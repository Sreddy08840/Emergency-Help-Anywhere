import { io } from 'socket.io-client'

// Reuse the same Socket.IO connection across the app.
const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: true,
})

export function joinSosRoom(sosId) {
  if (!sosId) return
  socket.emit('sos:join', { sosId })
}

export function leaveSosRoom(sosId) {
  if (!sosId) return
  socket.emit('sos:leave', { sosId })
}

// Helpers use this to send their live location for a specific SOS.
export function sendHelperLocation({ sosId, latitude, longitude }) {
  if (!sosId) return
  socket.emit('helper:location', { sosId, latitude, longitude })
}

export function onLocationUpdate(handler) {
  socket.on('location:update', handler)
}

export function offLocationUpdate(handler) {
  socket.off('location:update', handler)
}

export function onSosClosed(handler) {
  socket.on('sos:closed', handler)
}

export function offSosClosed(handler) {
  socket.off('sos:closed', handler)
}
