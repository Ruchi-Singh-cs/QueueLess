import { useCallback, useEffect, useRef, useState } from 'react'
import { api, getSocket } from '../api.js'

/** Fetch JSON with loading/error/reload. `deps` re-run the fetch. */
export function useFetch(path, { query, deps = [], enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !!enabled })
  const key = JSON.stringify([path, query, enabled])
  const load = useCallback(() => {
    if (!enabled) return setState({ data: null, error: null, loading: false })
    setState((s) => ({ ...s, loading: true, error: null }))
    api(path, { query }).then((data) => setState({ data, error: null, loading: false })).catch((e) => setState({ data: null, error: e.message, loading: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps])
  useEffect(load, [load])
  return { ...state, reload: load, setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) }
}

/** Subscribe to `queue:update` for a set of queue ids. */
export function useQueueWatch(ids, onUpdate) {
  const key = (ids || []).filter(Boolean).join(',')
  const cb = useRef(onUpdate)
  cb.current = onUpdate
  useEffect(() => {
    if (!key) return
    const list = key.split(',')
    const socket = getSocket()
    const watch = () => list.forEach((id) => socket.emit('queue:watch', id))
    const handler = (u) => list.includes(u.queueId) && cb.current?.(u)
    socket.on('connect', watch)
    socket.on('queue:update', handler)
    if (socket.connected) watch()
    return () => {
      socket.off('connect', watch)
      socket.off('queue:update', handler)
      list.forEach((id) => socket.emit('queue:unwatch', id))
    }
  }, [key])
}

/** Subscribe to `ticket:update` (my tokens). */
export function useTicketUpdates(onTicket) {
  const cb = useRef(onTicket)
  cb.current = onTicket
  useEffect(() => {
    const socket = getSocket()
    const handler = (t) => cb.current?.(t)
    socket.on('ticket:update', handler)
    return () => socket.off('ticket:update', handler)
  }, [])
}

/** Apply a queue:update payload to a shop summary object. */
export const applyUpdate = (q, u) => ({ ...q, isOpen: u.isOpen, avgServiceMinutes: u.avgServiceMinutes, currentNumber: u.currentNumber, waitingCount: u.waitingNumbers.length, etaMinutes: Math.round(u.waitingNumbers.length * u.avgServiceMinutes) })

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

export function useMedia(query) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/** Persisted state in localStorage (per browser). */
export function useLocalState(key, initial) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial } catch { return initial } })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }, [key, v])
  return [v, setV]
}
