import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { useTicketUpdates } from './hooks.js'
import { useToast } from '../ui/Toast.jsx'

// ponytail: notifications are derived client-side from ticket:update events and kept in localStorage;
// add a Notification model + endpoint if they must survive across devices.
const Ctx = createContext({ items: [], unread: 0, markAllRead: () => {}, clear: () => {} })

// Android Chrome throws on `new Notification` (needs a service worker) – ignore, the in-app center is the source of truth
const osNotify = (title, body) => { try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.svg' }) } catch {} }

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const toast = useToast()
  const key = user ? `queueless.notifications.${user._id}` : null
  // key + items live in one state so the save effect can never run against another user's (or the initial empty) list
  const [store, setStore] = useState({ key: null, items: [] })
  const items = store.items
  const setItems = (fn) => setStore((s) => ({ ...s, items: typeof fn === 'function' ? fn(s.items) : fn }))
  const last = useRef(new Map()) // tokenId -> last ticket seen

  useEffect(() => {
    let loaded = []
    if (key) try { loaded = JSON.parse(localStorage.getItem(key)) || [] } catch {}
    setStore({ key, items: loaded })
    last.current = new Map()
  }, [key])
  useEffect(() => { if (store.key && store.key === key) try { localStorage.setItem(key, JSON.stringify(store.items.slice(0, 50))) } catch {} }, [store, key])

  useTicketUpdates((t) => {
    if (!key) return
    const prev = last.current.get(t._id)
    last.current.set(t._id, t)
    const push = (kind, title, body, tone = 'info') => {
      setItems((xs) => [{ id: `${t._id}:${kind}:${Date.now()}`, kind, title, body, tone, at: new Date().toISOString(), tokenId: t._id, queueId: t.queue._id, read: false }, ...xs])
      toast.info(title, { description: body })
      osNotify(title, body)
    }
    const shop = t.queue.name
    const fresh = !prev && Date.now() - new Date(t.createdAt) < 15000
    if (t.status === 'serving' && prev?.status !== 'serving') push('turn', "It's your turn.", `${shop} is now serving #${t.number}. Please go in.`, 'success')
    else if (t.status === 'waiting' && t.ahead === 1 && (!prev || prev.ahead > 1)) push('next', 'Your turn is next.', `Please return to ${shop}.`, 'warning')
    else if (t.status === 'waiting' && t.ahead <= 3 && t.ahead > 1 && !fresh && (!prev || prev.ahead > 3)) push('approaching', 'Your turn is approaching.', `Only ${t.ahead} people are ahead of you at ${shop}.`, 'warning')
    else if (t.status === 'waiting' && prev && prev.currentNumber !== t.currentNumber && t.currentNumber != null) push('update', 'Your queue updated.', `${shop} is now serving #${t.currentNumber}.`)
    else if (t.status === 'served' && prev?.status !== 'served') push('done', 'Service completed.', 'Thanks for using QueueLess.', 'success')
    else if (t.status === 'skipped' && prev?.status !== 'skipped') push('skipped', 'Your token was skipped.', `Ask the counter at ${shop} to be called again.`, 'danger')
  })

  const value = useMemo(() => ({
    items,
    unread: items.filter((x) => !x.read).length,
    markAllRead: () => setItems((xs) => xs.map((x) => ({ ...x, read: true }))),
    clear: () => setItems([]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useNotifications = () => useContext(Ctx)
