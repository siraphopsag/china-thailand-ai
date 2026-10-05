/**
 * C.A.L.L. matching prototype (owner's model, Oct 2026): job seekers pin provinces with their skills (5 per weekly cycle, each pin
 * lasts a month); employers post what they need for a province (3 per weekly cycle, a post lasts 6 months); a post reaches seekers in
 * five levels (see release.ts); a seeker applies (or reserves a place once the post is full); the employer confirms or declines;
 * a confirmed match opens a case that goes to the employment agency and is followed step by step until the worker starts (cases.ts;
 * the agency's part is simulated — nothing is sent anywhere).
 * Everything here is synthetic prototype data kept in this browser. No identity documents or contact details are collected.
 */
import type { Case } from './cases'
/* fields, skills and languages (came with the first job-board prototype, which was removed in Oct 2026) */
export const SKILLS = [
  'software_engineering', 'data_analysis', 'mechanical_engineering', 'electrical_engineering', 'civil_engineering', 'quality_control',
  'project_management', 'accounting_finance', 'marketing', 'hospitality_management', 'culinary_arts', 'thai_chinese_translation',
] as const
export type Skill = (typeof SKILLS)[number]
export const INDUSTRIES = ['manufacturing', 'technology', 'hospitality', 'food_service', 'education', 'logistics', 'finance'] as const
export type Industry = (typeof INDUSTRIES)[number]
export const LANGS = ['th', 'zh', 'en'] as const
export const LANG_LEVELS = ['basic', 'conversational', 'professional', 'native'] as const
export interface LanguageSkill { lang: (typeof LANGS)[number]; level: (typeof LANG_LEVELS)[number] }
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
/** posts (new or renewed) per weekly cycle, and with the membership package (price to be announced; free in the prototype).
 *  A cycle starts with its first use and lasts 7 days; then the full allowance comes back (owner, Oct 2026). */
export const FREE_POSTS_PER_WEEK = 3
export const MEMBER_POSTS_PER_WEEK = 10
export const PINS_PER_WEEK = 5
export const MEMBER_PINS_PER_WEEK = 10
/** membership plans (owner, Oct 2026): planned prices in baht, shown struck through — free during the trial, no payment */
export const PLANS = [{ id: 'm1', months: 1, price: 59 }, { id: 'm6', months: 6, price: 349 }, { id: 'y1', months: 12, price: 599 }] as const
export type PlanId = (typeof PLANS)[number]['id']
/** a membership ending within this many days is announced at the bell */
export const MEMBER_WARN_DAYS = 7
export const CYCLE_DAYS = 7
/** a pin lasts a month; a post lasts 6 months from its (re)release, with a warning one week before it is removed */
export const PIN_LIFE_DAYS = 30
export const POST_LIFE_DAYS = 182
export const EXPIRY_WARN_DAYS = 7
/** release: level 1 opens to hourly groups for up to 24 rounds, then waits 24 h; levels 2 and 3 last 24 h each; level 4 (whole
 *  country) runs until a month after the release; level 5 (international) until the post expires */
export const ROUNDS = 24
export const STEP_HOURS = 24
export const NATIONWIDE_UNTIL_DAYS = 30
export type Country = 'TH' | 'CN'
export const COUNTRIES: Country[] = ['TH', 'CN']
export type Role = 'seeker' | 'employer'

export interface Place { country: Country; province: string }
/** a pinned destination: "I want this kind of work here" */
export interface Pin extends Place { id: string; industry: Industry; skills: Skill[]; at: string }

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
  /** start of the current release (the posting time, or the last renewal) — the levels and the 6-month life count from here */
  releasedAt: string
  /** the employer's company registration was approved (owner, Oct 2026): unverified posts stop at level 2 and carry a warning */
  verified: boolean
  synthetic: true
}
/**
 * An application. 'accepted' = holds a place and waits for the employer; 'reserved' = the post was full, so it waits in the queue
 * (the earliest reservation moves up when a place frees); 'confirmed' / 'rejected' = the employer decided; 'forwarded' = the admin
 * sent the confirmed case on (simulated).
 */
export type AppStatus = 'accepted' | 'reserved' | 'confirmed' | 'rejected' | 'forwarded'
export const HOLDS_PLACE: readonly AppStatus[] = ['accepted', 'confirmed', 'forwarded']
export interface Acceptance {
  id: string; postId: string; seekerId: string; at: string; status: AppStatus
  /** a short introduction (no contact details) and the first day the seeker can start */
  intro: string; availableFrom: string | null
  /** moved up from the reservation queue / decided by the employer / forwarded by the admin */
  promotedAt?: string; decidedAt?: string; forwardedAt?: string
  /** from the database: the name the employer sees */
  seekerName?: string
}
/** one use of a weekly allowance: a new post or a renewal (they share one allowance), or a pin */
export interface Credit { kind: 'post' | 'renew' | 'pin'; at: string }

export interface MatchState {
  version: 2
  role: Role | null
  /** demo clock: hours added to the real time, so the release levels can be shown without waiting */
  clockHours: number
  me: Seeker
  myCompany: string
  /** membership (simulated, no payment): employers post 10 per cycle instead of 3, job seekers pin 10 instead of 5 */
  member: boolean
  /** when the membership ends (null = no end date, from before the plans existed) */
  memberUntil: string | null
  seekers: Seeker[]
  posts: Post[]
  acceptances: Acceptance[]
  /** my uses of the weekly allowances (deleting a post or a pin does not give the use back) */
  credits: Credit[]
  /** cases after a match (see cases.ts) */
  cases: Case[]
  /** my employer verification (company registration number) */
  employerVerify: EmployerVerify | null
}
/** employer verification: the number is checked at once; an administrator (the agency in the prototype) approves it */
export interface EmployerVerify { country: Country; regNo: string; status: 'pending' | 'verified' | 'rejected'; at: string; decidedAt?: string }

/**
 * Release level (owner, Oct 2026), also the "rarity" shown on the board:
 * 1 = same province + same field (hourly groups, earliest pins first) · 2 = same field, another province · 3 = same province, another
 * field · 4 = anyone pinned in that country · 5 = international (everyone)
 */
export type Level = 1 | 2 | 3 | 4 | 5
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5]
/** the most a demo clock may run ahead: past the 6-month life of a post */
export const MAX_CLOCK_HOURS = 24 * 200
export const ME = 'me'
export const MY_EMPLOYER = 'employer:me'
