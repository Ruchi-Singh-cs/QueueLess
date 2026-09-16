import { useEffect, useMemo, useState } from 'react'

import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, ChevronUp, X, Clock, ArrowRight } from 'lucide-react'
import { useFetch, useQueueWatch, applyUpdate, useDebounced, useMedia } from '../lib/hooks.js'
import { useGeolocation } from '../lib/geo.js'
import { CATEGORIES, category, fmtKm, fmtMin } from '../lib/format.js'
import { Button, Chip, Segmented, Select, SkeletonCard, EmptyState, ErrorState, Badge, LiveDot, PageTransition, stagger, cx } from '../ui/index.jsx'
import { ShopCard } from '../components/Cards.jsx'
import { GoogleMap, RecenterButton } from '../components/Map.jsx'
import { LocationPrompt } from '../components/LocationPrompt.jsx'

const RADII = [1, 5, 10, 20]
const SORTS = [{ value: 'nearest', label: 'Nearest' }, { value: 'wait', label: 'Shortest Wait' }, { value: 'open', label: 'Open Now' }]

export default function Nearby() {
  const geo = useGeolocation()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const [cat, setCat] = useState('all')
  const [radius, setRadius] = useState(5)
  const [sort, setSort] = useState('nearest')
  const [selected, setSelected] = useState(null)
  const [sheet, setSheet] = useState(false)
  const mobile = useMedia('(max-width: 1023px)')
  const loc = geo.location

  const { data, error, loading, reload, setData } = useFetch('/api/queues/nearby', {
    query: loc && { lat: loc.lat, lng: loc.lng, radius, q: dq, category: cat === 'all' ? undefined : cat },
    enabled: !!loc,
  })
  const shops = useMemo(() => {
    let list = data?.queues || []
    if (sort === 'wait') list = [...list].sort((a, b) => a.etaMinutes - b.etaMinutes)
    if (sort === 'open') list = [...list].filter((s) => s.isOpen)
    return list
  }, [data, sort])
  useQueueWatch(shops.map((s) => s._id), (u) => setData((d) => d && { ...d, queues: d.queues.map((s) => (s._id === u.queueId ? applyUpdate(s, u) : s)) }))
  useEffect(() => { if (selected && !shops.some((s) => s._id === selected)) setSelected(null) }, [shops, selected])

  const markers = shops.filter((s) => s.location).map((s) => ({ id: s._id, position: s.location, category: s.category, label: s.currentNumber != null ? `#${s.currentNumber}` : '', title: s.name }))
  const sel = shops.find((s) => s._id === selected)

  if (!loc) {
    return (
      <PageTransition className="container page">
        <div className="page-head"><div><h1>Find nearby services</h1><p className="sub">Clinics, salons, banks, government offices and more — with live queues.</p></div></div>
        <div style={{ maxWidth: 520, margin: '0 auto' }}><LocationPrompt status={geo.status} onAllow={geo.request} onManual={geo.setManual} /></div>
      </PageTransition>
    )
  }

  const filters = (
    <>
      <div className="chips" role="group" aria-label="Category">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
        {CATEGORIES.filter((c) => c.value !== 'other').map((c) => <Chip key={c.value} active={cat === c.value} icon={c.icon} onClick={() => setCat(c.value)}>{c.label}</Chip>)}
      </div>
      <div className="row gap-3 wrap">
        <label className="row gap-2 small muted">Within<Select value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: 96, height: 36 }} aria-label="Distance">{RADII.map((r) => <option key={r} value={r}>{r} km</option>)}</Select></label>
        <Segmented options={SORTS} value={sort} onChange={setSort} label="Sort" />
      </div>
    </>
  )

  const list = (
    <>
      {loading && !data ? <div className="stack gap-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        : error ? <ErrorState onRetry={reload}>We couldn't load nearby services.</ErrorState>
        : !shops.length ? <EmptyState icon={MapPin} title="No QueueLess services nearby yet." actions={radius < 20 && <Button variant="secondary" onClick={() => setRadius(RADII[RADII.indexOf(radius) + 1] || 20)}>Increase radius to {RADII[RADII.indexOf(radius) + 1] || 20} km</Button>}>Try increasing your search radius or clearing filters.</EmptyState>
        : <motion.div className="stack gap-3" variants={stagger} initial="hidden" animate="show">{shops.map((s) => <ShopCard key={s._id} shop={s} selected={selected === s._id} onSelect={setSelected} />)}</motion.div>}
    </>
  )

  return (
    <PageTransition className="nearby">
      <div className="container nearby-top">
        <div className="between wrap gap-3">
          <div>
            <h1>Find nearby services</h1>
            <button type="button" className="loc-line" onClick={geo.clear}><MapPin aria-hidden />{geo.status === 'manual' ? loc.label : 'Using your current location'}<span className="xs faint">· change</span></button>
          </div>
          <div className="input-wrap nearby-search"><Search aria-hidden /><input type="search" className="input" placeholder="Search clinics, salons, banks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search nearby services" /></div>
        </div>
        <div className="nearby-filters">{filters}</div>
      </div>

      <div className="nearby-body">
        <div className="nearby-map">
          <GoogleMap markers={markers} user={loc} selected={selected} onSelect={(id) => { setSelected(id); if (mobile) setSheet(true) }} className="map-fill">
            <div className="map-pill"><LiveDot />{shops.length} service{shops.length === 1 ? '' : 's'} within {radius} km</div>
            <AnimatePresence>
              {sel && !mobile && (
                <motion.div key={sel._id} className="map-popup" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.2 }}>
                  <div className="between">
                    <div className="row gap-3" style={{ minWidth: 0 }}>
                      <span className={cx('icon-box', sel.category)}>{(() => { const I = category(sel.category).icon; return <I aria-hidden /> })()}</span>
                      <div style={{ minWidth: 0 }}><b className="truncate" style={{ display: 'block' }}>{sel.name}</b><span className="small muted">{category(sel.category).label} · {fmtKm(sel.distanceKm)}</span></div>
                    </div>
                    <Button variant="ghost" size="sm" icon={X} aria-label="Close" onClick={() => setSelected(null)} />
                  </div>
                  <div className="row gap-4 mt-3 small">
                    <span>Serving <b className="num">{sel.currentNumber == null ? '–' : `#${sel.currentNumber}`}</b></span>
                    <span><b className="num">{sel.waitingCount}</b> waiting</span>
                    <span className="row gap-1"><Clock aria-hidden style={{ width: 14 }} />~{fmtMin(sel.etaMinutes)}</span>
                    <Badge tone={sel.isOpen ? 'open' : 'closed'}>{sel.isOpen ? 'Open' : 'Closed'}</Badge>
                  </div>
                  <Button variant="primary" size="sm" to={`/shop/${sel._id}`} className="mt-3" block>View Queue<ArrowRight aria-hidden /></Button>
                </motion.div>
              )}
            </AnimatePresence>
          </GoogleMap>
        </div>
        <aside className="nearby-list hide-mobile-list">
          <div className="between mb-3"><span className="small muted">{loading ? 'Updating…' : `${shops.length} result${shops.length === 1 ? '' : 's'}`}</span></div>
          {list}
        </aside>
      </div>

      {/* Mobile: bottom sheet list */}
      {mobile && (
        <>
          <button type="button" className="sheet-tab" onClick={() => setSheet(true)}><ChevronUp aria-hidden />{shops.length} service{shops.length === 1 ? '' : 's'} nearby</button>
          <AnimatePresence>
            {sheet && (
              <motion.div className="msheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.4 }} onDragEnd={(_, i) => i.offset.y > 80 && setSheet(false)} role="dialog" aria-label="Nearby services">
                <div className="sheet-handle" />
                <div className="between mb-3" style={{ padding: '0 var(--s-4)' }}>
                  <b>{sel ? sel.name : `${shops.length} nearby`}</b>
                  <Button variant="ghost" size="sm" icon={X} aria-label="Close list" onClick={() => setSheet(false)} />
                </div>
                <div className="msheet-body">
                  {sel ? <div className="stack gap-3"><ShopCard shop={sel} animate={false} /><Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Show all</Button></div> : list}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </PageTransition>
  )
}

