import { io } from 'socket.io-client'

const KEY = 'queueless.auth'

export function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { token: null, user: null }
  } catch {
    return { token: null, user: null }
  }
}

export function writeAuth(auth) {
  try {
    if (auth?.token) localStorage.setItem(KEY, JSON.stringify(auth))
    else localStorage.removeItem(KEY)
  } catch {}
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const { token } = readAuth()
  if (query) {
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    if (qs) path += (path.includes('?') ? '&' : '?') + qs
  }
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && token && path !== '/api/auth/login') {
    writeAuth(null)
    location.assign('/login')
  }
  if (!res.ok) throw new Error(data.error || res.statusText)
  return data
}

let socket = null

export function getSocket() {
  if (!socket) socket = io({ auth: { token: readAuth().token } })
  return socket
}

export function resetSocket() {
  if (socket) socket.disconnect()
  socket = null
}

export const isActive = (t) => t.status === 'waiting' || t.status === 'serving'
