import { useEffect } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import { useFinePointer } from '../lib/motion.js'

/** Pointer light. One fixed layer moved by springs on motion values — no React re-render, no layout. Fine pointers only. */
export function CursorGlow() {
  const reduce = useReducedMotion()
  const fine = useFinePointer()
  const x = useMotionValue(-300)
  const y = useMotionValue(-300)
  const sx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 380, damping: 32, mass: 0.4 })
  const scale = useSpring(1, { stiffness: 320, damping: 26 })
  const opacity = useSpring(0, { stiffness: 260, damping: 30 })

  const on = !reduce && fine
  useEffect(() => {
    if (!on) return
    const move = (e) => {
      x.set(e.clientX)
      y.set(e.clientY)
      opacity.set(1)
      // grow over things you can actually press
      scale.set(e.target?.closest?.('a, button, [role="button"], input, select, textarea, .card-hover') ? 1.9 : 1)
    }
    const leave = () => opacity.set(0)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    return () => { window.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave) }
  }, [on, x, y, scale, opacity])

  if (!on) return null
  return <motion.div className="cursor-glow" aria-hidden style={{ x: sx, y: sy, scale, opacity }} />
}
