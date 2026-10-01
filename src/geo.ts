import type { Direction } from './types'

/** Countries in the geographic onboarding. Active = supported today; soon = planned ASEAN expansion (shown, never selectable as a route).
 *  `iso` is the ISO 3166-1 numeric code used by world-atlas (Natural Earth). Singapore is too small for the 1:110m map, so it is a point. */
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

/** Camera: rotation [lambda, phi] (d3 orthographic convention: rotate by minus the centre) and zoom factor on top of the fitted globe. */
export interface Camera { rotate: [number, number]; k: number }
export const WORLD_VIEW: Camera = { rotate: [-20, -15], k: 1 }
/** ASEAN + China: centred near 106°E 24°N. */
export const REGION_VIEW: Camera = { rotate: [-106, -24], k: 1.9 }
export const clampK = (k: number) => Math.max(0.85, Math.min(14, k))
export const clampPhi = (p: number) => Math.max(-80, Math.min(80, p))
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** Interpolate cameras along the shortest way round the globe. */
export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  const e = ease(Math.max(0, Math.min(1, t)))
  let dl = b.rotate[0] - a.rotate[0]
  dl = ((dl + 540) % 360) - 180
  return { rotate: [a.rotate[0] + dl * e, a.rotate[1] + (b.rotate[1] - a.rotate[1]) * e], k: a.k * Math.pow(b.k / a.k, e) }
}
