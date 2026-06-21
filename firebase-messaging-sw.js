// ═══════════════════════════════════════════════════════════
// MADINLIVE — Service Worker Firebase Cloud Messaging
// Ce fichier DOIT être à la racine du domaine : /firebase-messaging-sw.js
// Sur Netlify : mettre dans le dossier /public ou à la racine
// ═══════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC1oTME599olOExvAfo_03orh-8HBrXSi4",
  authDomain: "madinlive-fe6f5.firebaseapp.com",
  projectId: "madinlive-fe6f5",
  storageBucket: "madinlive-fe6f5.firebasestorage.app",
  messagingSenderId: "190026832681",
  appId: "1:190026832681:web:dbf683efca1c2d4cd9b538"
});

const messaging = firebase.messaging();

// Gérer les notifications en arrière-plan (app fermée ou en background)
messaging.onBackgroundMessage(payload => {
  console.log('[MadinLive SW] Notification reçue en background:', payload);

  const { title, body, icon, image, click_action } = payload.notification || {};
  const data = payload.data || {};

  self.registration.showNotification(title || '🗺️ MadinLive', {
    body: body || 'Nouvelle alerte en Martinique',
    icon: icon || '/icons/icon-192x192.png',
    image: image || null,
    badge: '/icons/icon-72x72.png',
    tag: data.tag || 'madinlive-notif',
    data: { url: click_action || data.url || 'https://madinlive.netlify.app' },
    actions: [
      { action: 'open', title: 'Voir' },
      { action: 'close', title: 'Fermer' }
    ],
    vibrate: [200, 100, 200],
    requireInteraction: false
  });
});

// Ouvrir l'app au clic sur la notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;

  const url = event.notification.data?.url || 'https://madinlive.netlify.app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Si l'app est déjà ouverte, focus dessus
      for (const client of clientList) {
        if (client.url.includes('madinlive') && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon ouvrir un nouvel onglet
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
