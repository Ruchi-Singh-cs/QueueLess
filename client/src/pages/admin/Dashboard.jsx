import { motion } from 'framer-motion'
import { Users, Store, ListOrdered, Ticket, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useFetch, useQueueWatch } from '../../lib/hooks.js'
import { num, timeAgo, category } from '../../lib/format.js'
import { StatCard, Badge, Skeleton, ErrorState, PageTransition, Button, LiveDot, stagger, fadeUp, cx } from '../../ui/index.jsx'
import { BarChart } from '../../components/Chart.jsx'

const day = (d) => new Date(d).toLocaleDateString([], { weekday: 'short' })
export const series = (rows) => rows.map((r) => ({ label: day(r.day), full: r.day, value: r.count }))

export function useAdminStats() {
  const s = useFetch('/api/admin/stats')
  useQueueWatch((s.data?.shops || []).map((x) => x._id), () => s.reload())
  return s
}

export default function Dashboard() {
  const { data, loading, error, reload } = useAdminStats()
  if (error) return <ErrorState onRetry={reload}>We couldn't load the dashboard.</ErrorState>
  if (loading && !data) return <div className="stack gap-5"><div className="grid grid-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={110} r={16} />)}</div><Skeleton h={260} r={16} /></div>
  return (
    <PageTransition className="stack gap-6">
      <div className="page-head" style={{ marginBottom: 0 }}><div><h1>Dashboard</h1><p className="sub">Platform overview · live.</p></div></div>
      <motion.div className="grid grid-4" variants={stagger} initial="hidden" animate="show">
        <motion.div variants={fadeUp}><StatCard label="Users" value={data.users} icon={Users} sub={`+${data.usersPerDay.at(-1)?.count ?? 0} today`} /></motion.div>
        <motion.div variants={fadeUp}><StatCard label="Businesses" value={data.businesses} icon={Store} sub={data.pendingShops ? `${data.pendingShops} awaiting approval` : `${data.activeQueues} accepting customers`} /></motion.div>
        <motion.div variants={fadeUp}><StatCard label="Active queues" value={data.activeQueues} icon={ListOrdered} sub={`${data.shops.reduce((a, s) => a + s.waitingCount, 0)} people waiting`} accent /></motion.div>
        <motion.div variants={fadeUp}><StatCard label="Today's tokens" value={data.todaysTokens} icon={Ticket} sub={`${data.todaysAppointments} appointments today`} /></motion.div>
      </motion.div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card"><div className="between mb-4"><div><h3>Token activity</h3><p className="small muted">Tokens issued per day, last 7 days.</p></div></div><BarChart data={series(data.tokensPerDay)} ariaLabel="Tokens per day" height={150} format={(v) => `${num(v)} tokens`} /></section>
        <section className="card"><div className="between mb-4"><div><h3>User growth</h3><p className="small muted">New sign-ups per day, last 7 days.</p></div></div><BarChart data={series(data.usersPerDay)} ariaLabel="New users per day" height={150} format={(v) => `${num(v)} users`} /></section>
      </div>
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="between mb-4"><h3>Active shops</h3><Button variant="ghost" size="sm" to="/admin/queues">All queues<ArrowRight aria-hidden /></Button></div>
          <div className="list">{data.shops.slice(0, 6).map((s) => {
            const cat = category(s.category)
            return <div key={s._id} className="list-item"><span className={cx('icon-box', s.category)}><cat.icon aria-hidden /></span><span className="stack grow" style={{ minWidth: 0 }}><Link to={`/shop/${s._id}`} className="strong truncate" style={{ color: 'inherit' }}>{s.name}</Link><span className="small muted">Serving {s.currentNumber != null ? `#${s.currentNumber}` : '–'} · {s.waitingCount} waiting</span></span><Badge tone={s.isOpen ? 'open' : 'closed'}>{s.isOpen ? <><LiveDot />Open</> : 'Closed'}</Badge></div>
          })}{!data.shops.length && <p className="muted small">No shops yet.</p>}</div>
        </section>
        <section className="card">
          <div className="between mb-4"><h3>Recent activity</h3></div>
          <div className="list">{data.recent.map((t) => (
            <div key={t._id} className="list-item"><span className="tl-num" style={{ width: 56 }}>#{t.number}</span><span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{t.user?.name || 'Customer'} · {t.queue?.name || 'Shop'}</b><span className="small muted">{timeAgo(t.at)}</span></span><Badge tone={t.status}>{t.status}</Badge></div>
          ))}{!data.recent.length && <p className="muted small">Nothing yet.</p>}</div>
        </section>
      </div>
    </PageTransition>
  )
}

