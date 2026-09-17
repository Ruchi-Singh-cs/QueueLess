import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { cx } from '../ui/index.jsx'

/**
 * Single-series bar chart (inline SVG). One hue, thin rounded bars anchored to the baseline, per-bar hover tooltip,
 * recessive grid. data: [{ label, value }]. `format` formats values for the tooltip.
 */
export function BarChart({ data, height = 160, format = (v) => v, labelEvery = 1, className, ariaLabel }) {
  const id = useId()
  const [hover, setHover] = useState(null)
  const box = useRef(null)
  const [W, setW] = useState(600)
  // 1 SVG unit = 1px so text and strokes never scale with the container
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width)))); ro.observe(el); return () => ro.disconnect() }, [])
  const H = height, padB = 22, padT = 18
  const max = Math.max(1, ...data.map((d) => d.value))
  const n = data.length || 1
  const slot = W / n
  const bw = Math.max(4, Math.min(28, slot * 0.6))
  const y = (v) => padT + (1 - v / max) * (H - padT - padB)
  const ticks = [...new Set([0, 0.5, 1].map((t) => Math.round(max * t)))]
  return (
    <figure ref={box} className={cx('chart', className)} aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} className="chart-grid" />)}
        {data.map((d, i) => {
          const x = i * slot + (slot - bw) / 2
          const top = y(d.value), h = H - padB - top
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}>
              <rect x={i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              <rect x={x} y={top} width={bw} height={Math.max(0, h)} rx={Math.min(4, bw / 2)} className={cx('chart-bar', hover === i && 'hot')} clipPath={`url(#${id}-c${i})`} />
              <clipPath id={`${id}-c${i}`}><rect x={x} y={top} width={bw} height={Math.max(0, h) + 8} /></clipPath>
              {i % labelEvery === 0 && <text x={i * slot + slot / 2} y={H - 6} textAnchor="middle" className="chart-label">{d.label}</text>}
            </g>
          )
        })}
      </svg>
      {hover != null && data[hover] && (
        <div className="chart-tip" style={{ left: `${((hover + 0.5) / n) * 100}%` }}><b>{format(data[hover].value)}</b><span>{data[hover].full || data[hover].label}</span></div>
      )}
      <table className="sr-only"><caption>{ariaLabel}</caption><tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.full || d.label}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </figure>
  )
}

/** Tiny line for stat cards. */
export function Sparkline({ values, width = 96, height = 28 }) {
  const max = Math.max(1, ...values), min = Math.min(...values)
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`).join(' ')
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="spark"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Weekday × hour intensity grid — "when is this shop actually busy".
 * `data` is number[7][24] with Sunday first, exactly as /stats returns it.
 */
export function HeatMap({ data, ariaLabel, format = (v) => `${v} token${v === 1 ? '' : 's'}` }) {
  const max = Math.max(1, ...data.flat())
  const hours = Array.from({ length: 24 }, (_, h) => h)
  return (
    <figure className="heat" aria-label={ariaLabel}>
      <div className="heat-grid">
        <span aria-hidden />
        {hours.map((h) => <span key={h} className="heat-hour" aria-hidden>{h % 6 === 0 ? h : ''}</span>)}
        {data.map((row, d) => (
          <Fragment key={d}>
            <span className="heat-day" aria-hidden>{WEEKDAYS[d]}</span>
            {row.map((v, h) => (
              <span key={h} className="heat-cell" style={{ '--v': v / max }}
                title={`${WEEKDAYS[d]} ${String(h).padStart(2, '0')}:00 UTC — ${format(v)}`} />
            ))}
          </Fragment>
        ))}
      </div>
      <figcaption className="heat-legend">
        <span className="xs faint">Quiet</span>
        <span className="heat-scale" aria-hidden />
        <span className="xs faint">Busy · hours are UTC</span>
      </figcaption>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>{data.map((row, d) => <tr key={d}><th scope="row">{WEEKDAYS[d]}</th><td>{format(row.reduce((a, b) => a + b, 0))}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
