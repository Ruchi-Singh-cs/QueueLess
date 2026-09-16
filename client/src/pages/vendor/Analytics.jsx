import { CheckCircle2, SkipForward, Clock, Users } from 'lucide-react'
import { useVendor } from './VendorContext.jsx'
import { useFetch } from '../../lib/hooks.js'
import { fmtMin } from '../../lib/format.js'
import { StatCard, Skeleton, ErrorState, PageTransition, Button } from '../../ui/index.jsx'
import { BarChart } from '../../components/Chart.jsx'

export default function Analytics() {
  const { shop, shopId, state } = useVendor()
  const { data, loading, error, reload } = useFetch(`/api/queues/${shopId}/stats`, { deps: [state?.queue?.currentNumber] })
  if (!shop) return null
  const hours = (data?.perHour || []).map((h) => ({ label: `${h.hour}`, full: `${h.hour}:00 – ${h.hour + 1}:00 UTC`, value: h.count }))
  const busiest = data?.perHour?.reduce((a, b) => (b.count > a.count ? b : a), { hour: 0, count: 0 })
  return (
    <PageTransition className="stack gap-6">
      <div className="page-head" style={{ marginBottom: 0 }}><div><h1>Analytics</h1><p className="sub">Today at {shop.name}.</p></div><Button variant="secondary" size="sm" onClick={reload}>Refresh</Button></div>
      {error ? <ErrorState onRetry={reload}>We couldn't load analytics.</ErrorState> : loading && !data ? <div className="grid grid-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={110} r={16} />)}</div> : (
        <>
          <div className="grid grid-4">
            <StatCard label="Tokens issued" value={data.total} sub={`${data.waiting} still waiting`} icon={Users} accent />
            <StatCard label="Served" value={data.served} sub={data.total ? `${Math.round((data.served / data.total) * 100)}% of tokens` : '—'} icon={CheckCircle2} />
            <StatCard label="Average wait" value={data.served ? fmtMin(data.avgWaitMinutes) : '–'} sub="join → called" icon={Clock} animated={false} />
            <StatCard label="Skipped / left" value={`${data.skipped} / ${data.left}`} sub="no-shows and drop-offs" icon={SkipForward} animated={false} />
          </div>
          <section className="card">
            <div className="between mb-4"><div><h3>Tokens by hour</h3><p className="small muted">When customers join today{busiest?.count ? ` · busiest around ${busiest.hour}:00 UTC` : ''}.</p></div></div>
            {data.total ? <BarChart data={hours} labelEvery={3} ariaLabel="Tokens issued per hour today" format={(v) => `${v} token${v === 1 ? '' : 's'}`} /> : <p className="muted small">No tokens yet today — the chart fills in as customers join.</p>}
          </section>
          <p className="xs faint">Daily stats reset at midnight UTC. “Left” counts customers who removed themselves from the queue.</p>
        </>
      )}
    </PageTransition>
  )
}
