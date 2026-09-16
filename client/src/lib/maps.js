// Google Maps Platform loader (Maps JavaScript API + Places + Marker libraries), loaded on demand.
export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

let promise = null
let failed = false
if (typeof window !== 'undefined') window.gm_authFailure = () => { failed = true; window.dispatchEvent(new Event('maps:authfailure')) }

export const mapsAvailable = () => !!MAPS_KEY && !failed

export function loadMaps() {
  if (!MAPS_KEY) return Promise.reject(new Error('missing-key'))
  if (failed) return Promise.reject(new Error('auth-failure'))
  promise ??= new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) return resolve()
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&v=weekly&loading=async&libraries=places,marker`
    s.async = true
    s.onload = resolve
    s.onerror = () => { promise = null; reject(new Error('load-failed')) }
    document.head.appendChild(s)
  }).then(() => Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('marker'), google.maps.importLibrary('places')]))
    .then(([maps, marker, places]) => ({ maps, marker, places }))
  return promise
}

/** DOM content for a QueueLess pin (used by AdvancedMarkerElement). */
export function pinElement({ color = '#2f6bff', label, selected = false, kind = 'shop' } = {}) {
  const el = document.createElement('div')
  el.className = `ql-pin ql-pin-${kind}${selected ? ' selected' : ''}`
  el.style.setProperty('--pin', color)
  if (kind === 'user') {
    el.innerHTML = '<span class="ql-user-dot"></span>'
  } else {
    el.innerHTML = `<span class="ql-pin-head">${label ?? ''}</span><span class="ql-pin-tail"></span>`
  }
  return el
}
