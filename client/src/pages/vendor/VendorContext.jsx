import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Store, ArrowRight } from 'lucide-react'
import { api } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { useQueueWatch } from '../../lib/hooks.js'
import { CATEGORIES } from '../../lib/format.js'
import { Button, Field, Input, Select, Textarea, Alert, Skeleton, ErrorState } from '../../ui/index.jsx'
import { useToast } from '../../ui/Toast.jsx'

const Ctx = createContext(null)
export const useVendor = () => useContext(Ctx)

/** Loads the vendor's shops, keeps the selected one's live QueueState fresh over Socket.IO. */
export function VendorProvider() {
  const { user } = useAuth()
  const [shops, setShops] = useState(null)
  const [error, setError] = useState('')
  const [shopId, setShopId] = useState(() => { try { return localStorage.getItem('queueless.vendor.shop') || '' } catch { return '' } })
  const [state, setState] = useState(null)

  const loadShops = useCallback(() => api('/api/queues').then((d) => {
    const mine = user.role === 'admin' ? d.queues : d.queues.filter((q) => q.owner === user._id)
    setShops(mine)
    setShopId((id) => (mine.some((s) => s._id === id) ? id : mine[0]?._id || ''))
  }).catch((e) => setError(e.message)), [user])
  useEffect(() => { loadShops() }, [loadShops])
  useEffect(() => { try { localStorage.setItem('queueless.vendor.shop', shopId) } catch {} }, [shopId])

  const loadState = useCallback(() => shopId ? api(`/api/queues/${shopId}`).then(setState).catch((e) => setError(e.message)) : Promise.resolve(), [shopId])
  useEffect(() => { setState(null); loadState() }, [loadState])
  // ponytail: full re-fetch on every queue:update; patch from the payload if it gets chatty
  useQueueWatch(shopId ? [shopId] : [], () => loadState())

  const value = useMemo(() => ({
    shops: shops || [], shopId, setShopId, state, shop: state?.queue,
    reload: () => Promise.all([loadShops(), loadState()]),
    setState,
    onCreated: (q) => { setShops((s) => [...(s || []), q]); setShopId(q._id) },
  }), [shops, shopId, state, loadShops, loadState])

  if (error && !shops) return <ErrorState onRetry={() => { setError(''); loadShops() }}>{error}</ErrorState>
  if (!shops) return <div className="stack gap-4"><Skeleton h={40} w={280} /><div className="grid grid-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={110} r={16} />)}</div><Skeleton h={300} r={16} /></div>
  if (!shops.length) return <Ctx.Provider value={value}><Onboarding onCreated={value.onCreated} /></Ctx.Provider>
  return <Ctx.Provider value={value}><Outlet /></Ctx.Provider>
}

/** First-run: create the shop. */
export function Onboarding({ onCreated, compact }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', category: 'medical', description: '', avgServiceMinutes: 5 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value })
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const { queue } = await api('/api/queues', { method: 'POST', body: { ...form, avgServiceMinutes: Number(form.avgServiceMinutes) || 5 } })
      toast.success('Shop created.', { description: 'Now add your location and services.' })
      onCreated(queue)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="onboard">
      {!compact && <div className="stack gap-3 mb-6"><span className="icon-box" style={{ width: 48, height: 48 }}><Store aria-hidden /></span><h1>Set up your shop</h1><p className="muted">Create your business and its live queue. You can add the map location, services and hours right after.</p></div>}
      <form onSubmit={submit} className={compact ? 'stack gap-4' : 'card stack gap-4'}>
        <Field label="Business name" htmlFor="ob-name"><Input id="ob-name" name="name" placeholder="Dr. Sharma Clinic" value={form.name} onChange={set} required /></Field>
        <div className="grid grid-2">
          <Field label="Category" htmlFor="ob-cat"><Select id="ob-cat" name="category" value={form.category} onChange={set}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
          <Field label="Avg. minutes per customer" htmlFor="ob-avg"><Input id="ob-avg" name="avgServiceMinutes" type="number" min="1" value={form.avgServiceMinutes} onChange={set} /></Field>
        </div>
        <Field label="Description" htmlFor="ob-desc"><Textarea id="ob-desc" name="description" placeholder="What do you do? Walk-ins welcome?" value={form.description} onChange={set} style={{ minHeight: 80 }} /></Field>
        {error && <Alert tone="error">{error}</Alert>}
        <div><Button type="submit" variant="primary" size="lg" loading={busy}>Create shop<ArrowRight aria-hidden /></Button></div>
      </form>
    </div>
  )
}
