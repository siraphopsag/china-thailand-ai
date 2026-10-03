/**
 * C.A.L.L. matching prototype (owner's model, Oct 2026): job seekers pin up to 5 provinces with their skills; employers post what
 * they need for a province; posts reach seekers in steps (same area + same field → same area → whole country); a seeker accepts;
 * the admin forwards the case to the employment authority (simulated — nothing is sent anywhere).
 * Everything here is synthetic prototype data kept in this browser. No identity documents or contact details are collected.
 */
import { INDUSTRIES, LANGS, LANG_LEVELS, SKILLS, type Industry, type LanguageSkill, type Skill } from '../jobboard/types'

export { INDUSTRIES, LANGS, LANG_LEVELS, SKILLS, type Industry, type LanguageSkill, type Skill }
/* employer post details added Oct 2026 (owner: "the form feels too short") */
export const EMPLOYMENT = ['permanent', 'contract', 'temporary', 'internship'] as const
export type Employment = (typeof EMPLOYMENT)[number]
/** minimum education; 'none' = not required */
/** minimum education, low → high. Thai ปวช./ปวส. line up with Chinese 中专/大专. 'secondary' = upper secondary and 'vocational' = vocational certificate
 *  (both keys kept from the first version so saved posts still load). */
export const EDU = ['none', 'lower_secondary', 'secondary', 'vocational', 'high_vocational', 'bachelor', 'master', 'doctorate'] as const
export type Edu = (typeof EDU)[number]
export const BENEFITS = ['housing', 'meals', 'insurance', 'workDocs'] as const
export type Benefit = (typeof BENEFITS)[number]
export const CURRENCIES = ['THB', 'CNY'] as const
export type Currency = (typeof CURRENCIES)[number]
/** monthly salary range (optional) */
export interface Salary { min: number; max: number; currency: Currency }
/** free posts per rolling 7 days, and with the membership package (price to be announced; free in the prototype) */
export const FREE_POSTS_PER_WEEK = 3
export const MEMBER_POSTS_PER_WEEK = 10
export type Country = 'TH' | 'CN'
export const COUNTRIES: Country[] = ['TH', 'CN']
export type Role = 'seeker' | 'employer'

export interface Place { country: Country; province: string }
/** a pinned destination: "I want this kind of work here" */
export interface Pin extends Place { id: string; industry: Industry; skills: Skill[]; at: string }
export const MAX_PINS = 5

export interface Seeker {
  id: string
  /** shown to the admin; for sample seekers an invented first name, for "you" a fixed label */
  name: string
  origin: Place | null
  pins: Pin[]
  synthetic: true
}
export interface Post extends Place {
  id: string
  employerId: string
  company: string
  position: string
  industry: Industry
  skills: Skill[]
  minYears: number
  details: string
  /* added Oct 2026 — null / empty on posts saved before then ("not stated") */
  headcount: number | null
  employment: Employment | null
  salary: Salary | null
  /** YYYY-MM-DD */
  startDate: string | null
  languages: LanguageSkill[]
  education: Edu
  benefits: Benefit[]
  createdAt: string
  synthetic: true
}
/** a seeker took a post; the admin then forwards it to the employment authority (simulated) */
export interface Acceptance { id: string; postId: string; seekerId: string; at: string; status: 'accepted' | 'forwarded'; forwardedAt?: string }

export interface MatchState {
  version: 1
  role: Role | null
  /** demo clock: days added to the real time, so the step-by-step release can be shown without waiting */
  dayOffset: number
  me: Seeker
  myCompany: string
  /** employer membership package (simulated, no payment): 10 posts per rolling 7 days instead of 3 */
  member: boolean
  seekers: Seeker[]
  posts: Post[]
  acceptances: Acceptance[]
}

/** step of the release: 1 = pinned area + same field, 2 = pinned area (any field), 3 = whole destination country */
export type Tier = 1 | 2 | 3
export const ME = 'me'
export const MY_EMPLOYER = 'employer:me'
