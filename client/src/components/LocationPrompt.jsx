import { useState } from 'react'
import { MapPin, Search, RefreshCw, Navigation } from 'lucide-react'
import { Button, cx } from '../ui/index.jsx'
import { DEFAULT_CENTER } from '../lib/geo.js'
import { LocationPicker } from './LocationPicker.jsx'

/**
 * Location permission UX. status from useGeolocation. Never blocks: "continue without location" uses a default city center.
 * The manual path is a real map with a draggable pin — asking a customer to type latitude and longitude
 * was never going to get anyone to their exact spot.
 */
export function LocationPrompt({ status, onAllow, onManual, compact, startManual = false, title, hint }) {
  const [manual, setManual] = useState(startManual)
  const [pin, setPin] = useState(null)
  const denied = status === 'denied'

  if (manual) {
    return (
      <div className={cx('loc-prompt loc-prompt-wide card', compact && 'card-sm')}>
        <h3>{title || 'Set your location'}</h3>
        <p className="muted small">Search for your area, or drag the pin to exactly where you are.</p>
        <div className="mt-4" style={{ width: '100%' }}>
          <LocationPicker value={pin} onChange={setPin} />
        </div>
        <div className="row gap-2 wrap mt-4" style={{ width: '100%' }}>
          <Button variant="primary" disabled={!pin} onClick={() => onManual({ lat: pin.lat, lng: pin.lng, label: pin.address || pin.name || 'Your location' })}>Use this location</Button>
          <Button variant="ghost" onClick={() => onManual({ ...DEFAULT_CENTER, label: 'Kanpur city center' })}>Use demo city</Button>
          <Button variant="ghost" onClick={() => setManual(false)}>Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cx('loc-prompt card', compact && 'card-sm')}>
      <span className={cx('icon-box', denied && 'government')}>{denied ? <MapPin aria-hidden /> : <Navigation aria-hidden />}</span>
      <h3>{denied ? 'Location access is unavailable.' : 'Find services near you.'}</h3>
      <p className="muted">{hint || (denied ? "We couldn't read your location. You can try again, or point to your area on a map." : 'Use your location to discover QueueLess businesses nearby.')}</p>
      <div className="row gap-2 wrap mt-3" style={{ justifyContent: 'center' }}>
        <Button variant="primary" icon={denied ? RefreshCw : MapPin} loading={status === 'loading'} onClick={onAllow}>{denied ? 'Try Again' : 'Allow Location'}</Button>
        <Button variant="secondary" icon={Search} onClick={() => setManual(true)}>Pick on map</Button>
      </div>
      {!denied && <p className="xs faint mt-3">You can continue without location.</p>}
    </div>
  )
}
