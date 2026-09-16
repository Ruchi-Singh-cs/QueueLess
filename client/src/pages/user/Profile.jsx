import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, MapPin, Bell, Save } from 'lucide-react'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { useTheme } from '../../lib/theme.jsx'
import { readSavedLocation, saveLocation } from '../../lib/geo.js'
import { Button, Field, Input, Avatar, Badge, Segmented, PageTransition, Alert } from '../../ui/index.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Profile() {
  const { user, logout, updateUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const toast = useToast()
  const [name, setName] = useState(user.name)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loc, setLoc] = useState(readSavedLocation())

  async function save(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const body = { name }
      if (password) body.password = password
      const { user: u } = await api('/api/auth/me', { method: 'PATCH', body })
      updateUser(u); setPassword('')
      toast.success('Profile saved.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <PageTransition className="container page" style={{ maxWidth: 760 }}>
      <div className="page-head"><div><h1>Profile</h1><p className="sub">Your account and preferences.</p></div></div>
      <div className="card row gap-4 mb-4">
        <Avatar name={user.name} size="lg" />
        <div className="stack grow" style={{ minWidth: 0 }}><b style={{ fontSize: '1.125rem' }}>{user.name}</b><span className="muted small truncate">{user.email}</span></div>
        <Badge tone="primary">{user.role}</Badge>
      </div>
      <form onSubmit={save} className="card stack gap-4 mb-4">
        <h3>Account</h3>
        <Field label="Name" htmlFor="p-name"><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
        <Field label="New password" htmlFor="p-pass" hint="Leave blank to keep your current password."><Input id="p-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" /></Field>
        {error && <Alert tone="error">{error}</Alert>}
        <div><Button type="submit" variant="primary" icon={Save} loading={busy}>Save changes</Button></div>
      </form>
      <div className="card stack gap-4 mb-4">
        <h3>Preferences</h3>
        <div className="between wrap gap-3"><span className="stack"><b>Appearance</b><span className="small muted">Follows your system by default.</span></span>
          <Segmented label="Theme" value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />
        </div>
        <div className="divider" />
        <div className="between wrap gap-3"><span className="stack"><b className="row gap-2"><MapPin aria-hidden style={{ width: 16 }} />Saved location</b><span className="small muted">{loc ? loc.label || `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'Not set — ask on the Nearby page.'}</span></span>
          {loc ? <Button variant="secondary" size="sm" onClick={() => { saveLocation(null); setLoc(null); toast.info('Location cleared.') }}>Forget</Button> : <Button variant="secondary" size="sm" to="/nearby">Set location</Button>}
        </div>
        <div className="divider" />
        <div className="between wrap gap-3"><span className="stack"><b className="row gap-2"><Bell aria-hidden style={{ width: 16 }} />Browser alerts</b><span className="small muted">{typeof Notification === 'undefined' ? 'Not supported in this browser.' : `Permission: ${Notification.permission}`}</span></span>
          {typeof Notification !== 'undefined' && Notification.permission === 'default' && <Button variant="secondary" size="sm" onClick={() => Notification.requestPermission().then(() => toast.info('Updated.'))}>Enable</Button>}
        </div>
      </div>
      <Button variant="danger" icon={LogOut} onClick={() => { logout(); navigate('/') }}>Log out</Button>
    </PageTransition>
  )
}

