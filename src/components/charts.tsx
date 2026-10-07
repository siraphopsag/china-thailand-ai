import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceMax } from '../domain/match/analytics'

/**
 * Small hand-made SVG charts for the admin analytics (owner, Oct 2026) — no chart library. One accent hue for one series
 * (the period before is the same data dashed, in muted ink), recessive grid, thin 2 px lines, a crosshair tooltip that also
 * works with the arrow keys, and a table view next to each chart. Colours come from the theme tokens, so they follow the
 * light/dark theme and the chosen accent.
 */
const W = 640, PAD = { l: 36, r: 12, t: 12, b: 26 }

/** a tiny trend line for a key-number card (decoration: the number beside it carries the meaning) */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values), w = 120, h = 32
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 4)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" aria-hidden preserveAspectRatio="none">
      <path d={`${line}L${w},${h}L0,${h}Z`} className="viz-area" />
      <path d={line} className="viz-line" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** one series over time, with the period before dashed behind it */
export function AreaChart({ points, prev, label, dayLabel, valueLabel, prevLabel, fill }: {
  points: { day: string; n: number }[]; prev?: number[]; label: string
  dayLabel: (day: string) => string; valueLabel: (n: number) => string; prevLabel: (n: number) => string
  /** take the height of the box (computers that fit the page to the screen) */
  fill?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [H, setH] = useState(220)
  useEffect(() => {
    const el = box.current; if (!fill || !el || typeof ResizeObserver === 'undefined') { setH(220); return }
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setH(Math.round(Math.min(380, Math.max(150, (W * r.height) / r.width)))) }
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect()
  }, [fill])
  const n = points.length
  if (!n) return null
  const max = niceMax(Math.max(1, ...points.map((p) => p.n), ...(prev ?? [0])))
  const x = (i: number) => PAD.l + (n === 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r))
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const cur = path(points.map((p) => p.n))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 10) / 10)
  const labelsAt = n <= 7 ? points.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1]
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.ownerSVGElement!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1)))))
  }
  const keys = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, Math.min(n - 1, (h ?? (e.key === 'ArrowRight' ? -1 : n)) + (e.key === 'ArrowRight' ? 1 : -1)))) }
    if (e.key === 'Escape') setHover(null)
  }
  const h = hover
  return (
    <div ref={box} className={`relative ${fill ? 'h-full min-h-0' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg" role="img" aria-label={label} tabIndex={0} onKeyDown={keys} onBlur={() => setHover(null)}>
        <defs><linearGradient id="viz-fade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" className="viz-stop-top" /><stop offset="1" className="viz-stop-bottom" /></linearGradient></defs>
        {ticks.map((v) => <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="viz-grid" /><text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="viz-tick">{v}</text></g>)}
        {labelsAt.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="viz-tick">{dayLabel(points[i].day)}</text>)}
        <path d={`${cur}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill="url(#viz-fade)" />
        {prev && prev.length === n && <path d={path(prev)} className="viz-prev" />}
        <path d={cur} className="viz-line" />
        {h !== null && <g><line x1={x(h)} x2={x(h)} y1={PAD.t} y2={H - PAD.b} className="viz-cross" /><circle cx={x(h)} cy={y(points[h].n)} r={5} className="viz-dot" /></g>}
        <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="transparent" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)} />
      </svg>
      {h !== null && (
        <div role="status" className="viz-tip pointer-events-none absolute top-1 rounded-lg px-3 py-2 text-xs shadow-lg" style={{ left: `${(x(h) / W) * 100}%`, transform: `translateX(${x(h) > W * 0.7 ? '-105%' : '5%'})` }}>
          <p className="opacity-80">{dayLabel(points[h].day)}</p>
          <p className="font-semibold text-sm">{valueLabel(points[h].n)}</p>
          {prev && prev.length === n && <p className="opacity-80">{prevLabel(prev[h])}</p>}
        </div>)}
    </div>
  )
}

/** parts of a whole (at most five), with the total in the middle; the legend list beside it carries names and numbers */
export function Donut({ parts, total, totalLabel }: { parts: { key: string; n: number }[]; total: number; totalLabel: string }) {
  const r = 70, c = 2 * Math.PI * r, gap = parts.filter((p) => p.n > 0).length > 1 ? 3 : 0
  let at = 0
  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40 shrink-0" role="img" aria-label={`${total} ${totalLabel}`}>
      <circle cx="100" cy="100" r={r} className="viz-ring" />
      {total > 0 && parts.map((p, i) => {
        if (!p.n) return null
        const len = (p.n / total) * c, seg = <circle key={p.key} cx="100" cy="100" r={r} className={`viz-seg viz-c${i + 1}`} strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-at} transform="rotate(-90 100 100)" />
        at += len
        return seg
      })}
      <text x="100" y="98" textAnchor="middle" className="viz-big">{total}</text>
      <text x="100" y="120" textAnchor="middle" className="viz-tick">{totalLabel}</text>
    </svg>
  )
}

/** daily activity as a grid of squares (one hue, light → dark); each square names its day and count */
export function Heatmap({ weeks, max, cellLabel, weekdayLabels }: { weeks: { day: string; n: number }[][]; max: number; cellLabel: (day: string, n: number) => string; weekdayLabels: string[] }) {
  // a fixed small size (stretched to the full width the squares and labels grew huge — owner, Oct 2026); narrow screens scroll
  const s = 12, g = 3, lw = 34
  const level = (n: number) => (n < 0 ? -1 : n === 0 || max === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)))
  const width = lw + weeks.length * (s + g), height = 7 * (s + g)
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" role="img" aria-label={weekdayLabels.join(' ')}>
        {weekdayLabels.map((w, i) => (i % 2 === 0 ? <text key={w} x={0} y={i * (s + g) + s - 2} className="viz-tick viz-tick-sm">{w}</text> : null))}
        {weeks.map((wk, x) => wk.map((d, y) => { const l = level(d.n); return l < 0 ? null : (
          <rect key={d.day} x={lw + x * (s + g)} y={y * (s + g)} width={s} height={s} rx={2.5} className={`viz-heat viz-h${l}`}><title>{cellLabel(d.day, d.n)}</title></rect>) }))}
      </svg>
    </div>
  )
}
