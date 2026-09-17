import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, SkipForward, Check, Pause, Play, Users, Clock, UserCheck, Undo2, AlarmClock } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor } from './VendorContext.jsx'
import { fmtMin, fmtTime, timeAgo } from '../../lib/format.js'
import { Button, Badge, LiveDot, AnimatedNumber, EmptyState, PageTransition, cx } from '../../ui/index.jsx'
import { useToast } from '../../ui/Toast.jsx'

/** Re-renders once a second so grace countdowns tick. Only mounted where one is actually shown. */
function useTicker(on) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const i = setInterval(() => set((n) => n + 1), 1000)
    return () => clearInterval(i)
  }, [on])
}

/** How long a called customer still has to show up before the sweeper auto-skips them. */
function Grace({ token, minutes }) {
  useTicker(true)
  const left = new Date(token.calledAt).getTime() + minutes * 60000 - Date.now()
  if (left <= 0) return <span className="grace over"><AlarmClock aria-hidden />No-show</span>
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000)
  return <span className={cx('grace', left < 60000 && 'soon')}><AlarmClock aria-hidden />{m}:{String(s).padStart(2, '0')} to arrive</span>
}

/** One counter's worth of controls. Used on its own for a single-counter shop, or tiled for several. */
function Counter({ n, token, shop, busy, act, arrived, active, onFocus, tile }) {
  const grace = shop.graceMinutes || 0
  const key = (a) => `${a}:${n}`
  return (
    <div
      className={cx('card live-now', tile && 'tile', !shop.isOpen && 'paused', active && tile && 'active')}
      onClick={tile ? onFocus : undefined}
    >
      <div className="between">
        <span className="eyebrow row gap-2"><LiveDot off={!shop.isOpen} />{tile ? `Counter ${n}` : shop.isOpen ? 'Currently serving' : 'Queue paused'}</span>
        {token && grace > 0 && (token.arrivedAt
          ? <span className="grace ok"><UserCheck aria-hidden />Arrived</span>
          : <Grace token={token} minutes={grace} />)}
      </div>

      <div className="live-number gradient-text num" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={token?._id || 'none'} initial={{ opacity: 0, y: 28, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -28, scale: 0.9 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }} style={{ display: 'inline-block' }}>
            {token ? `#${token.number}` : '—'}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="live-who">
        {token
          ? <><b>{token.user?.name || 'Customer'}</b><span className="muted">{token.service || 'Walk-in'} · called {timeAgo(token.calledAt)}</span>{token.priority && <Badge tone="priority">Priority</Badge>}</>
          : <span className="muted">{shop.waitingCount ? 'Press Next to call a customer.' : 'Nobody in the queue right now.'}</span>}
      </div>

      {/* paused means "no new tokens", not "stop serving" — staff still work through the people already here */}
      <Button variant="primary" size={tile ? 'lg' : 'xl'} block className="live-next" loading={busy === key('next')} disabled={!shop.isOpen && !token && !shop.waitingCount} onClick={() => act('next', n)}>
        NEXT<ArrowRight aria-hidden style={{ width: tile ? 20 : 26, height: tile ? 20 : 26 }} />
      </Button>

      <div className="live-secondary">
        {grace > 0 && token && !token.arrivedAt &&
          <Button variant="success" size={tile ? 'sm' : 'lg'} icon={UserCheck} loading={busy === `arrived:${token._id}`} onClick={() => arrived(token)}>Arrived</Button>}
        <Button variant="secondary" size={tile ? 'sm' : 'lg'} icon={SkipForward} disabled={!token} loading={busy === key('skip')} onClick={() => act('skip', n)}>Skip</Button>
        <Button variant="secondary" size={tile ? 'sm' : 'lg'} icon={Check} disabled={!token} loading={busy === key('complete')} onClick={() => act('complete', n)}>Complete</Button>
      </div>
    </div>
  )
}

/** The counter screen: giant current token, one primary action. Keyboard: N = next, S = skip, C = complete. */
export default function LiveQueue() {
  const { shop, state, shopId, setState } = useVendor()
  const toast = useToast()
  const [busy, setBusy] = useState('')
  const [active, setActive] = useState(1) // which counter the keyboard drives

  const counters = shop?.counters || 1
  const multi = counters > 1
  const serving = state?.serving || []
  const at = (n) => serving.find((t) => (t.counter || 1) === n)

  async function run(key, call, msg) {
    if (busy) return
    setBusy(key)
    try {
      setState(await call())
      if (msg) toast.info(msg)
    } catch (e) { toast.error(e.message) } finally { setBusy('') }
  }
  const act = (action, counter) => run(`${action}:${counter}`, () => api(`/api/queues/${shopId}/${action}`, { method: 'POST', body: { counter } }))
  const arrived = (t) => run(`arrived:${t._id}`, () => api(`/api/queues/${shopId}/arrived/${t._id}`, { method: 'POST' }), `#${t.number} checked in — the no-show timer is off.`)
  const recall = (t) => run(`recall:${t._id}`, () => api(`/api/queues/${shopId}/recall/${t._id}`, { method: 'POST' }), `#${t.number} is back at the front of the line.`)
  const toggle = () => run('toggle', () => api(`/api/queues/${shopId}`, { method: 'PATCH', body: { isOpen: !shop.isOpen } }), shop.isOpen ? 'Queue paused.' : 'Queue resumed.')

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey) return
      const k = e.key.toLowerCase()
      const n = Number(k)
      if (n >= 1 && n <= counters) return setActive(n)
      if (k === 'n') act('next', active)
      else if (k === 's' && at(active)) act('skip', active)
      else if (k === 'c' && at(active)) act('complete', active)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, busy, active, counters])

  if (!shop) return null
  const skipped = state.skipped || []
  const props = { shop: { ...shop, waitingCount: state.waiting.length }, busy, act, arrived }

  return (
    <PageTransition className="live">
      <div className="live-main">
        <div className="between mb-3 wrap gap-3">
          <span className="small muted">{state.waiting.length} waiting · ~{fmtMin(shop.etaMinutes)}{multi && ` · ${counters} counters`}</span>
          <Button variant={shop.isOpen ? 'ghost' : 'success'} size="sm" icon={shop.isOpen ? Pause : Play} loading={busy === 'toggle'} onClick={toggle}>{shop.isOpen ? 'Pause queue' : 'Resume queue'}</Button>
        </div>

        {multi ? (
          <div className="counter-grid">
            {Array.from({ length: counters }, (_, i) => i + 1).map((n) => (
              <Counter key={n} n={n} token={at(n)} {...props} tile active={active === n} onFocus={() => setActive(n)} />
            ))}
          </div>
        ) : <Counter n={1} token={at(1)} {...props} />}

        <p className="xs faint center hide-mobile mt-3">
          Keyboard: <span className="kbd">N</span> next · <span className="kbd">S</span> skip · <span className="kbd">C</span> complete
          {multi && <> · <span className="kbd">1</span>–<span className="kbd">{counters}</span> pick counter (now {active})</>}
        </p>
      </div>

      <aside className="stack gap-4">
        <div className="card live-list">
          <div className="between mb-4"><h3 className="row gap-2"><Users aria-hidden style={{ width: 18 }} />Waiting</h3><span className="badge">{state.waiting.length}</span></div>
          {state.waiting.length ? (
            <ol className="stack gap-2">
              <AnimatePresence initial={false}>
                {state.waiting.map((t, i) => (
                  <motion.li key={t._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }} transition={{ duration: 0.25 }} className={cx('wait-row', i === 0 && 'next')}>
                    <span className="wait-num">#{t.number}</span>
                    <span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{t.user?.name || 'Customer'}</b><span className="xs muted row gap-2 wait-meta"><span className="truncate">{t.service || 'Walk-in'}</span><span aria-hidden>·</span><Clock aria-hidden style={{ width: 12 }} />{timeAgo(t.createdAt)}</span></span>
                    {t.priority ? <Badge tone="priority">Priority</Badge> : i === 0 ? <Badge tone="primary">Up next</Badge> : null}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          ) : <EmptyState icon={Users} title="Queue is empty." />}
        </div>

        {/* no-shows from today — one tap puts them back at the front instead of making them take a new number */}
        {skipped.length > 0 && (
          <div className="card live-list">
            <div className="between mb-4"><h3 className="row gap-2"><Undo2 aria-hidden style={{ width: 18 }} />Skipped today</h3><span className="badge">{skipped.length}</span></div>
            <ul className="stack gap-2">
              {skipped.map((t) => (
                <li key={t._id} className="wait-row">
                  <span className="wait-num muted">#{t.number}</span>
                  <span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{t.user?.name || 'Customer'}</b><span className="xs muted">skipped {fmtTime(t.doneAt)}</span></span>
                  <Button variant="secondary" size="sm" icon={Undo2} loading={busy === `recall:${t._id}`} onClick={() => recall(t)}>Recall</Button>
                </li>
              ))}
            </ul>
            <p className="xs faint mt-3">Recall puts them back at the front with priority and re-sends their “it’s your turn” alert.</p>
          </div>
        )}
      </aside>
    </PageTransition>
  )
}
