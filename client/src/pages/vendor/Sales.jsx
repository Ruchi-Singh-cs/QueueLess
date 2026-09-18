import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVendor } from './VendorContext.jsx'
import { useFetch } from '../../lib/hooks.js'
import { PageTransition, Button, Segmented, Alert } from '../../ui/index.jsx'
import { SalesReport, RANGES } from '../../components/SalesReport.jsx'

export default function Sales() {
  const { shop, shopId, state } = useVendor()
  const [days, setDays] = useState('30')
  const { data, loading, error, reload } = useFetch(`/api/queues/${shopId}/sales`, { query: { days } })
  if (!shop) return null
  const ex = state?.expressConfig

  return (
    <PageTransition className="stack gap-6">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><h1>Sales</h1><p className="sub">Express-slot payments at {shop.name} over the last {days} days.</p></div>
        <div className="row gap-2 wrap">
          <Segmented label="Date range" value={days} onChange={setDays} options={RANGES} />
          <Button variant="secondary" size="sm" onClick={reload}>Refresh</Button>
        </div>
      </div>
      {ex && !ex.enabled && <Alert tone="info">Express slots are switched off, so nothing new will sell. Turn them on in <Link to="/vendor/settings">Settings</Link>.</Alert>}
      <SalesReport data={data} days={days} loading={loading} error={error} reload={reload} />
      <p className="xs faint">Amounts are what customers paid at checkout; Razorpay settles them to your bank account minus its fee. Days run midnight to midnight UTC.</p>
    </PageTransition>
  )
}
