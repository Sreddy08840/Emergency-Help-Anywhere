import React, { useEffect, useState } from 'react'
import { api } from '../services/api'
import { sendHelperLocation, joinSosRoom, leaveSosRoom } from '../services/socket'

export default function HelperDashboard() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState(null)
  const [activeSosId, setActiveSosId] = useState(null)

  async function loadRequests() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/helpers/requests')
      setRequests(res.requests || [])
    } catch (e) {
      setError(e.message || 'Could not load SOS requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  async function handleAction(id, action) {
    setActionId(id)
    setError('')
    try {
      const res = await api.post(`/helpers/requests/${id}/${action}`, {})
      if (action === 'accept' && res.success && res.sos) {
        setActiveSosId(res.sos.id)
      }
      if (action === 'reject' && activeSosId === id) {
        setActiveSosId(null)
      }
      await loadRequests()
    } catch (e) {
      setError(e.message || 'Could not update SOS')
    } finally {
      setActionId(null)
    }
  }

  // When a helper has an active SOS assigned, send live location
  // updates every 5 seconds using the browser's geolocation API.
  useEffect(() => {
    if (!activeSosId) return
    if (!navigator.geolocation) {
      console.warn('Geolocation is not supported for helper tracking')
      return
    }

    joinSosRoom(activeSosId)

    const sendPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          sendHelperLocation({
            sosId: activeSosId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          })
        },
        (err) => {
          console.warn('Helper location error', err)
        },
        { enableHighAccuracy: true }
      )
    }

    // Send once immediately, then every 5 seconds.
    sendPosition()
    const id = setInterval(sendPosition, 5000)

    return () => {
      clearInterval(id)
      leaveSosRoom(activeSosId)
    }
  }, [activeSosId])

  async function closeActive() {
    if (!activeSosId) return
    setActionId(activeSosId)
    setError('')
    try {
      await api.post(`/helpers/requests/${activeSosId}/close`, {})
      setActiveSosId(null)
      await loadRequests()
    } catch (e) {
      setError(e.message || 'Could not close SOS')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div style={{ margin: '16px 0', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, marginRight: 'auto' }}>Helper Dashboard</h3>
        <button onClick={loadRequests} disabled={loading}>Refresh</button>
      </div>
      {activeSosId && (
        <div style={{ marginBottom: 8, padding: 8, background: '#f3f4ff', borderRadius: 4 }}>
          <span>Active SOS #{activeSosId}</span>
          <button
            type="button"
            onClick={closeActive}
            disabled={actionId === activeSosId}
            style={{ marginLeft: 8 }}
          >
            {actionId === activeSosId ? 'Closing...' : 'Mark resolved'}
          </button>
        </div>
      )}
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {loading && !requests.length && <div>Loading SOS requests...</div>}
      {!loading && !requests.length && <div>No incoming SOS requests.</div>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {requests.map((r) => (
          <li key={r.id} style={{ padding: 8, marginBottom: 6, border: '1px solid #eee', borderRadius: 4 }}>
            <div style={{ fontWeight: 'bold' }}>#{r.id} - {r.type}</div>
            <div>Location: {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</div>
            <div>Created: {new Date(r.created_at).toLocaleString()}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleAction(r.id, 'accept')}
                disabled={actionId === r.id}
              >
                {actionId === r.id ? 'Assigning...' : 'Accept'}
              </button>
              <button
                type="button"
                onClick={() => handleAction(r.id, 'reject')}
                disabled={actionId === r.id}
              >
                {actionId === r.id ? 'Updating...' : 'Reject'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
