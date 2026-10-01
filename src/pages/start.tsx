import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { geoCentroid, geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, MultiLineString } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { go, useStore } from '../store'
import { useI18n } from '../i18n'
import { CountryBadge, Icon } from '../components/icons'
import { BRAND } from '../brand'
import places from '../data/geo/places.json'
import { ACTIVE, GEO, REGION_VIEW, SOON, WORLD_VIEW, checkDestination, clampK, clampPhi, codeOfIso, directionOf, lerpCamera, type Camera, type GeoCode } from '../geo'

/* ================= data (Natural Earth via world-atlas 1:110m + a Thailand/China admin-1 extract), loaded on demand ================= */
type Props = { name?: string; name_zh?: string; adm0_a3?: string }
interface GeoData {
  countries: Feature<Geometry, Props>[]
  admin1: Feature<Geometry, Props>[]
  adminMesh: Record<'TH' | 'CN', MultiLineString>
}
async function loadGeo(): Promise<GeoData> {
  const [w, a] = await Promise.all([import('world-atlas/countries-110m.json'), import('../data/geo/admin1-th-cn.json')])
  const wt = ((w as { default?: unknown }).default ?? w) as unknown as Topology<{ countries: GeometryCollection<Props> }>
  const at = ((a as { default?: unknown }).default ?? a) as unknown as Topology
  const key = Object.keys(at.objects)[0]
  const ao = at.objects[key] as GeometryCollection<Props>
  const inner = (iso: string) => mesh(at, ao, (x, y) => x !== y && (x.properties as Props | undefined)?.adm0_a3 === iso && (y.properties as Props | undefined)?.adm0_a3 === iso)
  return {
    countries: (feature(wt, wt.objects.countries) as FeatureCollection<Geometry, Props>).features,
    admin1: (feature(at, ao) as FeatureCollection<Geometry, Props>).features,
    adminMesh: { TH: inner('THA'), CN: inner('CHN') },
  }
}
type Place = { ne_id: number; country: 'TH' | 'CN' | 'SG'; name: string; capital: boolean; lon: number; lat: number }
const PLACES = places as Place[]
const capitalOf = (c: GeoCode) => PLACES.find((p) => p.country === c && p.capital)
const SG = capitalOf('SG')!

function useReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const [r, setR] = useState(!!q?.matches)
  useEffect(() => { if (!q) return; const f = () => setR(q.matches); q.addEventListener('change', f); return () => q.removeEventListener('change', f) }, [q])
  return r
}

/* ================= globe: orthographic projection drawn as SVG; drag/touch to rotate, wheel/pinch/buttons/keys to zoom ================= */
type Paint = (c: GeoCode | undefined) => string
interface GlobeProps {
  data: GeoData; cam: Camera; setCam: (f: (c: Camera) => Camera) => void; paint: Paint; onPick: (c: GeoCode) => void; onUser: () => void
  detail: 'TH' | 'CN' | null; labels: { code: GeoCode; text: string }[]; cities: { p: Place; text: string }[]
  route: [[number, number], [number, number]] | null; flightT: number; showSG: boolean; sgPaint: string; ariaLabel: string; provinceName: (f: Props) => string
  onSize: (w: number, h: number) => void
  /** vertical position of the globe centre (fraction of height): higher once the panel sits at the bottom */
  cx: number
  cy: number
}
function Globe({ data, cam, setCam, paint, onPick, onUser, detail, labels, cities, route, flightT, showSG, sgPaint, ariaLabel, provinceName, onSize, cx, cy }: GlobeProps) {
  const box = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  useEffect(() => {
    const el = box.current; if (!el) return
    const ro = new ResizeObserver(([e]) => { const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height); setSize({ w, h }); onSize(w, h) })
    ro.observe(el); return () => ro.disconnect()
  }, [onSize])
  const { w, h } = size
  const base = (Math.min(w, h) / 2) * 0.9
  const proj = useMemo(() => geoOrthographic().translate([w * cx, h * cy]).scale(base * cam.k).rotate([cam.rotate[0], cam.rotate[1]]).clipAngle(90).precision(0.4), [w, h, base, cam, cx, cy])
  const path = useMemo(() => geoPath(proj), [proj])
  const centre: [number, number] = [-cam.rotate[0], -cam.rotate[1]]
  const visible = (lon: number, lat: number) => geoDistance([lon, lat], centre) < Math.PI / 2 - 0.03

  // pointer gestures (mouse + touch): one pointer rotates, two pointers pinch-zoom; a tap without movement picks a country
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const down = useRef<{ code?: GeoCode; moved: number }>({ moved: 0 })
  const pinch = useRef<number | null>(null)
  const onDown = (e: ReactPointerEvent) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = (e.target as Element).closest('[data-code]') as HTMLElement | null
    down.current = { code: (el?.dataset.code as GeoCode | undefined), moved: 0 }
    if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y) }
    onUser()
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = ptrs.current.get(e.pointerId); if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      down.current.moved += Math.abs(dx) + Math.abs(dy)
      if (ptrs.current.size === 1) {
        setCam((c) => { const s = 0.28 / c.k; return { ...c, rotate: [c.rotate[0] + dx * s, clampPhi(c.rotate[1] - dy * s)] } })
      } else if (ptrs.current.size === 2 && pinch.current) {
        const [a, b] = [...ptrs.current.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y)
        const r = d / pinch.current; pinch.current = d
        setCam((c) => ({ ...c, k: clampK(c.k * r) }))
      }
    }
    const up = (e: PointerEvent) => {
      if (!ptrs.current.has(e.pointerId)) return
      ptrs.current.delete(e.pointerId)
      if (ptrs.current.size < 2) pinch.current = null
      if (ptrs.current.size === 0 && down.current.moved < 6 && down.current.code) onPick(down.current.code)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [setCam, onPick])
  useEffect(() => { // wheel must be non-passive to stop the page from scrolling while zooming the globe
    const el = svg.current; if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); onUser(); setCam((c) => ({ ...c, k: clampK(c.k * Math.exp(-e.deltaY * 0.0015)) })) }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }, [setCam, onUser])
  const onKey = (e: ReactKeyboardEvent) => {
    const step = 8 / cam.k
    const m: Record<string, (c: Camera) => Camera> = {
      ArrowLeft: (c) => ({ ...c, rotate: [c.rotate[0] + step, c.rotate[1]] }), ArrowRight: (c) => ({ ...c, rotate: [c.rotate[0] - step, c.rotate[1]] }),
      ArrowUp: (c) => ({ ...c, rotate: [c.rotate[0], clampPhi(c.rotate[1] - step)] }), ArrowDown: (c) => ({ ...c, rotate: [c.rotate[0], clampPhi(c.rotate[1] + step)] }),
      '+': (c) => ({ ...c, k: clampK(c.k * 1.25) }), '=': (c) => ({ ...c, k: clampK(c.k * 1.25) }), '-': (c) => ({ ...c, k: clampK(c.k / 1.25) }),
    }
    if (m[e.key]) { e.preventDefault(); onUser(); setCam(m[e.key]) }
  }

  const plane = useMemo(() => {
    if (!route || flightT <= 0) return null
    const ip = geoInterpolate(route[0], route[1])
    const t = Math.min(flightT, 0.999)
    const a = proj(ip(t)), b = proj(ip(Math.min(1, t + 0.01)))
    if (!a || !b) return null
    return { x: a[0], y: a[1], deg: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI }
  }, [route, flightT, proj])
  const flown = route && flightT > 0 ? { type: 'LineString' as const, coordinates: Array.from({ length: 41 }, (_, i) => geoInterpolate(route[0], route[1])((i / 40) * Math.min(1, flightT))) } : null
  const detailProvinces = detail ? data.admin1.filter((f) => f.properties.adm0_a3 === (detail === 'TH' ? 'THA' : 'CHN')) : []

  return (
    <div ref={box} className="absolute inset-0">
      <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="application" aria-label={ariaLabel} tabIndex={0} onKeyDown={onKey}
        onPointerDown={onDown} className="block select-none cursor-grab active:cursor-grabbing focus-visible:outline-none" style={{ touchAction: 'none' }}>
        <path d={path({ type: 'Sphere' }) ?? ''} className="globe-ocean" />
        <path d={path(geoGraticule10()) ?? ''} className="globe-grat" />
        {data.countries.map((f, i) => { const code = codeOfIso(f.id); return <path key={String(f.id ?? i)} d={path(f) ?? ''} data-code={code} className={'g-c ' + paint(code)} /> })}
        {detailProvinces.map((f, i) => <path key={i} d={path(f) ?? ''} className="g-prov"><title>{provinceName(f.properties)}</title></path>)}
        {detail && <path d={path(data.adminMesh[detail]) ?? ''} className="g-admin" />}
        {showSG && visible(SG.lon, SG.lat) && (() => { const p = proj([SG.lon, SG.lat]); return p ? <g data-code="SG" className={'cursor-pointer ' + sgPaint}><circle cx={p[0]} cy={p[1]} r={9} className="g-hit" /><circle cx={p[0]} cy={p[1]} r={Math.min(6, 2.5 + cam.k * 0.35)} className="g-sg" /></g> : null })()}
        {route && <path d={path({ type: 'LineString', coordinates: route }) ?? ''} className="g-route" />}
        {flown && <path d={path(flown) ?? ''} className="g-route-done" />}
        {labels.map(({ code, text }) => {
          const f = data.countries.find((x) => codeOfIso(x.id) === code); if (!f) return null
          const c = geoCentroid(f); if (!visible(c[0], c[1])) return null
          const p = proj(c); return p ? <text key={code} x={p[0]} y={p[1]} textAnchor="middle" className="g-label pointer-events-none">{text}</text> : null
        })}
        {cities.map(({ p, text }) => {
          if (!visible(p.lon, p.lat)) return null
          const xy = proj([p.lon, p.lat]); if (!xy) return null
          return (
            <g key={p.ne_id} className="pointer-events-none">
              {p.capital ? <circle cx={xy[0]} cy={xy[1]} r={6} className="g-capital" /> : <circle cx={xy[0]} cy={xy[1]} r={3.2} className="g-city" />}
              <text x={xy[0] + (p.capital ? 10 : 7)} y={xy[1] + 4} className={p.capital ? 'g-label' : 'g-label-sm'}>{text}</text>
            </g>)
        })}
        {route && cities.length === 0 && route.map((pt, i) => { const xy = proj(pt); return xy ? <circle key={i} cx={xy[0]} cy={xy[1]} r={5} className="g-capital" /> : null })}
        {plane && <g transform={`translate(${plane.x},${plane.y}) rotate(${plane.deg})`} className="pointer-events-none"><path d="M12 0 L4 -1.6 L-1 -9 L-3.6 -9 L-0.6 -1.6 L-6 -1.6 L-8.6 -4.6 L-10.2 -4.6 L-8.6 0 L-10.2 4.6 L-8.6 4.6 L-6 1.6 L-0.6 1.6 L-3.6 9 L-1 9 L4 1.6 Z" className="g-plane" /></g>}
      </svg>
    </div>
  )
}

/* ================= onboarding: world → ASEAN + China → origin → detail → destination → journey → business context ================= */
/** Where the focus sits once the question panel is shown: beside the panel on wide screens, above it on narrow ones. */
const layoutFor = (w: number) => (w >= 640 ? { cx: 0.64, cy: 0.47, bw: 0.62, bh: 0.78 } : { cx: 0.5, cy: 0.35, bw: 0.9, bh: 0.5 })
type Stage = 'intro' | 'toRegion' | 'origin' | 'originDetail' | 'destination' | 'destDetail' | 'soon' | 'flight' | 'arrived'
export function StartPage() {
  const { t, lang } = useI18n()
  const { mode, exitDemo, chooseDirection } = useStore()
  const reduce = useReducedMotion()
  const [data, setData] = useState<GeoData | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setFailed(false); setData(null)
    loadGeo().then((d) => { if (alive) setData(d) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [attempt])
  useEffect(() => { if (mode === 'demo') exitDemo() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- a new journey is always real data

  const [stage, setStage] = useState<Stage>('intro')
  const [picking, setPicking] = useState<'origin' | 'destination'>('origin')
  const [origin, setOrigin] = useState<GeoCode | null>(null)
  const [dest, setDest] = useState<GeoCode | null>(null)
  const [focus, setFocus] = useState<GeoCode | null>(null)
  const [notice, setNotice] = useState('')
  const [cam, setCamState] = useState<Camera>(WORLD_VIEW)
  const [flightT, setFlightT] = useState(0)
  const camRef = useRef(cam); camRef.current = cam
  const sizeRef = useRef({ w: 800, h: 600 })
  const anim = useRef(0)
  const touched = useRef(false)
  const setCam = useCallback((f: (c: Camera) => Camera) => setCamState(f), [])
  const stop = useCallback(() => { cancelAnimationFrame(anim.current) }, [])
  const onUser = useCallback(() => { touched.current = true; if (stage !== 'flight') stop() }, [stage, stop])
  const [width, setWidth] = useState(800)
  const onSize = useCallback((w: number, h: number) => { sizeRef.current = { w, h }; setWidth(w) }, [])
  const layout = layoutFor(width)
  useEffect(() => () => stop(), [stop])

  const animateTo = (to: Camera, ms = 1100) => new Promise<void>((res) => {
    stop()
    if (reduce) { setCamState(to); res(); return }
    const from = camRef.current, t0 = performance.now()
    const step = (now: number) => { const p = Math.min(1, (now - t0) / ms); setCamState(lerpCamera(from, to, p)); if (p < 1) anim.current = requestAnimationFrame(step); else res() }
    anim.current = requestAnimationFrame(step)
  })
  /** Camera that centres and frames a shape (country or route). */
  const fit = (g: Feature | { type: 'LineString'; coordinates: [number, number][] }, centre: [number, number], fill = 0.6, maxK = 9): Camera => {
    const { w, h } = sizeRef.current
    const base = (Math.min(w, h) / 2) * 0.9
    const L = layoutFor(w)
    const p = geoOrthographic().translate([w * L.cx, h * L.cy]).scale(base).rotate([-centre[0], -centre[1]]).clipAngle(90)
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds(g as never)
    const k = Math.min((w * L.bw * fill) / Math.max(1, x1 - x0), (h * L.bh * fill) / Math.max(1, y1 - y0))
    return { rotate: [-centre[0], -centre[1]], k: clampK(Math.min(maxK, Math.max(1.3, k))) }
  }
  const countryCam = (c: GeoCode): Camera => {
    if (c === 'SG') return { rotate: [-SG.lon, -SG.lat], k: 8 }
    const f = data?.countries.find((x) => codeOfIso(x.id) === c)
    return f ? fit(f, geoCentroid(f) as [number, number], 0.9) : REGION_VIEW
  }

  // intro: the globe turns slowly on its own until the user touches it (never with reduced motion)
  useEffect(() => {
    if (stage !== 'intro' || !data || reduce) return
    let last = performance.now()
    const spin = (now: number) => { const dt = now - last; last = now; if (!touched.current) setCamState((c) => ({ ...c, rotate: [c.rotate[0] - dt * 0.006, c.rotate[1]] })); anim.current = requestAnimationFrame(spin) }
    anim.current = requestAnimationFrame(spin)
    return () => cancelAnimationFrame(anim.current)
  }, [stage, data, reduce])

  const name = (c: GeoCode) => t(`geo.c.${c}` as never)
  const start = async () => { setStage('toRegion'); touched.current = true; await animateTo(REGION_VIEW, 1300); setStage('origin'); setPicking('origin') }
  const pick = (c: GeoCode) => {
    if (!['origin', 'destination', 'soon', 'originDetail', 'destDetail'].includes(stage)) return
    setNotice('')
    if (picking === 'destination' && origin) {
      const chk = checkDestination(origin, c)
      if (chk === 'same') { setNotice(t('geo.same')); return }
      setFocus(c); setStage(chk === 'soon' ? 'soon' : 'destDetail')
    } else {
      setFocus(c); setStage(GEO[c].status === 'soon' ? 'soon' : 'originDetail')
    }
    void animateTo(countryCam(c), 1000)
  }
  const backToRegion = (p: 'origin' | 'destination') => { setFocus(null); setStage(p); setPicking(p); void animateTo(REGION_VIEW, 900) }
  const confirmOrigin = () => { if (!focus) return; setOrigin(focus); backToRegion('destination') }
  const confirmDest = async () => {
    if (!focus || !origin) return
    setDest(focus); setFocus(null); setStage('flight')
    const a = capitalOf(origin)!, b = capitalOf(focus)!
    const line = { type: 'LineString' as const, coordinates: [[a.lon, a.lat], [b.lon, b.lat]] as [number, number][] }
    const mid = geoInterpolate([a.lon, a.lat], [b.lon, b.lat])(0.5) as [number, number]
    await animateTo(fit(line, mid, 0.55, 4.5), 900)
    if (reduce) { setFlightT(1) } else {
      await new Promise<void>((res) => { const t0 = performance.now(); const step = (now: number) => { const p = Math.min(1, (now - t0) / 2600); setFlightT(p); if (p < 1) anim.current = requestAnimationFrame(step); else res() }; anim.current = requestAnimationFrame(step) })
    }
    setStage('arrived')
  }
  const finish = useCallback(() => { const d = directionOf(origin, dest); if (d && !chooseDirection(d)) go('dashboard') }, [origin, dest, chooseDirection])
  useEffect(() => { if (stage !== 'arrived') return; const id = window.setTimeout(finish, reduce ? 2500 : 1600); return () => window.clearTimeout(id) }, [stage, finish, reduce])

  // what each country looks like right now
  const paint: Paint = (c) => {
    if (!c) return stage === 'intro' || stage === 'toRegion' ? 'g-land' : 'g-dim'
    if (stage === 'intro' || stage === 'toRegion') return GEO[c].status === 'active' ? 'g-active-soft' : 'g-land'
    if (stage === 'flight' || stage === 'arrived') return c === origin || c === dest ? 'g-pick' : 'g-dim'
    if (focus === c) return GEO[c].status === 'active' ? 'g-pick' : 'g-soon-pick'
    if (picking === 'destination' && c === origin) return 'g-origin'
    return GEO[c].status === 'active' ? 'g-active' : 'g-soon'
  }
  const detail = (stage === 'originDetail' || stage === 'destDetail') && (focus === 'TH' || focus === 'CN') ? focus : null
  const cityText = (p: Place) => t(`geo.city.${p.name.replace(/\s/g, '')}` as never)
  const cities = detail ? PLACES.filter((p) => p.country === detail).map((p) => ({ p, text: cityText(p) })) : []
  const labels = stage === 'origin' || stage === 'destination' || stage === 'soon' ? ACTIVE.map((c) => ({ code: c, text: name(c) })) : stage === 'flight' || stage === 'arrived' ? [origin!, dest!].map((c) => ({ code: c, text: name(c) })) : []
  const route: [[number, number], [number, number]] | null = (stage === 'flight' || stage === 'arrived') && origin && dest ? [[capitalOf(origin)!.lon, capitalOf(origin)!.lat], [capitalOf(dest)!.lon, capitalOf(dest)!.lat]] : null
  const provinceName = (p: Props) => (lang === 'zh' && p.name_zh ? p.name_zh : p.name ?? '')
  const stepIdx = stage === 'intro' || stage === 'toRegion' ? -1 : stage === 'flight' || stage === 'arrived' ? 2 : picking === 'destination' ? 1 : 0
  const zoom = (f: number) => { onUser(); setCam((c) => ({ ...c, k: clampK(c.k * f) })) }
  const resetView = () => { onUser(); void animateTo(stage === 'intro' ? WORLD_VIEW : focus ? countryCam(focus) : REGION_VIEW, 700) }

  const panel = (() => {
    if (failed) return (
      <div className="space-y-3" role="alert"><p className="font-semibold">{t('geo.error')}</p>
        <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>{t('geo.retry')}</button><button className="btn-ghost" onClick={() => go('direction')}>{t('geo.fallback')}</button></div></div>)
    if (!data) return <p className="flex items-center gap-2 font-medium" role="status"><Icon name="globe" size={18} className="animate-pulse text-primary" />{t('geo.loading')}</p>
    switch (stage) {
      case 'intro': case 'toRegion': return (
        <div className="space-y-3">
          <p className="text-sm text-muted">{t('geo.kicker')}</p>
          <button className="btn-primary !px-6 !min-h-[48px] text-base" onClick={start} disabled={stage === 'toRegion'} autoFocus><Go2>{t('geo.start')}</Go2></button>
          <p className="text-xs text-muted">{t('geo.introHint')}</p>
        </div>)
      case 'origin': case 'destination': return (
        <div className="space-y-2" aria-live="polite">
          {stage === 'destination' && origin && <p className="text-xs text-muted flex items-center gap-1.5">{t('geo.originTag')}: <span className="font-semibold text-ink">{name(origin)}</span></p>}
          <h2 className="text-xl font-semibold">{stage === 'origin' ? t('geo.origin.q') : t('geo.dest.q')}</h2>
          <p className="text-sm text-muted">{t('geo.pickHint')}</p>
          {notice && <p className="text-sm font-medium text-warn-fg flex items-center gap-1.5" role="alert"><Icon name="info" size={15} />{notice}</p>}
        </div>)
      case 'originDetail': case 'destDetail': {
        const c = focus!, cap = capitalOf(c)
        return (
          <div className="space-y-3" aria-live="polite">
            <div className="flex items-center gap-2"><CountryBadge c={c as 'TH' | 'CN'} /><h2 className="text-xl font-semibold">{name(c)}</h2></div>
            {cap && <p className="text-sm flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[rgb(var(--globe-capital))]" aria-hidden />{t('geo.capital')}: <b>{cityText(cap)}</b></p>}
            <p className="text-xs text-muted">{t('geo.capitalNote')} {t('geo.adminLegend')}</p>
            <p className="text-xs text-muted">{t('geo.majorCities')}: {PLACES.filter((p) => p.country === c && !p.capital).map(cityText).join(' · ')}</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={stage === 'originDetail' ? confirmOrigin : confirmDest} autoFocus><Go2>{stage === 'originDetail' ? t('geo.confirmOrigin') : t('geo.confirmDest')}</Go2></button>
              <button className="btn-ghost" onClick={() => backToRegion(stage === 'originDetail' ? 'origin' : 'destination')}>{t('geo.back')}</button>
            </div>
          </div>)
      }
      case 'soon': return (
        <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{name(focus!)}</h2><span className="chip bg-info-bg text-info-fg border-info-line font-semibold">{t('geo.soon')}</span></div>
          <p className="text-sm">{t('geo.soon.t')}</p><p className="text-xs text-muted">{t('geo.soon.now')}</p>
          <button className="btn-primary" onClick={() => backToRegion(picking)} autoFocus>{t('geo.chooseAnother')}</button>
        </div>)
      case 'flight': case 'arrived': return (
        <div className="space-y-3" aria-live="polite">
          <p className="flex items-center gap-2 text-lg font-semibold"><CountryBadge c={origin as 'TH' | 'CN'} />{name(origin!)}<Icon name="next" size={18} className="text-primary" /><CountryBadge c={dest as 'TH' | 'CN'} />{name(dest!)}</p>
          <p className="text-sm">{t('geo.flying')}</p>
          {stage === 'arrived' && <button className="btn-primary" onClick={finish} autoFocus><Go2>{t('geo.continue')}</Go2></button>}
        </div>)
    }
  })()

  const listable = data && !failed && ['origin', 'destination', 'soon'].includes(stage)
  return (
    <div className="space-y-3 -mt-2">
      <div className="relative rounded-2xl overflow-hidden border border-line globe-stage h-[72vh] min-h-[460px] max-h-[820px]">
        {data && <Globe data={data} cam={cam} setCam={setCam} paint={paint} onPick={pick} onUser={onUser} detail={detail} labels={labels} cities={cities} route={route} flightT={flightT}
          showSG={stage !== 'intro' && stage !== 'toRegion' && stage !== 'flight' && stage !== 'arrived'} sgPaint={focus === 'SG' ? 'is-pick' : ''} ariaLabel={t('geo.mapLabel')} provinceName={provinceName} onSize={onSize} cx={stage === 'intro' ? 0.5 : layout.cx} cy={stage === 'intro' ? 0.5 : layout.cy} />}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto rounded-xl bg-surface/85 backdrop-blur border border-line px-3 py-2">
            <div className="text-sm font-bold tracking-[0.12em]" lang="en">{BRAND.name}</div>
            {stepIdx >= 0 && <ol className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted mt-0.5" aria-label={t('geo.stepsLabel')}>{[1, 2, 3, 4].map((n, i) => <li key={n} aria-current={i === stepIdx ? 'step' : undefined} className={'flex items-center gap-1.5 ' + (i === stepIdx ? 'text-ink font-semibold' : i < stepIdx ? 'text-ok-fg' : '')}>{i > 0 && <span aria-hidden>›</span>}{t(`geo.progress.${n}` as never)}</li>)}</ol>}
          </div>
          {data && <div className="pointer-events-auto flex flex-col gap-1.5">
            <button className="globe-ctl" onClick={() => zoom(1.3)} aria-label={t('geo.zoomIn')} title={t('geo.zoomIn')}><Icon name="plus" size={18} /></button>
            <button className="globe-ctl" onClick={() => zoom(1 / 1.3)} aria-label={t('geo.zoomOut')} title={t('geo.zoomOut')}><Icon name="minus" size={18} /></button>
            <button className="globe-ctl" onClick={resetView} aria-label={t('geo.resetView')} title={t('geo.resetView')}><Icon name="target" size={18} /></button>
          </div>}
        </div>
        <div className="absolute left-2 right-2 bottom-2 sm:left-3 sm:bottom-3 sm:right-auto sm:max-w-sm rounded-xl bg-surface/95 backdrop-blur border border-line shadow-lg p-3 sm:p-4 text-sm">{panel}</div>
      </div>
      {listable && (
        <section aria-label={t('geo.listLabel')} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-muted">{t('geo.active')}:</span>
          {ACTIVE.map((c) => { const isOrigin = picking === 'destination' && c === origin; return <button key={c} className={'px-3 py-1.5 rounded-lg border min-h-[36px] transition ' + (isOrigin ? 'border-line text-muted cursor-not-allowed' : 'border-primary text-primary font-semibold hover:bg-brand')} aria-disabled={isOrigin} onClick={() => pick(c)}>{name(c)}{isOrigin ? ` (${t('geo.originTag')})` : ''}</button> })}
          <span className="text-xs font-semibold text-muted ml-2">{t('geo.soon')}:</span>
          {SOON.map((c) => <button key={c} className="px-2.5 py-1 rounded-lg border border-line text-muted hover:bg-surface3 min-h-[32px] text-xs" onClick={() => pick(c)}>{name(c)}</button>)}
        </section>)}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{t('geo.attribution')}</span>
        <button className="underline" onClick={() => go('direction')}>{t('geo.fallback')}</button>
      </div>
    </div>
  )
}
const Go2 = ({ children }: { children: ReactNode }) => <>{children}<Icon name="next" size={16} /></>
