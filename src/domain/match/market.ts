// The job market at a glance (owner, Oct 2026): the board's map view shows not only where people want to work but the state of
// the market — demand (employers' posts) and supply (job seekers' pins) per place and per field. Counts only: nobody can be
// identified. Pure: no React, no storage.
import type { Country, Industry, Post } from './types'
import { DAY_MS } from './release'

/** active pins, grouped (the database sends anonymous groups with a count; the local demo has one pin per group) */
export interface PinGroup { country: Country; province: string; industry: Industry; at: string; n: number }
export type Scope = 'all' | Country
export interface PlaceRow { country: Country; province: string; pins: number; employers: number; posts: number }
export interface FieldRow { industry: Industry; n: number }
export interface TrendRow { industry: Industry; n: number; last7: number; prev7: number }
export interface BalanceRow { industry: Industry; wanted: number; seeking: number; state: 'people' | 'jobs' | 'even' }
export interface Market {
  totals: { posts: number; places: number; employers: number; pins: number }
  top: PlaceRow[]
  /** fields job seekers pin most (with the last 7 days against the 7 before) */
  rising: TrendRow[]
  /** fields employers want most (people wanted) */
  wanted: FieldRow[]
  /** per field: people wanted against people looking */
  balance: BalanceRow[]
}

const top = <T,>(rows: T[], n: number, by: (r: T) => number, tie: (r: T) => string) => [...rows].sort((a, b) => by(b) - by(a) || tie(a).localeCompare(tie(b))).slice(0, n)
const places = (p: Post) => p.headcount ?? 1
/** short of people when more than half again as many are wanted as are looking, short of jobs the other way round */
export const balanceOf = (wanted: number, seeking: number): BalanceRow['state'] => (wanted > seeking * 1.5 ? 'people' : seeking > wanted * 1.5 ? 'jobs' : 'even')

/**
 * @param posts the live posts (not expired, not hidden) · @param pins active pin groups · @param scope both countries or one ·
 * @param province one province only (a tap on the map), or null · @param now for the 7-day trend
 */
export function marketOf(posts: Post[], pins: PinGroup[], scope: Scope, province: string | null, now: number, n = 5): Market {
  const inScope = (c: Country, p: string) => (scope === 'all' || c === scope) && (!province || p === province)
  const ps = posts.filter((p) => inScope(p.country, p.province))
  const gs = pins.filter((g) => inScope(g.country, g.province) && g.n > 0)
  const pinCount = gs.reduce((s, g) => s + g.n, 0)

  // places: pins and employers per province, ranked by how much happens there (pins + employers)
  const byPlace = new Map<string, PlaceRow & { emp: Set<string> }>()
  const at = (c: Country, p: string) => { const k = `${c}|${p}`; let r = byPlace.get(k); if (!r) { r = { country: c, province: p, pins: 0, employers: 0, posts: 0, emp: new Set() }; byPlace.set(k, r) } return r }
  for (const g of gs) at(g.country, g.province).pins += g.n
  for (const p of ps) { const r = at(p.country, p.province); r.posts++; r.emp.add(p.employerId) }
  const placeRows = [...byPlace.values()].map(({ emp, ...r }) => ({ ...r, employers: emp.size }))

  // fields
  const fields = new Map<Industry, { pins: number; last7: number; prev7: number; wanted: number }>()
  const f = (i: Industry) => { let r = fields.get(i); if (!r) { r = { pins: 0, last7: 0, prev7: 0, wanted: 0 }; fields.set(i, r) } return r }
  for (const g of gs) {
    const r = f(g.industry), age = now - Date.parse(g.at)
    r.pins += g.n
    if (age >= 0 && age < 7 * DAY_MS) r.last7 += g.n
    else if (age >= 7 * DAY_MS && age < 14 * DAY_MS) r.prev7 += g.n
  }
  for (const p of ps) f(p.industry).wanted += places(p)
  const fieldRows = [...fields.entries()].map(([industry, r]) => ({ industry, ...r }))

  return {
    totals: { posts: ps.length, places: ps.reduce((s, p) => s + places(p), 0), employers: new Set(ps.map((p) => p.employerId)).size, pins: pinCount },
    top: top(placeRows, n, (r) => r.pins + r.employers, (r) => r.province),
    rising: top(fieldRows.filter((r) => r.pins > 0), n, (r) => r.pins, (r) => r.industry).map((r) => ({ industry: r.industry, n: r.pins, last7: r.last7, prev7: r.prev7 })),
    wanted: top(fieldRows.filter((r) => r.wanted > 0), n, (r) => r.wanted, (r) => r.industry).map((r) => ({ industry: r.industry, n: r.wanted })),
    balance: top(fieldRows.filter((r) => r.wanted + r.pins > 0), n, (r) => r.wanted + r.pins, (r) => r.industry)
      .map((r) => ({ industry: r.industry, wanted: r.wanted, seeking: r.pins, state: balanceOf(r.wanted, r.pins) })),
  }
}
