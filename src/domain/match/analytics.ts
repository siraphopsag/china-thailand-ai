// Admin analytics (owner, Oct 2026): daily totals from the database (admin_daily, 0006) — visits (counted once per browser per
// day, nothing that identifies anyone), sign-ups, posts, applications, cases and reports — compared with the period before,
// plus cases by stage and a daily-activity grid. Only totals; no row is about one person. Pure: no React, no storage.
import { currentStep, type Case } from './cases'

export const METRICS = ['visits', 'signups', 'posts', 'applications', 'cases', 'reports'] as const
export type Metric = (typeof METRICS)[number]
export type DayRow = { day: string } & Record<Metric, number>
export const RANGES = [7, 30, 90] as const
export type Range = (typeof RANGES)[number]

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0 }
/** rows from the database, oldest first; bad rows are dropped */
export function parseDaily(rows: unknown): DayRow[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((r) => {
    if (typeof r !== 'object' || r === null) return []
    const o = r as Record<string, unknown>
    const day = typeof o.day === 'string' ? o.day.slice(0, 10) : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return []
    return [{ day, ...Object.fromEntries(METRICS.map((m) => [m, num(o[m])])) } as DayRow]
  }).sort((a, b) => a.day.localeCompare(b.day))
}
/** the last `days` rows and the `days` before them */
export function periods(rows: DayRow[], days: number): { cur: DayRow[]; prev: DayRow[] } {
  return { cur: rows.slice(-days), prev: rows.slice(-2 * days, -days) }
}
export const total = (rows: DayRow[], m: Metric) => rows.reduce((n, r) => n + r[m], 0)
/** change against the period before, in percent (null when there was nothing before) */
export function change(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null
  return Math.round(((cur - prev) / prev) * 1000) / 10
}
/** a rounded top for the y axis, so the grid lines land on round numbers */
export function niceMax(n: number): number {
  if (n <= 4) return 4
  const p = 10 ** Math.floor(Math.log10(n)), f = n / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p
}
/** daily activity (all actions together) for the last `weeks` weeks, one column per week, rows = weekdays from `weekStart` */
export function heatWeeks(rows: DayRow[], weeks: number, weekStart: 0 | 1, today: string): { day: string; n: number }[][] {
  const by = new Map(rows.map((r) => [r.day, r.signups + r.posts + r.applications + r.cases]))
  const [y, m, d] = today.split('-').map(Number)
  const end = new Date(y, m - 1, d)
  const back = (end.getDay() - weekStart + 7) % 7 // days since the start of this week
  const first = new Date(y, m - 1, d - back - (weeks - 1) * 7)
  const ymd = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => {
    const x = new Date(first.getFullYear(), first.getMonth(), first.getDate() + w * 7 + i)
    const day = ymd(x)
    return { day, n: day > today ? -1 : by.get(day) ?? 0 } // -1 = not yet
  }))
}
/** 0–4: how dark a cell is, against the busiest day shown */
export const heatLevel = (n: number, max: number) => (n <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)))

/** cases grouped into five stages for the donut */
export const STAGES = ['waiting', 'agency', 'prep', 'travel', 'done'] as const
export type Stage = (typeof STAGES)[number]
export function caseStages(cases: Case[]): Record<Stage, number> {
  const out: Record<Stage, number> = { waiting: 0, agency: 0, prep: 0, travel: 0, done: 0 }
  for (const c of cases) {
    const s = currentStep(c)
    out[s === null ? 'done' : s === 'opened' || s === 'submitted' ? 'waiting' : s === 'accepted' || s === 'documents' || s === 'tests' ? 'agency' : s === 'training' || s === 'permit' ? 'prep' : 'travel']++
  }
  return out
}
/** totals as a spreadsheet (CSV, one row per day) */
export function toCsv(rows: DayRow[]): string {
  return ['day,' + METRICS.join(','), ...rows.map((r) => [r.day, ...METRICS.map((m) => r[m])].join(','))].join('\n') + '\n'
}
