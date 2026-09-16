import { useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, CalendarDays, ArrowRight, Ticket, Search, History } from 'lucide-react'
import { isActive } from '../../api.js'
import { useAuth } from '../../auth.jsx'
import { useFetch, useQueueWatch, applyUpdate, useTicketUpdates } from '../../lib/hooks.js'
import { readSavedLocation, haversineKm, DEFAULT_CENTER } from '../../lib/geo.js'
import { greeting, fmtDate, fmtTime, timeAgo } from '../../lib/format.js'
import { Button, Badge, SkeletonCard, EmptyState, PageTransition, stagger, fadeUp } from '../../ui/index.jsx'
import { ShopCard, TokenCard } from '../../components/Cards.jsx'
import { useSearchPalette } from '../../components/SearchPalette.jsx'

export default function Home() {
  const { user } = useAuth()
  const palette = useSearchPalette()
  const me = readSavedLocation() || DEFAULT_CENTER
  const tickets = useFetch('/api/tokens/mine')
  const appts = useFetch('/api/appointments')
  const history = useFetch('/api/tokens/history')
  const nearby = useFetch('/api/queues/nearby', { query: { lat: me.lat, lng: me.lng, radius: 20 } })
  const [selected, setSelected] = useState(null)

  useTicketUpdates((t) => tickets.setData((d) => {
    const list = d?.tickets || []
    const next = isActive(t) ? (list.some((x) => x._id === t._id) ? list.map((x) => (x._id === t._id ? t : x)) : [t, ...list]) : list.filter((x) => x._id !== t._id)
    if (!isActive(t)) history.reload()
    return { tickets: next }
  }))
  const shops = (nearby.data?.queues || []).slice(0, 6)
  useQueueWatch(shops.map((s) => s._id), (u) => nearby.setData((d) => d && { ...d, queues: d.queues.map((s) => (s._id === u.queueId ? applyUpdate(s, u) : s)) }))

  const active = tickets.data?.tickets || []
  const upcoming = (appts.data?.appointments || []).filter((a) => a.status === 'booked' && new Date(a.at) > new Date()).slice(0, 3)

  return (
    <PageTransition className="container page">
      <div className="page-head">
        <div><span className="eyebrow">{greeting()}</span><h1>{user.name.split(' ')[0]}, {active.length ? "you're in line." : 'skip the wait today.'}</h1></div>
        <div className="row gap-2"><Button variant="secondary" icon={Search} onClick={palette.open} className="hide-mobile">Search</Button><Button variant="primary" icon={MapPin} to="/nearby">Find a Queue</Button></div>
      </div>

      <section className="mb-6">
        <div className="between mb-3"><h2 style={{ fontSize: '1.125rem' }}>My queue</h2>{active.length > 0 && <Button variant="ghost" size="sm" to="/queue">Open<ArrowRight aria-hidden /></Button>}</div>
        {tickets.loading ? <SkeletonCard /> : active.length ? (
          <motion.div className="grid grid-2" variants={stagger} initial="hidden" animate="show">{active.map((t) => <motion.div key={t._id} variants={fadeUp}><TokenCard ticket={t} /></motion.div>)}</motion.div>
        ) : (
          <EmptyState icon={Ticket} title="You're not in a queue." actions={<Button variant="primary" to="/nearby" icon={MapPin}>Find Nearby</Button>}>Find a nearby service and join a queue from your phone.</EmptyState>
        )}
      </section>

      <div className="home-grid">
        <section>
          <div className="between mb-3"><h2 style={{ fontSize: '1.125rem' }}>Near you</h2><Button variant="ghost" size="sm" to="/nearby">See all<ArrowRight aria-hidden /></Button></div>
          {nearby.loading ? <div className="grid grid-2">{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
            : shops.length ? <motion.div className="grid grid-2" variants={stagger} initial="hidden" animate="show">{shops.map((s) => <ShopCard key={s._id} shop={s} compact selected={selected === s._id} onSelect={setSelected} />)}</motion.div>
            : <EmptyState icon={MapPin} title="No services nearby yet." actions={<Button variant="secondary" to="/nearby">Set my location</Button>}>Allow location on the Nearby page to see live queues around you.</EmptyState>}
        </section>
        <aside className="stack gap-5">
          <section>
            <div className="between mb-3"><h2 style={{ fontSize: '1.125rem' }}>Upcoming</h2><Button variant="ghost" size="sm" to="/appointments">All<ArrowRight aria-hidden /></Button></div>
            {appts.loading ? <SkeletonCard lines={1} /> : upcoming.length ? (
              <div className="card stack">{upcoming.map((a) => (
                <div key={a._id} className="list-item"><span className="icon-box"><CalendarDays aria-hidden /></span><span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{a.queue?.name}</b><span className="small muted">{fmtDate(a.at)} · {fmtTime(a.at)}{a.service ? ` · ${a.service}` : ''}</span></span><Badge tone="booked">Confirmed</Badge></div>
              ))}</div>
            ) : <EmptyState icon={CalendarDays} title="No upcoming appointments." actions={<Button variant="secondary" size="sm" to="/nearby">Book an Appointment</Button>} />}
          </section>
          <section>
            <h2 className="mb-3" style={{ fontSize: '1.125rem' }}>Recent</h2>
            {history.loading ? <SkeletonCard lines={1} /> : history.data?.tickets?.length ? (
              <div className="card stack">{history.data.tickets.slice(0, 4).map((t) => (
                <div key={t._id} className="list-item"><span className="icon-box" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}><History aria-hidden /></span><span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{t.queue?.name}</b><span className="small muted">#{t.number} · {timeAgo(t.at)}</span></span><Badge tone={t.status}>{t.status}</Badge></div>
              ))}</div>
            ) : <p className="small muted">Your served tokens will show up here.</p>}
          </section>
        </aside>
      </div>
    </PageTransition>
  )
}

