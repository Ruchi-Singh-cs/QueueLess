import { useEffect, useRef, useState } from 'react'
import { loadLeaflet, createMap, pinIcon } from '../lib/osm.js'
import { useTheme } from '../lib/theme.jsx'
import { category } from '../lib/format.js'
import { Spinner, cx } from '../ui/index.jsx'

/** OpenStreetMap (Leaflet) map with the same props as GoogleMap. Used when no Google Maps key is configured. */
export function OsmMap({ center, zoom = 14, markers = [], user, selected, onSelect, fit = true, className, style, children }) {
  const box = useRef(null)
  const refs = useRef({ L: null, map: null, setTheme: null, markers: new Map(), user: null, fitKey: '' })
  const [ready, setReady] = useState(false)
  const { resolved } = useTheme()

  useEffect(() => {
    let dead = false
    loadLeaflet().then((L) => {
      if (dead || !box.current) return
      const { map, setTheme } = createMap(L, box.current, { center: center || user || { lat: 20.5937, lng: 78.9629 }, zoom, theme: resolved })
      refs.current = { ...refs.current, L, map, setTheme }
      setReady(true)
    })
    return () => { dead = true; refs.current.map?.remove(); refs.current = { L: null, map: null, setTheme: null, markers: new Map(), user: null, fitKey: '' }; setReady(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { refs.current.setTheme?.(resolved) }, [resolved])

  // markers
  useEffect(() => {
    const { L, map } = refs.current
    if (!map) return
    const seen = new Set()
    for (const m of markers) {
      seen.add(m.id)
      const opts = { color: category(m.category).color, label: m.label, selected: m.id === selected }
      let mk = refs.current.markers.get(m.id)
      if (!mk) {
        mk = L.marker([m.position.lat, m.position.lng], { icon: pinIcon(L, opts), title: m.title, riseOnHover: true }).addTo(map)
        mk.on('click', () => onSelect?.(m.id))
        refs.current.markers.set(m.id, mk)
      } else {
        mk.setLatLng([m.position.lat, m.position.lng])
        mk.setIcon(pinIcon(L, opts))
      }
      mk.setZIndexOffset(m.id === selected ? 1000 : 0)
    }
    for (const [id, mk] of refs.current.markers) if (!seen.has(id)) { mk.remove(); refs.current.markers.delete(id) }
    const fitKey = markers.map((m) => m.id).sort().join(',') + (user ? '|u' : '')
    if (fit && fitKey !== refs.current.fitKey && (markers.length || user)) {
      refs.current.fitKey = fitKey
      const pts = [...markers.map((m) => [m.position.lat, m.position.lng]), ...(user ? [[user.lat, user.lng]] : [])]
      if (pts.length === 1) map.setView(pts[0], 15)
      else map.fitBounds(L.latLngBounds(pts), { padding: [56, 56] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markers, selected, fit])

  // user marker
  useEffect(() => {
    const { L, map } = refs.current
    if (!map) return
    if (!user) { refs.current.user?.remove(); refs.current.user = null; return }
    if (!refs.current.user) refs.current.user = L.marker([user.lat, user.lng], { icon: pinIcon(L, { kind: 'user' }), title: 'You are here', interactive: false, zIndexOffset: 500 }).addTo(map)
    else refs.current.user.setLatLng([user.lat, user.lng])
  }, [ready, user])

  // pan to selected
  useEffect(() => {
    const m = markers.find((x) => x.id === selected)
    if (refs.current.map && m) refs.current.map.panTo([m.position.lat, m.position.lng])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  return (
    <div className={cx('map', className)} style={style}>
      <div ref={box} className="map-canvas" />
      {!ready && <div className="map-loading"><Spinner /></div>}
      {children}
    </div>
  )
}
