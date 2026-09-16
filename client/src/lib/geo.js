import { useCallback, useState } from 'react'

const KEY = 'queueless.location'
// Default map center when the user has no location yet (matches the seed data)
export const DEFAULT_CENTER = { lat: 26.4499, lng: 80.3319 }

export const readSavedLocation = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }
export const saveLocation = (loc) => { try { loc ? localStorage.setItem(KEY, JSON.stringify(loc)) : localStorage.removeItem(KEY) } catch {} }

/**
 * Browser geolocation with a clean state machine:
 * status: 'idle' | 'prompt' | 'loading' | 'granted' | 'denied' | 'manual'
 */
export function useGeolocation() {
  const saved = readSavedLocation()
  const [status, setStatus] = useState(saved ? saved.manual ? 'manual' : 'granted' : 'idle')
  const [location, setLocation] = useState(saved ? { lat: saved.lat, lng: saved.lng, label: saved.label } : null)

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) return setStatus('denied')
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your current location' }
        setLocation(loc); saveLocation(loc); setStatus('granted')
      },
      () => setStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  const setManual = useCallback((loc) => {
    const l = { ...loc, manual: true }
    setLocation(l); saveLocation(l); setStatus('manual')
  }, [])

  const clear = useCallback(() => { setLocation(null); saveLocation(null); setStatus('idle') }, [])

  return { status, location, request, setManual, clear }
}

export const haversineKm = (a, b) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export const directionsUrl = (loc, name) => `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}${name ? `&destination_place_id=&travelmode=driving` : ''}`
