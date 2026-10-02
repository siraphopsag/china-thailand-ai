import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { geoCentroid, geoMercator, geoPath } from 'd3-geo'
import { feature, merge } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import { useI18n } from '../i18n'
import { Icon } from './icons'
import { GEO, HOME, MAX_K, clampView, codeOfIso, lerpView, viewForBox, type GeoCode, type View } from '../geo'

/**
 * Reusable map of China + ASEAN with Thai and Chinese provinces (same Natural Earth data and raised-relief style as the original
 * map). Controlled: the parent decides the focused country and province; the map frames them, raises them, and draws pins.
 * Only Thailand and China can be chosen today; other ASEAN countries are shown as "coming later".
 */
const CHINA_PARTS = new Set(['156', '344', '446'])
type CountryF = Feature<Geometry, { name?: string }>
type ProvinceF = Feature<Geometry, { iso_3166_2?: string; adm0_a3?: string }>
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

export interface MapPin { country: 'TH' | 'CN'; province: string; label: string; tone?: 'mine' | 'post' }
export function GeoMap({ country, province, pins = [], onPickCountry, onPickProvince, label }: {
  country: 'TH' | 'CN' | null; province: string | null; pins?: MapPin[]; onPickCountry: (c: 'TH' | 'CN') => void; onPickProvince: (code: string | null) => void; label: string
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

  const [view, setView] = useState<View>(HOME)
  const viewRef = useRef(view); viewRef.current = view
  const anim = useRef(0)
  const target = useMemo<View>(() => {
    if (province) { const p = provs.find((x) => x.code === province); if (p) { const b = path.bounds(p.f) as [[number, number], [number, number]]; const pad = Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]) * 1.6; return viewForBox([[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]], w, h, 0.9, 10) } }
    if (country) { const s = shapes.find((x) => x.code === country); if (s) return viewForBox(s.b, w, h, country === 'CN' ? 0.8 : 0.72, 7) }
    return HOME
  }, [country, province, provs, shapes, path, w, h])
  useEffect(() => {
    cancelAnimationFrame(anim.current)
    const from = viewRef.current, t0 = performance.now()
    const step = (n: number) => { const p = Math.min(1, (n - t0) / 700); setView(lerpView(from, target, p)); if (p < 1) anim.current = requestAnimationFrame(step) }
    anim.current = requestAnimationFrame(step); return () => cancelAnimationFrame(anim.current)
  }, [target])
  const countryLift = useTween(country && !province ? 12 : 0, 420)
  const provLift = useTween(province ? 9 : 0, 380)

  // gestures: drag pans, wheel/buttons zoom, a tap picks a province (inside the focused country) or a country
  const svg = useRef<SVGSVGElement>(null)
  const down = useRef<{ x: number; y: number; moved: number; code?: string; prov?: string } | null>(null)
  const zoomAt = (f: number, cx = w / 2, cy = h / 2) => setView((v) => { const k = Math.max(1, Math.min(MAX_K, v.k * f)); const r = k / v.k; return clampView({ k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r }, w, h) })
  const onDown = (e: ReactPointerEvent) => {
    cancelAnimationFrame(anim.current)
    const el = e.target as Element
    down.current = { x: e.clientX, y: e.clientY, moved: 0, code: (el.closest('[data-code]') as HTMLElement | null)?.dataset.code, prov: (el.closest('[data-prov]') as HTMLElement | null)?.dataset.prov }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = down.current; if (!d) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy)
    setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }, w, h))
  }
  const onUp = () => {
    const d = down.current; down.current = null
    if (!d || d.moved > 6) return
    if (d.prov && country && d.prov.startsWith(country + '-')) onPickProvince(d.prov === province ? null : d.prov)
    else if (d.code === 'TH' || d.code === 'CN') onPickCountry(d.code)
  }
  useEffect(() => {
    const el = svg.current; if (!el) return
    const wheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top) }
    el.addEventListener('wheel', wheel, { passive: false }); return () => el.removeEventListener('wheel', wheel)
  }) // re-bound each render so zoomAt sees the current size

  const paint = (c: GeoCode | undefined) => (!c ? 'g-dim' : c === country ? 'g-footprint' : GEO[c].status === 'active' ? 'g-active' : 'g-soon')
  const focusShape = country ? shapes.find((s) => s.code === country) : undefined
  const provShape = province ? provs.find((p) => p.code === province) : undefined
  const Lc = countryLift / view.k
  const screen = (lon: number, lat: number, lift = 0): [number, number] | null => { const p = proj([lon, lat]); return p ? [view.x + view.k * p[0], view.y + view.k * p[1] - lift] : null }
  const name = (c: string) => t(`geo.c.${c}` as never)
  return (
    <div ref={box} className="relative rounded-2xl overflow-hidden border border-line map-ocean h-[46vh] min-h-[280px] max-h-[520px]">
      {failed && <p className="absolute inset-0 grid place-items-center p-6 text-center" role="alert">{t('geo.error')}</p>}
      {!data && !failed && <p className="absolute inset-0 grid place-items-center" role="status"><span className="flex items-center gap-2"><Icon name="globe" size={18} className="animate-pulse text-primary" />{t('geo.loading')}</span></p>}
      {data && (
        <div className="map-tilt map-stage">
          <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { down.current = null }}
            className="block select-none cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }}>
            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
              {shapes.map((s, i) => <path key={i} d={s.d} data-code={s.code} className={'g-c ' + paint(s.code)}>{s.code && <title>{name(s.code)}</title>}</path>)}
              {focusShape && <Raised d={focusShape.d} lift={countryLift} k={view.k} side="g-side" top="g-top" />}
              {country && <g transform={`translate(0,${-Lc})`}>{provs.filter((p) => p.country === country).map((p) => <path key={p.code} d={p.d} data-prov={p.code} className={'g-prov' + (p.code === province ? ' is-sel' : '')}><title>{t(`prov.${p.code}` as never)}</title></path>)}</g>}
              {provShape && <Raised d={provShape.d} lift={provLift} k={view.k} side="g-pside" top="g-ptop" />}
            </g>
            {!country && (['TH', 'CN'] as const).map((c) => { const s = shapes.find((x) => x.code === c); if (!s) return null; const x = view.x + view.k * ((s.b[0][0] + s.b[1][0]) / 2), y = view.y + view.k * ((s.b[0][1] + s.b[1][1]) / 2); return <text key={c} x={x} y={y} textAnchor="middle" className="g-label pointer-events-none">{name(c)}</text> })}
            {provShape && (() => { const xy = screen(provShape.c[0], provShape.c[1], provLift + countryLift); return xy ? <text x={xy[0]} y={xy[1] - 14} textAnchor="middle" className="g-name pointer-events-none">{t(`prov.${provShape.code}` as never)}</text> : null })()}
            {pins.map((pn, i) => {
              const p = provs.find((x) => x.code === pn.province); if (!p) return null
              const xy = screen(p.c[0], p.c[1], (pn.province === province ? provLift : 0) + (pn.country === country ? countryLift : 0)); if (!xy) return null
              return <g key={i} transform={`translate(${xy[0]},${xy[1]})`} className="pointer-events-none"><title>{pn.label}</title>
                <path d="M0 0 C-7 -9 -9 -13 -9 -17 A9 9 0 1 1 9 -17 C9 -13 7 -9 0 0 Z" className={pn.tone === 'post' ? 'g-pin-post' : 'g-pin'} /><circle cx={0} cy={-17} r={3.2} className="g-pin-dot" /></g>
            })}
          </svg>
        </div>)}
      {data && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" className="globe-ctl" onClick={() => zoomAt(1.3)} aria-label={t('geo.zoomIn')} title={t('geo.zoomIn')}><Icon name="plus" size={18} /></button>
          <button type="button" className="globe-ctl" onClick={() => zoomAt(1 / 1.3)} aria-label={t('geo.zoomOut')} title={t('geo.zoomOut')}><Icon name="minus" size={18} /></button>
        </div>)}
    </div>
  )
}
