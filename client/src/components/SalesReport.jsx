import { useState } from 'react'
import { IndianRupee, Zap, Users, TrendingUp } from 'lucide-react'
import { fmtDate, fmtTime, num } from '../lib/format.js'
import { StatCard, Badge, Skeleton, ErrorState, EmptyState, Button } from '../ui/index.jsx'
import { BarChart } from './Chart.jsx'

export const RANGES = [{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]
export const rupees = (paise) => `₹${new Intl.NumberFormat('en-IN').format(Math.round((paise || 0) / 100))}`

const TONE = { served: 'success', serving: 'info', waiting: 'warning', skipped: 'danger', left: 'neutral' }

/** Express-slot sales: totals, a per-day revenue chart and the payment list. Shared by the vendor and admin pages. */
export function SalesReport({ data, days, loading, error, reload, showShop, children }) {
  const [all, setAll] = useState(false)
  if (error) return <ErrorState onRetry={reload}>We couldn't load sales.</ErrorState>
  if (loading && !data) return <div className="grid grid-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={110} r={16} />)}</div>

  const byDay = data.byDay.map((d) => ({ label: d.day.slice(8), full: `${d.day} · ${d.count} slot${d.count === 1 ? '' : 's'}`, value: d.amount / 100 }))
  const best = data.byDay.reduce((a, b) => (b.amount > a.amount ? b : a), { amount: 0 })
  const active = data.byDay.filter((d) => d.count).length
  const perDay = active ? data.amount / active : 0
  // this-vs-last half of the range, so a 30-day view compares the latest 15 days with the 15 before
  const half = Math.floor(data.byDay.length / 2)
  const recent = data.byDay.slice(half).reduce((s, d) => s + d.amount, 0)
  const earlier = data.byDay.slice(0, half).reduce((s, d) => s + d.amount, 0)
  const trend = earlier ? Math.round(((recent - earlier) / earlier) * 100) : null

  return (
    <>
      <div className="grid grid-4">
        <StatCard label="Revenue" value={rupees(data.amount)} sub={`last ${days} days`} icon={IndianRupee} accent animated={false} />
        <StatCard label="Express slots sold" value={data.count} sub={data.count ? `avg ${rupees(data.amount / data.count)} each` : '—'} icon={Zap} />
        <StatCard label="Paying customers" value={data.customers} sub={data.count > data.customers ? `${data.count - data.customers} repeat purchase${data.count - data.customers === 1 ? '' : 's'}` : 'all first-time'} icon={Users} />
        <StatCard label="Trend" value={trend == null ? '–' : `${trend > 0 ? '+' : ''}${trend}%`} sub={trend == null ? 'not enough history' : 'vs the previous period'} icon={TrendingUp} animated={false} />
      </div>

      <section className="card">
        <div className="between mb-4">
          <div>
            <h3>Revenue by day</h3>
            <p className="small muted">{data.count ? `${rupees(perDay)} on an average selling day${best.amount ? ` · best day ${best.day} (${rupees(best.amount)})` : ''}.` : 'Express-slot payments will show up here.'}</p>
          </div>
        </div>
        {data.count
          ? <BarChart data={byDay} labelEvery={days === '7' ? 1 : days === '30' ? 5 : 15} ariaLabel={`Express revenue per day over the last ${days} days`} format={(v) => `₹${new Intl.NumberFormat('en-IN').format(v)}`} />
          : <p className="muted small">No express slots sold in this range yet.</p>}
      </section>

      {children}

      <section className="card">
        <div className="between mb-4"><div><h3>Transactions</h3><p className="small muted">Every paid express slot, newest first{data.transactions.length < data.count ? ` · showing ${data.transactions.length} of ${num(data.count)}` : ''}.</p></div></div>
        {data.transactions.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>When</th>{showShop && <th>Shop</th>}<th>Customer</th><th>Service</th><th>Token</th><th>Payment</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{(all ? data.transactions : data.transactions.slice(0, 40)).map((t) => (
              <tr key={t._id}>
                <td><span className="stack"><span>{fmtDate(t.at)}</span><span className="xs muted">{fmtTime(t.at)}</span></span></td>
                {showShop && <td>{t.queue?.name ?? '—'}</td>}
                <td>{t.user?.name ?? '—'}</td>
                <td className="muted">{t.service || '—'}</td>
                <td><span className="row gap-2">#{t.number}<Badge tone={TONE[t.status] || 'neutral'} size="sm">{t.status}</Badge></span></td>
                <td><code className="xs muted">{t.paymentId}</code></td>
                <td style={{ textAlign: 'right' }} className="strong">{rupees(t.amount)}</td>
              </tr>
            ))}</tbody>
          </table>{!all && data.transactions.length > 40 && <div className="row" style={{ justifyContent: 'center', padding: 12 }}><Button variant="secondary" size="sm" onClick={() => setAll(true)}>Show all {num(data.transactions.length)}</Button></div>}</div>
        ) : <EmptyState icon={Zap} title="No payments yet." />}
      </section>
    </>
  )
}
