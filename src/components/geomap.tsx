import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { geoCentroid, geoMercator, geoPath } from 'd3-geo'
import { feature, merge, mesh } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { useI18n } from '../i18n'
import { Icon } from './icons'
import { GEO, HOME, MAX_K, clampView, codeOfIso, lerpView, viewForBox, type GeoCode, type View } from '../geo'
import capitals from '../data/geo/capitals.json'
import taiwan from '../data/geo/taiwan.json'
import { FLAGS } from './flags'
import { useLite, useTextScale } from '../theme'

/**
 * Reusable map of China + ASEAN with Thai and Chinese provinces (same Natural Earth data and raised-relief style as the original
 * map). Controlled: the parent decides the focused country and province; the map frames them, raises them, and draws pins.
 * Every ASEAN country can be focused (its capital is shown); only Thailand and China have provinces today — the parent shows
 * "coming soon" for the others.
 *
 * Opening scene (owner, Oct 2026): when a map opens with nothing chosen, all 12 countries are framed in one colour on a bare map
 * (no country or capital names), each with a short upright pole from its capital carrying a flag label with the country's name
 * (tiny Singapore and Brunei were hard to find). Labels are as wide as their name; close neighbours get a taller pole or a label
 * to the side so nothing overlaps. Tapping a flag chooses that country; tapping or dragging the map — or "Show the map" — goes on
 * to the normal map, where Thailand and China (open today) stand out again. Small countries keep a ring around them there.
 *
 * Camera: the map plane leans back (oblique view). The lean is stronger on the overview and smaller once a country is chosen,
 * so provinces are easy to read. Labels, capitals and pins are drawn on a flat layer above the plane, positioned through the same
 * projection, so text always stands upright.
 */
const CHINA_PARTS = new Set(['156', '344', '446'])
/** Taiwan is drawn as part of China (owner, 29 Oct 2026: the region file had left it out). Natural Earth 1:50m, world-atlas
 *  2.0.2 country 158; no maritime lines are drawn. */
export const TAIWAN = taiwan as { type: 'MultiPolygon'; coordinates: number[][][][] }
/** China's outline = mainland + Hong Kong + Macao (merged arcs) + Taiwan */
export function withTaiwan(g: Geometry): Geometry {
  const own = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : []
  return { type: 'MultiPolygon', coordinates: [...own, ...TAIWAN.coordinates] }
}
type CountryF = Feature<Geometry, { name?: string }>
type ProvinceF = Feature<Geometry, { iso_3166_2?: string; adm0_a3?: string }>
type Capital = { country: GeoCode; name: string; lon: number; lat: number }
const CAPITALS = capitals as Capital[]
const ALL: GeoCode[] = ['TH', 'CN', 'VN', 'MM', 'LA', 'SG', 'KH', 'MY', 'ID', 'PH', 'BN', 'TL']
/** countries too small to spot when zoomed out: a ring marks them */
const TINY: GeoCode[] = ['SG', 'BN']
type Shaped = 'TH' | 'CN'
/** for a country with provinces: its outline made from its own provinces (so the raised country and the shaded provinces share
 *  one edge, with no sliver of the country's colour showing between them) and the borders between its provinces as one line */
type GeoData = { countries: CountryF[]; provinces: ProvinceF[]; outline: Record<Shaped, Geometry>; borders: Record<Shaped, Geometry> }
let cache: Promise<GeoData> | null = null
function loadGeo() {
  cache ??= Promise.all([import('../data/geo/region-asean-china.json'), import('../data/geo/admin1-th-cn.json')]).then(([r, a]) => {
    const rt = ((r as { default?: unknown }).default ?? r) as unknown as Topology<{ countries: GeometryCollection<{ name?: string }> }>
    const at = ((a as { default?: unknown }).default ?? a) as unknown as Topology
    const ao = at.objects[Object.keys(at.objects)[0]] as GeometryCollection<ProvinceF['properties']>
    const provinces = (feature(at, ao) as FeatureCollection<Geometry, ProvinceF['properties']>).features.filter((f) => f.properties.iso_3166_2 && !f.properties.iso_3166_2.includes('~'))
    const part = (a3: string) => ({ type: 'GeometryCollection', geometries: ao.geometries.filter((g) => (g.properties as { adm0_a3?: string } | undefined)?.adm0_a3 === a3) }) as GeometryCollection
    const own = (a3: string) => merge(at, part(a3).geometries as never) as Geometry
    const inner = (a3: string) => mesh(at, part(a3) as never, (a, b) => a !== b) as Geometry
    const outline = { TH: own('THA'), CN: withTaiwan(own('CHN')) }, borders = { TH: inner('THA'), CN: inner('CHN') }
    const geoms = rt.objects.countries.geometries
    const china: CountryF = { type: 'Feature', id: '156', properties: { name: 'China' }, geometry: withTaiwan(merge(rt, geoms.filter((g) => CHINA_PARTS.has(String(g.id))) as never)) }
    return { countries: [china, ...geoms.filter((g) => !CHINA_PARTS.has(String(g.id))).map((g) => feature(rt, g) as CountryF)], provinces, outline, borders }
  })
  return cache
}
/** a flag label on a pole: anchor (the capital), pole height, and the label's box */
export interface FlagSpot { c: GeoCode; x: number; y: number; pole: number; left: number; top: number; width: number }
export const FLAG_H = 24
const POLES = [20, 36, 52, 68] // short; taller only when a neighbour's label is in the way
/**
 * Place each label on top of its pole without overlapping other labels, poles or capitals. A label sits centred on its pole, or
 * to its right or left; the pole grows only when needed. Several placement orders are tried (Thailand and China, open today,
 * first in the main one) and the order with the least overlap wins — a dense group such as Laos–Thailand–Cambodia–Vietnam
 * needs a different order than a greedy north-to-south pass gives.
 */
export function layoutFlags(points: { c: GeoCode; x: number; y: number; width: number }[], w: number, h: number, labelH = FLAG_H, avoid: { l: number; t: number; r: number; b: number }[] = []): FlagSpot[] {
  type Box = { l: number; t: number; r: number; b: number }
  const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t))
  const place = (order: typeof points) => {
    const placed: FlagSpot[] = []
    let total = 0
    for (const p of order) {
      let best: { spot: FlagSpot; score: number } | null = null
      for (const pole of POLES) for (const align of ['center', 'right', 'left'] as const) {
        const left = Math.min(Math.max(4, align === 'center' ? p.x - p.width / 2 : align === 'right' ? p.x - 8 : p.x - p.width + 8), w - p.width - 4)
        const top = Math.max(4, p.y - pole - labelH)
        const box = { l: left - 3, t: top - 3, r: left + p.width + 3, b: top + labelH + 3 }
        let score = 0
        for (const q of placed) {
          score += overlap(box, { l: q.left, t: q.top, r: q.left + q.width, b: q.top + labelH }) * 4 // another label
          score += overlap(box, { l: q.x - 1.5, t: q.y - q.pole, r: q.x + 1.5, b: q.y }) * 2 // another pole
          score += overlap({ l: p.x - 1.5, t: top + labelH, r: p.x + 1.5, b: p.y }, { l: q.left, t: q.top, r: q.left + q.width, b: q.top + labelH }) * 2 // my pole through another label
        }
        for (const o of points) if (o.c !== p.c) score += overlap(box, { l: o.x - 4, t: o.y - 4, r: o.x + 4, b: o.y + 4 }) // another capital
        for (const z of avoid) score += overlap(box, z) * 4 // e.g. the "Show the map" button
        score += (pole - POLES[0]) * 0.02 + (align === 'center' ? 0 : 0.01) // prefer short and centred
        if (!best || score < best.score) best = { spot: { c: p.c, x: p.x, y: p.y, pole: p.y - top - labelH, left, top, width: p.width }, score }
      }
      placed.push(best!.spot); total += best!.score
    }
    return { placed, total }
  }
  const first = (c: GeoCode) => (c === 'TH' || c === 'CN' ? 0 : 1)
  const main = [...points].sort((x, y) => first(x.c) - first(y.c) || x.y - y.y)
  // other orders: a fixed pseudo-random shuffle (the same every time, so labels do not jump around)
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  let best = place(main)
  for (let i = 0; i < 60 && best.total > 1; i++) {
    const order = [...main]
    for (let j = order.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [order[j], order[k]] = [order[k], order[j]] }
    const tryIt = place(order)
    if (tryIt.total < best.total) best = tryIt
  }
  return best.placed.filter((q) => q.y > 0 && q.y < h)
}
/** label width: flag + name + padding, measured with the page's own font (estimated where there is no canvas, e.g. tests) */
let measureCtx: CanvasRenderingContext2D | null | undefined
function flagWidth(text: string, small: boolean): number {
  if (measureCtx === undefined) { try { measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null } catch { measureCtx = null } }
  let tw = text.length * 7
  if (measureCtx) { measureCtx.font = `600 ${small ? 11 : 12}px ${getComputedStyle(document.body).fontFamily || 'sans-serif'}`; tw = measureCtx.measureText(text).width }
  return Math.ceil(small ? 5 + 15 + 4 + tw + 5 + 2 : 6 + 18 + 5 + tw + 7 + 2)
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
/** each tap on a province brings the map this much closer; the province's centre lands a little below the middle, leaving
 *  room for its name above it */
const PICK_ZOOM = 1.3, PICK_Y = 0.56, PROV_LIFT = 9
/** the inverse of leanPoint: which flat-plane point shows at this spot on the screen */
export function unleanPoint(sx: number, sy: number, w: number, h: number, deg: number): [number, number] {
  const ox = w / 2, oy = h * 0.62, P = perspectiveFor(w), s = scaleFor(deg), a = (deg * Math.PI) / 180
  const Yt = sy - oy, Y = (Yt * P) / (P * Math.cos(a) + Yt * Math.sin(a)), f = P / (P - Y * Math.sin(a))
  return [ox + (sx - ox) / f / s, oy + Y / s]
}
export function leanPoint(x: number, y: number, w: number, h: number, deg: number): [number, number] {
  const ox = w / 2, oy = h * 0.62, P = perspectiveFor(w), s = scaleFor(deg), a = (deg * Math.PI) / 180
  const X = (x - ox) * s, Y = (y - oy) * s
  const z = Y * Math.sin(a), f = P / (P - z)
  return [ox + X * f, oy + Y * Math.cos(a) * f]
}

/* ---------- shading provinces by a number (owner, 27 Nov 2026: 77 bubbles piled up and hid Bangkok; option "ระบายสีจังหวัด") ----------
 * Steps by rank (quintiles), so one very large province does not leave all the others the same pale colour. */
/** upper bound of each step, ascending (at most `steps`; fewer when the values repeat) */
export function heatSteps(values: number[], steps = 5): number[] {
  const v = values.filter((n) => n > 0).sort((a, b) => a - b); if (!v.length) return []
  const out: number[] = []
  for (let i = 1; i <= steps; i++) { const x = v[Math.min(v.length - 1, Math.ceil((i / steps) * v.length) - 1)]; if (!out.length || x > out[out.length - 1]) out.push(x) }
  return out
}
/** the shade 0 (pale) … 4 (dark) of a number, spread over all five shades even when there are fewer steps */
export function heatShade(n: number, steps: number[]): number {
  if (!steps.length) return 0
  const i = steps.findIndex((s) => n <= s), k = i < 0 ? steps.length - 1 : i
  return steps.length === 1 ? 4 : Math.round((k * 4) / (steps.length - 1))
}
const fmt = (n: number) => n.toLocaleString('en-US')
/** the province a capital stands in: its number goes next to the capital's name (Bangkok's own label sat on top of it) */
const CAPITAL_PROV: Partial<Record<GeoCode, string>> = { TH: 'TH-10', CN: 'CN-BJ' }

export interface MapPin { country: 'TH' | 'CN'; province: string; label: string; tone?: 'mine' | 'post' }
/** `counts` (the board): a number per province shown as its shade, with a key; the number itself appears on a province once it is
 * large enough on screen (zoomed in) and in the name of a chosen province — the same numbers are listed in text next to the map */
export function GeoMap({ country, province, pins = [], counts, onPickCountry, onPickProvince, label, className = 'h-[46vh] min-h-[280px] max-h-[520px]' }: {
  country: GeoCode | null; province: string | null; pins?: MapPin[]; counts?: Record<string, number>; onPickCountry: (c: GeoCode) => void; onPickProvince: (code: string | null) => void; label: string; className?: string
}) {
  const { t } = useI18n()
  const [data, setData] = useState<GeoData | null>(null)
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
  const shapes = useMemo(() => (data?.countries ?? []).map((f) => { const code = codeOfIso(f.id), o = code === 'TH' || code === 'CN' ? data!.outline[code] : null
    return { code, d: (o ? path(o) : path(f)) ?? '', b: path.bounds(f) as [[number, number], [number, number]] } }), [data, path])
  const borderD = useMemo(() => (country === 'TH' || country === 'CN') && data ? path(data.borders[country]) ?? '' : '', [data, path, country])
  const provs = useMemo(() => (data?.provinces ?? []).map((f) => ({ f, code: f.properties.iso_3166_2!, country: (f.properties.adm0_a3 === 'THA' ? 'TH' : 'CN') as 'TH' | 'CN', d: path(f) ?? '', c: geoCentroid(f) as [number, number], b: path.bounds(f) as [[number, number], [number, number]] })), [data, path])
  // the shades are set by the chosen country's own provinces, so each country reads on its own scale
  const steps = useMemo(() => heatSteps(Object.entries(counts ?? {}).filter(([code]) => !!country && code.startsWith(country + '-')).map(([, n]) => n)), [counts, country])
  const heat = (code: string) => { const n = counts?.[code] ?? 0; return n > 0 ? ` g-heat g-heat-${heatShade(n, steps)}` : '' }
  const provTitle = (code: string) => { const n = counts?.[code]; return t(`prov.${code}` as never) + (n ? ` · ${fmt(n)}` : '') }
  const capitalOf = (c: GeoCode) => CAPITALS.find((x) => x.country === c)
  // the opening scene: only when the map opens with nothing chosen; anything chosen (here or in the lists) ends it
  const [intro, setIntro] = useState(() => !country && !province)
  useEffect(() => { if (country || province) setIntro(false) }, [country, province])

  const [view, setView] = useState<View>(HOME)
  const viewRef = useRef(view); viewRef.current = view
  const anim = useRef(0)
  const target = useMemo<View>(() => {
    if (intro && shapes.length) { // the 12 capitals in view (more room for Southeast Asia than framing all of China), space above for the flags
      const pts = ALL.flatMap((c) => { const cap = capitalOf(c), p = cap ? proj([cap.lon, cap.lat]) : null; return p ? [p] : [] })
      if (pts.length) {
        const x0 = Math.min(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])), x1 = Math.max(...pts.map((p) => p[0])), y1 = Math.max(...pts.map((p) => p[1]))
        const dx = x1 - x0, dy = y1 - y0
        return viewForBox([[x0 - dx * 0.12, y0 - dy * 0.2], [x1 + dx * 0.12, y1 + dy * 0.12]], w, h, 0.96, 6)
      }
    }
    if (province) { const p = provs.find((x) => x.code === province); if (p) { const b = path.bounds(p.f) as [[number, number], [number, number]]; const pad = Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) * 1.6; return viewForBox([[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]], w, h, 0.9, 10) } }
    if (country === 'SG') { const c = capitalOf('SG'), p = c && proj([c.lon, c.lat]); if (p) return viewForBox([[p[0] - 12, p[1] - 12], [p[0] + 12, p[1] + 12]], w, h, 0.7, 12) } // too small to frame by its outline
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
  // choosing a province inside the same country: it slides to the middle of the map and comes a little closer each time
  // (owner, 27 Nov 2026), never further out (a tap that threw the map back out to the preset size made him dizzy). Clearing
  // the choice leaves the map where it is.
  const last = useRef({ country, province, w, h })
  useEffect(() => {
    const was = last.current; last.current = { country, province, w, h }
    const sameCountry = was.country === country && was.w === w && was.h === h && !intro
    if (sameCountry && was.province !== province) {
      if (!province) return
      const pv = provs.find((x) => x.code === province), at = pv && proj(pv.c); if (!at) return
      const cur = viewRef.current, k = Math.min(MAX_K, Math.max(target.k, cur.k * PICK_ZOOM))
      const [fx, fy] = unleanPoint(w / 2, h * PICK_Y, w, h, tilt) // the spot on the leaning plane that shows in the middle
      flyTo(clampView({ k, x: fx - k * at[0], y: fy + PROV_LIFT - k * at[1] }, w, h)); return
    }
    flyTo(target)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps -- flyTo reads refs only
  useEffect(() => () => cancelAnimationFrame(anim.current), [])
  const countryLift = useTween(country && !province ? 12 : 0, 420)
  const provLift = useTween(province ? PROV_LIFT : 0, 380)
  // fewer effects (older phones): a flat map — the 3D lean is redrawn every frame while panning
  const lite = useLite()
  const fs = useTextScale() // labels grow with the text size in Settings, so their boxes do too
  const tilt = useTween(lite ? 0 : (country || province ? TILT.focused : TILT.overview) * (w < 640 ? TILT.phone : 1), 520)

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
  const paint = (c: GeoCode | undefined) => (!c ? 'g-dim' : intro ? 'g-uni' : c === country ? (GEO[c].status === 'active' ? 'g-footprint' : 'g-soon') : GEO[c].status === 'active' ? 'g-active' : 'g-soon')
  const focusShape = country ? shapes.find((s) => s.code === country) : undefined
  const provShape = province ? provs.find((p) => p.code === province) : undefined
  const Lc = countryLift / view.k
  /** flat-plane point (after zoom/pan and the raise of the selection) → upright screen position on the leaning plane */
  const flat = (x: number, y: number, lift = 0) => leanPoint(view.x + view.k * x, view.y + view.k * y - lift, w, h, tilt)
  const geoPt = (lon: number, lat: number, lift = 0): [number, number] | null => { const p = proj([lon, lat]); return p ? flat(p[0], p[1], lift) : null }
  const name = (c: string) => t(`geo.c.${c}` as never)
  const cityName = (c: Capital) => t(`geo.city.${c.name.replace(/\s/g, '')}` as never)
  const capText = (c: Capital) => { const pv = CAPITAL_PROV[c.country as GeoCode], n = pv && c.country === country ? counts?.[pv] : 0; return cityName(c) + (n ? ` · ${fmt(n)}` : '') }
  // capitals: Bangkok and Beijing on the overview, otherwise the chosen country's capital
  const shownCapitals = (country ? [capitalOf(country)] : [capitalOf('TH'), capitalOf('CN')]).filter((c): c is Capital => !!c)
  const inView = (p: [number, number] | null): p is [number, number] => !!p && p[0] > -40 && p[0] < w + 40 && p[1] > -40 && p[1] < h + 40
  const smallFlags = w < 480 // phones: a slightly smaller label
  const scene = intro && data
    ? layoutFlags(ALL.flatMap((c) => { const cap = capitalOf(c), p = cap ? geoPt(cap.lon, cap.lat) : null; return p ? [{ c, x: p[0], y: p[1], width: flagWidth(name(c), smallFlags) }] : [] }), w, h, smallFlags ? 20 : FLAG_H, [{ l: w - 150, t: h - 60, r: w, b: h }]) // keep clear of "Show the map" (bottom right)
    : []
  // the numbers on the map: only on a province that is wide enough on screen (zoomed in), biggest first, never on top of
  // another number, a capital's name or the chosen province's name (the shade and the list beside the map carry the rest)
  // the chosen province's name wins over a capital's name it would cover (owner's screenshot, 27 Nov 2026: Samut Prakan over Bangkok)
  const selBox = (() => { if (!provShape) return null; const p = geoPt(provShape.c[0], provShape.c[1], provLift + countryLift); if (!p) return null
    const half = provTitle(provShape.code).length * 5.5 * fs, up = pins.some((pn) => pn.province === provShape.code) ? 30 : 0
    return { l: p[0] - half, t: p[1] - 16 - up - 18 * fs, r: p[0] + half, b: p[1] - 10 - up } })()
  const capCovered = (c: Capital, p: [number, number]) => !!selBox && (CAPITAL_PROV[c.country] === provShape?.code || (p[0] - 7 < selBox.r && p[0] + 12 + capText(c).length * 7.5 * fs > selBox.l && p[1] - 10 * fs < selBox.b && p[1] + 8 > selBox.t))
  const countLabels: { code: string; x: number; y: number; text: string }[] = []
  if (data && !intro && counts && country) { // numbers and colours only once a country is chosen (owner, 27 Nov 2026: with several countries open, an all-red overview would say nothing)
    const taken: { l: number; t: number; r: number; b: number }[] = []
    for (const c of shownCapitals) { const p = geoPt(c.lon, c.lat, c.country === country ? countryLift : 0); if (p) taken.push({ l: p[0] - 7, t: p[1] - 10 * fs, r: p[0] + 12 + capText(c).length * 7.5 * fs, b: p[1] + 8 * fs }) }
    if (provShape) { const p = geoPt(provShape.c[0], provShape.c[1], provLift + countryLift); if (p) { const half = provTitle(provShape.code).length * 5.5 * fs; taken.push({ l: p[0] - half, t: p[1] - 46 - 18 * fs, r: p[0] + half, b: p[1] - 8 }) } }
    const cands = provs.filter((p) => (counts[p.code] ?? 0) > 0 && p.country === country).sort((a, b) => counts[b.code] - counts[a.code])
    for (const pv of cands) {
      const text = fmt(counts[pv.code]), half = (text.length * 3.6 + 4) * fs
      // the chosen province and a capital's province show the number in their names; elsewhere the number must fit its province
      if (pv.code === province || Object.values(CAPITAL_PROV).includes(pv.code) || (pv.b[1][0] - pv.b[0][0]) * view.k < half * 2 - 4) continue
      const p = geoPt(pv.c[0], pv.c[1], (pv.code === province ? provLift : 0) + (pv.country === country ? countryLift : 0)); if (!inView(p)) continue
      const box = { l: p[0] - half, t: p[1] - 8 * fs, r: p[0] + half, b: p[1] + 8 * fs }
      if (taken.some((o) => box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t)) continue
      taken.push(box); countLabels.push({ code: pv.code, x: p[0], y: p[1], text })
    }
  }
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
              {/* the raised edge under each shaded province takes that province's colour, a shade darker (owner, 27 Nov 2026) */}
              {country && counts && countryLift >= 0.3 && <g className="pointer-events-none">{[0, 1, 2, 3, 4].map((i) => <g key={i} transform={`translate(0,${(-Lc * i) / 5})`}>{provs.filter((p) => p.country === country && (counts[p.code] ?? 0) > 0).map((p) => <path key={p.code} d={p.d} className={'g-heat-side' + heat(p.code)} />)}</g>)}</g>}
              {country && <g transform={`translate(0,${-Lc})`} className={steps.length ? 'g-heat-on' : undefined}>{provs.filter((p) => p.country === country).map((p) => <path key={p.code} d={p.d} data-prov={p.code} className={'g-prov' + heat(p.code) + (p.code === province ? ' is-sel' : '')}><title>{provTitle(p.code)}</title></path>)}
                {borderD && <path d={borderD} className="g-pborder pointer-events-none" />}</g>}
              {provShape && <Raised d={provShape.d} lift={provLift} k={view.k} side={counts?.[provShape.code] ? 'g-heat-side' + heat(provShape.code) : 'g-pside'} top={counts?.[provShape.code] ? 'g-ptop-heat' + heat(provShape.code) : 'g-ptop'} />}
            </g>
          </svg>
        </div>)}
      {/* upright layer: names, capitals and pins stand straight while the map below leans back */}
      {data && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 pointer-events-none" aria-hidden>
          {!country && !intro && (['TH', 'CN'] as const).map((c) => {
            const s = shapes.find((x) => x.code === c); if (!s) return null
            const p = flat((s.b[0][0] + s.b[1][0]) / 2, (s.b[0][1] + s.b[1][1]) / 2)
            // keep the country name clear of its capital's name (Bangkok sits near the middle of Thailand)
            const cap = capitalOf(c), cp = cap && geoPt(cap.lon, cap.lat), near = cp && Math.abs(cp[1] - p[1]) < 22 && p[0] > cp[0] - 30 && p[0] < cp[0] + 130
            return <text key={c} x={near ? cp[0] - 12 : p[0]} y={near ? cp[1] - 16 : p[1]} textAnchor={near ? 'end' : 'middle'} className="g-label">{name(c)}</text>
          })}
          {!intro && view.k < 3 && TINY.map((c) => { const cap = capitalOf(c), p = cap ? geoPt(cap.lon, cap.lat, c === country ? countryLift : 0) : null; return inView(p) ? <circle key={`ring-${c}`} cx={p[0]} cy={p[1]} r={11} className="g-tiny" /> : null })}
          {scene.map((l) => <g key={`pole-${l.c}`}><line x1={l.x} y1={l.y} x2={l.x} y2={l.y - l.pole} className="g-pole" /><circle cx={l.x} cy={l.y} r={2.6} className="g-pole-foot" /></g>)}
          {!intro && shownCapitals.map((c) => { const p = geoPt(c.lon, c.lat, c.country === country ? countryLift : 0); return inView(p) ? (
            <g key={c.country}><circle cx={p[0]} cy={p[1]} r={5.5} className="g-capital" />{!capCovered(c, p) && <text x={p[0] + 9} y={p[1] + 4} className="g-city">{capText(c)}</text>}</g>) : null })}
          {provShape && (() => { const p = geoPt(provShape.c[0], provShape.c[1], provLift + countryLift); const up = pins.some((pn) => pn.province === provShape.code) ? 30 : 0 /* a pin stands on the same spot: lift the name above it */
            return p ? <text x={p[0]} y={p[1] - 16 - up} textAnchor="middle" className="g-name">{provTitle(provShape.code)}</text> : null })()}
          {!intro && pins.map((pn, i) => {
            const pv = provs.find((x) => x.code === pn.province); if (!pv) return null
            const p = geoPt(pv.c[0], pv.c[1], (pn.province === province ? provLift : 0) + (pn.country === country ? countryLift : 0)); if (!inView(p)) return null
            return <g key={i} transform={`translate(${p[0]},${p[1]})`}><title>{pn.label}</title>
              <ellipse cx={0} cy={0} rx={6} ry={2.2} className="g-shadow" />
              <path d="M0 0 C-7 -9 -9 -13 -9 -17 A9 9 0 1 1 9 -17 C9 -13 7 -9 0 0 Z" className={pn.tone === 'post' ? 'g-pin-post' : 'g-pin'} /><circle cx={0} cy={-17} r={3.2} className="g-pin-dot" /></g>
          })}
          {countLabels.map((l) => <text key={`n-${l.code}`} x={l.x} y={l.y + 4} textAnchor="middle" className="g-count-n">{l.text}</text>)}
        </svg>)}
      {/* the key for the shades (bottom left; the zoom buttons are top right) */}
      {data && !intro && country && steps.length > 0 && (
        <div className="map-key absolute left-2 bottom-2 pointer-events-none" aria-hidden>
          <p className="map-key-h">{t('geo.key')}</p>
          {steps.map((s, i) => { const lo = i === 0 ? Math.min(...Object.entries(counts ?? {}).filter(([c, n]) => n > 0 && c.startsWith(country + '-')).map(([, n]) => n)) : steps[i - 1] + 1
            return <p key={i} className="map-key-row"><span className={`map-key-sw g-heat-${heatShade(s, steps)}`} />{lo >= s ? fmt(s) : `${fmt(lo)}–${fmt(s)}`}</p> })}
        </div>)}
      {scene.length > 0 && (
        <div className="map-intro absolute inset-0 pointer-events-none">
          {scene.map((l) => (
            <button key={l.c} type="button" className={`map-flag pointer-events-auto${smallFlags ? ' is-small' : ''}`} style={{ left: l.left, top: l.top, height: smallFlags ? 20 : FLAG_H }}
              onClick={() => { setIntro(false); onPickCountry(l.c) }}>
              <img src={FLAGS[l.c]} alt="" width={18} height={13} className="map-flag-img" /><span>{name(l.c)}</span>
            </button>))}
          <button type="button" className="map-intro-go pointer-events-auto" onClick={() => setIntro(false)}><Icon name="globe" size={15} />{t('geo.introGo')}</button>
        </div>)}
      {data && !intro && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" className="globe-ctl" onClick={() => zoomAt(1.6)} aria-label={t('geo.zoomIn')} title={t('geo.zoomIn')}><Icon name="plus" size={18} /></button>
          <button type="button" className="globe-ctl" onClick={() => zoomAt(1 / 1.6)} aria-label={t('geo.zoomOut')} title={t('geo.zoomOut')}><Icon name="minus" size={18} /></button>        </div>)}
    </div>
  )
}
