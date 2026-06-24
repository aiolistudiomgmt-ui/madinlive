// ═══════════════════════════════════════════════════════════
// MADINLIVE — Bot Telegram « Routes de Martinique »
// Déployé sur Render.com — tourne h24
// ═══════════════════════════════════════════════════════════

const http = require("http");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { createClient } = require("@supabase/supabase-js");

// ════════════ SERVEUR HTTP (obligatoire pour Render Web Service) ════════════
// Render tue tout Web Service qui n'ouvre pas de port. Ce mini-serveur
// répond juste "OK" pour que Render considère le service comme vivant.
const PORT = process.env.PORT || 3000;
let botStatus = "demarrage";
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("MadinLive Bot — " + botStatus + " — " + new Date().toISOString());
}).listen(PORT, () => {
  console.log(`🌐 Serveur HTTP en écoute sur le port ${PORT} (Render keep-alive)`);
});
// ═════════════════════════════════════════════════════════════

// ════════════ VARIABLES D'ENVIRONNEMENT (Render) ════════════
const apiId    = parseInt(process.env.TELEGRAM_API_ID);
const apiHash  = process.env.TELEGRAM_API_HASH;
const SESSION  = process.env.TELEGRAM_SESSION;
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GROQ_KEY             = process.env.GROQ_KEY;
// ═════════════════════════════════════════════════════════════

const GROUP_CHAT_ID = -1001210197966;
const SCORE_MINIMUM = 35;
const MAX_AGE_MS    = 24 * 60 * 60 * 1000;
const SOURCE_NAME   = "Routes Martinique";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ═══ DICTIONNAIRE MARTINIQUAIS ═══
const JARGON = {
  chef:"controle_police", chefs:"controle_police", gendarme:"controle_police",
  gendarmerie:"controle_police", flic:"controle_police", flics:"controle_police",
  "contrôle":"controle_police", controle:"controle_police", radar:"radar",
  bouchon:"bouchon", bouchons:"bouchon", "bloqué":"bouchon", bloquer:"bouchon",
  bloke:"bouchon", embouteillage:"bouchon", ralenti:"bouchon", "pa bougé":"bouchon",
  "pas bougé":"bouchon", accident:"accident", choc:"accident", collision:"accident",
  tonbe:"accident", "tombé":"accident", "viré":"accident", "renversé":"accident",
  travaux:"travaux", chantier:"travaux", "route coupée":"route_coupee",
  "wout koupe":"route_coupee", "route koupe":"route_coupee",
  inondation:"inondation", "inonné":"inondation", glissement:"glissement",
  tremblement:"seisme", tranbleman:"seisme", houle:"houle", "mer forte":"houle",
};

const LIEUX = {
  "stade pierre aliker":{commune:"Fort-de-France",coords:[14.6082,-61.0736]},
  chu:{commune:"Fort-de-France",coords:[14.6117,-61.0689]},
  "maternité":{commune:"Fort-de-France",coords:[14.6117,-61.0689]},
  "hôpital":{commune:"Fort-de-France",coords:[14.6117,-61.0689]},
  desclieux:{commune:"Fort-de-France",coords:[14.6117,-61.0689]},
  dillon:{commune:"Fort-de-France",coords:[14.598,-61.082]},
  bocage:{commune:"Fort-de-France",coords:[14.605,-61.065]},
  "la galleria":{commune:"Le Lamentin",coords:[14.6142,-60.9953]},
  mangot:{commune:"Le Lamentin",coords:[14.61,-60.98]},
  acajou:{commune:"Le Lamentin",coords:[14.6133,-61.0067]},
  "belle rose":{commune:"Le Lamentin",coords:[14.605,-61.02]},
  "croix rivail":{commune:"Le Lamentin",coords:[14.595,-60.99]},
  batir:{commune:"La Trinité",coords:[14.738,-60.972]},
  "rond point de batir":{commune:"La Trinité",coords:[14.738,-60.972]},
  "bois thibault":{commune:"Le Lamentin",coords:[14.608,-60.985]},
  galion:{commune:"La Trinité",coords:[14.745,-60.96]},
  "trinité":{commune:"La Trinité",coords:[14.7411,-60.9683]},
  "le robert":{commune:"Le Robert",coords:[14.6833,-60.9333]},
  "les salines":{commune:"Sainte-Anne",coords:[14.4167,-60.8667]},
  "sainte anne":{commune:"Sainte-Anne",coords:[14.4333,-60.8833]},
  "le marin":{commune:"Le Marin",coords:[14.4667,-60.9]},
  "le diamant":{commune:"Le Diamant",coords:[14.4667,-61.0167]},
  "saint pierre":{commune:"Saint-Pierre",coords:[14.7333,-61.1833]},
  godissard:{commune:"Fort-de-France",coords:[14.62,-61.07]},
  schoelcher:{commune:"Schoelcher",coords:[14.6167,-61.1]},
  "le lamentin":{commune:"Le Lamentin",coords:[14.6167,-61.0]},
  "rivière salée":{commune:"Rivière-Salée",coords:[14.5167,-60.95]},
  "rivière pilote":{commune:"Rivière-Pilote",coords:[14.4833,-60.9]},
  "sainte marie":{commune:"Sainte-Marie",coords:[14.7833,-61.0167]},
  "le francois":{commune:"Le François",coords:[14.6167,-60.8833]},
  "le vauclin":{commune:"Le Vauclin",coords:[14.55,-60.8333]},
  "gros morne":{commune:"Gros-Morne",coords:[14.6833,-61.05]},
  n1:{commune:"Fort-de-France",coords:[14.61,-61.05]},
  n2:{commune:"Schoelcher",coords:[14.62,-61.08]},
  n3:{commune:"Le Lamentin",coords:[14.61,-61.01]},
  n5:{commune:"Rivière-Salée",coords:[14.52,-60.96]},
  fdf:{commune:"Fort-de-France",coords:[14.6082,-61.0736]},
};

function analyserMessage(texte, msgDate, hasPhoto) {
  const t = (texte||"").toLowerCase();
  let score=0, type="info_route", commune="Martinique", coords=null;
  const ageMin = (Date.now() - msgDate*1000)/60000;
  if(ageMin<120) score+=10;
  if(hasPhoto) score+=20;
  for(const [mot,typ] of Object.entries(JARGON)) { if(t.includes(mot)){score+=15;type=typ;break;} }
  for(const [lieu,info] of Object.entries(LIEUX)) {
    if(t.includes(lieu)){score+=lieu.length>8?35:20;commune=info.commune;coords=info.coords;break;}
  }
  const communes=["fort-de-france","lamentin","trinité","robert","marin","schoelcher",
    "sainte-marie","français","vauclin","diamant","saint-pierre","sainte-anne",
    "rivière-salée","rivière-pilote","gros-morne"];
  for(const c of communes){ if(t.includes(c)){score+=15;if(!coords)commune=c.split("-").map(w=>w[0].toUpperCase()+w.slice(1)).join("-");break;} }
  if(/urgent|attention|prudence|danger|grave|blessé|victime/.test(t)) score+=10;
  if(t.length<15) score-=20;
  if(t.length<5&&!hasPhoto) score-=30;
  return {score:Math.max(0,score),type,commune,coords};
}

async function analyserAvecIA(texte, scoring) {
  if(!texte||texte.length<5) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{Authorization:`Bearer ${GROQ_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"llama-3.3-70b-versatile", max_tokens:200,
        messages:[
          {role:"system",content:`Tu es un expert du trafic routier martiniquais. Tu analyses des messages du groupe Telegram "LES ROUTES DE MARTINIQUE". Réponds UNIQUEMENT en JSON sans markdown. Créole : "chef"=gendarme/police, "bloke"=bloqué, "wout koupe"=route coupée, "tonbe"=accident, "pa bougé"=bouchon. Commune détectée : ${scoring.commune}. Type détecté : ${scoring.type}.`},
          {role:"user",content:`Message: "${texte}"\nRéponds avec: {"est_alerte":bool,"titre":"string court","type":"accident|bouchon|travaux|controle_police|radar|inondation|route_coupee|danger|info_route","urgence":"haute|normale|faible","commune":"string"}`},
        ],
      }),
    });
    const data=await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content?.replace(/```json|```/g,"").trim());
  } catch(e) { console.log("⚠️ Groq erreur:",e.message); return null; }
}

async function traiterMessage(msg) {
  const texte=msg.message||"";
  const hasPhoto=!!(msg.photo||(msg.media&&msg.media.photo));
  const msgDate=msg.date;
  if((Date.now()-msgDate*1000)>MAX_AGE_MS) return;
  const scoring=analyserMessage(texte,msgDate,hasPhoto);
  console.log(`📊 Score ${scoring.score} | "${texte.slice(0,50)}"`);
  if(scoring.score<SCORE_MINIMUM){console.log(`❌ Rejeté (score ${scoring.score})`);return;}
  const analyse=await analyserAvecIA(texte,scoring);
  if(!analyse?.est_alerte){console.log("❌ Rejeté par IA");return;}
  const commune=analyse.commune||scoring.commune;
  const coords=scoring.coords;
  const pubMs=msgDate*1000;
  const row={
    type:analyse.type||scoring.type,
    description:texte.slice(0,500),
    commune, source:SOURCE_NAME, pseudo:SOURCE_NAME,
    is_official:true, url_source:`https://t.me/c/1210197966/${msg.id}`,
    lat:coords?.[0]||null, lng:coords?.[1]||null,
    created_at:new Date(pubMs).toISOString(),
    expires_at:new Date(pubMs+MAX_AGE_MS).toISOString(),
  };
  const {error}=await sb.from("signalements").upsert(row,{onConflict:"url_source",ignoreDuplicates:true});
  if(error) console.log("❌ Insert error:",error.message);
  else console.log(`✅ PUBLIÉ: "${analyse.titre}" | ${commune} | ${row.type}`);
}

// ═══ KEEPALIVE ═══
setInterval(()=>{ console.log(`💓 keepalive ${new Date().toISOString()}`); }, 5*60*1000);

// ═══ DÉMARRAGE ═══
(async()=>{
  if(!SESSION||SESSION==="COLLE_TA_SESSION_ICI"){
    console.log("⚠️ Variable TELEGRAM_SESSION manquante dans Render."); 
    botStatus = "erreur: SESSION manquante";
    return; // ne PAS process.exit — garde le serveur HTTP vivant pour Render
  }
  console.log("Connexion à Telegram...");
  const client=new TelegramClient(new StringSession(SESSION),apiId,apiHash,{connectionRetries:10});
  await client.connect();
  botStatus = "en ecoute du groupe";
  console.log("✅ Connecté. En écoute du groupe LES ROUTES DE MARTINIQUE...\n");
  client.addEventHandler(async(event)=>{
    const msg=event.message; if(!msg) return;
    await traiterMessage(msg);
  }, new NewMessage({chats:[GROUP_CHAT_ID]}));

  // Reconnexion automatique si déconnecté
  setInterval(async()=>{
    if(!client.connected){
      console.log("🔄 Reconnexion...");
      botStatus = "reconnexion...";
      try { await client.connect(); botStatus="en ecoute du groupe"; console.log("✅ Reconnecté."); }
      catch(e){ console.log("❌ Reconnexion échouée:",e.message); }
    }
  }, 30*1000);
})();
