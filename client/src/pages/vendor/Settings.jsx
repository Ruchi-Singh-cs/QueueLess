import { useState } from 'react'
import { Save, Plus, Store, ExternalLink } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor, Onboarding } from './VendorContext.jsx'
import { useTheme } from '../../lib/theme.jsx'
import { Button, Field, Input, Select, Switch, Segmented, Alert, PageTransition } from '../../ui/index.jsx'
import { Modal } from '../../ui/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Settings() {
  const { shop, shops, shopId, setShopId, setState, onCreated } = useVendor()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const [avg, setAvg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [create, setCreate] = useState(false)
  if (!shop) return null
  const avgValue = avg ?? Math.round(shop.avgServiceMinutes * 10) / 10

  async function patch(body, msg) {
    setBusy(true)
    try { setState(await api(`/api/queues/${shopId}`, { method: 'PATCH', body })); toast.success(msg) } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <PageTransition className="stack gap-5" style={{ maxWidth: 760 }}>
      <div className="page-head" style={{ marginBottom: 0 }}><div><h1>Settings</h1><p className="sub">Queue behaviour and workspace.</p></div></div>
      <section className="card stack gap-4">
        <h3>Queue</h3>
        <div className="between wrap gap-3"><span className="stack"><b>Accepting customers</b><span className="small muted">Paused queues don't accept new tokens; you can still serve the people already in line.</span></span><Switch checked={shop.isOpen} onChange={(v) => patch({ isOpen: v }, v ? 'Queue opened.' : 'Queue paused.')} label="Queue open" /></div>
        <div className="divider" />
        <form className="between wrap gap-3" onSubmit={(e) => { e.preventDefault(); patch({ avgServiceMinutes: Number(avgValue) }, 'Average time saved.') }}>
          <span className="stack"><b>Average minutes per customer</b><span className="small muted">Used for wait estimates. QueueLess also learns this from real service times.</span></span>
          <div className="row gap-2"><Input type="number" min="0.5" step="0.5" value={avgValue} onChange={(e) => setAvg(e.target.value)} style={{ width: 96 }} aria-label="Average minutes" /><Button type="submit" variant="secondary" icon={Save} loading={busy} disabled={Number(avgValue) === shop.avgServiceMinutes}>Save</Button></div>
        </form>
      </section>
      <section className="card stack gap-4">
        <h3>Workspace</h3>
        {shops.length > 1 && <Field label="Active shop" htmlFor="st-shop"><Select id="st-shop" value={shopId} onChange={(e) => setShopId(e.target.value)}>{shops.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</Select></Field>}
        <div className="between wrap gap-3"><span className="stack"><b>Public page</b><span className="small muted">What customers see.</span></span><Button variant="secondary" size="sm" icon={ExternalLink} to={`/shop/${shopId}`}>Open shop page</Button></div>
        <div className="between wrap gap-3"><span className="stack"><b>Another location?</b><span className="small muted">Each shop has its own queue, services and map pin.</span></span><Button variant="secondary" size="sm" icon={Plus} onClick={() => setCreate(true)}>New shop</Button></div>
        <div className="divider" />
        <div className="between wrap gap-3"><span className="stack"><b>Appearance</b><span className="small muted">Dashboard theme.</span></span><Segmented label="Theme" value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} /></div>
      </section>
      <Alert tone="info" icon={Store}>Token numbers reset every day at midnight (UTC).</Alert>
      <Modal open={create} onClose={() => setCreate(false)} title="Create a new shop" size="lg"><Onboarding compact onCreated={(q) => { onCreated(q); setCreate(false) }} /></Modal>
    </PageTransition>
  )
}
