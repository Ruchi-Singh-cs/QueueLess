import { useState } from 'react'
import { Navigate, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Store, ArrowRight } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { roleHome } from '../lib/format.js'
import { Button, Field, Input, Alert, Logo, LiveDot, Badge } from '../ui/index.jsx'

export default function Login({ register = false }) {
  const { user, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', password: '', role: params.get('role') === 'staff' ? 'staff' : 'user' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={location.state?.from || roleHome(user.role)} replace />
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const body = register ? form : { email: form.email, password: form.password }
      const data = await api(`/api/auth/${register ? 'register' : 'login'}`, { method: 'POST', body })
      login(data)
      navigate(location.state?.from || roleHome(data.user.role), { replace: true })
    } catch (err) { setError(err.message); setBusy(false) }
  }

  return (
    <div className="auth">
      <div className="auth-side">
        <div className="auth-side-bg bg-grid" aria-hidden />
        <Logo />
        <div className="auth-side-copy">
          <h2>Skip the wait.</h2>
          <p className="muted">Join queues remotely and arrive only when your turn is near.</p>
          <div className="auth-mini">
            <div className="between"><b>Dr. Sharma Clinic</b><Badge tone="open"><LiveDot />Open</Badge></div>
            <div className="row gap-5 mt-3"><span className="stack"><span className="eyebrow">Serving</span><b className="num" style={{ fontSize: '1.5rem' }}>#21</b></span><span className="stack"><span className="eyebrow">Your token</span><b className="num gradient-text" style={{ fontSize: '1.5rem' }}>#27</b></span><span className="stack"><span className="eyebrow">ETA</span><b className="num" style={{ fontSize: '1.5rem' }}>35 min</b></span></div>
          </div>
        </div>
        <span className="xs faint">© QueueLess</span>
      </div>
      <motion.div className="auth-form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="only-mobile mb-5"><Logo /></div>
        <h1>{register ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted mt-2">{register ? 'Take tokens, book appointments, and track queues live.' : 'Log in to see your queues and appointments.'}</p>
        <form onSubmit={submit} className="stack gap-4 mt-6" noValidate>
          {register && (
            <Field label="Full name" htmlFor="name"><div className="input-wrap"><User aria-hidden /><Input id="name" name="name" placeholder="Aarav Sharma" value={form.name} onChange={set} required autoComplete="name" /></div></Field>
          )}
          <Field label="Email" htmlFor="email"><div className="input-wrap"><Mail aria-hidden /><Input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={set} required autoComplete="email" /></div></Field>
          <Field label="Password" htmlFor="password" hint={register ? 'At least 6 characters' : undefined}><div className="input-wrap"><Lock aria-hidden /><Input id="password" name="password" type="password" placeholder="••••••••" value={form.password} onChange={set} required minLength={6} autoComplete={register ? 'new-password' : 'current-password'} /></div></Field>
          {register && (
            <fieldset className="role-pick">
              <legend className="label">I am a…</legend>
              {[['user', 'Customer', 'Join queues and book appointments', User], ['staff', 'Business', 'Manage a shop and its live queue', Store]].map(([v, t, d, Icon]) => (
                <label key={v} className={`role-opt${form.role === v ? ' selected' : ''}`}>
                  <input type="radio" name="role" value={v} checked={form.role === v} onChange={set} className="sr-only" />
                  <span className="icon-box"><Icon aria-hidden /></span><span className="stack"><b>{t}</b><span className="xs muted">{d}</span></span>
                </label>
              ))}
            </fieldset>
          )}
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" variant="primary" size="lg" block loading={busy}>{register ? 'Create account' : 'Login'}<ArrowRight aria-hidden /></Button>
        </form>
        <p className="muted small mt-5 center">
          {register ? <>Have an account? <Link to="/login" state={location.state}>Login</Link></> : <>New to QueueLess? <Link to="/register" state={location.state}>Create an account</Link></>}
        </p>
      </motion.div>
    </div>
  )
}
