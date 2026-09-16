import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Save, Wrench, GripVertical } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor } from './VendorContext.jsx'
import { Button, Field, Input, Alert, EmptyState, PageTransition } from '../../ui/index.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Services() {
  const { shop, shopId, setState } = useVendor()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [draft, setDraft] = useState({ name: '', minutes: 10 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (shop && list === null) setList(shop.services.map((s) => ({ name: s.name, minutes: s.minutes }))) }, [shop, list])
  if (!list) return null
  const dirty = JSON.stringify(list) !== JSON.stringify(shop.services.map((s) => ({ name: s.name, minutes: s.minutes })))

  function add(e) {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return
    if (list.some((s) => s.name.toLowerCase() === name.toLowerCase())) return setError('That service already exists.')
    setError(''); setList([...list, { name, minutes: Number(draft.minutes) || 5 }]); setDraft({ name: '', minutes: 10 })
  }
  async function save() {
    setBusy(true); setError('')
    try { setState(await api(`/api/queues/${shopId}`, { method: 'PATCH', body: { services: list } })); toast.success('Services saved.') } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <PageTransition className="stack gap-5" style={{ maxWidth: 760 }}>
      <div className="page-head" style={{ marginBottom: 0 }}><div><h1>Services</h1><p className="sub">Customers pick one when they join the queue or book.</p></div><Button variant="primary" icon={Save} loading={busy} disabled={!dirty} onClick={save}>Save</Button></div>
      <form onSubmit={add} className="card row gap-3 wrap" style={{ alignItems: 'flex-end' }}>
        <Field label="Service name" htmlFor="sv-name" className="grow"><Input id="sv-name" placeholder="General Consultation" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Minutes" htmlFor="sv-min" style={{ width: 110 }}><Input id="sv-min" type="number" min="1" value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} /></Field>
        <Button type="submit" variant="secondary" icon={Plus}>Add</Button>
      </form>
      {error && <Alert tone="error">{error}</Alert>}
      {list.length ? (
        <ul className="stack gap-2">
          <AnimatePresence initial={false}>
            {list.map((s, i) => (
              <motion.li key={s.name} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} className="card card-sm row gap-3">
                <GripVertical aria-hidden style={{ width: 16, color: 'var(--text-3)' }} />
                <b className="grow truncate">{s.name}</b>
                <label className="row gap-2 small muted">~<Input type="number" min="1" value={s.minutes} onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))} style={{ width: 76, height: 36 }} aria-label={`Minutes for ${s.name}`} />min</label>
                <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Remove ${s.name}`} onClick={() => setList(list.filter((_, j) => j !== i))} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : <EmptyState icon={Wrench} title="No services yet.">Add at least one so customers know what they're queuing for.</EmptyState>}
      {dirty && <Alert tone="info">You have unsaved changes.</Alert>}
    </PageTransition>
  )
}
