// ═══════════════════════════════════════════════════════════
// MadinLive — Service Worker Firebase Cloud Messaging
// Gère les notifications push reçues quand l'app est fermée ou en arrière-plan.
// Doit être servi à la racine du domaine : https://madinlive.netlify.app/firebase-messaging-sw.js
// (même version de SDK que celle chargée dans madinlive.html : 10.11.0)
// ═══════════════════════════════════════════════════════════

importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

// Même config que FB_CONFIG dans madinlive.html
firebase.initializeApp({
  apiKey: "AIzaSyC1oTME599olOExvAfo_03orh-8HBrXSi4",
  authDomain: "madinlive-fe6f5.firebaseapp.com",
  projectId: "madinlive-fe6f5",
  storageBucket: "madinlive-fe6f5.firebasestorage.app",
  messagingSenderId: "190026832681",
  appId: "1:190026832681:web:50c91765250ad98dd9b538"
});

const messaging = firebase.messaging();

// Notification reçue alors que l'app est fermée ou en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'MadinLive';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    tag: payload.data?.volet || 'madinlive'
  };
  self.registration.showNotification(title, options);
});

// Clic sur la notification → ouvre (ou remet au premier plan) l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
