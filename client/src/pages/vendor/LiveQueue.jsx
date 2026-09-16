import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, SkipForward, Check, Pause, Play, Users, Clock } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor } from './VendorContext.jsx'
import { fmtMin, timeAgo } from '../../lib/format.js'
import { Button, Badge, LiveDot, AnimatedNumber, EmptyState, PageTransition, cx } from '../../ui/index.jsx'
import { useToast } from '../../ui/Toast.jsx'

/** The counter screen: giant current token, one primary action. Keyboard: N = next, S = skip, C = complete. */
export default function LiveQueue() {
  const { shop, state, shopId, setState } = useVendor()
  const toast = useToast()
  const [busy, setBusy] = useState('')

  async function act(action, body) {
    if (busy) return
    setBusy(action)
    try {
      setState(await api(`/api/queues/${shopId}${action === 'toggle' ? '' : `/${action}`}`, { method: action === 'toggle' ? 'PATCH' : 'POST', body }))
      if (action === 'toggle') toast.info(body.isOpen ? 'Queue resumed.' : 'Queue paused.')
    } catch (e) { toast.error(e.message) } finally { setBusy('') }
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === 'n') act('next'); else if (k === 's' && state?.current) act('skip'); else if (k === 'c' && state?.current) act('complete')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.current, busy])

  if (!shop) return null
  const cur = state.current
  return (
    <PageTransition className="live">
      <div className="live-main">
        <div className={cx('card live-now', !shop.isOpen && 'paused')}>
          <div className="between"><span className="eyebrow row gap-2"><LiveDot off={!shop.isOpen} />{shop.isOpen ? 'Currently serving' : 'Queue paused'}</span><span className="small muted">{state.waiting.length} waiting · ~{fmtMin(shop.etaMinutes)}</span></div>
          <div className="live-number gradient-text num" aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={cur?._id || 'none'} initial={{ opacity: 0, y: 28, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -28, scale: 0.9 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }} style={{ display: 'inline-block' }}>
                {cur ? `#${cur.number}` : '—'}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="live-who">
            {cur ? <><b>{cur.user?.name || 'Customer'}</b><span className="muted">{cur.service || 'Walk-in'} · called {timeAgo(cur.calledAt)}</span>{cur.priority && <Badge tone="priority">Priority</Badge>}</> : <span className="muted">{state.waiting.length ? 'Press Next to call the first customer.' : 'Nobody in the queue right now.'}</span>}
          </div>
          <Button variant="primary" size="xl" block className="live-next" loading={busy === 'next'} disabled={!shop.isOpen && !cur && !state.waiting.length} onClick={() => act('next')}>NEXT<ArrowRight aria-hidden style={{ width: 26, height: 26 }} /></Button>
          <div className="live-secondary">
            <Button variant="secondary" size="lg" icon={SkipForward} disabled={!cur} loading={busy === 'skip'} onClick={() => act('skip')}>Skip</Button>
            <Button variant="secondary" size="lg" icon={Check} disabled={!cur} loading={busy === 'complete'} onClick={() => act('complete')}>Complete</Button>
            <Button variant={shop.isOpen ? 'ghost' : 'success'} size="lg" icon={shop.isOpen ? Pause : Play} loading={busy === 'toggle'} onClick={() => act('toggle', { isOpen: !shop.isOpen })}>{shop.isOpen ? 'Pause Queue' : 'Resume Queue'}</Button>
          </div>
          <p className="xs faint center hide-mobile">Keyboard: <span className="kbd">N</span> next · <span className="kbd">S</span> skip · <span className="kbd">C</span> complete</p>
        </div>
      </div>
      <aside className="card live-list">
        <div className="between mb-4"><h3 className="row gap-2"><Users aria-hidden style={{ width: 18 }} />Waiting</h3><span className="badge">{state.waiting.length}</span></div>
        {state.waiting.length ? (
          <ol className="stack gap-2">
            <AnimatePresence initial={false}>
              {state.waiting.map((t, i) => (
                <motion.li key={t._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }} transition={{ duration: 0.25 }} className={cx('wait-row', i === 0 && 'next')}>
                  <span className="wait-num">#{t.number}</span>
                  <span className="stack grow" style={{ minWidth: 0 }}><b className="truncate">{t.user?.name || 'Customer'}</b><span className="xs muted row gap-2">{t.service || 'Walk-in'}<span aria-hidden>·</span><Clock aria-hidden style={{ width: 12 }} />{timeAgo(t.createdAt)}</span></span>
                  {t.priority ? <Badge tone="priority">Priority</Badge> : i === 0 ? <Badge tone="primary">Up next</Badge> : null}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        ) : <EmptyState icon={Users} title="Queue is empty." />}
      </aside>
    </PageTransition>
  )
}
