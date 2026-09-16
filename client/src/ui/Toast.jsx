import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react'

const ToastCtx = createContext(() => {})
const ICON = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle }
let seq = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const dismiss = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), [])
  const toast = useCallback((title, { type = 'success', description, duration = 3500 } = {}) => {
    const id = ++seq
    setItems((xs) => [...xs.slice(-3), { id, title, type, description }])
    if (duration) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])
  const api = useMemo(() => Object.assign(toast, {
    success: (t, o) => toast(t, { ...o, type: 'success' }),
    error: (t, o) => toast(t, { ...o, type: 'error', duration: 5000 }),
    info: (t, o) => toast(t, { ...o, type: 'info' }),
    warning: (t, o) => toast(t, { ...o, type: 'warning' }),
  }), [toast])
  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((t) => {
              const Icon = ICON[t.type]
              return (
                <motion.div key={t.id} layout className={`toast toast-${t.type}`} role="status"
                  initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                  onClick={() => dismiss(t.id)}>
                  <Icon aria-hidden />
                  <div className="grow">
                    <div className="toast-title">{t.title}</div>
                    {t.description && <div className="toast-desc">{t.description}</div>}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
