import { useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor } from './VendorContext.jsx'
import { useFetch, useQueueWatch } from '../../lib/hooks.js'
import { Tabs, SkeletonCard, EmptyState, ErrorState, PageTransition, stagger } from '../../ui/index.jsx'
import { AppointmentCard } from '../../components/Cards.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function VendorAppointments() {
  const { shopId } = useVendor()
  const toast = useToast()
  const { data, loading, error, reload, setData } = useFetch('/api/appointments', { query: { queue: shopId } })
  useQueueWatch([shopId], reload)
  const [tab, setTab] = useState('today')
  const [busy, setBusy] = useState(null)
  const all = data?.appointments || []
  const isToday = (d) => new Date(d).toDateString() === new Date().toDateString()
  const lists = {
    today: all.filter((a) => isToday(a.at) && a.status !== 'cancelled'),
    upcoming: all.filter((a) => !isToday(a.at) && new Date(a.at) > new Date() && a.status === 'booked'),
    past: all.filter((a) => (new Date(a.at) < new Date() && !isToday(a.at)) || a.status === 'completed' || a.status === 'cancelled').reverse(),
  }
  async function setStatus(a, status) {
    setBusy(a._id)
    try {
      const { appointment } = await api(`/api/appointments/${a._id}`, { method: 'PATCH', body: { status } })
      setData((d) => ({ appointments: d.appointments.map((x) => (x._id === a._id ? appointment : x)) }))
      toast.success(status === 'checked_in' ? `Checked in — token #${appointment.token?.number}.` : status === 'completed' ? 'Marked completed.' : 'Appointment cancelled.')
    } catch (e) { toast.error(e.message) } finally { setBusy(null) }
  }
  return (
    <PageTransition>
      <div className="page-head"><div><h1>Appointments</h1><p className="sub">Check customers in to give them a priority token.</p></div></div>
      <Tabs tabs={[{ value: 'today', label: `Today${lists.today.length ? ` (${lists.today.length})` : ''}` }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} />
      <div className="mt-5">
        {loading ? <div className="grid grid-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
          : error ? <ErrorState onRetry={reload}>We couldn't load appointments.</ErrorState>
          : !lists[tab].length ? <EmptyState icon={CalendarDays} title={`No ${tab === 'today' ? 'appointments today' : `${tab} appointments`}.`}>Customers book from your shop page.</EmptyState>
          : <motion.div key={tab} className="grid grid-3" variants={stagger} initial="hidden" animate="show">{lists[tab].map((a) => <AppointmentCard key={a._id} a={a} staff busy={busy === a._id} onCheckIn={(x) => setStatus(x, 'checked_in')} onComplete={(x) => setStatus(x, 'completed')} onCancel={(x) => setStatus(x, 'cancelled')} />)}</motion.div>}
      </div>
    </PageTransition>
  )
}
