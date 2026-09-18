import { useState } from 'react'
import { Save, Plus, Store, ExternalLink, Zap } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor, Onboarding } from './VendorContext.jsx'
import { useTheme } from '../../lib/theme.jsx'
import { Button, Field, Input, Select, Switch, Segmented, Alert, PageTransition } from '../../ui/index.jsx'
import { Modal } from '../../ui/Modal.jsx'
import { useToast } from '../../ui/Toast.jsx'

/** An inline "number + Save" settings row. Declared out here so typing never remounts the input. */
function NumberRow({ name, label, hint, saved, unit, min, max, step = 1, msg, draft, setDraft, save, busy }) {
  const value = draft[name] ?? saved
  const dirty = Number(value) !== saved && value !== ''
  return (
    <form className="between wrap gap-3" onSubmit={(e) => { e.preventDefault(); save({ [name]: Number(value) }, msg, name) }}>
      <span className="stack"><b>{label}</b><span className="small muted">{hint}</span></span>
      <div className="row gap-2">
        <Input type="number" min={min} max={max} step={step} value={value} onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))} style={{ width: 92 }} aria-label={label} />
        {unit && <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{unit}</span>}
        <Button type="submit" variant="secondary" icon={Save} loading={busy} disabled={!dirty}>Save</Button>
      </div>
    </form>
  )
}

export default function Settings() {
  const { shop, shops, shopId, setShopId, setState, onCreated, state } = useVendor()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [create, setCreate] = useState(false)
  if (!shop) return null

  async function patch(body, msg, clear) {
    setBusy(true)
    try {
      setState(await api(`/api/queues/${shopId}`, { method: 'PATCH', body }))
      if (clear) setDraft((d) => ({ ...d, [clear]: undefined }))
      toast.success(msg)
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const rowProps = { draft, setDraft, save: patch, busy }
  const ex = state?.expressConfig || {}

  return (
    <PageTransition className="stack gap-5" style={{ maxWidth: 760 }}>
      <div className="page-head" style={{ marginBottom: 0 }}><div><h1>Settings</h1><p className="sub">Queue behaviour and workspace.</p></div></div>
      <section className="card stack gap-4">
        <h3>Queue</h3>
        <div className="between wrap gap-3"><span className="stack"><b>Accepting customers</b><span className="small muted">Paused queues don't accept new tokens; you can still serve the people already in line.</span></span><Switch checked={shop.isOpen} onChange={(v) => patch({ isOpen: v }, v ? 'Queue opened.' : 'Queue paused.')} label="Queue open" /></div>
        <div className="divider" />
        <NumberRow name="avgServiceMinutes" label="Average minutes per customer" hint="Used for wait estimates. QueueLess also learns this from real service times."
          saved={Math.round(shop.avgServiceMinutes * 10) / 10} unit="min" min={0.5} step={0.5} msg="Average time saved." {...rowProps} />
        <div className="divider" />
        <NumberRow name="counters" label="Counters" hint="How many customers you can serve at once. Each counter calls its own token, and waits are divided between them."
          saved={shop.counters || 1} unit={(shop.counters || 1) === 1 ? 'desk' : 'desks'} min={1} max={20} msg="Counters updated." {...rowProps} />
        <div className="divider" />
        <NumberRow name="graceMinutes" label="No-show grace period" hint="How long a called customer has to reach the counter before they're skipped automatically. Set 0 to turn it off and skip by hand."
          saved={shop.graceMinutes || 0} unit="min" min={0} max={60} msg="Grace period updated." {...rowProps} />
      </section>
      {shop.category !== 'government' && (
        <section className="card stack gap-4">
          <div className="row gap-2"><Zap aria-hidden style={{ width: 18, color: 'var(--warning)' }} /><h3>Express slots</h3></div>
          <p className="small muted">Sell a limited number of front-of-line tokens each hour. Everyone else's wait stays predictable because the cap is visible to them. Paid through Razorpay to you.</p>
          {!state?.paymentsEnabled && <Alert tone="info">Payments aren't configured on this server yet — set <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> to offer express slots.</Alert>}
          <div className="between wrap gap-3"><span className="stack"><b>Offer express slots</b><span className="small muted">Customers see the price and how many are left before they pay.</span></span><Switch checked={!!ex.enabled} onChange={(v) => patch({ express: { enabled: v } }, v ? 'Express slots on.' : 'Express slots off.')} label="Express slots" /></div>
          <div className="divider" />
          <NumberRow name="expressPrice" label="Price per slot" hint="Whole rupees. Set this before switching the offer on." saved={ex.price ?? 0} unit="₹" min={0} msg="Price saved." {...rowProps} save={(b, m, c) => patch({ express: { price: Number(b.expressPrice) } }, m, c)} />
          <div className="divider" />
          <NumberRow name="expressPerHour" label="Slots per hour" hint="The cap. Two or three keeps the regular queue honest." saved={ex.perHour ?? 2} unit="/ hour" min={1} max={20} msg="Cap saved." {...rowProps} save={(b, m, c) => patch({ express: { perHour: Number(b.expressPerHour) } }, m, c)} />
        </section>
      )}
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
