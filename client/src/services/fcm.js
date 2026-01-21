import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

let messaging
let swRegistration

export async function initFCM() {
  const supported = await isSupported()
  if (!supported) return
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }
  const app = initializeApp(firebaseConfig)
  messaging = getMessaging(app)
  // Register the service worker for background notifications (works on localhost or HTTPS)
  if ('serviceWorker' in navigator) {
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    } catch (e) {
      console.warn('Service worker registration failed', e)
    }
  }
  onMessage(messaging, (payload) => {
    // Basic in-page notification
    console.log('FCM message:', payload)
    alert(payload?.notification?.title || 'New notification')
  })
}

export async function getFcmToken() {
  if (!messaging) return null
  try {
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    })
    if (token) {
      console.log('FCM token:', token)
    }
    return token
  } catch (e) {
    console.warn('FCM getToken failed', e)
    return null
  }
}
