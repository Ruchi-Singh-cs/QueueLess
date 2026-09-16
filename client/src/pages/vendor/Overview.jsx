import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Ticket, CheckCircle2, Clock, ArrowRight, Play, CalendarDays, MapPin, Wrench } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor } from './VendorContext.jsx'
import { useFetch } from '../../lib/hooks.js'
import { greeting, fmtMin, fmtTime, fmtAddress } from '../../lib/format.js'
import { Button, Badge, LiveDot, StatCard, Switch, Skeleton, EmptyState, PageTransition, Alert, stagger, fadeUp } from '../../ui/index.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Overview() {
  const { shop, state, shopId, setState } = useVendor()
  const toast = useToast()
  const stats = useFetch(`/api/queues/${shopId}/stats`, { deps: [state?.queue?.currentNumber, state?.waiting?.length] })
  const appts = useFetch('/api/appointments', { query: { queue: shopId } })
  const [busy, setBusy] = useState(false)
  const today = (appts.data?.appointments || []).filter((a) => a.status !== 'cancelled' && new Date(a.at).toDateString() === new Date().toDateString())

  async function toggleOpen(v) {
    try { setState(await api(`/api/queues/${shopId}`, { method: 'PATCH', body: { isOpen: v } })); toast.info(v ? 'Queue is open.' : 'Queue paused.') } catch (e) { toast.error(e.message) }
  }
  async function next() {
    setBusy(true)
    try { setState(await api(`/api/queues/${shopId}/next`, { method: 'POST' })) } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (!shop) return <div className="stack gap-4"><Skeleton h={40} w={280} /><div className="grid grid-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={110} r={16} />)}</div></div>
  const setupMissing = [!shop.location && ['Set your map location', '/vendor/location', MapPin], !shop.services?.length && ['Add your services', '/vendor/services', Wrench], !fmtAddress(shop.address) && ['Complete your shop profile', '/vendor/shop', CalendarDays]].filter(Boolean)

  return (
    <PageTransition className="stack gap-6">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><span className="eyebrow">{greeting()}.</span><h1 className="row gap-3 wrap">{shop.name}<Badge tone={shop.isOpen ? 'open' : 'closed'} size="lg"><LiveDot off={!shop.isOpen} />{shop.isOpen ? 'Online' : 'Paused'}</Badge></h1></div>
        <div className="row gap-3"><label className="row gap-2 small muted">Accepting customers<Switch checked={shop.isOpen} onChange={toggleOpen} label="Queue open" /></label><Button variant="primary" icon={Play} loading={busy} onClick={next} disabled={!state.current && !state.waiting.length}>Next</Button></div>
      </div>

      {setupMissing.length > 0 && (
        <Alert tone="info"><div className="between wrap gap-3"><span><b>Finish setting up.</b> {setupMissing.length} step{setupMissing.length > 1 ? 's' : ''} left so customers can find you.</span><div className="row gap-2 wrap">{setupMissing.map(([t, to, I]) => <Button key={to} variant="soft" size="sm" to={to} icon={I}>{t}</Button>)}</div></div></Alert>
      )}

      <motion.div className="grid grid-4" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp}><StatCard label="Current token" value={state.current ? `#${state.current.number}` : '–'} sub={state.current?.user?.name || 'Nobody being served'} icon={Ticket} accent animated={false} /></motion.div>
        <motion.div variants={fadeUp}><StatCard label="Waiting" value={state.waiting.length} sub={`~${fmtMin(shop.etaMinutes)} total wait`} icon={Users} /></motion.div>
        <motion.div variants={fadeUp}><StatCard label="Served today" value={stats.data?.served ?? 0} sub={`${stats.data?.skipped ?? 0} skipped · ${stats.data?.left ?? 0} left`} icon={CheckCircle2} /></motion.div>
        <motion.div variants={fadeUp}><StatCard label="Average wait" value={stats.data?.served ? fmtMin(stats.data.avgWaitMinutes) : '–'} sub={`~${fmtMin(shop.avgServiceMinutes)} per customer`} icon={Clock} animated={false} /></motion.div>
      </motion.div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="between mb-4"><h3>Waiting now</h3><Button variant="ghost" size="sm" to="/vendor/queue">Open queue screen<ArrowRight aria-hidden /></Button></div>
          {state.waiting.length ? (
            <div className="list">{state.waiting.slice(0, 6).map((t, i) => (
              <div key={t._id} className="list-item"><span className="tl-num" style={{ width: 52 }}>#{t.number}</span><span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{t.user?.name}</b><span className="small muted">{t.service || 'Walk-in'}{i === 0 ? ' · next up' : ''}</span></span>{t.priority && <Badge tone="priority">Priority</Badge>}</div>
            ))}{state.waiting.length > 6 && <p className="small muted mt-3">+{state.waiting.length - 6} more</p>}</div>
          ) : <EmptyState icon={Users} title="Nobody waiting.">Customers who join from their phones will show up here instantly.</EmptyState>}
        </section>
        <section className="card">
          <div className="between mb-4"><h3>Today's appointments</h3><Button variant="ghost" size="sm" to="/vendor/appointments">All<ArrowRight aria-hidden /></Button></div>
          {appts.loading ? <Skeleton h={80} /> : today.length ? (
            <div className="list">{today.map((a) => (
              <div key={a._id} className="list-item"><span className="num strong" style={{ width: 72 }}>{fmtTime(a.at)}</span><span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{a.user?.name}</b><span className="small muted">{a.service || a.note || 'Appointment'}</span></span><Badge tone={a.status}>{a.status.replace('_', ' ')}</Badge></div>
            ))}</div>
          ) : <EmptyState icon={CalendarDays} title="No appointments today." />}
        </section>
      </div>
    </PageTransition>
  )
}
