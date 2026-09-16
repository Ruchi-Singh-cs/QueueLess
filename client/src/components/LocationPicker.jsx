import { useEffect, useRef, useState } from 'react'
import { Crosshair, Search, MapPin } from 'lucide-react'
import { loadMaps, mapsAvailable, MAP_ID, pinElement } from '../lib/maps.js'
import { loadLeaflet, createMap, pinIcon, geocode } from '../lib/osm.js'
import { DEFAULT_CENTER } from '../lib/geo.js'
import { useTheme } from '../lib/theme.jsx'
import { useDebounced } from '../lib/hooks.js'
import { Button, Field, Input, Spinner, cx } from '../ui/index.jsx'

/**
 * Pick a point: address search → map → draggable marker → current location. Always shows lat/lng.
 * Google Maps (Places autocomplete) when a key is configured, otherwise OpenStreetMap + Nominatim (free).
 * value: {lat,lng} | null   onChange({lat,lng,address?,name?})
 */
export function LocationPicker({ value, onChange, color = '#2f6bff' }) {
  const google = mapsAvailable()
  const [locating, setLocating] = useState(false)
  function useCurrent() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); onChange({ lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => setLocating(false), { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const Picker = google ? GooglePicker : OsmPicker
  const pos = value || DEFAULT_CENTER
  return (
    <div className="stack gap-4">
      <Picker value={value} onChange={onChange} color={color} tools={<Button variant="secondary" icon={Crosshair} loading={locating} onClick={useCurrent}>Use Current Location</Button>} />
      <div className="grid grid-2">
        <Field label="Latitude" htmlFor="lat"><Input id="lat" type="number" step="any" value={value?.lat ?? ''} placeholder="26.4499" onChange={(e) => onChange({ ...pos, lat: Number(e.target.value) })} /></Field>
        <Field label="Longitude" htmlFor="lng"><Input id="lng" type="number" step="any" value={value?.lng ?? ''} placeholder="80.3319" onChange={(e) => onChange({ ...pos, lng: Number(e.target.value) })} /></Field>
      </div>
    </div>
  )
}

/* ---------------- OpenStreetMap + Nominatim ---------------- */
function OsmPicker({ value, onChange, color, tools }) {
  const box = useRef(null)
  const refs = useRef({ L: null, map: null, marker: null, setTheme: null })
  const [ready, setReady] = useState(false)
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 400)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const { resolved } = useTheme()
  const pos = value || DEFAULT_CENTER

  useEffect(() => {
    let dead = false
    loadLeaflet().then((L) => {
      if (dead || !box.current) return
      const { map, setTheme } = createMap(L, box.current, { center: pos, zoom: value ? 16 : 12, theme: resolved })
      const marker = L.marker([pos.lat, pos.lng], { icon: pinIcon(L, { color, label: '' }), draggable: true }).addTo(map)
      marker.on('dragend', () => { const p = marker.getLatLng(); onChange({ lat: p.lat, lng: p.lng }) })
      map.on('click', (e) => { marker.setLatLng(e.latlng); onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) })
      refs.current = { L, map, marker, setTheme }
      setReady(true)
    })
    return () => { dead = true; refs.current.map?.remove(); refs.current = { L: null, map: null, marker: null, setTheme: null } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { refs.current.setTheme?.(resolved) }, [resolved])
  useEffect(() => {
    const { map, marker } = refs.current
    if (!map || !value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return
    marker.setLatLng([value.lat, value.lng]); map.panTo([value.lat, value.lng])
  }, [value])

  useEffect(() => {
    if (dq.trim().length < 3) return setResults([])
    const ctl = new AbortController()
    setSearching(true)
    geocode(dq, ctl.signal).then(setResults).catch(() => {}).finally(() => setSearching(false))
    return () => ctl.abort()
  }, [dq])

  function pick(r) {
    setResults([]); setQ(r.label)
    refs.current.map?.setView([r.lat, r.lng], 16)
    onChange({ lat: r.lat, lng: r.lng, address: r.label, name: r.name })
  }

  return (
    <>
      <div className="picker-tools">
        <div className="place-search grow">
          <div className="input-wrap"><Search aria-hidden /><input className="input" placeholder="Search an address or place…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search address" autoComplete="off" />{searching && <Spinner className="place-spin" />}</div>
          {results.length > 0 && (
            <ul className="menu place-results" role="listbox">
              {results.map((r, i) => <li key={i}><button type="button" className="menu-item" role="option" onClick={() => pick(r)}><MapPin aria-hidden /><span className="truncate">{r.label}</span></button></li>)}
            </ul>
          )}
        </div>
        {tools}
      </div>
      <div className={cx('map map-picker')}>
        <div ref={box} className="map-canvas" />
        {!ready && <div className="map-loading"><Spinner /></div>}
        <div className="map-hint">Drag the pin or click the map to set the exact spot</div>
      </div>
    </>
  )
}

/* ---------------- Google Maps + Places ---------------- */
function GooglePicker({ value, onChange, color, tools }) {
  const box = useRef(null)
  const acBox = useRef(null)
  const refs = useRef({ map: null, marker: null })
  const [state, setState] = useState('loading')
  const { resolved } = useTheme()
  const pos = value || DEFAULT_CENTER

  useEffect(() => {
    let dead = false
    loadMaps().then(({ marker, places }) => {
      if (dead || !box.current) return
      const map = new google.maps.Map(box.current, { center: pos, zoom: value ? 16 : 12, mapId: MAP_ID, disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false, colorScheme: resolved === 'dark' ? 'DARK' : 'LIGHT' })
      const m = new marker.AdvancedMarkerElement({ map, position: pos, gmpDraggable: true, content: pinElement({ color, label: '' }) })
      m.addListener('dragend', () => { const p = m.position; onChange({ lat: typeof p.lat === 'function' ? p.lat() : p.lat, lng: typeof p.lng === 'function' ? p.lng() : p.lng }) })
      map.addListener('click', (e) => { const p = { lat: e.latLng.lat(), lng: e.latLng.lng() }; m.position = p; onChange(p) })
      refs.current = { map, marker: m }
      if (places.PlaceAutocompleteElement && acBox.current) {
        const el = new places.PlaceAutocompleteElement()
        acBox.current.replaceChildren(el)
        const pick = async (place) => {
          await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] })
          const loc = place.location
          if (!loc) return
          const p = { lat: loc.lat(), lng: loc.lng() }
          map.panTo(p); map.setZoom(16); m.position = p
          onChange({ ...p, address: place.formattedAddress, name: place.displayName })
        }
        el.addEventListener('gmp-select', (e) => pick(e.placePrediction.toPlace()))
        el.addEventListener('gmp-placeselect', (e) => pick(e.place))
      }
      setState('ready')
    }).catch(() => setState('error'))
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved])
  useEffect(() => {
    const { map, marker } = refs.current
    if (!map || !marker || !value) return
    marker.position = value; map.panTo(value)
  }, [value])

  if (state === 'error') return <OsmPicker value={value} onChange={onChange} color={color} tools={tools} />
  return (
    <>
      <div className="picker-tools">
        {state === 'ready' ? <div ref={acBox} className="place-ac grow" /> : <div className="input-wrap grow"><Search aria-hidden /><input className="input" placeholder="Loading places…" disabled /></div>}
        {tools}
      </div>
      <div className={cx('map map-picker')}>
        <div ref={box} className="map-canvas" />
        {state === 'loading' && <div className="map-loading"><Spinner /></div>}
        <div className="map-hint">Drag the pin or click the map to set the exact spot</div>
      </div>
    </>
  )
}
