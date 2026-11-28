// More about the job (owner, 28 Nov 2026: "add more job details without making the form harder"): working hours and days off,
// housing and meals, the contract and probation, the place and getting there. All optional; each part is its own folding group in
// the form, and the post page shows only what the employer filled in. Saved as one small object (SQL 0024: posts.extras jsonb);
// anything unknown or out of range is dropped, so an old or edited value can never break a post.
import { textProblem } from './logic'

export const HOUSING = ['free', 'paid'] as const
export type Housing = (typeof HOUSING)[number]
export const PAY_CYCLES = ['monthly', 'twice', 'weekly', 'daily'] as const
export type PayCycle = (typeof PAY_CYCLES)[number]

export interface PostExtras {
  /** working hours, 24-hour HH:MM (a night shift may end the next day: to < from) */
  hours?: { from: string; to: string }
  /** working days a week, 1–7 */
  days?: number
  /** overtime: none, or paid when there is some */
  ot?: 'none' | 'paid'
  /** with the "housing" benefit: free, or paid by the worker (deducted) */
  housing?: Housing
  /** people sharing a room, 1–12 */
  room?: number
  /** with the "meals" benefit: meals a working day, 1–3 */
  meals?: number
  /** contract length in months, 1–60; 0 = no fixed end */
  contract?: number
  /** probation in months, 0–6 */
  probation?: number
  /** how often the pay comes */
  pay?: PayCycle
  /** the district, town or industrial estate (no address, no contact details), up to 80 characters */
  area?: string
  /** the employer's bus or van to work */
  shuttle?: boolean
  /** near a train, metro or bus station */
  transit?: boolean
}
export const AREA_MAX = 80
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const int = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : undefined)
const oneOf = <T extends string>(all: readonly T[], v: unknown) => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : undefined)

/** only the known, valid parts (the rest is dropped) */
export function cleanExtras(v: unknown): PostExtras {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const x = v as Record<string, unknown>, out: PostExtras = {}
  const h = x.hours as { from?: unknown; to?: unknown } | undefined
  if (h && typeof h === 'object' && typeof h.from === 'string' && typeof h.to === 'string' && HHMM.test(h.from) && HHMM.test(h.to) && h.from !== h.to) out.hours = { from: h.from, to: h.to }
  const days = int(x.days, 1, 7); if (days !== undefined) out.days = days
  const ot = oneOf(['none', 'paid'] as const, x.ot); if (ot) out.ot = ot
  const housing = oneOf(HOUSING, x.housing); if (housing) out.housing = housing
  const room = int(x.room, 1, 12); if (room !== undefined) out.room = room
  const meals = int(x.meals, 1, 3); if (meals !== undefined) out.meals = meals
  const contract = int(x.contract, 0, 60); if (contract !== undefined) out.contract = contract
  const probation = int(x.probation, 0, 6); if (probation !== undefined) out.probation = probation
  const pay = oneOf(PAY_CYCLES, x.pay); if (pay) out.pay = pay
  if (typeof x.area === 'string' && x.area.trim() && textProblem(x.area.trim(), 1, AREA_MAX) === null) out.area = x.area.trim()
  if (x.shuttle === true) out.shuttle = true
  if (x.transit === true) out.transit = true
  return out
}
export const hasExtras = (e: PostExtras | undefined) => !!e && Object.keys(e).length > 0
/** the area typed by the employer is refused when it looks like contact details or is too long */
export const areaProblem = (area: string | undefined) => (area?.trim() ? textProblem(area.trim(), 1, AREA_MAX) : null)
/** hours a day from the working hours (a night shift crosses midnight) */
export function hoursADay(h: { from: string; to: string }): number {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3))
  const d = (m(h.to) - m(h.from) + 1440) % 1440
  return Math.round((d / 60) * 10) / 10
}
