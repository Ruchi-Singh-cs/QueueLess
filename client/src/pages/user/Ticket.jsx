import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Clock, MapPin, Navigation, Bell, LogOut, Check, Ticket as TicketIcon, PartyPopper } from 'lucide-react'
import { api } from '../../api.js'
import { useFetch, useTicketUpdates, useQueueWatch } from '../../lib/hooks.js'
import { directionsUrl } from '../../lib/geo.js'
import { fmtMin, category } from '../../lib/format.js'
import { Button, Badge, LiveDot, AnimatedNumber, Skeleton, ErrorState, EmptyState, PageTransition, Alert, cx } from '../../ui/index.jsx'
import { Modal } from '../../ui/Modal.jsx'
import { QueueTimeline } from '../../components/Cards.jsx'
import { useToast } from '../../ui/Toast.jsx'

const FINAL = {
  served: { title: 'Service completed.', body: 'Thanks for using QueueLess.', icon: PartyPopper },
  skipped: { title: 'Your token was skipped.', body: 'Ask at the counter to be called again, or take a new token.', icon: TicketIcon },
  left: { title: 'You left the queue.', body: 'You can join again any time.', icon: LogOut },
}

/** /queue → the user's active ticket (or an empty state). */
export function MyQueue() {
  const { data, loading, error, reload } = useFetch('/api/tokens/mine')
  if (loading) return <div className="container page"><Skeleton h={320} r={16} /></div>
  if (error) return <div className="container page"><ErrorState onRetry={reload}>We couldn't load your queue.</ErrorState></div>
  const t = data.tickets[0]
  if (t) return <Navigate to={`/t/${t._id}`} replace />
  return (
    <PageTransition className="container page">
      <div className="page-head"><div><h1>My queue</h1><p className="sub">Your live token, position and estimated wait.</p></div></div>
      <EmptyState icon={TicketIcon} title="You're not in a queue." actions={<Button variant="primary" to="/nearby" icon={MapPin}>Find Nearby</Button>}>Find a nearby service and join a queue.</EmptyState>
    </PageTransition>
  )
}

export default function Ticket() {
  const { tokenId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'denied' : Notification.permission)

  useEffect(() => { api(`/api/tokens/${tokenId}`).then((d) => setTicket(d.ticket)).catch((e) => setError(e.message)) }, [tokenId])
  useTicketUpdates((t) => { if (t._id === tokenId) setTicket(t) })
  // refresh waiting numbers (timeline) on any queue change too
  useQueueWatch(ticket ? [ticket.queue._id] : [], (u) => setTicket((t) => t && { ...t, currentNumber: u.currentNumber, waitingNumbers: u.waitingNumbers, queue: { ...t.queue, isOpen: u.isOpen, avgServiceMinutes: u.avgServiceMinutes } }))

  async function leave() {
    setLeaving(true)
    try {
      setTicket((await api(`/api/tokens/${tokenId}`, { method: 'DELETE' })).ticket)
      toast.info('Queue left.')
      setConfirm(false)
    } catch (e) { setError(e.message) } finally { setLeaving(false) }
  }

  if (error && !ticket) return <div className="container page"><ErrorState onRetry={() => navigate(0)}>{error}</ErrorState></div>
  if (!ticket) return <div className="container page ticket-page"><Skeleton h={120} r={16} /><Skeleton h={220} r={16} className="mt-4" /></div>

  const done = FINAL[ticket.status]
  const serving = ticket.status === 'serving'
  const near = ticket.status === 'waiting' && ticket.ahead <= 2
  const cat = category(ticket.queue.category)

  return (
    <PageTransition className="container page ticket-page">
      <div className="ticket-head">
        <div className="row gap-3" style={{ minWidth: 0 }}>
          <span className={cx('icon-box', ticket.queue.category)}><cat.icon aria-hidden /></span>
          <div style={{ minWidth: 0 }}><Link to={`/shop/${ticket.queue._id}`} className="ticket-shop truncate">{ticket.queue.name}</Link><div className="small muted">{ticket.service || cat.label}{ticket.priority && <> · <Badge tone="priority">Priority</Badge></>}</div></div>
        </div>
        {done ? <Badge tone={ticket.status}>{ticket.status}</Badge> : <Badge tone={serving ? 'success' : 'open'} size="lg"><LiveDot />{serving ? 'Your turn' : 'LIVE'}</Badge>}
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" className="card ticket-final" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="success-check" style={{ background: ticket.status === 'served' ? undefined : 'var(--surface-3)', color: ticket.status === 'served' ? undefined : 'var(--text-2)' }}><done.icon aria-hidden /></span>
            <h2>{done.title}</h2>
            <p className="muted">{done.body}</p>
            <span className="eyebrow mt-3">Token</span><span className="num" style={{ fontSize: '2rem', fontWeight: 700 }}>#{ticket.number}</span>
            <div className="row gap-2 wrap mt-4" style={{ justifyContent: 'center' }}><Button variant="primary" to="/nearby" icon={MapPin}>Find another queue</Button><Button variant="secondary" to="/app">Home</Button></div>
          </motion.div>
        ) : (
          <motion.div key="live" className="ticket-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className={cx('card ticket-main', serving && 'is-serving')}>
              {serving && <Alert tone="success" icon={Check} className="mb-4"><b>It's your turn.</b> Please go to the counter now.</Alert>}
              {near && !serving && <Alert tone="warning" icon={Bell} className="mb-4"><b>Get ready.</b> Only {ticket.ahead} {ticket.ahead === 1 ? 'person' : 'people'} ahead — head back now.</Alert>}
              <span className="eyebrow">Your token</span>
              <span className="token-hero gradient-text num"><AnimatedNumber value={ticket.number} prefix="#" /></span>
              <div className="ticket-stats">
                <div><span className="stat-label">Currently serving</span><span className="stat-value">{ticket.currentNumber == null ? '–' : <AnimatedNumber value={ticket.currentNumber} prefix="#" />}</span></div>
                <div><span className="stat-label"><Users aria-hidden />Ahead</span><span className="stat-value"><AnimatedNumber value={ticket.ahead} /></span></div>
                <div><span className="stat-label"><Clock aria-hidden />Estimated</span><span className="stat-value">{serving ? 'Now' : <AnimatedNumber value={ticket.etaMinutes} suffix=" min" />}</span></div>
              </div>
              <div className="progress mt-4" aria-hidden><motion.span animate={{ width: `${serving ? 100 : Math.max(6, 100 - Math.min(96, ticket.ahead * 12))}%` }} transition={{ duration: 0.5 }} /></div>
              <p className="small muted mt-3">{serving ? 'Show this token at the counter.' : "You can leave now. We'll notify you when your turn is approaching."}</p>
              <div className="row gap-2 wrap mt-4">
                {perm === 'default' && <Button variant="secondary" size="sm" icon={Bell} onClick={() => Notification.requestPermission().then(setPerm)}>Enable notifications</Button>}
                {ticket.queue.location && <Button variant="secondary" size="sm" icon={Navigation} href={directionsUrl(ticket.queue.location, ticket.queue.name)} target="_blank" rel="noreferrer">Get Directions</Button>}
                {ticket.status === 'waiting' && <Button variant="danger" size="sm" icon={LogOut} onClick={() => setConfirm(true)}>Leave Queue</Button>}
              </div>
              {error && <Alert tone="error" className="mt-3">{error}</Alert>}
            </div>
            <aside className="card">
              <div className="between mb-4"><h3>Queue timeline</h3><span className="small muted">{ticket.waitingNumbers?.length ?? 0} waiting</span></div>
              <QueueTimeline currentNumber={ticket.currentNumber} waitingNumbers={ticket.waitingNumbers || []} mine={ticket.status === 'waiting' ? ticket.number : null} />
              {serving && <p className="small muted mt-3">You're being served right now.</p>}
            </aside>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Leave the queue?" center footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Stay</Button><Button variant="danger" loading={leaving} onClick={leave}>Leave Queue</Button></>}>
        <p className="muted">You'll lose token <b>#{ticket.number}</b> at {ticket.queue.name}. You can join again later, but you'll get a new number.</p>
      </Modal>
    </PageTransition>
  )
}

