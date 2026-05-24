// Service Worker MadinLive — Mode hors-ligne
const CACHE = 'madinlive-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  'https://fonts.googleapis.com/css2?family=Unbounded:wght@700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css',
  'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js',
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

  // Fonts, Mapbox CSS — Cache First
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
