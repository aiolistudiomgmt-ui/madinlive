// ═══════════════════════════════════════════════════════════
// MadinLive — Import sargasses via Netlify Function
// Contourne le blocage réseau NOAA des Edge Functions Supabase.
// Interroge NOAA/AOML ERDDAP (indice AFAI), calcule le niveau par plage, écrit dans Supabase.
// VERSION DIAGNOSTIC : remonte le détail de chaque erreur dans la réponse.
// ═══════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SOURCE = 'NOAA/AOML - USF AFAI';

// Plages principales de Martinique (côte atlantique surtout touchée)
const PLAGES = [
  { plage: 'Anse Mitan',           commune: 'Les Trois-Îlets',     lat: 14.5480, lng: -61.0580 },
  { plage: 'Plage des Salines',    commune: 'Sainte-Anne',         lat: 14.4080, lng: -60.8820 },
  { plage: "Grande Anse d'Arlet",  commune: "Les Anses-d'Arlet",   lat: 14.4890, lng: -61.0860 },
  { plage: 'Tartane',              commune: 'La Trinité',          lat: 14.7570, lng: -60.8940 },
  { plage: 'Pointe Faula',         commune: 'Le Vauclin',          lat: 14.5270, lng: -60.8430 },
  { plage: 'Plage du Diamant',     commune: 'Le Diamant',          lat: 14.4590, lng: -61.0170 },
  { plage: 'Anse Cafard',          commune: 'Le Diamant',          lat: 14.4490, lng: -61.0310 },
  { plage: 'Plage du Vauclin',     commune: 'Le Vauclin',          lat: 14.5530, lng: -60.8350 },
  { plage: 'Plage de Sainte-Anne', commune: 'Sainte-Anne',         lat: 14.4350, lng: -60.8850 },
  { plage: 'Plage de Sainte-Marie',commune: 'Sainte-Marie',        lat: 14.7860, lng: -61.0020 },
  { plage: 'Anse Noire',           commune: "Les Anses-d'Arlet",   lat: 14.4980, lng: -61.0710 },
  { plage: 'Anse Trabaud',         commune: 'Sainte-Anne',         lat: 14.4120, lng: -60.8540 },
  { plage: 'Cap Chevalier',        commune: 'Sainte-Anne',         lat: 14.4460, lng: -60.8180 },
];

// Seuils provisoires (échelle AFAI réelle ≈ -0.004 à 0.006) — à valider avec le terrain.
function afaiToNiveau(afai) {
  if (afai < 0.001) return 'libre';
  if (afai < 0.003) return 'modere';
  return 'alerte';
}

// Requête ERDDAP NOAA/AOML pour l'indice AFAI (Sargasses) autour d'un point.
// Retourne { afai, error } — error est null en cas de succès, sinon le détail exact.
async function fetchAfai(lat, lng) {
  const minLat = (lat - 0.2).toFixed(2);
  const maxLat = (lat + 0.2).toFixed(2);
  const minLng = (lng - 0.2).toFixed(2);
  const maxLng = (lng + 0.2).toFixed(2);
  const url = `https://cwcgom.aoml.noaa.gov/erddap/griddap/noaa_aoml_atlantic_oceanwatch_AFAI_7D.json?` +
    `AFAI[(last)][(${minLat}):1:(${maxLat})][(${minLng}):1:(${maxLng})]`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      let bodyText = '';
      try { bodyText = (await res.text()).slice(0, 300); } catch (_) {}
      return { afai: null, error: `HTTP ${res.status} — ${bodyText || 'pas de détail'}` };
    }
    const data = await res.json();
    const rows = data?.table?.rows || [];
    if (!rows.length) return { afai: 0, error: null };
    const values = rows.map((r) => r[3]).filter((v) => v !== null && !isNaN(v));
    if (!values.length) return { afai: 0, error: null };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { afai: avg, error: null };
  } catch (e) {
    clearTimeout(timer);
    return { afai: null, error: `${e.name || 'Error'}: ${e.message || String(e)}` };
  }
}

exports.handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Variables SUPABASE manquantes' }) };
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  let updated = 0, errors = 0;
  const results = [];
  const errorDetails = [];

  for (const p of PLAGES) {
    const { afai, error } = await fetchAfai(p.lat, p.lng);
    if (afai === null) {
      errors++;
      errorDetails.push({ plage: p.plage, reason: error });
      continue;
    }
    const niveau = afaiToNiveau(afai);
    const { error: sbError } = await sb.from('sargasses').upsert({
      plage: p.plage,
      commune: p.commune,
      lat: p.lat,
      lng: p.lng,
      niveau,
      source: SOURCE,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'plage', ignoreDuplicates: false });
    if (sbError) {
      errors++;
      errorDetails.push({ plage: p.plage, reason: `Supabase: ${sbError.message}` });
    } else {
      updated++;
      results.push({ plage: p.plage, niveau, afai: afai.toFixed(4) });
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: updated, errors, results, errorDetails, timestamp: new Date().toISOString() }),
  };
};
