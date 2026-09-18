import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Clock, Check, ArrowRight, LogIn, Zap } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { fmtMin } from '../lib/format.js'
import { Button, Alert, cx } from '../ui/index.jsx'
import { Modal } from '../ui/Modal.jsx'
import { ServiceCard } from './Cards.jsx'
import { useToast } from '../ui/Toast.jsx'

/** Razorpay's hosted checkout, loaded on first use. */
const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve(window.Razorpay)
  const s = document.createElement('script')
  s.src = 'https://checkout.razorpay.com/v1/checkout.js'
  s.onload = () => resolve(window.Razorpay)
  s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."))
  document.head.appendChild(s)
})

/**
 * Join-queue flow: service → review → join → success. Rendered as a modal (bottom sheet on phones).
 * shop: summary with services/currentNumber/waitingCount/etaMinutes, and express {price, perHour, slotsLeft} when offered
 */
export function JoinQueueModal({ shop, open, onClose, onJoined }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [service, setService] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ticket, setTicket] = useState(null)
  const [express, setExpress] = useState(false)
  const hasServices = shop.services?.length > 0
  const offer = shop.express && shop.express.slotsLeft > 0 ? shop.express : null

  useEffect(() => { if (open) { setStep(hasServices ? 0 : 1); setService(null); setError(''); setTicket(null); setExpress(false) } }, [open, hasServices])

  async function finish(body) {
    const { ticket } = await api(`/api/queues/${shop._id}/join`, { method: 'POST', body })
    setTicket(ticket); setStep(2)
    toast.success(ticket.express ? 'Express slot booked.' : 'Queue joined successfully.', { description: `Your token is #${ticket.number}.` })
    onJoined?.(ticket)
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission() } catch {}
  }

  async function join() {
    setBusy(true); setError('')
    try {
      const body = { service: service?.name || '' }
      if (!express || !offer) return await finish(body)
      // express: create the order, pay in Razorpay's window, then join with the signed result
      const order = await api(`/api/queues/${shop._id}/express/order`, { method: 'POST' })
      const Razorpay = await loadRazorpay()
      await new Promise((resolve, reject) => {
        const rzp = new Razorpay({
          key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
          name: 'QueueLess', description: order.description, prefill: { name: user.name, email: user.email }, theme: { color: '#2f6bff' },
          handler: (res) => finish({ ...body, express: { orderId: res.razorpay_order_id, paymentId: res.razorpay_payment_id, signature: res.razorpay_signature } }).then(resolve, reject),
          modal: { ondismiss: () => reject(new Error('Payment cancelled. Your slot was not charged.')) },
        })
        rzp.on('payment.failed', (r) => reject(new Error(r.error?.description || 'Payment failed. You have not been charged.')))
        rzp.open()
      })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!user) {
    return (
      <Modal open={open} onClose={onClose} title="Join the queue" center>
        <p className="muted">Log in to take a token at <b>{shop.name}</b>. It takes ten seconds.</p>
        <div className="row gap-2 mt-4"><Button variant="primary" icon={LogIn} onClick={() => navigate('/login', { state: { from: `/shop/${shop._id}` } })}>Login</Button><Button variant="secondary" to="/register">Create account</Button></div>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={step === 2 ? () => { onClose(); navigate(`/t/${ticket._id}`) } : onClose} title={step === 2 ? null : step === 0 ? 'Select a service' : 'Join queue'} size={step === 2 ? undefined : 'lg'}>
      <AnimatePresence mode="wait" initial={false}>
        {step === 0 && (
          <motion.div key="s0" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="stack gap-3">
            <p className="muted small">What do you need at {shop.name}?</p>
            <div className="stack gap-2">{shop.services.map((s) => <ServiceCard key={s.name} s={s} selected={service?.name === s.name} onSelect={setService} />)}</div>
            <div className="row gap-2 mt-2" style={{ justifyContent: 'flex-end' }}><Button variant="primary" disabled={!service} onClick={() => setStep(1)}>Continue<ArrowRight aria-hidden /></Button></div>
          </motion.div>
        )}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="stack gap-4">
            <div className="join-review">
              <div><span className="eyebrow">Currently serving</span><b className="num">{shop.currentNumber == null ? '–' : `#${shop.currentNumber}`}</b></div>
              <div><span className="eyebrow">Waiting</span><b className="num">{shop.waitingCount}</b></div>
              <div><span className="eyebrow">Est. wait</span><b className="num">~{fmtMin(shop.etaMinutes)}</b></div>
            </div>
            {service && <div className="between card card-sm"><span className="stack"><span className="xs faint">Service</span><b>{service.name}</b></span>{hasServices && <Button variant="ghost" size="sm" onClick={() => setStep(0)}>Change</Button>}</div>}
            {offer && (
              <button type="button" className={cx('express-offer', express && 'on')} onClick={() => setExpress((v) => !v)} aria-pressed={express}>
                <span className="icon-box"><Zap aria-hidden /></span>
                <span className="stack grow" style={{ minWidth: 0 }}>
                  <b>Express slot · ₹{offer.price}</b>
                  <span className="xs muted">Go to the front of the line. {offer.slotsLeft} of {offer.perHour} left this hour — paid to the shop.</span>
                </span>
                <span className={cx('express-check', express && 'on')} aria-hidden><Check strokeWidth={3} /></span>
              </button>
            )}
            {error && <Alert tone="error">{error}</Alert>}
            <p className="small muted">You'll get a token instantly. Leave, do your thing, and come back when we tell you your turn is near.</p>
            <Button variant="primary" size="lg" block loading={busy} onClick={join}>{express && offer ? `Pay ₹${offer.price} & join` : 'Join Queue'}</Button>
          </motion.div>
        )}
        {step === 2 && ticket && (
          <motion.div key="s2" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} className="join-success">
            <motion.span className="success-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.05 }}><Check strokeWidth={3} aria-hidden /></motion.span>
            <h2>You're in.</h2>
            <span className="eyebrow">Your token</span>
            <motion.span className="token-hero gradient-text num" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>#{ticket.number}</motion.span>
            <div className="join-success-stats">
              <span><Users aria-hidden />{ticket.ahead} people ahead</span>
              <span><Clock aria-hidden />~{fmtMin(ticket.etaMinutes)}</span>
            </div>
            <p className="muted small" style={{ maxWidth: 300 }}>You can leave now. We'll notify you when your turn is approaching.</p>
            <Button variant="primary" size="lg" block className="mt-3" onClick={() => { onClose(); navigate(`/t/${ticket._id}`) }}>Track my queue<ArrowRight aria-hidden /></Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}
