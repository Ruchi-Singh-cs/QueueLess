import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, Clock, CornerDownLeft } from 'lucide-react'
import { api } from '../api.js'
import { useDebounced } from '../lib/hooks.js'
import { category, fmtKm, fmtMin } from '../lib/format.js'
import { readSavedLocation, haversineKm } from '../lib/geo.js'
import { LiveDot, cx } from '../ui/index.jsx'

const EVT = 'queueless:search'
export const useSearchPalette = () => ({ open: () => window.dispatchEvent(new Event(EVT)) })

/** Global search (Ctrl/⌘+K): shops, services, categories. */
export function SearchPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const navigate = useNavigate()
  const dq = useDebounced(q, 200)
  const me = readSavedLocation()

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o) } }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(EVT, onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(EVT, onOpen) }
  }, [])
  useEffect(() => { if (open) { setTimeout(() => input.current?.focus(), 30); setQ(''); setActive(0) } }, [open])
  useEffect(() => {
    if (!open) return
    setLoading(true)
    api('/api/queues', { query: { q: dq } }).then((d) => {
      const list = d.queues.map((s) => ({ ...s, distanceKm: me && s.location ? haversineKm(me, s.location) : null })).sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)).slice(0, 8)
      setResults(list); setActive(0)
    }).catch(() => setResults([])).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, open])

  const go = (s) => { setOpen(false); navigate(`/shop/${s._id}`) }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && results[active]) go(results[active])
    if (e.key === 'Escape') setOpen(false)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <motion.div role="dialog" aria-modal="true" aria-label="Search" className="palette" initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: -8 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="palette-input">
              <Search aria-hidden />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Search shops, services…" aria-label="Search shops and services" role="combobox" aria-expanded aria-controls="palette-list" aria-activedescendant={results[active] ? `pr-${results[active]._id}` : undefined} />
              <span className="kbd">esc</span>
            </div>
            <ul className="palette-list" id="palette-list" role="listbox">
              {results.map((s, i) => {
                const cat = category(s.category)
                return (
                  <li key={s._id} id={`pr-${s._id}`} role="option" aria-selected={i === active} className={cx('palette-item', i === active && 'active')} onMouseEnter={() => setActive(i)} onClick={() => go(s)}>
                    <span className={cx('icon-box', s.category)}><cat.icon aria-hidden /></span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="row gap-2"><b className="truncate">{s.name}</b>{s.isOpen ? <LiveDot /> : null}</span>
                      <span className="small muted row gap-2 wrap">{cat.label}{s.distanceKm != null && <><span aria-hidden>·</span><MapPin style={{ width: 12 }} aria-hidden />{fmtKm(s.distanceKm)}</>}<span aria-hidden>·</span><Clock style={{ width: 12 }} aria-hidden />{fmtMin(s.etaMinutes)} wait</span>
                    </span>
                    {i === active && <CornerDownLeft aria-hidden style={{ width: 16, color: 'var(--text-3)' }} />}
                  </li>
                )
              })}
              {!loading && !results.length && <li className="palette-empty">No results for “{q}”.</li>}
            </ul>
            <div className="palette-foot"><span><span className="kbd">↑</span><span className="kbd">↓</span> navigate</span><span><span className="kbd">↵</span> open</span></div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
