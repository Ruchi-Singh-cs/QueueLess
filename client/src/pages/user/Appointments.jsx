import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, MapPin } from 'lucide-react'
import { api } from '../../api.js'
import { useFetch } from '../../lib/hooks.js'
import { Button, Tabs, SkeletonCard, EmptyState, ErrorState, PageTransition, stagger } from '../../ui/index.jsx'
import { AppointmentCard } from '../../components/Cards.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Appointments() {
  const { data, loading, error, reload, setData } = useFetch('/api/appointments')
  const [tab, setTab] = useState('upcoming')
  const [busy, setBusy] = useState(null)
  const toast = useToast()
  const all = data?.appointments || []
  const now = new Date()
  const lists = {
    upcoming: all.filter((a) => (a.status === 'booked' || a.status === 'checked_in') && new Date(a.at) >= new Date(now.getTime() - 3600e3)),
    past: all.filter((a) => a.status === 'completed' || (a.status === 'booked' && new Date(a.at) < new Date(now.getTime() - 3600e3))).reverse(),
    cancelled: all.filter((a) => a.status === 'cancelled').reverse(),
  }

  async function cancel(a) {
    setBusy(a._id)
    try {
      const { appointment } = await api(`/api/appointments/${a._id}`, { method: 'PATCH', body: { status: 'cancelled' } })
      setData((d) => ({ appointments: d.appointments.map((x) => (x._id === a._id ? appointment : x)) }))
      toast.info('Appointment cancelled.')
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }

  return (
    <PageTransition className="container page">
      <div className="page-head">
        <div><h1>Appointments</h1><p className="sub">Book ahead and get a priority token when you check in.</p></div>
        <Button variant="primary" icon={MapPin} to="/nearby">Book an Appointment</Button>
      </div>
      <Tabs tabs={[{ value: 'upcoming', label: `Upcoming${lists.upcoming.length ? ` (${lists.upcoming.length})` : ''}` }, { value: 'past', label: 'Past' }, { value: 'cancelled', label: 'Cancelled' }]} value={tab} onChange={setTab} />
      <div className="mt-5">
        {loading ? <div className="grid grid-2">{[1, 2].map((i) => <SkeletonCard key={i} />)}</div>
          : error ? <ErrorState onRetry={reload}>We couldn't load your appointments.</ErrorState>
          : !lists[tab].length ? <EmptyState icon={CalendarDays} title={tab === 'upcoming' ? 'No upcoming appointments.' : `No ${tab} appointments.`} actions={tab === 'upcoming' && <Button variant="primary" to="/nearby">Book an Appointment</Button>}>{tab === 'upcoming' ? 'Pick a shop, choose a service, and reserve a time.' : null}</EmptyState>
          : <motion.div key={tab} className="grid grid-2" variants={stagger} initial="hidden" animate="show">{lists[tab].map((a) => <AppointmentCard key={a._id} a={a} onCancel={cancel} busy={busy === a._id} />)}</motion.div>}
      </div>
    </PageTransition>
  )
}
