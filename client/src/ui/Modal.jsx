import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button, cx } from './index.jsx'

function useDialog(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // move focus into the dialog
    const t = setTimeout(() => ref.current?.querySelector('input, button, [tabindex]')?.focus(), 30)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; clearTimeout(t); prev?.focus?.() }
  }, [open, onClose])
  return ref
}

/** Centered dialog (scale + fade). On phones it becomes a bottom sheet unless `center`. */
export function Modal({ open, onClose, title, children, footer, size, center, className }) {
  const ref = useDialog(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            className={cx('modal', size && `modal-${size}`, center && 'modal-center', className)}
            initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 12 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
            {(title || onClose) && (
              <div className="modal-head">
                <h3>{title}</h3>
                {onClose && <Button variant="ghost" size="sm" icon={X} aria-label="Close" onClick={onClose} />}
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Bottom sheet (slides up). */
export function Sheet({ open, onClose, children, className, label }) {
  const ref = useDialog(open, onClose)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay sheet-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={cx('sheet', className)}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.4 }} onDragEnd={(_, info) => info.offset.y > 90 && onClose?.()}>
            <div className="sheet-handle" />
            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Side drawer (mobile nav / sidebar). */
export function Drawer({ open, onClose, children, side = 'right', label }) {
  const ref = useDialog(open, onClose)
  const x = side === 'right' ? '100%' : '-100%'
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="overlay drawer-overlay" style={side === 'left' ? { justifyContent: 'flex-start' } : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={label} className="drawer" style={side === 'left' ? { borderLeft: 0, borderRight: '1px solid var(--border)' } : undefined}
            initial={{ x }} animate={{ x: 0 }} exit={{ x }} transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
