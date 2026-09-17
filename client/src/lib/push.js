import { api, readAuth } from '../api.js'

// Web Push: lets the server reach a customer after they've closed the tab. The in-app notification
// centre (lib/notifications.jsx) covers the tab-open case and stays the source of truth either way.

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// Registered lazily: a visitor who never turns notifications on never gets a service worker.
let registering = null
const registration = () => {
  if (!pushSupported()) return Promise.resolve(null)
  registering ??= navigator.serviceWorker.register('/sw.js').catch(() => null)
  return registering
}

let key = null
const vapid = () => (key ??= api('/api/push/key').catch(() => ({ enabled: false, publicKey: null })))

const decode = (b64) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const sameKey = (sub, bytes) => {
  const have = sub.options?.applicationServerKey
  if (!have) return false
  const a = new Uint8Array(have)
  return a.length === bytes.length && a.every((v, i) => v === bytes[i])
}

/**
 * Subscribe this device and hand the subscription to the server.
 * Throws a message worth showing the user when it can't.
 */
export async function subscribePush() {
  const { enabled, publicKey } = await vapid()
  if (!enabled || !publicKey) throw new Error('Background notifications are not set up on this server yet.')
  const reg = await registration()
  if (!reg) throw new Error("This browser can't do background notifications.")
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted')
    throw new Error('Notifications are blocked for this site in your browser settings.')

  const bytes = decode(publicKey)
  let sub = await reg.pushManager.getSubscription()
  // a subscription made against an older server key can never be delivered to — replace it
  if (sub && !sameKey(sub, bytes)) { await sub.unsubscribe().catch(() => {}); sub = null }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
  await api('/api/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } })
  return sub
}

/**
 * Stop pushes to this device. Never registers a worker of its own — it only tears down one that's
 * already there, so logging out doesn't install a service worker for someone who never opted in.
 * The server scopes the delete to the caller, so logout passes the token it is about to discard
 * rather than letting us read it back after it's gone.
 */
export async function unsubscribePush(token = readAuth().token) {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration('/').catch(() => null)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

/** 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on' — everything the settings UI needs. */
export async function pushState() {
  if (!pushSupported()) return 'unsupported'
  if (!(await vapid()).enabled) return 'unconfigured'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  const sub = await (await registration())?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

/**
 * Re-POST this device's existing subscription so the server binds it to whoever is logged in now,
 * and so a browser-rotated or re-keyed subscription heals itself. No-ops unless this device already
 * opted in — it never registers a worker or asks for permission on its own.
 */
export async function resyncPush() {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker.getRegistration('/').catch(() => null)
  if (!(await reg?.pushManager.getSubscription())) return false
  try {
    await subscribePush()
    return true
  } catch {
    return false
  }
}
