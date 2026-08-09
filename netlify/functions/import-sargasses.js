// ═══════════════════════════════════════════════════════════
// MadinLive — Import sargasses via Netlify Function
// Contourne le blocage réseau NOAA des Edge Functions Supabase.
// Interroge NOAA/AOML ERDDAP (indice AFAI), calcule le niveau par plage, écrit dans Supabase.
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

// ATTENTION niveaux recalibrés : l'échelle AFAI réelle va d'environ -0.004 à 0.006
// (et non 0-1 comme le laissait supposer l'ancien code). Ces seuils sont une
// première approximation à partir de la colorBar officielle du dataset NOAA —
// à ajuster avec Olivier une fois qu'on a des observations de terrain pour comparer.
function afaiToNiveau(afai) {
  if (afai < 0.001) return 'libre';
  if (afai < 0.003) return 'modere';
  return 'alerte';
}

// Requête ERDDAP NOAA/AOML pour l'indice AFAI (Sargasses) autour d'un point
// Dataset réel (vérifié) : noaa_aoml_atlantic_oceanwatch_AFAI_7D sur cwcgom.aoml.noaa.gov
// (l'ancien code pointait vers un dataset inexistant sur coastwatch.pfeg.noaa.gov → 404 systématique)
async function fetchAfai(lat, lng) {
  const minLat = (lat - 0.2).toFixed(2);
  const maxLat = (lat + 0.2).toFixed(2);
  const minLng = (lng - 0.2).toFixed(2);
  const maxLng = (lng + 0.2).toFixed(2);
  // (last) = dernier pas de temps disponible, évite tout souci de décalage
  // de publication (le composite 7 jours n'est pas toujours dispo pour "hier")
  const url = `https://cwcgom.aoml.noaa.gov/erddap/griddap/noaa_aoml_atlantic_oceanwatch_AFAI_7D.json?` +
    `AFAI[(last)][(${minLat}):1:(${maxLat})][(${minLng}):1:(${maxLng})]`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.warn(`NOAA ${res.status} pour ${lat},${lng}`); return null; }
    const data = await res.json();
    const rows = data?.table?.rows || [];
    if (!rows.length) return 0;
    const values = rows.map((r) => r[3]).filter((v) => v !== null && !isNaN(v));
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  } catch (e) {
    console.warn(`ERDDAP error ${lat},${lng}: ${e.message}`);
    return null;
  }
}

exports.handler = async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Variables SUPABASE manquantes' }) };
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  let updated = 0, errors = 0;
  const results = [];

  for (const p of PLAGES) {
    try {
      const afai = await fetchAfai(p.lat, p.lng);
      if (afai === null) { console.warn(`${p.plage}: données indisponibles`); errors++; continue; }
      const niveau = afaiToNiveau(afai);
      const { error } = await sb.from('sargasses').upsert({
        plage: p.plage,
        commune: p.commune,
        niveau,
        source: SOURCE,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plage', ignoreDuplicates: false });
      if (error) { console.error(`${p.plage}: ${error.message}`); errors++; }
      else { updated++; results.push({ plage: p.plage, niveau, afai: afai.toFixed(4) }); }
    } catch (e) {
      console.error(`${p.plage}: ${e.message}`); errors++;
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: updated, errors, results, timestamp: new Date().toISOString() }),
  };
};
