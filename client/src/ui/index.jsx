// QueueLess design-system primitives. One icon library (lucide), one motion library (framer-motion).
import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, animate, useReducedMotion } from 'framer-motion'
import { EASE, page as pageMotion, rise, group, card as cardVariant, inView as inViewport, useMagnetic } from '../lib/motion.js'
import { Inbox, AlertTriangle, ChevronDown } from 'lucide-react'

const cx = (...a) => a.filter(Boolean).join(' ')
export { cx }

/* ---------- Button ---------- */
export const Button = forwardRef(function Button(
  { variant = 'secondary', size, block, icon: Icon, loading, children, className, to, href, magnetic, ...props }, ref,
) {
  const cls = cx('btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', !children && Icon && 'btn-icon', magnetic && 'btn-magnetic', className)
  const inner = (
    <>
      {loading ? <span className="spinner" aria-hidden /> : Icon ? <Icon aria-hidden /> : null}
      {children}
    </>
  )
  // The hook has to run every render; its result is only bound when `magnetic` is set. It already
  // no-ops for reduced motion and for touch, where there is no hover to follow.
  const mag = useMagnetic()
  const bind = magnetic
    ? { ref: mergeRefs(ref, mag.ref), style: { ...mag.style, ...props.style } }
    : { ref }
  const { style: _s, ...rest } = props
  const p = magnetic ? rest : props

  if (to) return <MLink {...bind} to={to} className={cls} {...p}>{inner}</MLink>
  if (href) return <motion.a {...bind} href={href} className={cls} {...p}>{inner}</motion.a>
  return <motion.button {...bind} type="button" className={cls} disabled={loading || p.disabled} {...p}>{inner}</motion.button>
})
const MLink = motion.create ? motion.create(Link) : motion(Link)
const mergeRefs = (...refs) => (node) => refs.forEach((r) => { if (typeof r === 'function') r(node); else if (r) r.current = node })

/* ---------- Inputs ---------- */
export function Field({ label, hint, error, children, className, htmlFor }) {
  return (
    <div className={cx('field', className)}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="err" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}
export const Input = forwardRef(function Input({ className, ...p }, ref) { return <input ref={ref} className={cx('input', className)} {...p} /> })
export const Select = forwardRef(function Select({ className, children, ...p }, ref) { return <select ref={ref} className={cx('select', className)} {...p}>{children}</select> })
export const Textarea = forwardRef(function Textarea({ className, ...p }, ref) { return <textarea ref={ref} className={cx('textarea', className)} {...p} /> })
export function SearchInput({ icon: Icon, kbd, className, ...p }) {
  return (
    <div className={cx('input-wrap', className)}>
      {Icon && <Icon aria-hidden />}
      <input type="search" className="input" {...p} />
      {kbd && <span className="kbd hide-mobile">{kbd}</span>}
    </div>
  )
}
export function Switch({ checked, onChange, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
}
export function Chip({ active, icon: Icon, children, ...p }) {
  return <button type="button" className="chip" aria-pressed={!!active} {...p}>{Icon && <Icon aria-hidden />}{children}</button>
}
export function Segmented({ options, value, onChange, label }) {
  const id = useId()
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.value === value && <motion.span layoutId={`seg-${id}`} className="thumb" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange }) {
  const id = useId()
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" className="tab" aria-selected={t.value === value} onClick={() => onChange(t.value)}>
          {t.label}
          {t.value === value && <motion.span layoutId={`tab-${id}`} className="tab-line" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
        </button>
      ))}
    </div>
  )
}

/* ---------- Badge / Live / Avatar ---------- */
export function Badge({ tone, children, className, icon: Icon, size }) {
  return <span className={cx('badge', tone && `badge-${tone}`, size && `badge-${size}`, className)}>{Icon && <Icon aria-hidden />}{children}</span>
}
export const LiveDot = ({ off }) => <span className={cx('live-dot', off && 'off')} aria-hidden />
export function Avatar({ name = '?', size, className }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
  return <span className={cx('avatar', size && `avatar-${size}`, className)} aria-hidden>{initials}</span>
}
/** The mark: a progress ring stopped just short of closing, read as a Q; the dot is your token. */
export const LogoMark = ({ className }) => (
  <svg viewBox="0 0 24 24" className={cx('logo-glyph', className)} fill="none" aria-hidden
    stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <path className="logo-ring" d="M13.89 17.58A7 7 0 1 1 18.08 13.39" />
    <path d="M14.2 14.2 18.6 18.6" />
    <circle cx="11.5" cy="11" r="2" fill="currentColor" stroke="none" />
  </svg>
)

export const Logo = ({ to = '/', className }) => (
  <Link to={to} className={cx('logo', className)} aria-label="QueueLess home">
    <span className="logo-mark"><LogoMark /></span>
    <span>QueueLess</span>
  </Link>
)

/* ---------- Card / Stat ---------- */
export function Card({ hover, sm, className, children, as: As = 'div', ...p }) {
  return <As className={cx('card', hover && 'card-hover', sm && 'card-sm', className)} {...p}>{children}</As>
}
export function StatCard({ label, value, sub, icon: Icon, accent, animated = true, className }) {
  return (
    <Card className={cx('stat', accent && 'stat-accent', className)}>
      <span className="stat-label">{Icon && <Icon aria-hidden />}{label}</span>
      <span className="stat-value">{animated && typeof value === 'number' ? <AnimatedNumber value={value} /> : value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </Card>
  )
}

/* ---------- AnimatedNumber: tweens between values, pulses on change ---------- */
export function AnimatedNumber({ value, prefix = '', suffix = '', className }) {
  const ref = useRef(null)
  const prev = useRef(value)
  const reduce = useReducedMotion()
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prev.current
    prev.current = value
    if (typeof value !== 'number' || typeof from !== 'number' || reduce || from === value) { el.textContent = `${prefix}${value ?? '–'}${suffix}`; return }
    setPulse((p) => p + 1)
    const c = animate(from, value, { duration: 0.5, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => { el.textContent = `${prefix}${Math.round(v)}${suffix}` } })
    return () => c.stop()
  }, [value, prefix, suffix, reduce])
  return (
    <motion.span key={pulse} ref={ref} className={cx('num', className)} initial={pulse ? { scale: 1.08 } : false} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
      {prefix}{value ?? '–'}{suffix}
    </motion.span>
  )
}

/* ---------- Skeleton & states ---------- */
export const Skeleton = ({ w, h = 14, r, className, style }) => <span className={cx('skeleton', className)} style={{ display: 'block', width: w ?? '100%', height: h, borderRadius: r, ...style }} aria-hidden />
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card" aria-hidden>
      <Skeleton w="55%" h={18} />
      {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} w={`${85 - i * 15}%`} className="mt-3" />)}
      <Skeleton w={110} h={36} r={10} className="mt-4" />
    </div>
  )
}
export function EmptyState({ icon: Icon = Inbox, title, children, actions, className }) {
  return (
    <div className={cx('state', className)}>
      <span className="state-icon"><Icon aria-hidden /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}
export function ErrorState({ title = 'Something went wrong.', children, onRetry, className }) {
  return (
    <div className={cx('state state-error', className)} role="alert">
      <span className="state-icon"><AlertTriangle aria-hidden /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {onRetry && <div className="actions"><Button variant="secondary" onClick={onRetry}>Try Again</Button></div>}
    </div>
  )
}
export const Spinner = ({ className }) => <span className={cx('spinner', className)} role="status" aria-label="Loading" />
export function Alert({ tone = 'info', icon: Icon, children, className }) {
  return <div className={cx('alert', `alert-${tone}`, className)} role={tone === 'error' ? 'alert' : undefined}>{Icon && <Icon aria-hidden />}<div>{children}</div></div>
}

/* ---------- Dropdown ---------- */
export function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className="dropdown" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open })}
      <AnimatePresence>
        {open && (
          <motion.div role="menu" className="menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined}
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export const MenuItem = ({ to, icon: Icon, children, danger, ...p }) => {
  const cls = cx('menu-item', danger && 'danger')
  return to ? <Link to={to} className={cls} role="menuitem" {...p}>{Icon && <Icon aria-hidden />}{children}</Link>
    : <button type="button" className={cls} role="menuitem" {...p}>{Icon && <Icon aria-hidden />}{children}</button>
}
export { ChevronDown }

/* ---------- Page transition ---------- */
export function PageTransition({ children, className, style }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className={className} style={style}
      initial={reduce ? false : pageMotion.initial} animate={pageMotion.animate} exit={reduce ? undefined : pageMotion.exit}>
      {children}
    </motion.div>
  )
}

/** Scroll-triggered reveal. Renders a plain element under reduced motion so content is never left hidden. */
export function Reveal({ children, as = 'div', delay = 0, y = 18, className, style, stagger: st }) {
  const reduce = useReducedMotion()
  const M = motion[as] || motion.div
  if (reduce) { const A = as; return <A className={className} style={style}>{children}</A> }
  return (
    <M className={className} style={style} initial="hidden" whileInView="show" viewport={inViewport}
      variants={st ? group(st, delay) : { hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE, delay } } }}>
      {children}
    </M>
  )
}
/** A child of a <Reveal stagger> — it inherits the parent's timing. */
export const RevealItem = ({ children, as = 'div', className, style, variants = cardVariant }) => {
  const M = motion[as] || motion.div
  return <M className={className} style={style} variants={variants}>{children}</M>
}

export { rise, group, cardVariant, useMagnetic }
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
export const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] } } }
