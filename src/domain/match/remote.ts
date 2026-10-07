// Mapping between the database rows (supabase/migrations/0002_matching.sql, 0003_board.sql) and the matching prototype's own types, so the pages
// and rules in logic.ts work the same with the database as with the local demo data. Pure: no network, no React.
import { isObj } from '../../profileSchema'
import type { PostInput } from './logic'
import type { PinLike } from './release'
import { APPOINTMENTS, CASE_STEPS, DOCS, PERMITS, TESTS, type Case, type CaseStep } from './cases'
import { REPORT_REASONS, groupReports, type ReportGroup, type ReportReason } from './reports'
export const isReason = (v: string): v is ReportReason => (REPORT_REASONS as readonly string[]).includes(v)
/** the administrator's queue: open reports of everyone, grouped by post */
export const reportQueue = (rows: ReportRow[]): ReportGroup[] =>
  groupReports(rows.filter((r) => r.status === 'open').flatMap((r) => (isReason(r.reason) ? [{ postId: r.post_id, reason: r.reason, note: r.note ?? '', at: iso(r.created_at) }] : [])))
import { BENEFITS, EDU, EMPLOYMENT, INDUSTRIES, LANGS, LANG_LEVELS, ME, MY_EMPLOYER, SKILLS, type Acceptance, type AppStatus, type Benefit, type Country, type Credit, type Edu, type Employment, type Industry, type LanguageSkill, type MatchState, type Pin, type Post, type Role, type Seeker, type Skill } from './types'

export interface PostRow {
  id: string; employer_id: string | null; is_sample: boolean; company: string; position: string; industry: string; skills: string[]; min_years: number
  details: string; headcount: number | null; employment: string | null; salary_min: number | null; salary_max: number | null; salary_currency: string | null
  start_date: string | null; languages: unknown; education: string; benefits: string[]; country: string; province: string; created_at: string
  /** start of the current release (0003); missing on a database that has not run 0003 yet → the posting time */
  released_at?: string | null
  /** the employer is verified (0004); missing before 0004 → only the samples count as verified */
  verified?: boolean | null
  /** hidden while an administrator checks reports (0005) */
  hidden?: boolean | null
}
export interface ReportRow { id: string; post_id: string; reporter_id: string; reason: string; note: string | null; status: string; created_at: string }
export interface CaseRow { id: string; acceptance_id: string; post_id: string; seeker_id: string; steps: unknown; docs: unknown; tests: unknown; permit: unknown; trainings: unknown; departure_date: string | null; note: string | null; created_at: string; dates?: unknown }
export interface PinRow { id: string; seeker_id: string; country: string; province: string; industry: string; skills: string[]; created_at: string }
export interface AcceptanceRow { id: string; post_id: string; seeker_id: string; seeker_name: string; status: string; created_at: string; forwarded_at: string | null
  intro?: string | null; available_from?: string | null; promoted_at?: string | null; decided_at?: string | null }
export interface QuotaRow { kind: string; created_at: string }
/** anonymous counts of active pins (public.pin_stats): place, field and the hour they were made — no owner */
export interface PinStatRow { country: string; province: string; industry: string; skills: string[]; hour: string; n: number }
export interface ProfileRow { id?: string; full_name?: string | null; user_type: string | null; company: string | null; origin_country: string | null; origin_province: string | null; member: boolean | null; member_until?: string | null
  verify_country?: string | null; verify_reg?: string | null; verify_status?: string | null; verify_at?: string | null; verify_decided_at?: string | null; suspended?: boolean | null }
export interface AdminStats { users: number; employers: number; seekers: number; posts: number; posts_7d: number; acceptances: number }

const one = <T extends string>(all: readonly T[], v: unknown): T | null => (typeof v === 'string' && (all as readonly string[]).includes(v) ? (v as T) : null)
const many = <T extends string>(all: readonly T[], v: unknown): T[] => (Array.isArray(v) ? v.filter((x): x is T => one(all, x) !== null) : [])
const country = (v: unknown): Country | null => (v === 'TH' || v === 'CN' ? v : null)
const iso = (v: string) => new Date(v).toISOString()

export const rowToPost = (r: PostRow, uid: string): Post => ({
  id: r.id,
  // my own posts use the same marker as in the demo, so quota and "my posts" logic stay unchanged
  employerId: r.employer_id === uid ? MY_EMPLOYER : r.employer_id ?? `sample:${r.id}`,
  company: r.company, position: r.position,
  industry: one(INDUSTRIES, r.industry) ?? 'manufacturing',
  skills: many(SKILLS, r.skills),
  minYears: r.min_years, details: r.details ?? '',
  headcount: r.headcount, employment: one(EMPLOYMENT, r.employment),
  salary: r.salary_min !== null && r.salary_max !== null && (r.salary_currency === 'THB' || r.salary_currency === 'CNY') ? { min: r.salary_min, max: r.salary_max, currency: r.salary_currency } : null,
  startDate: r.start_date, languages: toLanguages(r.languages), education: one(EDU, r.education) ?? 'none', benefits: many(BENEFITS, r.benefits),
  country: country(r.country) ?? 'TH', province: r.province, createdAt: iso(r.created_at), releasedAt: iso(r.released_at ?? r.created_at), verified: r.verified ?? r.is_sample, ...(r.hidden ? { hidden: true } : {}), ...(r.is_sample ? { sample: true } : {}), synthetic: true,
})
export function toLanguages(v: unknown): LanguageSkill[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((x) => (isObj(x) && one(LANGS, x.lang) && one(LANG_LEVELS, x.level) ? [{ lang: x.lang as LanguageSkill['lang'], level: x.level as LanguageSkill['level'] }] : []))
}
/** the columns an employer writes (owner, dates and sample flag are set by the database) */
export const postToRow = (i: PostInput) => ({
  company: i.company, position: i.position, industry: i.industry, skills: [...i.skills], min_years: i.minYears, details: i.details,
  headcount: i.headcount, employment: i.employment,
  salary_min: i.salary?.min ?? null, salary_max: i.salary?.max ?? null, salary_currency: i.salary?.currency ?? null,
  start_date: i.startDate, languages: i.languages.map((l) => ({ lang: l.lang, level: l.level })), education: i.education, benefits: [...i.benefits],
  country: i.place.country, province: i.place.province,
})
/** a post back into the form's input (for editing) */
export const postToInput = (p: Post): PostInput => ({
  place: { country: p.country, province: p.province }, company: p.company, position: p.position, industry: p.industry, skills: [...p.skills], minYears: p.minYears,
  details: p.details, headcount: p.headcount ?? 1, employment: (p.employment ?? 'permanent') as Employment, salary: p.salary ? { ...p.salary } : null,
  startDate: p.startDate ?? '', languages: p.languages.map((l) => ({ ...l })), education: p.education as Edu, benefits: [...p.benefits] as Benefit[],
})

export const rowToPin = (r: PinRow): Pin => ({ id: r.id, country: country(r.country) ?? 'TH', province: r.province, industry: (one(INDUSTRIES, r.industry) ?? 'manufacturing') as Industry, skills: many(SKILLS, r.skills) as Skill[], at: iso(r.created_at) })
const STATUSES: readonly AppStatus[] = ['accepted', 'reserved', 'confirmed', 'rejected', 'forwarded']
const opt = (v: string | null | undefined) => (v ? { v: iso(v) } : null)
export const rowToAcceptance = (r: AcceptanceRow, uid: string): Acceptance => {
  const status = one(STATUSES, r.status) ?? 'accepted'
  const promoted = opt(r.promoted_at), decided = opt(r.decided_at)
  return {
    id: r.id, postId: r.post_id, seekerId: r.seeker_id === uid ? ME : r.seeker_id, seekerName: r.seeker_name || undefined, at: iso(r.created_at), status,
    intro: r.intro ?? '', availableFrom: r.available_from ?? null,
    ...(promoted ? { promotedAt: promoted.v } : {}), ...(decided ? { decidedAt: decided.v } : {}),
    ...(status === 'forwarded' ? { forwardedAt: iso(r.forwarded_at ?? r.created_at) } : {}),
  }
}
export const rowToCredit = (r: QuotaRow): Credit | null => (r.kind === 'post' || r.kind === 'renew' || r.kind === 'pin' ? { kind: r.kind, at: iso(r.created_at) } : null)
/** the anonymous pin counts as the release needs them (one entry per group; the count does not change who is reached) */
export const statsToPool = (rows: PinStatRow[]): PinLike[] => rows.flatMap((r) => {
  const c = country(r.country), ind = one(INDUSTRIES, r.industry)
  return c && ind ? [{ country: c, province: r.province, industry: ind, skills: many(SKILLS, r.skills), at: iso(r.hour) }] : []
})
/** pins per province, for the board map */
export const statsByProvince = (rows: PinStatRow[]) => rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.province]: (m[r.province] ?? 0) + Number(r.n) }), {})

const flagsOf = <K extends string>(keys: readonly K[], v: unknown): Partial<Record<K, boolean>> => (isObj(v) ? Object.fromEntries(keys.filter((k) => typeof v[k] === 'boolean').map((k) => [k, v[k] as boolean])) as Partial<Record<K, boolean>> : {})
export function rowToCase(r: CaseRow, uid: string): Case {
  const steps = (isObj(r.steps) ? Object.fromEntries(CASE_STEPS.filter((s) => typeof (r.steps as Record<string, unknown>)[s] === 'string').map((s) => [s, iso((r.steps as Record<string, string>)[s])])) : {}) as Partial<Record<CaseStep, string>>
  const trainings = Array.isArray(r.trainings) ? r.trainings.flatMap((x) => (isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' ? [{ id: x.id, name: x.name, done: x.done === true, ...(typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? { date: x.date } : {}) }] : [])) : []
  return { id: r.id, accId: r.acceptance_id, postId: r.post_id, seekerId: r.seeker_id === uid ? ME : r.seeker_id, steps, docs: flagsOf(DOCS, r.docs), tests: flagsOf(TESTS, r.tests), permit: flagsOf(PERMITS, r.permit),
    trainings, departureDate: r.departure_date, note: r.note ?? '', createdAt: iso(r.created_at),
    dates: isObj(r.dates) ? Object.fromEntries(APPOINTMENTS.flatMap((k) => { const v = (r.dates as Record<string, unknown>)[k]; return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? [[k, v]] : [] })) : {} }
}
/** the whole matching state for one signed-in person, as the pages expect it */
export function buildState(input: { uid: string; name: string; profile: ProfileRow | null; posts: PostRow[]; pins: PinRow[]; acceptances: AcceptanceRow[]; clockHours: number; credits?: QuotaRow[]; people?: ProfileRow[]; allPins?: PinRow[]; cases?: CaseRow[]; reports?: ReportRow[] }): MatchState {
  const p = input.profile
  const origin = p && country(p.origin_country) && p.origin_province ? { country: country(p.origin_country)!, province: p.origin_province } : null
  // administrators also see the other job seekers (names and pins) to follow the step-by-step release
  const seekers: Seeker[] = (input.people ?? []).filter((x) => x.id && x.id !== input.uid && x.user_type === 'seeker').map((x) => ({
    id: x.id!, name: x.full_name || '—',
    origin: country(x.origin_country) && x.origin_province ? { country: country(x.origin_country)!, province: x.origin_province } : null,
    pins: (input.allPins ?? []).filter((r) => r.seeker_id === x.id).map(rowToPin), synthetic: true,
  }))
  return {
    version: 2, role: one<Role>(['seeker', 'employer'], p?.user_type), clockHours: input.clockHours, myCompany: p?.company ?? '', member: !!p?.member, memberUntil: p?.member_until ? iso(p.member_until) : null,
    me: { id: ME, name: input.name, origin, pins: input.pins.map(rowToPin), synthetic: true },
    seekers,
    posts: input.posts.map((r) => rowToPost(r, input.uid)),
    acceptances: input.acceptances.map((r) => rowToAcceptance(r, input.uid)),
    credits: (input.credits ?? []).flatMap((r) => { const c = rowToCredit(r); return c ? [c] : [] }),
    cases: (input.cases ?? []).map((r) => rowToCase(r, input.uid)),
    reports: (input.reports ?? []).filter((r) => r.reporter_id === input.uid).flatMap((r) => (isReason(r.reason) ? [{ id: r.id, postId: r.post_id, reason: r.reason, note: r.note ?? '', at: iso(r.created_at) }] : [])),
    ...(p?.suspended ? { suspended: true } : {}),
    employerVerify: p && country(p.verify_country) && p.verify_reg && (p.verify_status === 'pending' || p.verify_status === 'verified' || p.verify_status === 'rejected')
      ? { country: country(p.verify_country)!, regNo: p.verify_reg, status: p.verify_status, at: iso(p.verify_at ?? new Date().toISOString()), ...(p.verify_decided_at ? { decidedAt: iso(p.verify_decided_at) } : {}) } : null,
  }
}

/** database error → one of the prototype's problems (the message text is never shown as is) */
export function dbProblem(e: { message?: string; code?: string } | null | undefined): 'quota' | 'limit' | 'duplicate' | 'already' | 'contact' | 'notOpen' | 'state' | 'belowHeld' | 'dbOld' | 'regNo' | 'caseStarted' | 'reportLimit' | 'suspended' | 'network' {
  const m = e?.message ?? ''
  // a function, table or column this website needs is missing: the database has not been updated (0003_board.sql)
  if (['PGRST202', 'PGRST204', 'PGRST205', '42883', '42P01', '42703'].includes(e?.code ?? '') || /schema cache|does not exist/i.test(m)) return 'dbOld'
  if (m.includes('quota')) return 'quota'
  if (m.includes('below_held')) return 'belowHeld'
  if (m.includes('bad_reg_no')) return 'regNo'
  if (m.includes('case_started')) return 'caseStarted'
  if (m.includes('report_limit')) return 'reportLimit'
  if (m.includes('suspended')) return 'suspended'
  if (m.includes('pin_limit')) return 'limit'
  if (m.includes('pin_duplicate')) return 'duplicate'
  if (m.includes('not_open') || m.includes('expired')) return 'notOpen'
  if (m.includes('bad_state') || m.includes('not_allowed')) return 'state'
  if (e?.code === '23505') return 'already'
  if (m.includes('no_contact') || e?.code === '23514') return 'contact'
  return 'network'
}
