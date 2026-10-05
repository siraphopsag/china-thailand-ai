import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { geoCentroid, geoMercator, geoPath } from 'd3-geo'
import { feature, merge } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { useI18n } from '../i18n'
import { Icon } from './icons'
import { GEO, HOME, MAX_K, clampView, codeOfIso, lerpView, viewForBox, type GeoCode, type View } from '../geo'
import capitals from '../data/geo/capitals.json'
import { FLAGS } from './flags'

/**
 * Reusable map of China + ASEAN with Thai and Chinese provinces (same Natural Earth data and raised-relief style as the original
 * map). Controlled: the parent decides the focused country and province; the map frames them, raises them, and draws pins.
 * Every ASEAN country can be focused (its capital is shown); only Thailand and China have provinces today — the parent shows
 * "coming soon" for the others.
 *
 * Opening scene (owner, Oct 2026): when a map opens with nothing chosen, all 12 countries are framed, each with a straight line
 * from its capital to a label with its flag and name (tiny Singapore and Brunei were hard to find). Tapping a flag chooses that
 * country; tapping or dragging the map — or "Show the map" — goes on to the normal map. Small countries keep a ring around them.
 *
 * Camera: the map plane leans back (oblique view). The lean is stronger on the overview and smaller once a country is chosen,
 * so provinces are easy to read. Labels, capitals and pins are drawn on a flat layer above the plane, positioned through the same
 * projection, so text always stands upright.
 */
const CHINA_PARTS = new Set(['156', '344', '446'])
type CountryF = Feature<Geometry, { name?: string }>
type ProvinceF = Feature<Geometry, { iso_3166_2?: string; adm0_a3?: string }>
type Capital = { country: GeoCode; name: string; lon: number; lat: number }
const CAPITALS = capitals as Capital[]
const ALL: GeoCode[] = ['TH', 'CN', 'VN', 'MM', 'LA', 'SG', 'KH', 'MY', 'ID', 'PH', 'BN', 'TL']
/** countries too small to spot when zoomed out: a ring marks them */
const TINY: GeoCode[] = ['SG', 'BN']
let cache: Promise<{ countries: CountryF[]; provinces: ProvinceF[] }> | null = null
function loadGeo() {
  cache ??= Promise.all([import('../data/geo/region-asean-china.json'), import('../data/geo/admin1-th-cn.json')]).then(([r, a]) => {
    const rt = ((r as { default?: unknown }).default ?? r) as unknown as Topology<{ countries: GeometryCollection<{ name?: string }> }>
    const at = ((a as { default?: unknown }).default ?? a) as unknown as Topology
    const ao = at.objects[Object.keys(at.objects)[0]] as GeometryCollection<ProvinceF['properties']>
    const provinces = (feature(at, ao) as FeatureCollection<Geometry, ProvinceF['properties']>).features.filter((f) => f.properties.iso_3166_2 && !f.properties.iso_3166_2.includes('~'))
    const geoms = rt.objects.countries.geometries
    const china: CountryF = { type: 'Feature', id: '156', properties: { name: 'China' }, geometry: merge(rt, geoms.filter((g) => CHINA_PARTS.has(String(g.id))) as never) }
    return { countries: [china, ...geoms.filter((g) => !CHINA_PARTS.has(String(g.id))).map((g) => feature(rt, g) as CountryF)], provinces }
  })
  return cache
}
function Raised({ d, lift, k, side, top }: { d: string; lift: number; k: number; side: string; top: string }) {
  if (lift < 0.3) return null
  const L = lift / k
  return <g className="pointer-events-none"><path d={d} className="g-shadow" transform={`translate(${L * 0.45},${L * 0.75})`} />{[1, 2, 3, 4].map((i) => <path key={i} d={d} className={side} transform={`translate(0,${(-L * i) / 5})`} />)}<path d={d} className={top} transform={`translate(0,${-L})`} /></g>
}
function useTween(target: number, ms: number) {
  const [v, setV] = useState(target)
  const cur = useRef(v); cur.current = v
  useEffect(() => {
    const from = cur.current, t0 = performance.now(); let id = 0
    const step = (n: number) => { const p = Math.min(1, (n - t0) / ms); setV(from + (target - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) id = requestAnimationFrame(step) }
    id = requestAnimationFrame(step); return () => cancelAnimationFrame(id)
  }, [target, ms])
  return v
}

/** camera lean in degrees: overview vs. a chosen country/province (owner review, Oct 2026); phones lean a little less */
export const TILT = { overview: 28, focused: 14, phone: 0.85 }
/** CSS perspective distance and the scale that keeps the leaning plane filling the frame */
const perspectiveFor = (w: number) => (w < 640 ? 900 : 1100)
const scaleFor = (deg: number) => 1 + deg * 0.0053
/** where a point of the flat map plane appears on screen once the plane leans back (same maths as the CSS transform) */
export function leanPoint(x: number, y: number, w: number, h: number, deg: number): [number, number] {
  const ox = w / 2, oy = h * 0.62, P = perspectiveFor(w), s = scaleFor(deg), a = (deg * Math.PI) / 180
  const X = (x - ox) * s, Y = (y - oy) * s
  const z = Y * Math.sin(a), f = P / (P - z)
  return [ox + X * f, oy + Y * Math.cos(a) * f]
}

export interface MapPin { country: 'TH' | 'CN'; province: string; label: string; tone?: 'mine' | 'post' }
/** `counts` (the board): a number per province drawn as a bubble at its centre — the same numbers are listed in text next to the map */
export function GeoMap({ country, province, pins = [], counts, onPickCountry, onPickProvince, label, className = 'h-[46vh] min-h-[280px] max-h-[520px]' }: {
  country: GeoCode | null; province: string | null; pins?: MapPin[]; counts?: Record<string, number>; onPickCountry: (c: GeoCode) => void; onPickProvince: (code: string | null) => void; label: string; className?: string
}) {
  const { t } = useI18n()
  const [data, setData] = useState<{ countries: CountryF[]; provinces: ProvinceF[] } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => { let alive = true; loadGeo().then((d) => alive && setData(d)).catch(() => alive && setFailed(true)); return () => { alive = false } }, [])
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 460 })
  useLayoutEffect(() => {
    const el = box.current; if (!el) return
    const m = () => setSize((o) => { const n = { w: Math.max(200, el.clientWidth), h: Math.max(200, el.clientHeight) }; return o.w === n.w && o.h === n.h ? o : n })
    m(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(m) : null; ro?.observe(el); return () => ro?.disconnect()
  }, [])
  const { w, h } = size
  const focusSet = useMemo(() => (data?.countries ?? []).filter((f) => codeOfIso(f.id)), [data])
  const proj = useMemo(() => { const p = geoMercator(); if (focusSet.length) p.fitExtent([[16, 16], [w - 16, h - 16]], { type: 'FeatureCollection', features: focusSet } as FeatureCollection); return p }, [focusSet, w, h])
  const path = useMemo(() => geoPath(proj), [proj])
  const shapes = useMemo(() => (data?.countries ?? []).map((f) => ({ code: codeOfIso(f.id), d: path(f) ?? '', b: path.bounds(f) as [[number, number], [number, number]] })), [data, path])
  const provs = useMemo(() => (data?.provinces ?? []).map((f) => ({ f, code: f.properties.iso_3166_2!, country: (f.properties.adm0_a3 === 'THA' ? 'TH' : 'CN') as 'TH' | 'CN', d: path(f) ?? '', c: geoCentroid(f) as [number, number] })), [data, path])
  const capitalOf = (c: GeoCode) => CAPITALS.find((x) => x.country === c)
  // the opening scene: only when the map opens with nothing chosen; anything chosen (here or in the lists) ends it
  const [intro, setIntro] = useState(() => !country && !province)
  useEffect(() => { if (country || province) setIntro(false) }, [country, province])

  const [view, setView] = useState<View>(HOME)
  const viewRef = useRef(view); viewRef.current = view
  const anim = useRef(0)
  const target = useMemo<View>(() => {
    if (intro) { // all 12 countries in view
      const all = shapes.filter((x) => x.code)
      if (all.length) {
        const x0 = Math.min(...all.map((x) => x.b[0][0])), y0 = Math.min(...all.map((x) => x.b[0][1])), x1 = Math.max(...all.map((x) => x.b[1][0])), y1 = Math.max(...all.map((x) => x.b[1][1]))
        return viewForBox([[x0, y0], [x1, y1 + (y1 - y0) * 0.12]], w, h, 0.96, 4)
      }
    }
    if (province) { const p = provs.find((x) => x.code === province); if (p) { const b = path.bounds(p.f) as [[number, number], [number, number]]; const pad = Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) * 1.6; return viewForBox([[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]], w, h, 0.9, 10) } }
    if (country === 'SG') { const c = capitalOf('SG'), p = c && proj([c.lon, c.lat]); if (p) return viewForBox([[p[0] - 12, p[1] - 12], [p[0] + 12, p[1] + 12]], w, h, 0.7, MAX_K) } // too small to frame by its outline
    if (country) { const s = shapes.find((x) => x.code === country); if (s) return viewForBox(s.b, w, h, country === 'CN' ? 0.8 : 0.72, 7) }
    // nothing chosen yet: frame the two countries in service (Thailand + China), not all of ASEAN
    const two = shapes.filter((x) => x.code === 'TH' || x.code === 'CN')
    if (two.length) {
      const x0 = Math.min(...two.map((x) => x.b[0][0])), y0 = Math.min(...two.map((x) => x.b[0][1])), x1 = Math.max(...two.map((x) => x.b[1][0])), y1 = Math.max(...two.map((x) => x.b[1][1]))
      // a little room at the bottom: the leaning camera pushes the near (southern) edge outwards
      return viewForBox([[x0, y0], [x1, y1 + (y1 - y0) * 0.22]], w, h, 0.94, 4)
    }
    return HOME
  }, [intro, country, province, provs, shapes, path, proj, w, h]) // eslint-disable-line react-hooks/exhaustive-deps -- capitalOf reads a constant
  const flyTo = (to: View) => {
    cancelAnimationFrame(anim.current)
    const from = viewRef.current, t0 = performance.now()
    const step = (n: number) => { const p = Math.min(1, (n - t0) / 700); setView(lerpView(from, to, p)); if (p < 1) anim.current = requestAnimationFrame(step) }
    anim.current = requestAnimationFrame(step)
  }
  useEffect(() => { flyTo(target); return () => cancelAnimationFrame(anim.current) }, [target]) // eslint-disable-line react-hooks/exhaustive-deps -- flyTo reads refs only
  const countryLift = useTween(country && !province ? 12 : 0, 420)
  const provLift = useTween(province ? 9 : 0, 380)
  const tilt = useTween((country || province ? TILT.focused : TILT.overview) * (w < 640 ? TILT.phone : 1), 520)

  // gestures: one finger (or the mouse) drags, two fingers pinch to zoom (owner, Oct 2026: pinching did nothing on phones),
  // wheel/buttons zoom, a tap picks a province (inside the focused country) or a country
  const svg = useRef<SVGSVGElement>(null)
  const down = useRef<{ x: number; y: number; moved: number; code?: string; prov?: string } | null>(null)
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; mx: number; my: number } | null>(null)
  const zoomAt = (f: number, cx = w / 2, cy = h / 2) => setView((v) => { const k = Math.max(1, Math.min(MAX_K, v.k * f)); const r = k / v.k; return clampView({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }, w, h) })
  const lean = () => Math.cos((tilt * Math.PI) / 180) // the plane leans back, so vertical moves are foreshortened
  const twoFingers = () => { const [a, b] = [...touches.current.values()]; return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 } }
  const onDown = (e: ReactPointerEvent) => {
    if (intro) { setIntro(false); return }
    cancelAnimationFrame(anim.current)
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId) } catch { /* the pointer is already gone */ }
    if (touches.current.size >= 2) { if (touches.current.size === 2) pinch.current = twoFingers(); if (down.current) down.current.moved = Infinity; return } // a pinch is never a tap
    const el = e.target as Element
    down.current = { x: e.clientX, y: e.clientY, moved: 0, code: (el.closest('[data-code]') as HTMLElement | null)?.dataset.code, prov: (el.closest('[data-prov]') as HTMLElement | null)?.dataset.prov }
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!touches.current.has(e.pointerId)) return // a mouse moving without a pressed button
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (p && touches.current.size >= 2) {
      // zoom by how far the fingers spread, around the point between them, and follow that point as it moves
      const n = twoFingers(), r = svg.current?.getBoundingClientRect()
      zoomAt(n.dist / Math.max(1, p.dist), n.mx - (r?.left ?? 0), n.my - (r?.top ?? 0))
      setView((v) => clampView({ ...v, x: v.x + (n.mx - p.mx), y: v.y + (n.my - p.my) / lean() }, w, h))
      pinch.current = n
      return
    }
    const d = down.current; if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy)
    setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy / lean() }, w, h))
  }
  const onUp = (e: ReactPointerEvent) => {
    touches.current.delete(e.pointerId)
    if (pinch.current) {
      // one finger lifted: keep dragging with the other one (no tap)
      pinch.current = null
      const rest = [...touches.current.values()][0]
      down.current = rest ? { x: rest.x, y: rest.y, moved: Infinity } : null
      return
    }
    const d = down.current; down.current = null
    if (!d || d.moved > 6) return
    if (d.prov && country && d.prov.startsWith(country + '-')) onPickProvince(d.prov === province ? null : d.prov)
    else if (d.code && d.code in GEO) onPickCountry(d.code as GeoCode)
  }
  const onCancel = (e: ReactPointerEvent) => { touches.current.delete(e.pointerId); pinch.current = null; down.current = null }
  useEffect(() => {
    const el = svg.current; if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); if (intro) { setIntro(false); return } const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top) }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }) // re-bound each render so zoomAt sees the current size

  // a chosen planned country is raised in grey, not indigo, so it never looks open (owner, Oct 2026)
  const paint = (c: GeoCode | undefined) => (!c ? 'g-dim' : c === country ? (GEO[c].status === 'active' ? 'g-footprint' : 'g-soon') : GEO[c].status === 'active' ? 'g-active' : 'g-soon')
  const focusShape = country ? shapes.find((s) => s.code === country) : undefined
  const provShape = province ? provs.find((p) => p.code === province) : undefined
  const Lc = countryLift / view.k
  /** flat-plane point (after zoom/pan and the raise of the selection) → upright screen position on the leaning plane */
  const flat = (x: number, y: number, lift = 0) => leanPoint(view.x + view.k * x, view.y + view.k * y - lift, w, h, tilt)
  const geoPt = (lon: number, lat: number, lift = 0): [number, number] | null => { const p = proj([lon, lat]); return p ? flat(p[0], p[1], lift) : null }
  const name = (c: string) => t(`geo.c.${c}` as never)
  const cityName = (c: Capital) => t(`geo.city.${c.name.replace(/\s/g, '')}` as never)
  // capitals: Bangkok and Beijing on the overview, otherwise the chosen country's capital
  const shownCapitals = (country ? [capitalOf(country)] : [capitalOf('TH'), capitalOf('CN')]).filter((c): c is Capital => !!c)
  const inView = (p: [number, number] | null): p is [number, number] => !!p && p[0] > -40 && p[0] < w + 40 && p[1] > -40 && p[1] < h + 40
  const labelW = w < 640 ? 100 : 128, labelH = 26, edge = 8
  const scene = intro && data ? (() => {
    const pts = ALL.flatMap((c) => { const cap = capitalOf(c), p = cap && geoPt(cap.lon, cap.lat); return p ? [{ c, x: p[0], y: p[1] }] : [] }).sort((a, b) => a.x - b.x)
    const half = Math.ceil(pts.length / 2)
    const column = (side: 'left' | 'right', list: typeof pts) => {
      const top = 14, bottom = h - 64 // room for the "Show the map" button
      const step = list.length > 1 ? (bottom - top - labelH) / (list.length - 1) : 0
      return [...list].sort((a, b) => a.y - b.y).map((p, i) => ({ ...p, side, ly: top + i * step, lx: side === 'left' ? edge + labelW : w - edge - labelW }))
    }
    return [...column('left', pts.slice(0, half)), ...column('right', pts.slice(half))]
  })() : []
  return (
    <div ref={box} className={`relative rounded-2xl overflow-hidden border border-line map-ocean ${className}`}>
      {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center" role="alert">{t('geo.error')}</p>}
      {!data && !failed && <p className="absolute inset-0 grid place-items-center" role="status"><span className="flex items-center gap-2"><Icon name="globe" size={18} className="animate-pulse text-primary" />{t('geo.loading')}</span></p>}
      {data && (
        <div className="map-tilt map-stage" style={{ transform: `perspective(${perspectiveFor(w)}px) rotateX(${tilt}deg) scale(${scaleFor(tilt)})` }}>
          <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}
            className="block select-none cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }}>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {shapes.map((s, i) => <path key={i} d={s.d} data-code={s.code} className={'g-c ' + paint(s.code)}>{s.code && <title>{name(s.code)}</title>}</path>)}
              {focusShape && <Raised d={focusShape.d} lift={countryLift} k={view.k} side={GEO[focusShape.code!].status === 'active' ? 'g-side' : 'g-side-soon'} top={GEO[focusShape.code!].status === 'active' ? 'g-top' : 'g-top-soon'} />}
              {country && <g transform={`translate(0,${-Lc})`}>{provs.filter((p) => p.country === country).map((p) => <path key={p.code} d={p.d} data-prov={p.code} className={'g-prov' + (p.code === province ? ' is-sel' : '')}><title>{t(`prov.${p.code}` as never)}</title></path>)}</g>}
              {provShape && <Raised d={provShape.d} lift={provLift} k={view.k} side="g-pside" top="g-ptop" />}
            </g>
          </svg>
        </div>)}
      {/* upright layer: names, capitals and pins stand straight while the map below leans back */}
      {data && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 pointer-events-none" aria-hidden>
          {!country && (['TH', 'CN'] as const).map((c) => {
            const s = shapes.find((x) => x.code === c); if (!s) return null
            const p = flat((s.b[0][0] + s.b[1][0]) / 2, (s.b[0][1] + s.b[1][1]) / 2)
            // keep the country name clear of its capital's name (Bangkok sits near the middle of Thailand)
            const cap = capitalOf(c), cp = cap && geoPt(cap.lon, cap.lat), near = cp && Math.abs(cp[1] - p[1]) < 22 && p[0] > cp[0] - 30 && p[0] < cp[0] + 130
            return <text key={c} x={near ? cp[0] - 12 : p[0]} y={near ? cp[1] - 16 : p[1]} textAnchor={near ? 'end' : 'middle'} className="g-label">{name(c)}</text>
          })}
          {view.k < 3 && TINY.map((c) => { const cap = capitalOf(c), p = cap ? geoPt(cap.lon, cap.lat, c === country ? countryLift : 0) : null; return inView(p) ? <circle key={`ring-${c}`} cx={p[0]} cy={p[1]} r={11} className="g-tiny" /> : null })}
          {scene.map((l) => <g key={`line-${l.c}`} className="g-intro"><line x1={l.x} y1={l.y} x2={l.lx} y2={l.ly + labelH / 2} className="g-intro-line" /><circle cx={l.x} cy={l.y} r={3.5} className="g-intro-dot" /></g>)}
          {shownCapitals.map((c) => { const p = geoPt(c.lon, c.lat, c.country === country ? countryLift : 0); return inView(p) ? (
            <g key={c.country}><circle cx={p[0]} cy={p[1]} r={5.5} className="g-capital" /><text x={p[0] + 9} y={p[1] + 4} className="g-city">{cityName(c)}</text></g>) : null })}
          {provShape && (() => { const p = geoPt(provShape.c[0], provShape.c[1], provLift + countryLift); const up = pins.some((pn) => pn.province === provShape.code) ? 30 : 0 /* a pin stands on the same spot: lift the name above it */
            return p ? <text x={p[0]} y={p[1] - 16 - up} textAnchor="middle" className="g-name">{t(`prov.${provShape.code}` as never)}</text> : null })()}
          {!intro && pins.map((pn, i) => {
            const pv = provs.find((x) => x.code === pn.province); if (!pv) return null
            const p = geoPt(pv.c[0], pv.c[1], (pn.province === province ? provLift : 0) + (pn.country === country ? countryLift : 0)); if (!inView(p)) return null
            return <g key={i} transform={`translate(${p[0]},${p[1]})`}><title>{pn.label}</title>
              <ellipse cx={0} cy={0} rx={6} ry={2.2} className="g-shadow" />
              <path d="M0 0 C-7 -9 -9 -13 -9 -17 A9 9 0 1 1 9 -17 C9 -13 7 -9 0 0 Z" className={pn.tone === 'post' ? 'g-pin-post' : 'g-pin'} /><circle cx={0} cy={-17} r={3.2} className="g-pin-dot" /></g>
          })}
          {!intro && counts && Object.entries(counts).filter(([, n]) => n > 0).map(([code, n]) => {
            const pv = provs.find((x) => x.code === code); if (!pv) return null
            const p = geoPt(pv.c[0], pv.c[1], (code === province ? provLift : 0) + (pv.country === country ? countryLift : 0)); if (!inView(p)) return null
            const r = 10 + Math.min(12, Math.sqrt(n) * 3)
            return <g key={`n-${code}`} transform={`translate(${p[0]},${p[1]})`}><circle r={r} className="g-count" /><text y={4} textAnchor="middle" className="g-count-n">{n}</text></g>
          })}
        </svg>)}
      {scene.length > 0 && (
        <div className="map-intro absolute inset-0 pointer-events-none">
          {scene.map((l) => (
            <button key={l.c} type="button" className="map-flag pointer-events-auto" style={{ top: l.ly, width: labelW, height: labelH, ...(l.side === 'left' ? { left: edge } : { right: edge }) }}
              onClick={() => { setIntro(false); onPickCountry(l.c) }}>
              <img src={FLAGS[l.c]} alt="" width={20} height={15} className="map-flag-img" /><span className="truncate">{name(l.c)}</span>
            </button>))}
          <button type="button" className="map-intro-go pointer-events-auto" onClick={() => setIntro(false)}><Icon name="globe" size={15} />{t('geo.introGo')}</button>
        </div>)}
      {data && !intro && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" className="globe-ctl" onClick={() => zoomAt(1.3)} aria-label={t('geo.zoomIn')} title={t('geo.zoomIn')}><Icon name="plus" size={18} /></button>
          <button type="button" className="globe-ctl" onClick={() => zoomAt(1 / 1.3)} aria-label={t('geo.zoomOut')} title={t('geo.zoomOut')}><Icon name="minus" size={18} /></button>        </div>)}
    </div>
  )
}
