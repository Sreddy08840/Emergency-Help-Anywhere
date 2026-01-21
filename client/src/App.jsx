import React, { useEffect, useState } from 'react'
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api'
import { api } from './services/api.js'
import { initFCM, getFcmToken } from './services/fcm.js'
import Login from './components/Login.jsx'
import Signup from './components/Signup.jsx'
import SOSButton from './components/SOSButton.jsx'
import HelperDashboard from './components/HelperDashboard.jsx'
import AdminPanel from './components/AdminPanel.jsx'
import { joinSosRoom, leaveSosRoom, onLocationUpdate, offLocationUpdate, onSosClosed, offSosClosed } from './services/socket'

const containerStyle = { width: '100%', height: '400px' }

export default function App() {
  const [center, setCenter] = useState({ lat: 37.7749, lng: -122.4194 })
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [mode, setMode] = useState('login')
  const [activeSosId, setActiveSosId] = useState(null)
  const [helperLocation, setHelperLocation] = useState(null)

  useEffect(() => {
    // Geolocate
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
    }
    // Init FCM
    initFCM().then(() => getFcmToken()).catch(() => {})
  }, [])

  // Subscribe to live helper location updates for the active SOS.
  useEffect(() => {
    if (!activeSosId) {
      return
    }

    joinSosRoom(activeSosId)

    const handleLocation = (msg) => {
      if (msg.sosId !== activeSosId) return
      setHelperLocation({ lat: msg.latitude, lng: msg.longitude })
    }

    const handleClosed = (msg) => {
      if (msg.sosId !== activeSosId) return
      setActiveSosId(null)
      setHelperLocation(null)
      leaveSosRoom(activeSosId)
    }

    onLocationUpdate(handleLocation)
    onSosClosed(handleClosed)

    return () => {
      offLocationUpdate(handleLocation)
      offSosClosed(handleClosed)
      leaveSosRoom(activeSosId)
    }
  }, [activeSosId])

  function onLoginSuccess(res) {
    setToken(res.token)
    setUser(res.user)
  }

  function handleSosCreated(sos) {
    setActiveSosId(sos.id)
  }

  async function loadAlerts() {
    const data = await api.get('/alerts')
    setAlerts(data)
  }

  async function sendAlert() {
    const res = await api.post('/alerts', {
      title: 'Need Help',
      description: 'Auto-generated alert',
      lat: center.lat,
      lng: center.lng,
    })
    setAlerts((prev) => [res, ...prev])
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1>Emergency Help Anywhere</h1>
      {!token ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {mode === 'login' ? (
            <Login onSuccess={onLoginSuccess} switchToSignup={() => setMode('signup')} />
          ) : (
            <Signup onRegistered={() => setMode('login')} switchToLogin={() => setMode('login')} />
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{ marginRight: 'auto' }}>
            <strong>{user?.name || user?.email}</strong> {user?.role ? `(${user.role})` : ''}
          </div>
          <button onClick={loadAlerts}>Load Alerts</button>
          <button onClick={sendAlert}>Send Alert</button>
          <button onClick={() => { localStorage.removeItem('token'); setToken(''); setUser(null); }}>Logout</button>
        </div>
      )}

      {token && user?.role === 'admin' && <AdminPanel />}

      {token && user?.role === 'helper' && <HelperDashboard />}

      {token && <SOSButton onSosCreated={handleSosCreated} />}

      <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
        <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13}>
          <Marker position={center} />
          {helperLocation && (
            <Marker position={helperLocation} label="H" />
          )}
          {alerts.map((a) => (
            <Marker key={a.id} position={{ lat: a.lat, lng: a.lng }} />
          ))}
        </GoogleMap>
      </LoadScript>

      <div>
        <h3>Recent Alerts</h3>
        <ul>
          {alerts.map((a) => (
            <li key={a.id}>{a.title} @ {a.lat.toFixed(4)}, {a.lng.toFixed(4)} - {new Date(a.created_at).toLocaleString()}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
