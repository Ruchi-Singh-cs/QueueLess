import { useEffect, useRef, useState } from 'react'
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

/**
 * One motion vocabulary for the whole app, so nothing feels hand-tuned in isolation.
 *
 * EASE is a long, decelerating curve — things arrive quickly and settle softly, the house style at
 * Apple and Linear. EASE_UI is shorter and symmetric, for things that respond to a pointer.
 * Everything here animates transform and opacity only, which the compositor handles without layout.
 */
export const EASE = [0.16, 1, 0.3, 1]
export const EASE_UI = [0.4, 0, 0.2, 1]

export const DUR = { fast: 0.18, ui: 0.28, base: 0.55, slow: 0.8 }

/** Entrance for a single block. `d` delays it within a sequence. */
export const rise = (d = 0) => ({
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE, delay: d } },
})

/** Parent that releases its children one after another. */
export const group = (stagger = 0.07, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

/** A card arriving in a grid: a touch of scale so it reads as coming forward, not sliding. */
export const card = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.base, ease: EASE } },
}

/** Route change. Short, and the exit is shorter than the entrance so navigation never feels laggy. */
export const page = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: EASE_UI } },
}

/** Standard viewport trigger: fire once, slightly before the element is fully on screen. */
export const inView = { once: true, margin: '-12% 0px -8% 0px' }

/**
 * Pulls an element gently toward the pointer while it is over it. Returns a ref and the
 * motion values to bind. Disabled for reduced motion and for coarse pointers, where there is
 * no hover to respond to and the transform would just fight the tap.
 */
export function useMagnetic({ strength = 0.28, radius = 90 } = {}) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const x = useSpring(mx, { stiffness: 250, damping: 20, mass: 0.35 })
  const y = useSpring(my, { stiffness: 250, damping: 20, mass: 0.35 })

  useEffect(() => {
    const el = ref.current
    if (!el || reduce || !fine) return
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy)
      const pull = Math.max(0, 1 - d / (Math.max(r.width, r.height) / 2 + radius))
      mx.set(dx * strength * pull)
      my.set(dy * strength * pull)
    }
    const reset = () => { mx.set(0); my.set(0) }
    window.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', reset)
    return () => { window.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', reset) }
  }, [reduce, fine, strength, radius, mx, my])

  return { ref, style: reduce || !fine ? undefined : { x, y } }
}

/** True on devices that actually have a hovering pointer. */
export function useFinePointer() {
  const [fine, setFine] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)')
    const on = () => setFine(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return fine
}

/** Window scroll position, throttled to one read per frame so it never thrashes layout. */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    let frame = 0
    const on = () => {
      if (frame) return
      frame = requestAnimationFrame(() => { setScrolled(window.scrollY > threshold); frame = 0 })
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(frame) }
  }, [threshold])
  return scrolled
}
