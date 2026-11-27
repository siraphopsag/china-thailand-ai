// What each side tells the other about itself (owner's blueprint, 27 Nov 2026): the employer describes the shop or company; the job
// seeker lists past work and what they can show. Short fixed fields and short text only, no contact details (contact.ts rules, as
// everywhere), so nobody is pulled out of the platform. Pure: no React, no storage.
import { textProblem } from './match/logic'
import { INDUSTRIES, type Country, type Industry } from './match/types'

export const SIZES = ['1-9', '10-49', '50-249', '250+'] as const
export type Size = (typeof SIZES)[number]
export interface Business { about: string; industry: Industry | ''; size: Size | ''; since: number | null }
export interface Job { role: string; country: Country; years: number; industry: Industry | '' }
export interface Work { jobs: Job[]; showcase: string }
export const MAX_JOBS = 5
export const MAX_ABOUT = 400, MAX_SHOWCASE = 300, MAX_ROLE = 60

export const emptyBusiness = (): Business => ({ about: '', industry: '', size: '', since: null })
export const emptyWork = (): Work => ({ jobs: [], showcase: '' })
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const ind = (v: unknown): Industry | '' => ((INDUSTRIES as readonly string[]).includes(v as string) ? (v as Industry) : '')
const thisYear = () => new Date().getFullYear()

/** keeps only well-formed parts (what this device stored, or what the database returned) */
export function cleanBusiness(v: unknown): Business {
  if (!isObj(v)) return emptyBusiness()
  const since = typeof v.since === 'number' && Number.isInteger(v.since) && v.since >= 1900 && v.since <= thisYear() ? v.since : null
  return { about: str(v.about, MAX_ABOUT), industry: ind(v.industry), size: (SIZES as readonly string[]).includes(v.size as string) ? (v.size as Size) : '', since }
}
export function cleanWork(v: unknown): Work {
  if (!isObj(v)) return emptyWork()
  const jobs = (Array.isArray(v.jobs) ? v.jobs : []).filter(isObj).map((j) => ({
    role: str(j.role, MAX_ROLE), country: (j.country === 'CN' ? 'CN' : 'TH') as Country,
    years: typeof j.years === 'number' && j.years >= 0 && j.years <= 50 ? Math.round(j.years * 2) / 2 : 0, industry: ind(j.industry),
  })).filter((j) => j.role).slice(0, MAX_JOBS)
  return { jobs, showcase: str(v.showcase, MAX_SHOWCASE) }
}
export const hasBusiness = (b: Business) => !!(b.about || b.industry || b.size || b.since)
export const hasWork = (w: Work) => w.jobs.length > 0 || !!w.showcase

/** a reason the text cannot be saved (contact details or too long), or null */
export function businessProblem(b: Business): 'contact' | 'length' | null {
  if (b.about && textProblem(b.about, 0, MAX_ABOUT) === 'contact') return 'contact'
  return b.about.length > MAX_ABOUT ? 'length' : null
}
export function workProblem(w: Work): 'contact' | 'length' | 'jobs' | null {
  if (w.jobs.length > MAX_JOBS) return 'jobs'
  for (const x of [w.showcase, ...w.jobs.map((j) => j.role)]) if (x && textProblem(x, 0, MAX_ABOUT) === 'contact') return 'contact'
  return w.showcase.length > MAX_SHOWCASE || w.jobs.some((j) => j.role.length > MAX_ROLE) ? 'length' : null
}
/** the total years of experience listed */
export const totalYears = (w: Work) => w.jobs.reduce((s, j) => s + j.years, 0)
