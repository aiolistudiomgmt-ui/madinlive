// firebase-messaging-sw.js
// Service Worker MadinLive — Notifications Push
// Ce fichier DOIT être à la racine du site

importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC1oTME599olOExvAfo_03orh-8HBrXSi4",
  authDomain: "madinlive-fe6f5.firebaseapp.com",
  projectId: "madinlive-fe6f5",
  storageBucket: "madinlive-fe6f5.firebasestorage.app",
  messagingSenderId: "190026832681",
  appId: "1:190026832681:web:dbf683efca1c2d4cd9b538"
});

const messaging = firebase.messaging();

// Notif reçue en arrière-plan (appli fermée)
messaging.onBackgroundMessage(payload => {
  const { title, body, icon, data } = payload.notification || {};
  self.registration.showNotification(title || 'MadinLive 🌴', {
    body: body || 'Nouveau signalement sur l\'île',
    icon: icon || '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data || {},
    actions: [
      { action: 'open', title: 'Voir sur la carte' },
      { action: 'dismiss', title: 'Ignorer' }
    ]
  });
});

// Clic sur la notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('netlify.app') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('https://madinlive.netlify.app/');
    })
  );
});
