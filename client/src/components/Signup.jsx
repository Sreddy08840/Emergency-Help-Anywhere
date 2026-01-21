import React, { useState } from 'react'
import { api } from '../services/api'

export default function Signup({ onRegistered, switchToLogin }) {
  const [form, setForm] = useState({ name: '', phone: '', role: 'user', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    if (!form.name.trim()) return 'Name is required'
    if (!/^[0-9\-\+\s]{7,15}$/.test(form.phone)) return 'Valid phone is required'
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Valid email required'
    if (!form.password || form.password.length < 6) return 'Password min 6 chars'
    if (!['user','helper'].includes(form.role)) return 'Invalid role'
    return ''
  }

  async function submit(e) {
    e.preventDefault()
    const v = validate()
    if (v) return setError(v)
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/register', form)
      onRegistered()
    } catch (e) {
      setError(e.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <h2>Sign up</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <input placeholder="Full name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} />
      <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} />
      <select value={form.role} onChange={e=>setForm({...form, role: e.target.value})}>
        <option value="user">User</option>
        <option value="helper">Helper</option>
      </select>
      <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
      <input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} />
      <button type="submit" disabled={loading}>{loading ? '...' : 'Create account'}</button>
      <button type="button" onClick={switchToLogin} style={{ background: 'transparent', border: 'none', color: '#06f', textDecoration: 'underline', cursor: 'pointer' }}>Have an account? Log in</button>
    </form>
  )
}
