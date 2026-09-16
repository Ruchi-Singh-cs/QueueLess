import { useEffect, useState } from 'react'
import { Save, MapPin, Navigation } from 'lucide-react'
import { api } from '../../api.js'
import { useVendor } from './VendorContext.jsx'
import { category, fmtAddress } from '../../lib/format.js'
import { directionsUrl } from '../../lib/geo.js'
import { Button, Alert, PageTransition, Badge } from '../../ui/index.jsx'
import { LocationPicker } from '../../components/LocationPicker.jsx'
import { useToast } from '../../ui/Toast.jsx'

export default function Location() {
  const { shop, shopId, setState } = useVendor()
  const toast = useToast()
  const [loc, setLoc] = useState(null)
  const [picked, setPicked] = useState(null) // address text from Places
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (shop && loc === null) setLoc(shop.location || null) }, [shop, loc])
  if (!shop) return null
  const dirty = loc && (!shop.location || loc.lat !== shop.location.lat || loc.lng !== shop.location.lng)

  async function save() {
    setBusy(true)
    try {
      const body = { location: { lat: loc.lat, lng: loc.lng } }
      if (picked?.address && !fmtAddress(shop.address)) body.address = { street: picked.address }
      setState(await api(`/api/queues/${shopId}`, { method: 'PATCH', body }))
      toast.success('Location updated.')
    } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <PageTransition className="stack gap-5" style={{ maxWidth: 880 }}>
      <div className="page-head" style={{ marginBottom: 0 }}><div><h1>Location</h1><p className="sub">Search for your address, then drag the pin to the exact entrance.</p></div><Button variant="primary" icon={Save} loading={busy} disabled={!dirty} onClick={save}>Save Location</Button></div>
      {!shop.location && <Alert tone="warning" icon={MapPin}>Your shop isn't on the map yet — customers can't find you in Nearby until you save a location.</Alert>}
      <div className="card stack gap-4">
        <LocationPicker value={loc} color={category(shop.category).color} onChange={(p) => { setLoc({ lat: p.lat, lng: p.lng }); if (p.address) setPicked({ address: p.address, name: p.name }) }} />
      </div>
      <div className="card between wrap gap-3">
        <div className="stack gap-1"><span className="eyebrow">Address</span><span>{picked?.address || fmtAddress(shop.address) || <span className="muted">Not set</span>}</span>{shop.location && <Badge tone="success" className="mt-2">Saved · {shop.location.lat.toFixed(5)}, {shop.location.lng.toFixed(5)}</Badge>}</div>
        {shop.location && <Button variant="secondary" icon={Navigation} href={directionsUrl(shop.location, shop.name)} target="_blank" rel="noreferrer">Preview directions</Button>}
      </div>
    </PageTransition>
  )
}
