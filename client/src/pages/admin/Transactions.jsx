import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFetch } from '../../lib/hooks.js'
import { num } from '../../lib/format.js'
import { PageTransition, Button, Segmented } from '../../ui/index.jsx'
import { SalesReport, RANGES, rupees } from '../../components/SalesReport.jsx'

export default function Transactions() {
  const [days, setDays] = useState('30')
  const { data, loading, error, reload } = useFetch('/api/admin/transactions', { query: { days } })

  return (
    <PageTransition className="stack gap-6">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><h1>Transactions</h1><p className="sub">Every express-slot payment across the platform, last {days} days.</p></div>
        <div className="row gap-2 wrap">
          <Segmented label="Date range" value={days} onChange={setDays} options={RANGES} />
          <Button variant="secondary" size="sm" onClick={reload}>Refresh</Button>
        </div>
      </div>
      <SalesReport data={data} days={days} loading={loading} error={error} reload={reload} showShop>
        {data?.byShop.length > 0 && (
          <section className="card">
            <div className="between mb-4"><div><h3>By shop</h3><p className="small muted">Who is selling express slots and how much they bring in.</p></div></div>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Shop</th><th>Slots sold</th><th>Share</th><th style={{ textAlign: 'right' }}>Revenue</th></tr></thead>
              <tbody>{data.byShop.map((s) => (
                <tr key={s._id}>
                  <td><Link to={`/shop/${s._id}`} className="strong" style={{ color: 'inherit' }}>{s.name}</Link></td>
                  <td>{num(s.count)}</td>
                  <td className="muted">{Math.round((s.amount / data.amount) * 100)}%</td>
                  <td style={{ textAlign: 'right' }} className="strong">{rupees(s.amount)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        )}
      </SalesReport>
      <p className="xs faint">Payments go straight to each shop's Razorpay account; this is a record, not a platform balance. Days run midnight to midnight UTC.</p>
    </PageTransition>
  )
}
