import { useState } from 'react'
import { MapPin, Search, RefreshCw, Navigation } from 'lucide-react'
import { Button, Input, Field, cx } from '../ui/index.jsx'
import { DEFAULT_CENTER } from '../lib/geo.js'

/**
 * Location permission UX. status from useGeolocation. Never blocks: "continue without location" uses a default city center.
 */
export function LocationPrompt({ status, onAllow, onManual, compact }) {
  const [manual, setManual] = useState(false)
  const [form, setForm] = useState({ label: '', lat: '', lng: '' })
  const denied = status === 'denied'

  if (manual) {
    const ok = Number.isFinite(Number(form.lat)) && Number.isFinite(Number(form.lng)) && form.lat !== '' && form.lng !== ''
    return (
      <div className={cx('loc-prompt card', compact && 'card-sm')}>
        <span className="icon-box"><Search aria-hidden /></span>
        <h3>Search manually</h3>
        <p className="muted small">Enter an area name and coordinates, or use the demo city center.</p>
        <div className="stack gap-3 mt-3" style={{ width: '100%', maxWidth: 360 }}>
          <Field label="Area" htmlFor="loc-label"><Input id="loc-label" placeholder="e.g. Civil Lines, Kanpur" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <div className="grid grid-2">
            <Field label="Latitude" htmlFor="loc-lat"><Input id="loc-lat" type="number" step="any" placeholder="26.4499" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
            <Field label="Longitude" htmlFor="loc-lng"><Input id="loc-lng" type="number" step="any" placeholder="80.3319" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
          </div>
          <div className="row gap-2 wrap">
            <Button variant="primary" disabled={!ok} onClick={() => onManual({ lat: Number(form.lat), lng: Number(form.lng), label: form.label || 'Custom location' })}>Use this location</Button>
            <Button variant="ghost" onClick={() => onManual({ ...DEFAULT_CENTER, label: 'Kanpur city center' })}>Use demo city</Button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setManual(false)}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div className={cx('loc-prompt card', compact && 'card-sm')}>
      <span className={cx('icon-box', denied && 'government')}>{denied ? <MapPin aria-hidden /> : <Navigation aria-hidden />}</span>
      <h3>{denied ? 'Location access is unavailable.' : 'Find services near you.'}</h3>
      <p className="muted">{denied ? "We couldn't read your location. You can try again or search an area manually." : 'Use your location to discover QueueLess businesses nearby.'}</p>
      <div className="row gap-2 wrap mt-3" style={{ justifyContent: 'center' }}>
        <Button variant="primary" icon={denied ? RefreshCw : MapPin} loading={status === 'loading'} onClick={onAllow}>{denied ? 'Try Again' : 'Allow Location'}</Button>
        <Button variant="secondary" icon={Search} onClick={() => setManual(true)}>Search Manually</Button>
      </div>
      {!denied && <p className="xs faint mt-3">You can continue without location.</p>}
    </div>
  )
}
