// ═══════════════════════════════════════════════════════════
// MadinLive — Import sargasses via Netlify Function
// Contourne le blocage réseau NOAA des Edge Functions Supabase.
// Interroge NOAA ERDDAP, calcule le niveau par plage, écrit dans Supabase.
// ═══════════════════════════════════════════════════════════

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SOURCE = 'Copernicus Marine';

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

function afaiToNiveau(afai) {
  if (afai < 0.15) return 'libre';
  if (afai < 0.40) return 'modere';
  return 'alerte';
}

// Requête ERDDAP NOAA pour l'indice sargasses autour d'un point
async function fetchAfai(lat, lng) {
  const minLat = (lat - 0.2).toFixed(2);
  const maxLat = (lat + 0.2).toFixed(2);
  const minLng = (lng - 0.2).toFixed(2);
  const maxLng = (lng + 0.2).toFixed(2);
  // Données satellite J-1
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/noaa_aoml_sargassum_composite_7day.json?` +
    `sargassum_density[(${yesterday}T00:00:00Z)][(${minLat}):1:(${maxLat})][(${minLng}):1:(${maxLng})]`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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
