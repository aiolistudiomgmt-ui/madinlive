// Service Worker MadinLive — Mode hors-ligne
const CACHE = 'madinlive-v2';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  'https://fonts.googleapis.com/css2?family=Unbounded:wght@700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://api.mapbox.com/mapbox-gl-js/v3.26.0/mapbox-gl.css',
  'https://api.mapbox.com/mapbox-gl-js/v3.26.0/mapbox-gl.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Installation — cache les assets essentiels
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_ASSETS.filter(u => !u.startsWith('https://api.mapbox'))))
  );
  self.skipWaiting();
});

// Activation — nettoie les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — stratégie Cache First pour assets, Network First pour API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API Supabase — Network First avec fallback cache
  if(url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Ressources DYNAMIQUES Mapbox : jamais mises en cache.
  // Les glyphes (/fonts/), sprites, tuiles et styles étaient capturés par la
  // règle "Cache First" ci-dessous et servis indéfiniment. Un glyphe mis en
  // cache incomplet corrompt ensuite TOUS les labels de la carte (texte illisible
  // sur les noms de communes, écussons routiers, chiffres des clusters) —
  // et aucun changement de style ou de version ne peut le corriger, puisque
  // l'appareil ne redemande jamais la ressource.
  if(url.hostname.includes('mapbox.com') &&
     /\/(fonts|sprite|styles|v4|tiles|raster|models)\//.test(url.pathname)) {
    return; // laisser passer au réseau, sans interception
  }

  // Fonts Google, bibliothèque Mapbox (JS/CSS versionnés) — Cache First
  if(url.hostname.includes('fonts.googleapis') || url.hostname.includes('mapbox.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }))
    );
    return;
  }

  // Page principale — Network First
  if(url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request) || caches.match('/'))
    );
  }
});
