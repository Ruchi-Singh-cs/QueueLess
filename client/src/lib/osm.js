// Free map provider: OpenStreetMap standard tiles rendered with Leaflet (loaded on demand). No key, no billing.
// ponytail: osm.org tiles are fine for a demo/low traffic (see their tile usage policy); point TILES at your own or a paid tile host for production.
import { pinElement } from './maps.js'

let promise = null
export function loadLeaflet() {
  promise ??= Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => L.default || L)
  return promise
}

const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

export function createMap(L, el, { center, zoom = 14, theme = 'light' }) {
  const map = L.map(el, { zoomControl: false, attributionControl: true })
  L.control.zoom({ position: 'topright' }).addTo(map)
  map.setView([center.lat, center.lng], zoom)
  L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map)
  // dark mode: one tile source, re-toned with a CSS filter on the tile pane (see .map-dark in pages.css)
  const setTheme = (t) => el.classList.toggle('map-dark', t === 'dark')
  setTheme(theme)
  return { map, setTheme }
}

/** Leaflet marker whose icon is the same QueueLess pin used on Google Maps. */
export function pinIcon(L, opts) {
  const el = pinElement(opts)
  return opts.kind === 'user'
    ? L.divIcon({ html: el.outerHTML, className: 'ql-leaflet-icon', iconSize: [16, 16], iconAnchor: [8, 8] })
    : L.divIcon({ html: el.outerHTML, className: 'ql-leaflet-icon', iconSize: [44, 40], iconAnchor: [22, 40] })
}

// ponytail: Nominatim public endpoint (1 req/s, attribution required); swap for your own geocoder if traffic grows
export async function geocode(q, signal) {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('search failed')
  return (await res.json()).map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name, name: r.name }))
}
