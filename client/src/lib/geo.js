import { useCallback, useState } from 'react'

const KEY = 'queueless.location'
// Default map center when the user has no location yet (matches the seed data)
export const DEFAULT_CENTER = { lat: 26.8444, lng: 80.8590 } // Lucknow — where the demo data is seeded

export const readSavedLocation = () => { try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null } }

// Browsers report how good a fix is. Without GPS (most laptops) they locate you from Wi-Fi or your IP,
// which is routinely kilometres out — so anything looser than this we call approximate and offer to correct.
export const COARSE_METRES = 750
export const isCoarse = (loc) => !!loc?.accuracy && loc.accuracy > COARSE_METRES
export const fmtAccuracy = (m) => (m >= 1000 ? `±${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km` : `±${Math.round(m)} m`)
export const saveLocation = (loc) => { try { loc ? localStorage.setItem(KEY, JSON.stringify(loc)) : localStorage.removeItem(KEY) } catch {} }

/** Browser geolocation. status: 'idle' | 'loading' | 'granted' | 'denied' | 'manual' */
export function useGeolocation() {
  const saved = readSavedLocation()
  const [status, setStatus] = useState(saved ? saved.manual ? 'manual' : 'granted' : 'idle')
  const [location, setLocation] = useState(saved ? { lat: saved.lat, lng: saved.lng, label: saved.label, accuracy: saved.accuracy } : null)

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) return setStatus('denied')
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // accuracy is the radius in metres the browser is confident about — keep it, the UI needs to be honest
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), label: 'Your current location' }
        setLocation(loc); saveLocation(loc); setStatus('granted')
      },
      () => setStatus('denied'),
      // maximumAge 0: never hand back a cached fix from a previous session, which is a common source of
      // "it put me in the wrong place". A longer timeout gives a real GPS fix time to arrive.
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
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
