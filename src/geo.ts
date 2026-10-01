import type { Direction } from './types'

/** Countries on the ASEAN + China map. Active = supported today; soon = planned ASEAN expansion (visible and selectable, never a route).
 *  `iso` is the ISO 3166-1 numeric code used by Natural Earth / world-atlas. */
export type GeoCode = 'TH' | 'CN' | 'VN' | 'MM' | 'LA' | 'SG' | 'KH' | 'MY' | 'ID' | 'PH' | 'BN'
export type GeoStatus = 'active' | 'soon'
export const GEO: Record<GeoCode, { iso: string; status: GeoStatus }> = {
  TH: { iso: '764', status: 'active' }, CN: { iso: '156', status: 'active' },
  VN: { iso: '704', status: 'soon' }, MM: { iso: '104', status: 'soon' }, LA: { iso: '418', status: 'soon' }, SG: { iso: '702', status: 'soon' },
  KH: { iso: '116', status: 'soon' }, MY: { iso: '458', status: 'soon' }, ID: { iso: '360', status: 'soon' }, PH: { iso: '608', status: 'soon' }, BN: { iso: '096', status: 'soon' },
}
export const ACTIVE: GeoCode[] = ['TH', 'CN']
export const SOON: GeoCode[] = ['VN', 'MM', 'LA', 'SG', 'KH', 'MY', 'ID', 'PH', 'BN']
const BY_ISO = Object.fromEntries(Object.entries(GEO).map(([c, v]) => [v.iso, c])) as Record<string, GeoCode>
export const codeOfIso = (iso: string | number | undefined): GeoCode | undefined => (iso === undefined ? undefined : BY_ISO[String(iso).padStart(3, '0')])

/** The two supported routes map onto the existing Business Context direction. Anything else is not a route (yet). */
export function directionOf(origin: GeoCode | null, dest: GeoCode | null): Direction | null {
  if (origin === 'TH' && dest === 'CN') return 'TH_CN'
  if (origin === 'CN' && dest === 'TH') return 'CN_TH'
  return null
}
export type DestCheck = 'ok' | 'same' | 'soon'
export function checkDestination(origin: GeoCode, dest: GeoCode): DestCheck {
  if (dest === origin) return 'same'
  return GEO[dest].status === 'active' ? 'ok' : 'soon'
}

/** 2D map view: zoom k and translation (x, y) applied on top of the fitted regional projection. */
export interface View { k: number; x: number; y: number }
export const HOME: View = { k: 1, x: 0, y: 0 }
export const MAX_K = 12
/** Keep the region on screen: never smaller than the fitted view, never panned away from it. */
export function clampView(v: View, w: number, h: number): View {
  const k = Math.max(1, Math.min(MAX_K, v.k))
  const m = 0.25
  return { k, x: Math.min(w * m, Math.max(w * (1 - k) - w * m, v.x)), y: Math.min(h * m, Math.max(h * (1 - k) - h * m, v.y)) }
}
/** View that frames a box [[x0,y0],[x1,y1]] (in fitted-map coordinates) with the given fill. */
export function viewForBox(b: [[number, number], [number, number]], w: number, h: number, fill = 0.7, maxK = 8): View {
  const bw = Math.max(1, b[1][0] - b[0][0]), bh = Math.max(1, b[1][1] - b[0][1])
  const k = Math.max(1, Math.min(maxK, fill * Math.min(w / bw, h / bh)))
  const cx = (b[0][0] + b[1][0]) / 2, cy = (b[0][1] + b[1][1]) / 2
  return clampView({ k, x: w / 2 - k * cx, y: h / 2 - k * cy }, w, h)
}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export function lerpView(a: View, b: View, t: number): View {
  const e = ease(Math.max(0, Math.min(1, t)))
  return { k: a.k * Math.pow(b.k / a.k, e), x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
}
/** A gentle arc between two screen points (quadratic Bézier bulging to the left of the direction of travel). */
export function arcPoint(a: [number, number], b: [number, number], t: number, bend = 0.22): { x: number; y: number; deg: number } {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1]
  const c: [number, number] = [mx + dy * bend, my - dx * bend]
  const u = 1 - t
  const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]
  const tx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), ty = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1])
  return { x, y, deg: (Math.atan2(ty, tx) * 180) / Math.PI }
}
