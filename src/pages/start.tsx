import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { go, useStore } from '../store'
import { useI18n } from '../i18n'
import { CountryBadge, Icon } from '../components/icons'
import capitals from '../data/geo/capitals.json'
import { ACTIVE, GEO, HOME, MAX_K, SOON, arcPoint, checkDestination, clampView, codeOfIso, directionOf, lerpView, viewForBox, type GeoCode, type View } from '../geo'

/* ================= data: Natural Earth 1:50m countries clipped to ASEAN + China (+ capitals from Natural Earth populated places) ================= */
type Country = Feature<Geometry, { name?: string }>
async function loadRegion(): Promise<Country[]> {
  const m = await import('../data/geo/region-asean-china.json')
  const t = ((m as { default?: unknown }).default ?? m) as unknown as Topology<{ countries: GeometryCollection<{ name?: string }> }>
  return (feature(t, t.objects.countries) as FeatureCollection<Geometry, { name?: string }>).features
}
type Capital = { country: GeoCode; ne_id: number; name: string; lon: number; lat: number }
const CAPITALS = capitals as Capital[]
const capitalOf = (c: GeoCode) => CAPITALS.find((x) => x.country === c)!

function useReducedMotion() {
  const q = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const [r, setR] = useState(!!q?.matches)
  useEffect(() => { if (!q) return; const f = () => setR(q.matches); q.addEventListener('change', f); return () => q.removeEventListener('change', f) }, [q])
  return r
}
const arcD = (a: [number, number], b: [number, number], upto = 1) => 'M' + Array.from({ length: 33 }, (_, i) => arcPoint(a, b, (i / 32) * upto)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')

/* ================= the journey: ASEAN + China map → origin → destination → route → Business Context ================= */
type Stage = 'origin' | 'originDetail' | 'destination' | 'destDetail' | 'soon' | 'flight' | 'arrived'
export function StartPage() {
  const { t } = useI18n()
  const { mode, exitDemo, chooseDirection } = useStore()
  const reduce = useReducedMotion()
  const [countries, setCountries] = useState<Country[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    setFailed(false); setCountries(null)
    loadRegion().then((d) => { if (alive) setCountries(d) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [attempt])
  useEffect(() => { if (mode === 'demo') exitDemo() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- a new journey is always real data

  const [stage, setStage] = useState<Stage>('origin')
  const [picking, setPicking] = useState<'origin' | 'destination'>('origin')
  const [origin, setOrigin] = useState<GeoCode | null>(null)
  const [dest, setDest] = useState<GeoCode | null>(null)
  const [focus, setFocus] = useState<GeoCode | null>(null)
  const [notice, setNotice] = useState('')
  const [view, setViewState] = useState<View>(HOME)
  const [flightT, setFlightT] = useState(0)
  const viewRef = useRef(view); viewRef.current = view

  // map size and the fitted regional projection (framed on ASEAN + China; neighbours are context only)
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 520 })
  // measured before the first paint, then kept in sync by ResizeObserver (with a window-resize fallback for environments that pause it)
  useLayoutEffect(() => {
    const el = box.current; if (!el) return
    const measure = () => { const n = { w: Math.max(200, el.clientWidth), h: Math.max(200, el.clientHeight) }; setSize((o) => (o.w === n.w && o.h === n.h ? o : n)) }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el); window.addEventListener('resize', measure)
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])
  const { w, h } = size
  const focusSet = useMemo(() => (countries ?? []).filter((f) => codeOfIso(f.id)), [countries])
  const proj = useMemo(() => {
    const p = geoMercator()
    if (focusSet.length) p.fitExtent([[16, 16], [w - 16, h - 16]], { type: 'FeatureCollection', features: focusSet } as FeatureCollection)
    return p
  }, [focusSet, w, h])
  const path = useMemo(() => geoPath(proj), [proj])
  const shapes = useMemo(() => (countries ?? []).map((f) => ({ f, code: codeOfIso(f.id), d: path(f) ?? '', b: path.bounds(f) as [[number, number], [number, number]] })), [countries, path])
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
    const b = boundsOf(c); return b ? viewForBox(b, w, h, c === 'CN' ? 0.85 : 0.75, c === 'ID' || c === 'PH' || c === 'MY' ? 4 : 7) : HOME
  }
  // The view is in pixels of the fitted map, so a resize (rotation, a scrollbar appearing) must re-frame whatever is in focus.
  type Target = { kind: 'home' } | { kind: 'country'; c: GeoCode } | { kind: 'pair'; a: GeoCode; b: GeoCode }
  const target = useRef<Target>({ kind: 'home' })
  const viewOf = (tg: Target): View => {
    if (tg.kind === 'country') return viewFor(tg.c)
    if (tg.kind === 'pair') { const a = boundsOf(tg.a), b = boundsOf(tg.b); return a && b ? viewForBox([[Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])], [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])]], w, h, 0.8, 4) : HOME }
    return HOME
  }
  const frame = (tg: Target, ms = 750) => { target.current = tg; return animateTo(viewOf(tg), ms) }
  useEffect(() => { cancelAnimationFrame(anim.current); setViewState(clampView(viewOf(target.current), w, h)) }, [w, h, shapes]) // eslint-disable-line react-hooks/exhaustive-deps
  const screen = (lon: number, lat: number): [number, number] | null => { const p = proj([lon, lat]); return p ? [view.x + view.k * p[0], view.y + view.k * p[1]] : null }

  // gestures: one pointer pans, two pointers pinch-zoom, a tap without movement picks a country
  const svg = useRef<SVGSVGElement>(null)
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const down = useRef<{ code?: GeoCode; moved: number }>({ moved: 0 })
  const pinch = useRef<number | null>(null)
  const pick = (c: GeoCode) => {
    if (stage === 'flight' || stage === 'arrived') return
    setNotice('')
    if (picking === 'destination' && origin) {
      const chk = checkDestination(origin, c)
      if (chk === 'same') { setNotice(t('geo.same')); return }
      setFocus(c); setStage(chk === 'soon' ? 'soon' : 'destDetail')
    } else {
      setFocus(c); setStage(GEO[c].status === 'soon' ? 'soon' : 'originDetail')
    }
    void frame({ kind: 'country', c })
  }
  const pickRef = useRef(pick); pickRef.current = pick
  const zoomAt = (f: number, cx = w / 2, cy = h / 2) => setView((v) => { const k = Math.max(1, Math.min(MAX_K, v.k * f)); const r = k / v.k; return { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r } })
  const zoomRef = useRef(zoomAt); zoomRef.current = zoomAt
  const onDown = (e: ReactPointerEvent) => {
    cancelAnimationFrame(anim.current)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const el = (e.target as Element).closest('[data-code]') as HTMLElement | null
    down.current = { code: el?.dataset.code as GeoCode | undefined, moved: 0 }
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
      if (ptrs.current.size === 0 && down.current.moved < 6 && down.current.code) pickRef.current(down.current.code)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [setView])
  useEffect(() => { // non-passive wheel so zooming the map does not scroll the page
    const el = svg.current; if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomRef.current(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top) }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }, [countries])
  const onKey = (e: ReactKeyboardEvent) => {
    const s = 40
    const m: Record<string, () => void> = {
      ArrowLeft: () => setView((v) => ({ ...v, x: v.x + s })), ArrowRight: () => setView((v) => ({ ...v, x: v.x - s })),
      ArrowUp: () => setView((v) => ({ ...v, y: v.y + s })), ArrowDown: () => setView((v) => ({ ...v, y: v.y - s })),
      '+': () => zoomAt(1.25), '=': () => zoomAt(1.25), '-': () => zoomAt(1 / 1.25),
    }
    if (m[e.key]) { e.preventDefault(); m[e.key]() }
  }

  // flow
  const name = (c: GeoCode) => t(`geo.c.${c}` as never)
  const capName = (c: GeoCode) => t(`geo.city.${capitalOf(c).name.replace(/\s/g, '')}` as never)
  const backToRegion = (p: 'origin' | 'destination') => { setFocus(null); setStage(p); setPicking(p); setNotice(''); void frame({ kind: 'home' }) }
  const confirmOrigin = () => { if (!focus) return; setOrigin(focus); backToRegion('destination') }
  const confirmDest = async () => {
    if (!focus || !origin) return
    const d = focus
    setDest(d); setFocus(null); setStage('flight'); setFlightT(0)
    await frame({ kind: 'pair', a: origin, b: d }, 700)
    if (reduce) setFlightT(1)
    else await new Promise<void>((res) => { const t0 = performance.now(); const step = (now: number) => { const p = Math.min(1, (now - t0) / 2400); setFlightT(p); if (p < 1) anim.current = requestAnimationFrame(step); else res() }; anim.current = requestAnimationFrame(step) })
    setStage('arrived')
  }
  const finish = useCallback(() => { const d = directionOf(origin, dest); if (d && !chooseDirection(d)) go('dashboard') }, [origin, dest, chooseDirection])
  useEffect(() => { if (stage !== 'arrived') return; const id = window.setTimeout(finish, reduce ? 2500 : 1500); return () => window.clearTimeout(id) }, [stage, finish, reduce])

  // what each country looks like right now
  const paint = (c: GeoCode | undefined) => {
    if (!c) return 'g-land'
    if (stage === 'flight' || stage === 'arrived') return c === origin || c === dest ? 'g-pick' : 'g-dim'
    if (focus === c) return GEO[c].status === 'active' ? 'g-pick' : 'g-soon-pick'
    if (picking === 'destination' && c === origin) return 'g-origin'
    return GEO[c].status === 'active' ? 'g-active' : 'g-soon'
  }
  const journey = stage === 'flight' || stage === 'arrived'
  // progressive disclosure: region → country → capital. Only the capital(s) of the country in focus (or of the route) are drawn — no provinces, no other cities.
  const markers: GeoCode[] = journey && origin && dest ? [origin, dest] : focus ? [focus] : []
  const nameLabels: GeoCode[] = journey && origin && dest ? [origin, dest] : focus ? [focus] : ACTIVE
  const ends = journey && origin && dest ? [screen(capitalOf(origin).lon, capitalOf(origin).lat), screen(capitalOf(dest).lon, capitalOf(dest).lat)] : null
  const stepIdx = journey ? 2 : picking === 'destination' ? 1 : 0
  const title = journey ? t('geo.journey.t') : picking === 'origin' ? t('geo.origin.q') : t('geo.dest.q')

  const panel = (() => {
    if (failed) return (
      <div className="space-y-3" role="alert"><p className="font-semibold">{t('geo.error')}</p>
        <div className="flex flex-wrap justify-center gap-2"><button className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>{t('geo.retry')}</button><button className="btn-ghost" onClick={() => go('direction')}>{t('geo.fallback')}</button></div></div>)
    if (!countries) return <p className="flex items-center gap-2 font-medium" role="status"><Icon name="globe" size={18} className="animate-pulse text-primary" />{t('geo.loading')}</p>
    switch (stage) {
      case 'origin': case 'destination': return (
        <div className="space-y-1" aria-live="polite">
          <p className="text-sm text-muted">{t('geo.pickHint')}</p>
          {notice && <p className="text-sm font-medium text-warn-fg flex items-center gap-1.5" role="alert"><Icon name="info" size={15} />{notice}</p>}
        </div>)
      case 'originDetail': case 'destDetail': {
        const c = focus!
        return (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3" aria-live="polite">
            <div className="space-y-1">
              <div className="flex items-center gap-2"><CountryBadge c={c as 'TH' | 'CN'} /><h2 className="text-2xl font-bold tracking-wide">{name(c)}</h2></div>
              <p className="text-sm font-semibold text-primary">{stage === 'originDetail' ? t('geo.originSel') : t('geo.destSel')}</p>
              <p className="text-sm flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[rgb(var(--globe-capital))]" aria-hidden />{t('geo.capital')}: <b>{capName(c)}</b></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={stage === 'originDetail' ? confirmOrigin : confirmDest} autoFocus><Go>{stage === 'originDetail' ? t('geo.confirmOrigin') : t('geo.confirmDest')}</Go></button>
              <button className="btn-ghost" onClick={() => backToRegion(stage === 'originDetail' ? 'origin' : 'destination')}>{t('geo.back')}</button>
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
            <p className="flex items-center gap-2 text-lg font-semibold"><CountryBadge c={origin as 'TH' | 'CN'} />{name(origin!)}<Icon name="next" size={18} className="text-primary" /><CountryBadge c={dest as 'TH' | 'CN'} />{name(dest!)}</p>
            <p className="text-sm text-muted">{t('geo.flying')}</p>
          </div>
          {stage === 'arrived' && <button className="btn-primary" onClick={finish} autoFocus><Go>{t('geo.continue')}</Go></button>}
        </div>)
    }
  })()

  const listable = countries && !failed && !journey
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <header className="space-y-2">
        <ol className="flex flex-wrap items-center gap-x-2 text-xs text-muted" aria-label={t('geo.stepsLabel')}>
          {[1, 2, 3, 4].map((n, i) => <li key={n} aria-current={i === stepIdx ? 'step' : undefined} className={'flex items-center gap-1.5 ' + (i === stepIdx ? 'text-ink font-semibold' : i < stepIdx ? 'text-ok-fg' : '')}>{i > 0 && <Icon name="next" size={12} className="text-muted" />}{i < stepIdx && <Icon name="ok" size={13} />}{t(`geo.progress.${n}` as never)}</li>)}
        </ol>
        <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
        {picking === 'destination' && origin && !journey && <p className="text-sm text-muted">{t('geo.originTag')}: <b className="text-ink">{name(origin)}</b></p>}
      </header>

      <div ref={box} className="relative rounded-2xl overflow-hidden border border-line map-stage h-[50vh] min-h-[300px] max-h-[600px] sm:h-[56vh]">
        {countries && (
          <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="application" aria-label={t('geo.mapLabel')} tabIndex={0} onKeyDown={onKey} onPointerDown={onDown}
            className="block select-none cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }}>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {shapes.map((s, i) => <path key={String(s.f.id ?? i)} d={s.d} data-code={s.code} className={'g-c ' + paint(s.code)}>{s.code && <title>{name(s.code)}</title>}</path>)}
            </g>
            {/* Singapore is tiny at regional scale: a larger invisible tap target on its capital */}
            {!journey && (() => { const p = screen(capitalOf('SG').lon, capitalOf('SG').lat); return p ? <circle cx={p[0]} cy={p[1]} r={10} data-code="SG" className="g-hit cursor-pointer"><title>{name('SG')}</title></circle> : null })()}
            {ends && ends[0] && ends[1] && <>
              <path d={arcD(ends[0], ends[1])} className="g-route" />
              {flightT > 0 && <path d={arcD(ends[0], ends[1], flightT)} className="g-route-done" />}
              {flightT > 0 && (() => { const p = arcPoint(ends[0], ends[1], Math.min(flightT, 0.995)); return <g transform={`translate(${p.x},${p.y}) rotate(${p.deg})`} className="pointer-events-none"><path d="M11 0 L3.5 -1.4 L-1 -8 L-3.2 -8 L-0.5 -1.4 L-5.5 -1.4 L-7.8 -4.2 L-9.2 -4.2 L-7.8 0 L-9.2 4.2 L-7.8 4.2 L-5.5 1.4 L-0.5 1.4 L-3.2 8 L-1 8 L3.5 1.4 Z" className="g-plane" /></g> })()}
            </>}
            {nameLabels.map((c) => {
              const s = shapes.find((x) => x.code === c); if (!s) return null
              const focused = markers.includes(c)
              // focused: the name sits above the country, so it never covers the capital label
              const x = view.x + view.k * ((s.b[0][0] + s.b[1][0]) / 2)
              const y = focused ? view.y + view.k * s.b[0][1] - 10 : view.y + view.k * ((s.b[0][1] + s.b[1][1]) / 2)
              return <text key={'n' + c} x={Math.min(w - 50, Math.max(50, x))} y={Math.min(h - 10, Math.max(22, y))} textAnchor="middle" className={(focused ? 'g-name' : 'g-label') + ' pointer-events-none'}>{name(c)}</text>
            })}
            {markers.map((c) => {
              const p = screen(capitalOf(c).lon, capitalOf(c).lat); if (!p) return null
              return (
                <g key={'c' + c} className="pointer-events-none">
                  <circle cx={p[0]} cy={p[1]} r={6} className="g-capital" />
                  {capName(c) !== name(c) && <text x={p[0] + 10} y={p[1] + 4} className="g-label">{capName(c)}</text>}
                </g>)
            })}
          </svg>)}
        {countries && (
          <div className="absolute top-3 right-3 flex flex-col gap-1.5">
            <button className="globe-ctl" onClick={() => zoomAt(1.3)} aria-label={t('geo.zoomIn')} title={t('geo.zoomIn')}><Icon name="plus" size={18} /></button>
            <button className="globe-ctl" onClick={() => zoomAt(1 / 1.3)} aria-label={t('geo.zoomOut')} title={t('geo.zoomOut')}><Icon name="minus" size={18} /></button>
            <button className="globe-ctl" onClick={() => void frame(target.current, 500)} aria-label={t('geo.resetView')} title={t('geo.resetView')}><Icon name="target" size={18} /></button>
          </div>)}
        {!countries && <div className="absolute inset-0 grid place-items-center p-6 text-center">{panel}</div>}
      </div>

      {countries && <section className="card !p-4">{panel}</section>}
      {listable && (
        <section aria-label={t('geo.listLabel')} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold text-muted">{t('geo.active')}:</span>
          {ACTIVE.map((c) => { const isOrigin = picking === 'destination' && c === origin; return <button key={c} className={'px-3 py-1.5 rounded-lg border min-h-[36px] transition ' + (isOrigin ? 'border-line text-muted cursor-not-allowed' : 'border-primary text-primary font-semibold hover:bg-brand')} aria-disabled={isOrigin} onClick={() => pick(c)}>{name(c)}{isOrigin ? ` (${t('geo.originTag')})` : ''}</button> })}
          <span className="text-xs font-semibold text-muted sm:ml-2">{t('geo.soon')}:</span>
          {SOON.map((c) => <button key={c} className="px-2.5 py-1 rounded-lg border border-line text-muted hover:bg-surface3 min-h-[32px] text-xs" onClick={() => pick(c)}>{name(c)}</button>)}
        </section>)}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{t('geo.attribution')}</span>
        <button className="underline" onClick={() => go('direction')}>{t('geo.fallback')}</button>
      </div>
    </div>
  )
}
const Go = ({ children }: { children: ReactNode }) => <>{children}<Icon name="next" size={16} /></>
