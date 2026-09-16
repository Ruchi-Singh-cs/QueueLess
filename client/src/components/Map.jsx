import { useEffect, useRef, useState } from 'react'
import { Navigation, Crosshair } from 'lucide-react'
import { loadMaps, mapsAvailable, MAP_ID, pinElement } from '../lib/maps.js'
import { useTheme } from '../lib/theme.jsx'
import { category } from '../lib/format.js'
import { Button, Spinner, cx } from '../ui/index.jsx'
import { OsmMap } from './OsmMap.jsx'

/**
 * Map with QueueLess markers. Uses Google Maps when VITE_GOOGLE_MAPS_API_KEY is set, otherwise the free OpenStreetMap provider (OsmMap).
 * markers: [{ id, position: {lat,lng}, category, label }]
 * user: {lat,lng} | null   selected: id | null   onSelect(id)   fit: refit bounds when markers change
 */
export function GoogleMap({ center, zoom = 14, markers = [], user, selected, onSelect, fit = true, className, style, children, onReady }) {
  const box = useRef(null)
  const mapRef = useRef(null)
  const objs = useRef({ markers: new Map(), user: null, lib: null, fitKey: '' })
  const [state, setState] = useState(mapsAvailable() ? 'loading' : 'unavailable')
  const { resolved } = useTheme()

  // create map
  useEffect(() => {
    if (!mapsAvailable()) return
    let dead = false
    setState('loading') // (re)creating, e.g. after a theme change; markers re-attach once 'ready'
    loadMaps().then((lib) => {
      if (dead || !box.current) return
      objs.current.lib = lib
      const map = new google.maps.Map(box.current, {
        center: center || { lat: 20.5937, lng: 78.9629 }, zoom, mapId: MAP_ID,
        disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy', clickableIcons: false,
        colorScheme: resolved === 'dark' ? 'DARK' : 'LIGHT',
      })
      mapRef.current = map
      setState('ready')
      onReady?.(map)
    }).catch(() => setState('unavailable'))
    const onFail = () => setState('unavailable')
    window.addEventListener('maps:authfailure', onFail)
    return () => { dead = true; window.removeEventListener('maps:authfailure', onFail); mapRef.current = null; objs.current.markers.clear(); objs.current.user = null; objs.current.fitKey = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved])

  // markers
  useEffect(() => {
    const map = mapRef.current, { lib } = objs.current
    if (!map || !lib) return
    const { AdvancedMarkerElement } = lib.marker
    const seen = new Set()
    for (const m of markers) {
      seen.add(m.id)
      const cat = category(m.category)
      let entry = objs.current.markers.get(m.id)
      if (!entry) {
        const content = pinElement({ color: cat.color, label: m.label, selected: m.id === selected })
        const marker = new AdvancedMarkerElement({ map, position: m.position, content, title: m.title })
        marker.addListener('click', () => onSelect?.(m.id))
        entry = { marker, content }
        objs.current.markers.set(m.id, entry)
        content.classList.add('drop')
      } else {
        entry.marker.position = m.position
        entry.content.classList.toggle('selected', m.id === selected)
        entry.content.querySelector('.ql-pin-head').textContent = m.label ?? ''
      }
      entry.marker.zIndex = m.id === selected ? 10 : 1
    }
    for (const [id, entry] of objs.current.markers) if (!seen.has(id)) { entry.marker.map = null; objs.current.markers.delete(id) }
    // refit only when the set of markers changes, never on ordinary re-renders (would fight the user's panning)
    const fitKey = markers.map((m) => m.id).sort().join(',') + (user ? '|u' : '')
    if (fit && fitKey !== objs.current.fitKey && (markers.length || user)) {
      objs.current.fitKey = fitKey
      const b = new google.maps.LatLngBounds()
      markers.forEach((m) => b.extend(m.position))
      if (user) b.extend(user)
      if (markers.length + (user ? 1 : 0) === 1) { map.setCenter(b.getCenter()); map.setZoom(15) }
      else map.fitBounds(b, 56)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, markers, selected, fit])

  // user marker
  useEffect(() => {
    const map = mapRef.current, { lib } = objs.current
    if (!map || !lib) return
    if (!user) { if (objs.current.user) objs.current.user.map = null; objs.current.user = null; return }
    if (!objs.current.user) objs.current.user = new lib.marker.AdvancedMarkerElement({ map, position: user, content: pinElement({ kind: 'user' }), title: 'You are here', zIndex: 5 })
    else objs.current.user.position = user
  }, [state, user])

  // pan to selected
  useEffect(() => {
    const map = mapRef.current
    const m = markers.find((x) => x.id === selected)
    if (map && m) map.panTo(m.position)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  if (state === 'unavailable') return <OsmMap center={center} zoom={zoom} markers={markers} user={user} selected={selected} onSelect={onSelect} fit={fit} className={className} style={style}>{children}</OsmMap>
  return (
    <div className={cx('map', className)} style={style}>
      <div ref={box} className="map-canvas" />
      {state === 'loading' && <div className="map-loading"><Spinner /></div>}
      {children}
    </div>
  )
}

/** Small floating control to re-center on the user. */
export function RecenterButton({ onClick }) {
  return <Button variant="secondary" size="sm" icon={Crosshair} className="map-recenter" aria-label="Recenter on my location" onClick={onClick} />
}

export { Navigation }
