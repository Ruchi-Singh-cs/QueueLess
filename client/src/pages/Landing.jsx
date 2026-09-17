import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, MapPin, Bell, Users, Clock, Search, ListOrdered, Radar, Footprints, Store, BarChart3, ShieldCheck, Zap, CalendarDays } from 'lucide-react'
import { api } from '../api.js'
import { useAuth } from '../auth.jsx'
import { readSavedLocation, haversineKm, DEFAULT_CENTER } from '../lib/geo.js'
import { withGsap } from '../lib/gsap.js'
import { roleHome } from '../lib/format.js'
import { Button, Badge, LiveDot, AnimatedNumber, Reveal, stagger, fadeUp } from '../ui/index.jsx'
import { ShopCard } from '../components/Cards.jsx'
import { GoogleMap } from '../components/Map.jsx'

/* Headline that assembles itself a word at a time. */
function Headline({ text }) {
  const reduce = useReducedMotion()
  if (reduce) return <motion.h1 variants={fadeUp}>{text}</motion.h1>
  return (
    <motion.h1 variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }} style={{ perspective: 600 }}>
      {text.split(' ').map((w, i) => (
        <motion.span key={i} className="hero-word"
          variants={{ hidden: { opacity: 0, y: '0.5em', rotateX: -40 }, show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.55, ease: [0.2, 0.8, 0.2, 1] } } }}>
          {i ? ' ' + w : w}
        </motion.span>
      ))}
    </motion.h1>
  )
}

/* Real numbers, counted up as the strip scrolls in — nothing here is invented. */
function LiveStrip() {
  const [s, setS] = useState(null)
  useEffect(() => {
    api('/api/queues')
      .then((d) => setS({
        shops: d.queues.length,
        waiting: d.queues.reduce((a, q) => a + (q.waitingCount || 0), 0),
        services: d.queues.reduce((a, q) => a + (q.services?.length || 0), 0),
      }))
      .catch(() => setS(null))
  }, [])
  if (!s) return null
  const items = [[s.shops, 'businesses listed'], [s.waiting, 'people in a queue right now'], [s.services, 'services you can book']]
  return (
    <motion.ul className="live-strip" initial="hidden" whileInView="show" viewport={{ once: true, margin: '-40px' }} variants={stagger}>
      {items.map(([v, label]) => (
        <motion.li key={label} variants={fadeUp}>
          <span className="live-strip-num num gradient-text"><AnimatedNumber value={v} /></span>
          <span className="xs muted">{label}</span>
        </motion.li>
      ))}
    </motion.ul>
  )
}

/* ---------- Hero product mockup: a live-feeling QueueLess screen ---------- */
function ProductMock() {
  const reduce = useReducedMotion()
  const [serving, setServing] = useState(21)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setServing((s) => (s >= 24 ? 21 : s + 1)), 2600)
    return () => clearInterval(t)
  }, [reduce])
  const ahead = 27 - serving - 1
  return (
    <div className="mock" aria-hidden>
      <div className="mock-window">
        <div className="mock-bar"><span /><span /><span /></div>
        <div className="mock-body">
          <div className="mock-list">
            <div className="mock-list-head"><span className="eyebrow">Nearby shops</span><span className="xs faint">Kanpur · 5 km</span></div>
            {[['Dr. Sharma Clinic', 'Medical', '0.8 km', true], ['Glow Salon', 'Salon', '1.2 km', false], ['City Bank', 'Bank', '2.1 km', false]].map(([n, c, d, a]) => (
              <div key={n} className={`mock-row${a ? ' active' : ''}`}><span className="mock-dot" /><span className="grow"><b>{n}</b><small>{c} · {d}</small></span>{a && <LiveDot />}</div>
            ))}
          </div>
          <div className="mock-ticket">
            <div className="between"><b>Dr. Sharma Clinic</b><Badge tone="open"><LiveDot />Open</Badge></div>
            <div className="mock-serving"><span className="eyebrow">Currently serving</span><span className="num mock-num"><AnimatedNumber value={serving} prefix="#" /></span></div>
            <div className="mock-yours"><span className="eyebrow">Your token</span><span className="num gradient-text">#27</span></div>
            <div className="mock-stats"><span><Users aria-hidden /><AnimatedNumber value={ahead} /> ahead</span><span><Clock aria-hidden />~<AnimatedNumber value={ahead * 6} /> min</span></div>
            <div className="mock-btn">Track live</div>
          </div>
        </div>
      </div>
      <motion.div className="float float-a" animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}><LiveDot />Live</motion.div>
      <motion.div className="float float-b" animate={reduce ? undefined : { y: [0, 6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}><Users aria-hidden />{ahead} people ahead</motion.div>
      <motion.div className="float float-c" animate={reduce ? undefined : { y: [0, -5, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}><Bell aria-hidden />Your turn is near</motion.div>
    </div>
  )
}

/* ---------- How it works: scroll-revealed timeline ---------- */
const STEPS = [
  { n: '01', t: 'Find a service', d: 'Search or browse nearby clinics, salons, banks and offices on the map.', icon: Search },
  { n: '02', t: 'Join the queue', d: 'Pick a service and take a token from your phone — no standing in line.', icon: ListOrdered },
  { n: '03', t: 'Track your position', d: 'Watch the queue move in real time with a live estimate of your wait.', icon: Radar },
  { n: '04', t: 'Get notified', d: "We'll ping you when only a few people are ahead of you.", icon: Bell },
  { n: '05', t: 'Arrive when needed', d: 'Walk in right when it matters. Your time stays yours.', icon: Footprints },
]
function Step({ s, i }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.li ref={ref} className="how-step" initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.45, delay: 0.05, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="how-rail">
        <span className="how-num">{s.n}</span>
        {/* scaleY is driven by GSAP ScrollTrigger below, not by Framer, so the two never fight */}
        {i < STEPS.length - 1 && <span className="how-line" />}
      </div>
      <div className="how-body">
        <span className="icon-box"><s.icon aria-hidden /></span>
        <div><h3>{s.t}</h3><p className="muted">{s.d}</p></div>
      </div>
    </motion.li>
  )
}

/**
 * Welds the timeline rail to the scroll wheel: each connector fills exactly as far as you have
 * scrolled past its step, and unfills if you scroll back. That two-way tie to scroll position is
 * what GSAP's scrub gives us and Framer's viewport triggers cannot.
 */
function useScrollRail(ref) {
  useEffect(() => withGsap(({ gsap }) => {
    gsap.utils.toArray('.how-line').forEach((line) => {
      gsap.fromTo(line, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: { trigger: line, start: 'top 85%', end: 'bottom 55%', scrub: 0.4 },
      })
    })
  }, ref.current), [ref])
}

/* ---------- Nearby preview ---------- */
function NearbyPreview() {
  const [shops, setShops] = useState(null)
  const me = readSavedLocation() || DEFAULT_CENTER
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    api('/api/queues/nearby', { query: { lat: me.lat, lng: me.lng, radius: 20 } })
      .then((d) => setShops(d.queues.slice(0, 4)))
      .catch(() => api('/api/queues').then((d) => setShops(d.queues.slice(0, 4).map((s) => ({ ...s, distanceKm: s.location ? haversineKm(me, s.location) : null })))).catch(() => setShops([])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const markers = (shops || []).filter((s) => s.location).map((s) => ({ id: s._id, position: s.location, category: s.category, label: s.currentNumber != null ? `#${s.currentNumber}` : '', title: s.name }))
  return (
    <div className="nearby-preview">
      <div className="nearby-preview-map"><GoogleMap markers={markers} user={me} selected={selected} onSelect={setSelected} className="map-rounded" /></div>
      <motion.div className="nearby-preview-list" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
        {shops === null ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="card"><span className="skeleton" style={{ height: 18, width: '60%', display: 'block' }} /><span className="skeleton mt-3" style={{ height: 12, width: '40%', display: 'block' }} /><span className="skeleton mt-4" style={{ height: 40, display: 'block' }} /></div>)
          : shops.length ? shops.map((s) => <ShopCard key={s._id} shop={s} compact selected={selected === s._id} onSelect={setSelected} />)
          : <div className="card center muted">No QueueLess services nearby yet.</div>}
        <Button variant="secondary" to="/nearby" block>Explore all nearby services<ArrowRight aria-hidden /></Button>
      </motion.div>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const reduce = useReducedMotion()
  const howRef = useRef(null)
  useScrollRail(howRef)
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  // subtle depth: the mock lifts and tips away slightly faster than the copy
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -70])
  const mockRotate = useTransform(scrollYProgress, [0, 1], [0, -4])
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 40])
  const heroFade = useTransform(scrollYProgress, [0, 0.85], [1, 0])
  const par = (v) => (reduce ? undefined : v)
  return (
    <>
      {/* HERO */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg bg-grid" aria-hidden />
        <div className="hero-glow" aria-hidden />
        <div className="container hero-grid">
          <motion.div className="hero-copy" initial="hidden" animate="show" variants={stagger} style={{ y: par(copyY), opacity: par(heroFade) }}>
            <motion.div variants={fadeUp}><Badge tone="primary" size="lg"><LiveDot />Real-time virtual queues</Badge></motion.div>
            <Headline text="Skip the wait." />
            <motion.p variants={fadeUp} className="hero-sub">Join the queue virtually. Know your turn. Arrive when it matters.</motion.p>
            <motion.div variants={fadeUp} className="hero-cta">
              <Button variant="primary" size="lg" magnetic to={user ? roleHome(user.role) : '/nearby'} icon={MapPin}>Find a Queue</Button>
              <Button variant="secondary" size="lg" magnetic href="#business">For Businesses</Button>
            </motion.div>
            <motion.ul variants={fadeUp} className="hero-proof">
              <li><Zap aria-hidden />Token in seconds</li>
              <li><Radar aria-hidden />Live position &amp; ETA</li>
              <li><Bell aria-hidden />Notified when it's near</li>
            </motion.ul>
          </motion.div>
          <motion.div className="hero-visual" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            style={{ y: par(mockY), rotate: par(mockRotate) }}>
            <ProductMock />
          </motion.div>
        </div>
        <div className="container"><LiveStrip /></div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section" id="how">
        <div className="container">
          <Reveal className="section-head">
            <span className="eyebrow">How QueueLess works</span>
            <h2>Join remotely. Track live. Arrive when it matters.</h2>
            <p>Five steps between you and never sitting in a waiting room again.</p>
          </Reveal>
          <ol className="how" ref={howRef}>{STEPS.map((s, i) => <Step key={s.n} s={s} i={i} />)}</ol>
        </div>
      </section>

      {/* NEARBY */}
      <section className="section section-alt" id="nearby">
        <div className="container">
          <Reveal className="section-head">
            <span className="eyebrow">Nearby</span>
            <h2>Find services near you.</h2>
            <p>Discover nearby clinics, salons, banks, government offices and more — with live queue status before you leave home.</p>
          </Reveal>
          <NearbyPreview />
        </div>
      </section>

      {/* FOR BUSINESSES */}
      <section className="section" id="business">
        <div className="container biz">
          <Reveal className="section-head">
            <span className="eyebrow">For businesses</span>
            <h2>A calmer front desk. Happier customers.</h2>
            <p>Run your queue from one screen. Customers join from their phones; you press <b>Next</b>.</p>
            <div className="row gap-2 wrap mt-5"><Button variant="primary" size="lg" magnetic to="/register?role=staff">Register your business<ArrowRight aria-hidden /></Button><Button variant="ghost" size="lg" to="/login">Vendor login</Button></div>
          </Reveal>
          <motion.ul className="biz-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
            {[[Store, 'Shop profile & map pin', 'Show up on the map with hours, services and directions.'], [ListOrdered, 'One-tap queue control', 'Next, skip, complete, pause — built for a busy counter.'], [CalendarDays, 'Appointments', 'Bookings check in as priority tokens automatically.'], [BarChart3, 'Analytics', 'Served today, average wait, busiest hours.'], [ShieldCheck, 'Role-based access', 'Vendors manage only their own shop. Admins see everything.'], [Bell, 'Automatic notifications', 'Customers are told when to return — you never shout a number again.']].map(([Icon, t, d]) => (
              <motion.li key={t} variants={fadeUp} className="card card-hover"><span className="icon-box"><Icon aria-hidden /></span><h3 className="mt-3">{t}</h3><p className="muted small mt-2">{d}</p></motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container">
          <motion.div className="cta-band" initial={{ opacity: 0, y: 28, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}>
            <div><h2>Your time is yours again.</h2><p>Find a queue near you and take a token in seconds.</p></div>
            <Button variant="primary" size="lg" magnetic to={user ? roleHome(user.role) : '/register'}>{user ? 'Go to my dashboard' : 'Get Started'}<ArrowRight aria-hidden /></Button>
          </motion.div>
        </div>
      </section>
    </>
  )
}
