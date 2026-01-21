import React, { useState } from 'react'
import { api } from '../services/api'

export default function Login({ onSuccess, switchToSignup }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Valid email required'
    if (!form.password || form.password.length < 6) return 'Password min 6 chars'
    return ''
  }

  async function submit(e) {
    e.preventDefault()
    const v = validate()
    if (v) return setError(v)
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', form)
      localStorage.setItem('token', res.token)
      onSuccess(res)
    } catch (e) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
      <h2>Login</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <input placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
      <input placeholder="Password" type="password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} />
      <button type="submit" disabled={loading}>{loading ? '...' : 'Login'}</button>
      <button type="button" onClick={switchToSignup} style={{ background: 'transparent', border: 'none', color: '#06f', textDecoration: 'underline', cursor: 'pointer' }}>Need an account? Sign up</button>
    </form>
  )
}
