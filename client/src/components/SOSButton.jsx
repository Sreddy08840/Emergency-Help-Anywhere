import React, { useState } from 'react'
import { api } from '../services/api'

const EMERGENCY_TYPES = ['Medical', 'Vehicle Breakdown', 'Accident', 'Police']

export default function SOSButton({ onSosCreated }) {
  const [type, setType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function sendSos() {
    setError('')
    setMessage('')
    if (!type) {
      setError('Please choose an emergency type')
      return
    }
    if (!navigator.geolocation) {
      setError('Geolocation is not supported in this browser')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude
        const longitude = pos.coords.longitude
        try {
          const res = await api.post('/sos', { type, latitude, longitude })
          if (res.success) {
            setMessage('SOS sent successfully')
            if (res.sos && onSosCreated) {
              onSosCreated(res.sos)
            }
          } else {
            setError('Could not send SOS')
          }
        } catch (e) {
          setError(e.message || 'Could not send SOS')
        } finally {
          setLoading(false)
        }
      },
      () => {
        setError('Could not get your location')
        setLoading(false)
      }
    )
  }

  return (
    <div style={{ margin: '24px 0', padding: 16, border: '1px solid #f5c2c7', borderRadius: 8, background: '#fff5f5' }}>
      <h3>Need urgent help?</h3>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {message && <div style={{ color: 'green', marginBottom: 8 }}>{message}</div>}
      <div style={{ marginBottom: 12 }}>
        <label>
          Emergency type:{' '}
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Select type</option>
            {EMERGENCY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={sendSos}
        disabled={loading}
        style={{
          width: 160,
          height: 160,
          borderRadius: '50%',
          border: 'none',
          background: '#d32f2f',
          color: 'white',
          fontSize: 32,
          fontWeight: 'bold',
          cursor: loading ? 'default' : 'pointer',
          boxShadow: '0 0 12px rgba(0,0,0,0.3)',
        }}
      >
        {loading ? 'Sending...' : 'SOS'}
      </button>
    </div>
  )
}
