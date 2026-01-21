import React, { useEffect, useState } from 'react'
import { api } from '../services/api'

export default function AdminPanel() {
  const [sos, setSos] = useState([])
  const [helpers, setHelpers] = useState([])
  const [tab, setTab] = useState('sos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [sosRes, helpersRes] = await Promise.all([
        api.get('/admin/sos'),
        api.get('/admin/helpers'),
      ])
      setSos(sosRes.sos || [])
      setHelpers(helpersRes.helpers || [])
    } catch (e) {
      setError(e.message || 'Could not load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function toggleBlock(helper, blocked) {
    setLoading(true)
    setError('')
    try {
      const path = blocked ? 'unblock' : 'block'
      await api.post(`/admin/helpers/${helper.id}/${path}`, {})
      await loadData()
    } catch (e) {
      setError(e.message || 'Could not update helper')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ margin: '16px 0', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setTab('sos')} disabled={tab === 'sos'}>SOS Requests</button>
        <button onClick={() => setTab('helpers')} disabled={tab === 'helpers'}>Helpers</button>
        <button onClick={loadData} disabled={loading} style={{ marginLeft: 'auto' }}>Refresh</button>
      </div>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {tab === 'sos' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>User</th>
                <th>Created</th>
                <th>Response (s)</th>
                <th>Helper</th>
              </tr>
            </thead>
            <tbody>
              {sos.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.type}</td>
                  <td>{s.status}</td>
                  <td>{s.user_name || s.user_id}</td>
                  <td>{new Date(s.created_at).toLocaleString()}</td>
                  <td>{s.response_seconds != null ? Math.round(s.response_seconds) : '-'}</td>
                  <td>{s.helper_name || s.helper_id || '-'}</td>
                </tr>
              ))}
              {!sos.length && !loading && (
                <tr><td colSpan={7}>No SOS requests found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'helpers' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Available</th>
                <th>Blocked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {helpers.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>{h.name}</td>
                  <td>{h.email}</td>
                  <td>{h.role}</td>
                  <td>{h.available ? 'Yes' : 'No'}</td>
                  <td>{h.blocked ? 'Yes' : 'No'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => toggleBlock(h, h.blocked)}
                      disabled={loading}
                    >
                      {h.blocked ? 'Unblock' : 'Block'}
                    </button>
                  </td>
                </tr>
              ))}
              {!helpers.length && !loading && (
                <tr><td colSpan={7}>No helpers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
