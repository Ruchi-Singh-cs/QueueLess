import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ArrowRight, CalendarDays, Clock } from 'lucide-react'
import { api } from '../api.js'
import { fmtDate, fmtTime } from '../lib/format.js'
import { Button, Field, Input, Textarea, Alert, cx } from '../ui/index.jsx'
import { Modal } from '../ui/Modal.jsx'
import { ServiceCard } from './Cards.jsx'
import { useToast } from '../ui/Toast.jsx'

const pad = (n) => String(n).padStart(2, '0')
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

/** Book: service → date → time → confirm. Slots are 30-min within the shop's hours. */
export function BookAppointmentModal({ shop, open, onClose }) {
  const toast = useToast()
  const navigate = useNavigate()
  const hasServices = shop.services?.length > 0
  const [step, setStep] = useState(0)
  const [service, setService] = useState(null)
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  useEffect(() => { if (open) { setStep(hasServices ? 0 : 1); setService(null); setDate(todayStr()); setTime(''); setNote(''); setError(''); setDone(null) } }, [open, hasServices])

  const slots = useMemo(() => {
    const [oh, om] = (shop.hours?.open || '09:00').split(':').map(Number), [ch, cm] = (shop.hours?.close || '18:00').split(':').map(Number)
    const out = []
    const now = new Date()
    for (let m = oh * 60 + (om || 0); m < ch * 60 + (cm || 0); m += 30) {
      const t = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
      const when = new Date(`${date}T${t}:00`)
      if (when > now) out.push(t)
    }
    return out
  }, [shop.hours, date])

  async function confirm() {
    setBusy(true); setError('')
    try {
      const at = new Date(`${date}T${time}:00`).toISOString()
      const { appointment } = await api('/api/appointments', { method: 'POST', body: { queue: shop._id, at, service: service?.name || '', note } })
      setDone(appointment)
      toast.success('Appointment booked.', { description: `${fmtDate(appointment.at)} at ${fmtTime(appointment.at)}` })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const titles = ['Select a service', 'Pick a date & time', 'Confirm appointment']
  return (
    <Modal open={open} onClose={onClose} title={done ? null : titles[step]} size="lg">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" className="join-success" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.span className="success-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}><Check strokeWidth={3} aria-hidden /></motion.span>
            <h2>Booked.</h2>
            <p className="muted">{shop.name}{done.service ? ` · ${done.service}` : ''}</p>
            <div className="join-success-stats"><span><CalendarDays aria-hidden />{fmtDate(done.at)}</span><span><Clock aria-hidden />{fmtTime(done.at)}</span></div>
            <p className="small muted" style={{ maxWidth: 320 }}>When you arrive, the counter checks you in and you get a priority token.</p>
            <Button variant="primary" size="lg" block className="mt-3" onClick={() => { onClose(); navigate('/appointments') }}>View my appointments<ArrowRight aria-hidden /></Button>
          </motion.div>
        ) : step === 0 ? (
          <motion.div key="s0" className="stack gap-3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            <div className="stack gap-2">{shop.services.map((s) => <ServiceCard key={s.name} s={s} selected={service?.name === s.name} onSelect={setService} />)}</div>
            <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="primary" disabled={!service} onClick={() => setStep(1)}>Continue<ArrowRight aria-hidden /></Button></div>
          </motion.div>
        ) : step === 1 ? (
          <motion.div key="s1" className="stack gap-4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            <Field label="Date" htmlFor="appt-date"><Input id="appt-date" type="date" min={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} /></Field>
            <div className="field">
              <span className="label">Time</span>
              {slots.length ? <div className="slots" role="radiogroup" aria-label="Time">{slots.map((t) => <button key={t} type="button" role="radio" aria-checked={time === t} className={cx('slot', time === t && 'on')} onClick={() => setTime(t)}>{fmtTime(`${date}T${t}:00`)}</button>)}</div>
                : <p className="small muted">No slots left on this day — pick another date.</p>}
            </div>
            <div className="row gap-2" style={{ justifyContent: 'space-between' }}>{hasServices ? <Button variant="ghost" onClick={() => setStep(0)}>Back</Button> : <span />}<Button variant="primary" disabled={!time} onClick={() => setStep(2)}>Continue<ArrowRight aria-hidden /></Button></div>
          </motion.div>
        ) : (
          <motion.div key="s2" className="stack gap-4" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
            <div className="card card-sm stack gap-2">
              <div className="between"><span className="muted small">Shop</span><b>{shop.name}</b></div>
              {service && <div className="between"><span className="muted small">Service</span><b>{service.name}</b></div>}
              <div className="between"><span className="muted small">When</span><b>{fmtDate(`${date}T${time}:00`)} · {fmtTime(`${date}T${time}:00`)}</b></div>
            </div>
            <Field label="Note (optional)" htmlFor="appt-note"><Textarea id="appt-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the counter should know?" style={{ minHeight: 72 }} /></Field>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="row gap-2" style={{ justifyContent: 'space-between' }}><Button variant="ghost" onClick={() => setStep(1)}>Back</Button><Button variant="primary" loading={busy} onClick={confirm} icon={Check}>Confirm</Button></div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}
