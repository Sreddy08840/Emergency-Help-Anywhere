/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js')

// Firebase config is injected at build-time is not available here.
// For basic background handling, we initialize without config; messaging will still handle background events via registration scope.
// If needed, you can inline your Firebase config here for more advanced use-cases.

try {
  firebase.initializeApp({})
  const messaging = firebase.messaging()
  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || 'Emergency Alert'
    const options = {
      body: payload?.notification?.body || 'You have a new alert',
      icon: '/favicon.ico'
    }
    self.registration.showNotification(title, options)
  })
} catch (e) {
  // noop
}
