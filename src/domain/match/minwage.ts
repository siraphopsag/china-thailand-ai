// Minimum wage by province (v2 model, owner Nov 2026: "rules that can be checked with certainty"). A post or a contract that pays
// less than the LOWEST legal minimum that applies anywhere in its province is certainly below the law, so this rule never accuses a
// lawful post: provinces with higher rates in some districts or sectors are compared with their lowest rate only.
// Thailand: daily rates (Wage Committee notification), turned into a monthly floor as daily rate × 30 days.
// China: the province's lowest monthly tier (provincial human resources and social security notices).
// Data: src/data/minwage.ts (sources and dates there). Pure: no React, no storage.
import { TH_MIN_DAILY, CN_MIN_MONTHLY, CN_MIN_MONTHLY_NEXT, MINWAGE_SOURCES } from '../../data/minwage'
import type { Country, Salary } from './types'

/** Thai daily rate → monthly floor for monthly-paid work */
export const TH_DAYS_PER_MONTH = 30
/** pay above this many times the local minimum for a job that asks for NO experience is "unusually high" — the usual lure of fake
 *  job ads ("no experience, 50,000 a month"). A warning only: skilled posts may pay far more and are never flagged. */
export const HIGH_PAY_FACTOR = 4

export interface MinWage { monthly: number; currency: 'THB' | 'CNY'; daily?: number; source: string }
/** the monthly legal floor for a province on a day (YYYY-MM-DD, default today), or null when the province has no record */
export function minMonthlyWage(country: Country, province: string, day = new Date().toISOString().slice(0, 10)): MinWage | null {
  if (country === 'TH') {
    const d = TH_MIN_DAILY[province]
    return d ? { monthly: d * TH_DAYS_PER_MONTH, daily: d, currency: 'THB', source: MINWAGE_SOURCES.TH } : null
  }
  const next = CN_MIN_MONTHLY_NEXT[province]
  const m = next && day >= next.from ? next.lowest : CN_MIN_MONTHLY[province]
  return m ? { monthly: m, currency: 'CNY', source: MINWAGE_SOURCES.CN } : null
}

export type WageWarning = 'belowMinWage' | 'veryHighPay'
/** a post's monthly salary range against the province's minimum; a salary in the other country's currency is not compared */
export function wageWarning(place: { country: Country; province: string }, salary: Salary | null, minYears = 0): { warning: WageWarning; min: MinWage } | null {
  if (!salary) return null
  const min = minMonthlyWage(place.country, place.province)
  if (!min || min.currency !== salary.currency) return null
  if (salary.min < min.monthly) return { warning: 'belowMinWage', min }
  if (minYears === 0 && salary.max > min.monthly * HIGH_PAY_FACTOR) return { warning: 'veryHighPay', min }
  return null
}
