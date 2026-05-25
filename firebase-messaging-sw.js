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

// Notif reçue en arrière-plan
messaging.onBackgroundMessage(payload => {
  const n = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(n.title || 'MadinLive 🌴', {
    body: n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.volet || 'madinlive',
    data: { url: data.url || 'https://madinlive.netlify.app/' }
  });
});

// Clic sur la notif → ouvrir l'app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || 'https://madinlive.netlify.app/';
  e.waitUntil(clients.openWindow(url));
});
