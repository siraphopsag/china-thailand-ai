// Mapping between the database rows (supabase/migrations/0002_matching.sql) and the matching prototype's own types, so the pages
// and rules in logic.ts work the same with the database as with the local demo data. Pure: no network, no React.
import { isObj } from '../../profileSchema'
import type { PostInput } from './logic'
import { BENEFITS, EDU, EMPLOYMENT, INDUSTRIES, LANGS, LANG_LEVELS, ME, MY_EMPLOYER, SKILLS, type Acceptance, type Benefit, type Country, type Edu, type Employment, type Industry, type LanguageSkill, type MatchState, type Pin, type Post, type Role, type Seeker, type Skill } from './types'

export interface PostRow {
  id: string; employer_id: string | null; is_sample: boolean; company: string; position: string; industry: string; skills: string[]; min_years: number
  details: string; headcount: number | null; employment: string | null; salary_min: number | null; salary_max: number | null; salary_currency: string | null
  start_date: string | null; languages: unknown; education: string; benefits: string[]; country: string; province: string; created_at: string
}
export interface PinRow { id: string; seeker_id: string; country: string; province: string; industry: string; skills: string[]; created_at: string }
export interface AcceptanceRow { id: string; post_id: string; seeker_id: string; seeker_name: string; status: string; created_at: string; forwarded_at: string | null }
export interface ProfileRow { id?: string; full_name?: string | null; user_type: string | null; company: string | null; origin_country: string | null; origin_province: string | null; member: boolean | null }
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
  country: country(r.country) ?? 'TH', province: r.province, createdAt: iso(r.created_at), synthetic: true,
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
export const rowToAcceptance = (r: AcceptanceRow, uid: string): Acceptance => ({
  id: r.id, postId: r.post_id, seekerId: r.seeker_id === uid ? ME : r.seeker_id, seekerName: r.seeker_name || undefined, at: iso(r.created_at),
  ...(r.status === 'forwarded' ? { status: 'forwarded' as const, forwardedAt: iso(r.forwarded_at ?? r.created_at) } : { status: 'accepted' as const }),
})

/** the whole matching state for one signed-in person, as the pages expect it */
export function buildState(input: { uid: string; name: string; profile: ProfileRow | null; posts: PostRow[]; pins: PinRow[]; acceptances: AcceptanceRow[]; dayOffset: number; people?: ProfileRow[]; allPins?: PinRow[] }): MatchState {
  const p = input.profile
  const origin = p && country(p.origin_country) && p.origin_province ? { country: country(p.origin_country)!, province: p.origin_province } : null
  // administrators also see the other job seekers (names and pins) to follow the step-by-step release
  const seekers: Seeker[] = (input.people ?? []).filter((x) => x.id && x.id !== input.uid && x.user_type === 'seeker').map((x) => ({
    id: x.id!, name: x.full_name || '—',
    origin: country(x.origin_country) && x.origin_province ? { country: country(x.origin_country)!, province: x.origin_province } : null,
    pins: (input.allPins ?? []).filter((r) => r.seeker_id === x.id).map(rowToPin), synthetic: true,
  }))
  return {
    version: 1, role: one<Role>(['seeker', 'employer'], p?.user_type) , dayOffset: input.dayOffset, myCompany: p?.company ?? '', member: !!p?.member,
    me: { id: ME, name: input.name, origin, pins: input.pins.map(rowToPin), synthetic: true },
    seekers,
    posts: input.posts.map((r) => rowToPost(r, input.uid)),
    acceptances: input.acceptances.map((r) => rowToAcceptance(r, input.uid)),
  }
}

/** database error → one of the prototype's problems (the message text is never shown as is) */
export function dbProblem(e: { message?: string; code?: string } | null | undefined): 'quota' | 'limit' | 'already' | 'contact' | 'network' {
  const m = e?.message ?? ''
  if (m.includes('quota')) return 'quota'
  if (m.includes('pin_limit')) return 'limit'
  if (e?.code === '23505') return 'already'
  if (m.includes('no_contact') || e?.code === '23514') return 'contact'
  return 'network'
}
