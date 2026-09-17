import { useState } from 'react'
import { CheckCircle2, SkipForward, Clock, Users, Flame } from 'lucide-react'
import { useVendor } from './VendorContext.jsx'
import { useFetch } from '../../lib/hooks.js'
import { fmtMin } from '../../lib/format.js'
import { StatCard, Skeleton, ErrorState, PageTransition, Button, Segmented, Alert } from '../../ui/index.jsx'
import { BarChart, HeatMap } from '../../components/Chart.jsx'

const RANGES = [{ value: '1', label: 'Today' }, { value: '7', label: '7 days' }, { value: '30', label: '30 days' }]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The busiest weekday+hour in the heatmap, or null if there's nothing in it yet. */
function peak(heat) {
  let best = null
  heat?.forEach((row, d) => row.forEach((count, h) => { if (count > (best?.count ?? 0)) best = { d, h, count } }))
  return best
}

export default function Analytics() {
  const { shop, shopId, state } = useVendor()
  const [days, setDays] = useState('1')
  const { data, loading, error, reload } = useFetch(`/api/queues/${shopId}/stats`, { query: { days }, deps: [state?.queue?.currentNumber] })
  if (!shop) return null

  const hours = (data?.perHour || []).map((h) => ({ label: `${h.hour}`, full: `${h.hour}:00 – ${h.hour + 1}:00 UTC`, value: h.count }))
  const byDay = (data?.byDay || []).map((d) => ({ label: d.day.slice(8), full: `${d.day} · ${d.served} served`, value: d.total }))
  const busiest = data?.perHour?.reduce((a, b) => (b.count > a.count ? b : a), { hour: 0, count: 0 })
  const hot = peak(data?.heat)
  const multiDay = days !== '1'

  return (
    <PageTransition className="stack gap-6">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div><h1>Analytics</h1><p className="sub">{multiDay ? `The last ${days} days at ${shop.name}.` : `Today at ${shop.name}.`}</p></div>
        <div className="row gap-2 wrap">
          <Segmented label="Date range" value={days} onChange={setDays} options={RANGES} />
          <Button variant="secondary" size="sm" onClick={reload}>Refresh</Button>
        </div>
      </div>
      {error ? <ErrorState onRetry={reload}>We couldn't load analytics.</ErrorState> : loading && !data ? <div className="grid grid-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h={110} r={16} />)}</div> : (
        <>
          <div className="grid grid-4">
            <StatCard label="Tokens issued" value={data.total} sub={`${data.waiting} still waiting`} icon={Users} accent />
            <StatCard label="Served" value={data.served} sub={data.total ? `${Math.round((data.served / data.total) * 100)}% of tokens` : '—'} icon={CheckCircle2} />
            <StatCard label="Average wait" value={data.served ? fmtMin(data.avgWaitMinutes) : '–'} sub="join → called" icon={Clock} animated={false} />
            <StatCard label="Skipped / left" value={`${data.skipped} / ${data.left}`} sub="no-shows and drop-offs" icon={SkipForward} animated={false} />
          </div>

          {hot?.count > 0 && multiDay && (
            <Alert tone="info" icon={Flame}>
              Busiest stretch: <b>{WEEKDAYS[hot.d]} around {String(hot.h).padStart(2, '0')}:00 UTC</b> — {hot.count} token{hot.count === 1 ? '' : 's'} in that hour. Worth a second counter.
            </Alert>
          )}

          <section className="card">
            <div className="between mb-4">
              <div>
                <h3>{multiDay ? 'Tokens by day' : 'Tokens by hour'}</h3>
                <p className="small muted">{multiDay ? `Every day in the last ${days}.` : `When customers join today${busiest?.count ? ` · busiest around ${busiest.hour}:00 UTC` : ''}.`}</p>
              </div>
            </div>
            {data.total ? (
              multiDay
                ? <BarChart data={byDay} labelEvery={days === '30' ? 5 : 1} ariaLabel={`Tokens issued per day over the last ${days} days`} format={(v) => `${v} token${v === 1 ? '' : 's'}`} />
                : <BarChart data={hours} labelEvery={3} ariaLabel="Tokens issued per hour today" format={(v) => `${v} token${v === 1 ? '' : 's'}`} />
            ) : <p className="muted small">No tokens in this range yet — the chart fills in as customers join.</p>}
          </section>

          <section className="card">
            <div className="between mb-4"><div><h3>Busy times</h3><p className="small muted">Every token in this range, by weekday and hour. Darker means busier.</p></div></div>
            {data.total ? <HeatMap data={data.heat} ariaLabel="Tokens issued by weekday and hour" /> : <p className="muted small">Nothing to map yet. Pick a longer range, or come back once you've served a few days.</p>}
          </section>

          <p className="xs faint">Days run midnight to midnight UTC. “Left” counts customers who removed themselves from the queue.</p>
        </>
      )}
    </PageTransition>
  )
}
