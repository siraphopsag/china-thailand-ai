import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { geoCentroid, geoContains, geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { go, useStore } from '../store'
import { useI18n } from '../i18n'
import { CountryBadge, Icon } from '../components/icons'
import capitals from '../data/geo/capitals.json'
import { ACTIVE, GEO, HOME, MAX_K, SOON, arcPoint, checkDestination, clampView, codeOfIso, directionOf, lerpView, viewForBox, type GeoCode, type View } from '../geo'

/* ================= data (Natural Earth): 1:50m countries clipped to ASEAN + China, first-level divisions of Thailand and China, the 11 capitals ================= */
type Country = Feature<Geometry, { name?: string }>
type Province = Feature<Geometry, { name?: string; name_zh?: string; adm0_a3?: string; iso_3166_2?: string }>
async function loadGeo(): Promise<{ countries: Country[]; provinces: Province[] }> {
  const [r, a] = await Promise.all([import('../data/geo/region-asean-china.json'), import('../data/geo/admin1-th-cn.json')])
  const rt = ((r as { default?: unknown }).default ?? r) as unknown as Topology<{ countries: GeometryCollection<{ name?: string }> }>
  const at = ((a as { default?: unknown }).default ?? a) as unknown as Topology
  const ao = at.objects[Object.keys(at.objects)[0]] as GeometryCollection<Province['properties']>
  const provinces = (feature(at, ao) as FeatureCollection<Geometry, Province['properties']>).features
    .filter((f) => f.properties.iso_3166_2 && !f.properties.iso_3166_2.includes('~')) // not selectable: non-ISO entries such as disputed islands
  return { countries: (feature(rt, rt.objects.countries) as FeatureCollection<Geometry, { name?: string }>).features, provinces }
}
type Capital = { country: GeoCode; ne_id: number; name: string; lon: number; lat: number }
const CAPITALS = capitals as Capital[]
const capitalOf = (c: GeoCode) => CAPITALS.find((x) => x.country === c)!
const provCountry = (p: Province): 'TH' | 'CN' => (p.properties.adm0_a3 === 'THA' ? 'TH' : 'CN')

function useReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const [r, setR] = useState(!!q?.matches)
  useEffect(() => { if (!q) return; const f = () => setR(q.matches); q.addEventListener('change', f); return () => q.removeEventListener('change', f) }, [q])
  return r
}
/** Smoothly follow a numeric target (used for how high the selected shape is raised). */
function useTween(target: number, ms: number, reduce: boolean) {
  const [v, setV] = useState(target)
  const cur = useRef(v); cur.current = v
  useEffect(() => {
    if (reduce) { setV(target); return }
    const from = cur.current, t0 = performance.now(); let id = 0
    const step = (now: number) => { const p = Math.min(1, (now - t0) / ms); setV(from + (target - from) * (1 - Math.pow(1 - p, 3))); if (p < 1) id = requestAnimationFrame(step) }
    id = requestAnimationFrame(step); return () => cancelAnimationFrame(id)
  }, [target, ms, reduce])
  return v
}
const arcD = (a: [number, number], b: [number, number], upto = 1) => 'M' + Array.from({ length: 33 }, (_, i) => arcPoint(a, b, (i / 32) * upto)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')

/** The signature interaction: the current selection rises out of the flat map (stacked side layers + a lifted top face + a soft shadow).
 *  Drawn inside the zoomed group, so the lift is converted from screen pixels to map units. */
function Raised({ d, lift, k, side, top }: { d: string; lift: number; k: number; side: string; top: string }) {
  if (lift < 0.3) return null
  const L = lift / k, n = 6
  return (
    <g className="pointer-events-none">
      <path d={d} className="g-shadow" transform={`translate(${L * 0.45},${L * 0.75})`} />
      {Array.from({ length: n }, (_, i) => <path key={i} d={d} className={side} transform={`translate(0,${(-L * (i + 1)) / (n + 1)})`} />)}
      <path d={d} className={top} transform={`translate(0,${-L})`} />
    </g>
  )
}

/* ================= flow ================= */
// Internal states (never shown to users): MAP_REGION_SELECT = 'origin' | 'destination'; COUNTRY_SELECTED / PROVINCE_SELECT = 'originDetail' | 'destDetail';
// 'soon' = a planned ASEAN country (cannot continue); ROUTE_PREVIEW = 'flight' → 'arrived' → TRANSITION_TO_BUSINESS_CONTEXT (chooseDirection → /interview).
type Stage = 'origin' | 'originDetail' | 'destination' | 'destDetail' | 'soon' | 'flight' | 'arrived'
const COUNTRY_LIFT = 12, PROVINCE_LIFT = 9
export function StartPage() {
  const { t, lang } = useI18n()
  const { mode, exitDemo, chooseDirection } = useStore()
  const reduce = useReducedMotion()
  const [data, setData] = useState<{ countries: Country[]; provinces: Province[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setFailed(false); setData(null)
    loadGeo().then((d) => { if (alive) setData(d) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [attempt])
  useEffect(() => { if (mode === 'demo') exitDemo() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- a new journey is always real data

  const [stage, setStage] = useState<Stage>('origin')
  const [picking, setPicking] = useState<'origin' | 'destination'>('origin')
  const [origin, setOrigin] = useState<GeoCode | null>(null)
  const [originProv, setOriginProv] = useState<string | null>(null)
  const [dest, setDest] = useState<GeoCode | null>(null)
  const [destProv, setDestProv] = useState<string | null>(null)
  const [focus, setFocus] = useState<GeoCode | null>(null)
  const [prov, setProv] = useState<string | null>(null) // province being selected inside the focused country
  const [notice, setNotice] = useState('')
  const [view, setViewState] = useState<View>(HOME)
  const [flightT, setFlightT] = useState(0)
  const viewRef = useRef(view); viewRef.current = view

  // size: measured before the first paint, then followed by ResizeObserver (+ window resize fallback)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 520 })
  useLayoutEffect(() => {
    const el = box.current; if (!el) return
    const measure = () => { const n = { w: Math.max(200, el.clientWidth), h: Math.max(200, el.clientHeight) }; setSize((o) => (o.w === n.w && o.h === n.h ? o : n)) }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el); window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const { w, h } = size
  const focusSet = useMemo(() => (data?.countries ?? []).filter((f) => codeOfIso(f.id)), [data])
  const proj = useMemo(() => {
    const p = geoMercator()
    if (focusSet.length) p.fitExtent([[16, 16], [w - 16, h - 16]], { type: 'FeatureCollection', features: focusSet } as FeatureCollection)
    return p
  }, [focusSet, w, h])
  const path = useMemo(() => geoPath(proj), [proj])
  const shapes = useMemo(() => (data?.countries ?? []).map((f) => ({ f, code: codeOfIso(f.id), d: path(f) ?? '', b: path.bounds(f) as [[number, number], [number, number]] })), [data, path])
  const provShapes = useMemo(() => (data?.provinces ?? []).map((f) => ({ f, code: f.properties.iso_3166_2!, country: provCountry(f), d: path(f) ?? '', c: geoCentroid(f) as [number, number] })), [data, path])
  const setView = useCallback((f: (v: View) => View) => setViewState((v) => clampView(f(v), w, h)), [w, h])

  const anim = useRef(0)
  useEffect(() => () => cancelAnimationFrame(anim.current), [])
  const animateTo = (to: View, ms = 750) => new Promise<void>((res) => {
    cancelAnimationFrame(anim.current)
    if (reduce) { setViewState(to); res(); return }
    const from = viewRef.current, t0 = performance.now()
    const step = (now: number) => { const p = Math.min(1, (now - t0) / ms); setViewState(lerpView(from, to, p)); if (p < 1) anim.current = requestAnimationFrame(step); else res() }
    anim.current = requestAnimationFrame(step)
  })
  const boundsOf = (c: GeoCode) => shapes.find((s) => s.code === c)?.b
  const viewFor = (c: GeoCode): View => {
    if (c === 'SG') { const p = proj([capitalOf('SG').lon, capitalOf('SG').lat])!; return viewForBox([[p[0] - 12, p[1] - 12], [p[0] + 12, p[1] + 12]], w, h, 0.7, MAX_K) }
    const b = boundsOf(c); return b ? viewForBox(b, w, h, c === 'CN' ? 0.8 : 0.72, c === 'ID' || c === 'PH' || c === 'MY' ? 4 : 7) : HOME
  }
  // the view is in pixels of the fitted map, so a resize must re-frame whatever is in focus
  type Target = { kind: 'home' } | { kind: 'country'; c: GeoCode } | { kind: 'prov'; c: GeoCode; p: string } | { kind: 'pair'; a: GeoCode; b: GeoCode }
  const target = useRef<Target>({ kind: 'home' })
  const viewOf = (tg: Target): View => {
    if (tg.kind === 'country') return viewFor(tg.c)
    if (tg.kind === 'prov') { const ps = provShapes.find((x) => x.code === tg.p); if (!ps) return viewFor(tg.c); const b = path.bounds(ps.f) as [[number, number], [number, number]]; const pad = Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) * 1.6; return viewForBox([[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]], w, h, 0.9, 10) }
    if (tg.kind === 'pair') { const a = boundsOf(tg.a), b = boundsOf(tg.b); return a && b ? viewForBox([[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]], w, h, 0.8, 4) : HOME }
    return HOME
  }
  const frame = (tg: Target, ms = 750) => { target.current = tg; return animateTo(viewOf(tg), ms) }
  useEffect(() => { cancelAnimationFrame(anim.current); setViewState(clampView(viewOf(target.current), w, h)) }, [w, h, shapes]) // eslint-disable-line react-hooks/exhaustive-deps

  // how high the current selection is raised: the country while no province is chosen, then only the province
  const detail = (stage === 'originDetail' || stage === 'destDetail') && (focus === 'TH' || focus === 'CN') ? focus : null
  const countryLift = useTween(detail && !prov ? COUNTRY_LIFT : 0, 420, reduce)
  const provLift = useTween(detail && prov ? PROVINCE_LIFT : 0, 380, reduce)
  const shown = detail ?? null
  const shownProvs = shown ? provShapes.filter((p) => p.country === shown) : []

  // gestures: one pointer pans, two pointers pinch-zoom, a tap picks a province (inside the selected country) or a country
  const svg = useRef<SVGSVGElement>(null)
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const down = useRef<{ code?: GeoCode; prov?: string; moved: number }>({ moved: 0 })
  const pinch = useRef<number | null>(null)
  const pick = (c: GeoCode) => {
    if (stage === 'flight' || stage === 'arrived') return
    setNotice('')
    if (picking === 'destination' && origin) {
      const chk = checkDestination(origin, c)
      if (chk === 'same') { setNotice(t('geo.same')); return }
      if (focus !== c) setProv(null)
      setFocus(c); setStage(chk === 'soon' ? 'soon' : 'destDetail')
    } else {
      if (focus !== c) setProv(null)
      setFocus(c); setStage(GEO[c].status === 'soon' ? 'soon' : 'originDetail')
    }
    void frame({ kind: 'country', c })
  }
  const chooseProv = (code: string | null) => { if (!detail) return; if (code && !code.startsWith(detail + '-')) return; setProv(code); void frame(code ? { kind: 'prov', c: detail, p: code } : { kind: 'country', c: detail }, 600) }
  const pickProv = (code: string) => chooseProv(code === prov ? null : code)
  const pickRef = useRef({ pick, pickProv }); pickRef.current = { pick, pickProv }
  const zoomAt = (f: number, cx = w / 2, cy = h / 2) => setView((v) => { const k = Math.max(1, Math.min(MAX_K, v.k * f)); const r = k / v.k; return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r } })
  const zoomRef = useRef(zoomAt); zoomRef.current = zoomAt
  const onDown = (e: ReactPointerEvent) => {
    cancelAnimationFrame(anim.current)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = e.target as Element
    const pv = el.closest('[data-prov]') as HTMLElement | null, ct = el.closest('[data-code]') as HTMLElement | null
    down.current = { prov: pv?.dataset.prov, code: ct?.dataset.code as GeoCode | undefined, moved: 0 }
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y) }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = ptrs.current.get(e.pointerId); if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      down.current.moved += Math.abs(dx) + Math.abs(dy)
      if (ptrs.current.size === 1) setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
      else if (ptrs.current.size === 2 && pinch.current && svg.current) {
        const [a, b] = [...ptrs.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y)
        const r = svg.current.getBoundingClientRect()
        const f = d / pinch.current; pinch.current = d
        setView((v) => { const k = Math.max(1, Math.min(MAX_K, v.k * f)); const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top; const q = k / v.k; return { k, x: cx - (cx - v.x) * q, y: cy - (cy - v.y) * q } })
      }
    }
    const up = (e: PointerEvent) => {
      if (!ptrs.current.has(e.pointerId)) return
      ptrs.current.delete(e.pointerId)
      if (ptrs.current.size < 2) pinch.current = null
      if (ptrs.current.size === 0 && down.current.moved < 6) {
        if (down.current.prov) pickRef.current.pickProv(down.current.prov)
        else if (down.current.code) pickRef.current.pick(down.current.code)
      }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [setView])
  useEffect(() => { // non-passive wheel so zooming the map does not scroll the page
    const el = svg.current; if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomRef.current(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top) }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }, [data])
  const onKey = (e: ReactKeyboardEvent) => {
    const s = 40
    const m: Record<string, () => void> = {
      ArrowLeft: () => setView((v) => ({ ...v, x: v.x + s })), ArrowRight: () => setView((v) => ({ ...v, x: v.x - s })),
      ArrowUp: () => setView((v) => ({ ...v, y: v.y + s })), ArrowDown: () => setView((v) => ({ ...v, y: v.y - s })),
      '+': () => zoomAt(1.25), '=': () => zoomAt(1.25), '-': () => zoomAt(1 / 1.25),
    }
    if (m[e.key]) { e.preventDefault(); m[e.key]() }
  }

  // names
  const name = (c: GeoCode) => t(`geo.c.${c}` as never)
  const capName = (c: GeoCode) => t(`geo.city.${capitalOf(c).name.replace(/\s/g, '')}` as never)
  const provName = (code: string) => t(`prov.${code}` as never)
  const pw = (c: GeoCode) => t(`geo.pw.${c}` as never)
  const crumb = (c: GeoCode, p: string | null) => name(c) + (p ? ' › ' + provName(p) : '')
  const collator = useMemo(() => new Intl.Collator(lang === 'zh' ? 'zh-CN' : lang), [lang])

  // transitions (invalid ones are simply not offered: no destination before an origin, no same country, no continuing with a planned country)
  const backToRegion = (p: 'origin' | 'destination') => { setFocus(null); setProv(null); setStage(p); setPicking(p); setNotice(''); void frame({ kind: 'home' }) }
  const confirmOrigin = () => { if (!focus || GEO[focus].status !== 'active') return; setOrigin(focus); setOriginProv(prov); backToRegion('destination') }
  const confirmDest = async () => {
    if (!focus || !origin || focus === origin || GEO[focus].status !== 'active') return
    const d = focus
    setDest(d); setDestProv(prov); setFocus(null); setProv(null); setStage('flight'); setFlightT(0)
    await frame({ kind: 'pair', a: origin, b: d }, 700)
    if (reduce) setFlightT(1)
    else await new Promise<void>((res) => { const t0 = performance.now(); const step = (now: number) => { const p = Math.min(1, (now - t0) / 2400); setFlightT(p); if (p < 1) anim.current = requestAnimationFrame(step); else res() }; anim.current = requestAnimationFrame(step) })
    setStage('arrived')
  }
  const finish = useCallback(() => {
    const d = directionOf(origin, dest); if (!d) return
    const ok = chooseDirection(d, { originProvince: originProv, destinationProvince: destProv, location: destProv ? provName(destProv) : undefined })
    if (!ok) go('dashboard')
  }, [origin, dest, originProv, destProv, chooseDirection]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (stage !== 'arrived') return; const id = window.setTimeout(finish, reduce ? 2500 : 1500); return () => window.clearTimeout(id) }, [stage, finish, reduce])

  // painting
  const journey = stage === 'flight' || stage === 'arrived'
  const paint = (c: GeoCode | undefined) => {
    if (!c) return 'g-land'
    if (journey) return c === origin || c === dest ? 'g-pick' : 'g-dim'
    if (focus === c) return GEO[c].status === 'active' ? (c === shown ? 'g-footprint' : 'g-pick') : 'g-soon-pick'
    if (picking === 'destination' && c === origin) return 'g-origin'
    return GEO[c].status === 'active' ? 'g-active' : 'g-soon'
  }
  const focusShape = shown ? shapes.find((s) => s.code === shown) : undefined
  const provShape = prov ? provShapes.find((p) => p.code === prov) : undefined
  const screen = (lon: number, lat: number, liftPx = 0): [number, number] | null => { const p = proj([lon, lat]); return p ? [view.x + view.k * p[0], view.y + view.k * p[1] - liftPx] : null }
  // a point sits on whatever is raised under it
  const liftAt = (c: GeoCode, pt: [number, number]) => (c !== shown ? 0 : countryLift + (provShape && geoContains(provShape.f, pt) ? provLift : 0))
  // endpoints of the route: the chosen province (its centre) or else the capital
  const endpoint = (c: GeoCode, p: string | null): { pt: [number, number]; label: string; capital: boolean } => {
    const ps = p ? provShapes.find((x) => x.code === p) : undefined
    return ps ? { pt: ps.c, label: provName(p!), capital: false } : { pt: [capitalOf(c).lon, capitalOf(c).lat], label: capName(c), capital: true }
  }
  const ends = journey && origin && dest ? [endpoint(origin, originProv), endpoint(dest, destProv)] : null
  const endsXY = ends ? ends.map((e) => screen(e.pt[0], e.pt[1])) : null
  const stepIdx = journey ? 2 : picking === 'destination' ? 1 : 0
  const title = journey ? t('geo.journey.t') : picking === 'origin' ? t('geo.origin.q') : t('geo.dest.q')
  const selectionText = focus ? `${picking === 'origin' ? t('geo.originTag') : t('geo.destLbl')}: ${crumb(focus, prov)}${detail ? ' — ' + t('geo.extruded') : ''}` : ''

  const panel = (() => {
    if (failed) return (
      <div className="space-y-3" role="alert"><p className="font-semibold">{t('geo.error')}</p>
        <div className="flex flex-wrap justify-center gap-2"><button className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>{t('geo.retry')}</button><button className="btn-ghost" onClick={() => go('direction')}>{t('geo.fallback')}</button></div></div>)
    if (!data) return <p className="flex items-center gap-2 font-medium" role="status"><Icon name="globe" size={18} className="animate-pulse text-primary" />{t('geo.loading')}</p>
    switch (stage) {
      case 'origin': case 'destination': return (
        <div className="space-y-1" aria-live="polite">
          <p className="text-sm text-muted">{t('geo.pickHint')}</p>
          {notice && <p className="text-sm font-medium text-warn-fg flex items-center gap-1.5" role="alert"><Icon name="info" size={15} />{notice}</p>}
        </div>)
      case 'originDetail': case 'destDetail': {
        const c = focus!
        const list = provShapes.filter((p) => p.country === c).sort((a, b) => collator.compare(provName(a.code), provName(b.code)))
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{stage === 'originDetail' ? t('geo.originTag') : t('geo.destLbl')}</p>
                <div className="flex flex-wrap items-center gap-2"><CountryBadge c={c as 'TH' | 'CN'} /><h2 className="text-2xl font-bold tracking-wide">{name(c)}</h2>{prov && <span className="text-lg font-semibold text-muted">› {provName(prov)}</span>}</div>
                <p className="text-sm flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[rgb(var(--globe-capital))]" aria-hidden />{t('geo.capital')}: <b>{capName(c)}</b></p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" onClick={stage === 'originDetail' ? confirmOrigin : confirmDest} autoFocus><Go>{stage === 'originDetail' ? t('geo.confirmOrigin') : t('geo.confirmDest')}</Go></button>
                <button className="btn-ghost" onClick={() => backToRegion(stage === 'originDetail' ? 'origin' : 'destination')}>{t('geo.back')}</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <label htmlFor="prov-select" className="text-sm text-muted">{t('geo.provHint', { pw: pw(c) })}</label>
              <select id="prov-select" className="input !w-auto min-w-[180px] !py-1.5 text-sm" value={prov ?? ''} onChange={(e) => chooseProv(e.target.value || null)}>
                <option value="">{t('geo.provNone')}</option>
                {list.map((p) => <option key={p.code} value={p.code}>{provName(p.code)}</option>)}
              </select>
              {prov && <button className="text-sm underline text-muted" onClick={() => chooseProv(null)}>{t('geo.provClear')}</button>}
            </div>
          </div>)
      }
      case 'soon': return (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3" aria-live="polite">
          <div className="space-y-1 max-w-xl">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold tracking-wide">{name(focus!)}</h2><span className="chip bg-info-bg text-info-fg border-info-line font-semibold">{t('geo.soon')}</span></div>
            <p className="text-sm flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[rgb(var(--globe-capital))]" aria-hidden />{t('geo.capital')}: <b>{capName(focus!)}</b></p>
            <p className="text-sm text-muted">{t('geo.soon.t')} {t('geo.soon.now')}</p>
          </div>
          <button className="btn-primary" onClick={() => backToRegion(picking)} autoFocus>{t('geo.chooseAnother')}</button>
        </div>)
      case 'flight': case 'arrived': return (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3" aria-live="polite">
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-lg font-semibold"><CountryBadge c={origin as 'TH' | 'CN'} />{crumb(origin!, originProv)}<Icon name="next" size={18} className="text-primary" /><CountryBadge c={dest as 'TH' | 'CN'} />{crumb(dest!, destProv)}</p>
            <p className="text-sm text-muted">{t('geo.flying')}</p>
          </div>
          {stage === 'arrived' && <button className="btn-primary" onClick={finish} autoFocus><Go>{t('geo.continue')}</Go></button>}
        </div>)
    }
  })()

  const listable = data && !failed && !journey
  const Lc = countryLift / view.k
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <header className="space-y-2">
        <ol className="flex flex-wrap items-center gap-x-2 text-xs text-muted" aria-label={t('geo.stepsLabel')}>
          {[1, 2, 3, 4].map((n, i) => <li key={n} aria-current={i === stepIdx ? 'step' : undefined} className={'flex items-center gap-1.5 ' + (i === stepIdx ? 'text-ink font-semibold' : i < stepIdx ? 'text-ok-fg' : '')}>{i > 0 && <Icon name="next" size={12} className="text-muted" />}{i < stepIdx && <Icon name="ok" size={13} />}{t(`geo.progress.${n}` as never)}</li>)}
        </ol>
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {picking === 'destination' && origin && !journey && <p className="text-sm text-muted">{t('geo.originTag')}: <b className="text-ink">{crumb(origin, originProv)}</b></p>}
      </header>

      <div ref={box} className="relative rounded-2xl overflow-hidden border border-line map-stage h-[50vh] min-h-[300px] max-h-[600px] sm:h-[56vh]">
        {data && (
          <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="application" aria-label={t('geo.mapLabel')} aria-describedby="geo-state" tabIndex={0} onKeyDown={onKey} onPointerDown={onDown}
            className="block select-none cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }}>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {/* the flat map: every country stays a flat 2D shape */}
              {shapes.map((s, i) => <path key={String(s.f.id ?? i)} d={s.d} data-code={s.code} className={'g-c ' + paint(s.code)}>{s.code && <title>{name(s.code)}</title>}</path>)}
              {/* only the selected country rises (while no province is chosen) */}
              {focusShape && <Raised d={focusShape.d} lift={countryLift} k={view.k} side="g-side" top="g-top" />}
              {/* province boundaries of the selected country, sitting on its (raised) surface; names stay hidden */}
              {shown && <g transform={`translate(0,${-Lc})`}>
                {shownProvs.map((p) => <path key={p.code} d={p.d} data-prov={p.code} className={'g-prov' + (p.code === prov ? ' is-sel' : '')}><title>{provName(p.code)}</title></path>)}
              </g>}
              {/* then only the selected province rises */}
              {provShape && <Raised d={provShape.d} lift={provLift} k={view.k} side="g-pside" top="g-ptop" />}
            </g>
            {!journey && (() => { const p = screen(capitalOf('SG').lon, capitalOf('SG').lat); return p ? <circle cx={p[0]} cy={p[1]} r={10} data-code="SG" className="g-hit cursor-pointer"><title>{name('SG')}</title></circle> : null })()}
            {endsXY && endsXY[0] && endsXY[1] && <>
              <path d={arcD(endsXY[0], endsXY[1])} className="g-route" />
              {flightT > 0 && <path d={arcD(endsXY[0], endsXY[1], flightT)} className="g-route-done" />}
              {flightT > 0 && (() => { const p = arcPoint(endsXY[0], endsXY[1], Math.min(flightT, 0.995)); return <g transform={`translate(${p.x},${p.y}) rotate(${p.deg})`} className="pointer-events-none"><path d="M11 0 L3.5 -1.4 L-1 -8 L-3.2 -8 L-0.5 -1.4 L-5.5 -1.4 L-7.8 -4.2 L-9.2 -4.2 L-7.8 0 L-9.2 4.2 L-7.8 4.2 L-5.5 1.4 L-0.5 1.4 L-3.2 8 L-1 8 L3.5 1.4 Z" className="g-plane" /></g> })()}
              {ends!.map((e, i) => { const xy = endsXY[i]; return xy ? <g key={i} className="pointer-events-none"><circle cx={xy[0]} cy={xy[1]} r={6} className={e.capital ? 'g-capital' : 'g-provmark'} /><text x={xy[0] + 10} y={xy[1] + 4} className="g-label">{e.label}</text></g> : null })}
            </>}
            {/* country names: the two active countries on the regional map; the selected one sits above its shape */}
            {!journey && (focus ? [focus] : ACTIVE).map((c) => {
              const s = shapes.find((x) => x.code === c); if (!s) return null
              const focused = c === focus
              const x = view.x + view.k * ((s.b[0][0] + s.b[1][0]) / 2)
              const y = focused ? view.y + view.k * s.b[0][1] - 12 - (c === shown ? countryLift : 0) : view.y + view.k * ((s.b[0][1] + s.b[1][1]) / 2)
              return <text key={'n' + c} x={Math.min(w - 50, Math.max(50, x))} y={Math.min(h - 10, Math.max(22, y))} textAnchor="middle" className={(focused ? 'g-name' : 'g-label') + ' pointer-events-none'}>{name(c)}</text>
            })}
            {journey && ends && origin && dest && [origin, dest].map((c) => { const s = shapes.find((x) => x.code === c); if (!s) return null; const x = view.x + view.k * ((s.b[0][0] + s.b[1][0]) / 2), y = view.y + view.k * s.b[0][1] - 10; return <text key={'j' + c} x={Math.min(w - 50, Math.max(50, x))} y={Math.max(22, y)} textAnchor="middle" className="g-name pointer-events-none">{name(c)}</text> })}
            {/* the selected province's name (only that one) */}
            {provShape && focus && (() => { const xy = screen(provShape.c[0], provShape.c[1], provLift); if (!xy) return null; const cap = capitalOf(focus); const cp = screen(cap.lon, cap.lat, liftAt(focus, [cap.lon, cap.lat])); const near = cp && Math.abs(cp[1] - (xy[1] - 12)) < 18 && Math.abs(cp[0] + 40 - xy[0]) < 90; return <text x={xy[0]} y={near ? xy[1] + 24 : xy[1] - 12} textAnchor="middle" className="g-label pointer-events-none">{provName(provShape.code)}</text> })()}
            {/* the capital is the first reference point: one red marker for the country in focus */}
            {!journey && focus && (() => { const cap = capitalOf(focus); const pt: [number, number] = [cap.lon, cap.lat]; const p = screen(cap.lon, cap.lat, liftAt(focus, pt)); return p ? (
              <g className="pointer-events-none"><circle cx={p[0]} cy={p[1]} r={6} className="g-capital" />{capName(focus) !== name(focus) && <text x={p[0] + 10} y={p[1] + 4} className="g-label">{capName(focus)}</text>}</g>) : null })()}
          </svg>)}
        {data && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            <button className="globe-ctl" onClick={() => zoomAt(1.3)} aria-label={t('geo.zoomIn')} title={t('geo.zoomIn')}><Icon name="plus" size={18} /></button>
            <button className="globe-ctl" onClick={() => zoomAt(1 / 1.3)} aria-label={t('geo.zoomOut')} title={t('geo.zoomOut')}><Icon name="minus" size={18} /></button>
            <button className="globe-ctl" onClick={() => void frame(target.current, 500)} aria-label={t('geo.resetView')} title={t('geo.resetView')}><Icon name="target" size={18} /></button>
          </div>)}
        {!data && <div className="absolute inset-0 grid place-items-center p-6 text-center">{panel}</div>}
        <p id="geo-state" className="sr-only" aria-live="polite">{selectionText}</p>
      </div>

      {data && <section className="card !p-4">{panel}</section>}
      {listable && (
        <section aria-label={t('geo.listLabel')} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-muted">{t('geo.active')}:</span>
          {ACTIVE.map((c) => { const isOrigin = picking === 'destination' && c === origin; return <button key={c} className={'px-3 py-1.5 rounded-lg border min-h-[36px] transition ' + (isOrigin ? 'border-line text-muted cursor-not-allowed' : 'border-primary text-primary font-semibold hover:bg-brand')} aria-disabled={isOrigin} aria-pressed={focus === c} onClick={() => pick(c)}>{name(c)}{isOrigin ? ` (${t('geo.originTag')})` : ''}</button> })}
          <span className="text-xs font-semibold text-muted sm:ml-2">{t('geo.soon')}:</span>
          {SOON.map((c) => <button key={c} className="px-2.5 py-1 rounded-lg border border-line text-muted hover:bg-surface3 min-h-[32px] text-xs" aria-pressed={focus === c} onClick={() => pick(c)}>{name(c)}</button>)}
        </section>)}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{t('geo.attribution')}</span>
        <button className="underline" onClick={() => go('direction')}>{t('geo.fallback')}</button>
      </div>
    </div>
  )
}
const Go = ({ children }: { children: ReactNode }) => <>{children}<Icon name="next" size={16} /></>
