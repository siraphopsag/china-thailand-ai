// Pure rules of the matching prototype (no React, no storage): pins, posts, the step-by-step release and acceptances.
import { isObj } from '../../profileSchema'
import { provinces } from '../../locales/provinces'
import { BENEFITS, COUNTRIES, CURRENCIES, EDU, EMPLOYMENT, FREE_POSTS_PER_WEEK, INDUSTRIES, LANGS, LANG_LEVELS, MAX_PINS, ME, MEMBER_POSTS_PER_WEEK, MY_EMPLOYER, SKILLS,
  type Acceptance, type Benefit, type Country, type Edu, type Employment, type Industry, type LanguageSkill, type MatchState, type Pin, type Place, type Post, type Salary, type Seeker, type Skill, type Tier } from './types'

/**
 * Short free text (company, position, details). Text that looks like contact details — an e-mail address, a link or a long run
 * of digits such as a phone or ID number — is refused, so real personal or employer contact data cannot be typed in.
 * (Came from the first job-board prototype, removed in Oct 2026.)
 */
export function textProblem(v: unknown, min: number, max: number): 'type' | 'length' | 'contact' | null {
  if (typeof v !== 'string') return 'type'
  const s = v.trim()
  if (s.length < min || s.length > max || s !== v) return 'length'
  if (/[^\s@]+@[^\s@]+/.test(s) || /(https?:\/\/|www\.)/i.test(s) || /\d[\d\s-]{6,}\d/.test(s)) return 'contact'
  return null
}

export const DAY_MS = 86_400_000
export const isCountry = (v: unknown): v is Country => v === 'TH' || v === 'CN'
/** a first-level division code of that country that exists on the map (e.g. TH-50, CN-SH) */
export const isProvinceOf = (c: Country, v: unknown): v is string => typeof v === 'string' && v.startsWith(c + '-') && `prov.${v}` in provinces
export const isPlace = (v: unknown): v is Place => isObj(v) && isCountry(v.country) && isProvinceOf(v.country, v.province)
const isIndustry = (v: unknown): v is Industry => typeof v === 'string' && (INDUSTRIES as readonly string[]).includes(v)
const isSkills = (v: unknown): v is Skill[] => Array.isArray(v) && v.length > 0 && v.length <= SKILLS.length && v.every((s) => (SKILLS as readonly string[]).includes(s)) && new Set(v).size === v.length
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9:_-]{1,40}$/.test(v)

export type Problem = 'place' | 'industry' | 'skills' | 'limit' | 'duplicate' | 'company' | 'position' | 'details' | 'years' | 'contact' | 'notOpen' | 'already' | 'unknown'
  | 'headcount' | 'employment' | 'salary' | 'startDate' | 'languages' | 'education' | 'benefits' | 'quota' | 'network'
const oneOf = <T extends string>(all: readonly T[], v: unknown): v is T => typeof v === 'string' && (all as readonly string[]).includes(v)
const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const isLangs = (v: unknown): v is LanguageSkill[] => Array.isArray(v) && v.length <= LANGS.length && v.every((l) => isObj(l) && Object.keys(l).length === 2 && oneOf(LANGS, l.lang) && oneOf(LANG_LEVELS, l.level))
  && new Set(v.map((l) => (l as LanguageSkill).lang)).size === v.length
const isBenefits = (v: unknown): v is Benefit[] => Array.isArray(v) && v.every((b) => oneOf(BENEFITS, b)) && new Set(v).size === v.length
const isSalary = (v: unknown): v is Salary => isObj(v) && Object.keys(v).length === 3 && intIn(v.min, 1, 10_000_000) && intIn(v.max, 1, 10_000_000) && oneOf(CURRENCIES, v.currency)
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'))
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: Problem }
const fail = <T,>(problem: Problem): Outcome<T> => ({ ok: false, problem })
const text = (v: unknown, min: number, max: number, field: Problem): Problem | null => { const p = textProblem(v, min, max); return p === null ? null : p === 'contact' ? 'contact' : field }

/* ---------- pins ---------- */
export function addPin(s: Seeker, input: { place: Place; industry: Industry; skills: Skill[] }, id: string, at: string): Outcome<Seeker> {
  if (!isPlace(input.place)) return fail('place')
  if (!isIndustry(input.industry)) return fail('industry')
  if (!isSkills(input.skills)) return fail('skills')
  if (s.pins.length >= MAX_PINS) return fail('limit')
  if (s.pins.some((p) => p.country === input.place.country && p.province === input.place.province)) return fail('duplicate')
  const pin: Pin = { id, country: input.place.country, province: input.place.province, industry: input.industry, skills: [...input.skills], at }
  return { ok: true, value: { ...s, pins: [...s.pins, pin] } }
}
export const removePin = (s: Seeker, id: string): Seeker => ({ ...s, pins: s.pins.filter((p) => p.id !== id) })

/* ---------- posts ---------- */
export interface PostInput {
  place: Place; company: string; position: string; industry: Industry; skills: Skill[]; minYears: number; details: string
  headcount: number; employment: Employment; salary: Salary | null; startDate: string; languages: LanguageSkill[]; education: Edu; benefits: Benefit[]
}
export function makePost(input: PostInput, id: string, employerId: string, at: string): Outcome<Post> {
  if (!isPlace(input.place)) return fail('place')
  // position: 2 characters minimum, so short titles such as "HR" are accepted (owner, Oct 2026)
  const t = text(input.company, 2, 80, 'company') ?? text(input.position, 2, 80, 'position') ?? text(input.details, 0, 600, 'details')
  if (t) return fail(t)
  if (!isIndustry(input.industry)) return fail('industry')
  if (!isSkills(input.skills)) return fail('skills')
  if (!intIn(input.minYears, 0, 40)) return fail('years')
  if (!intIn(input.headcount, 1, 99)) return fail('headcount')
  if (!oneOf(EMPLOYMENT, input.employment)) return fail('employment')
  if (input.salary !== null && (!isSalary(input.salary) || input.salary.min > input.salary.max)) return fail('salary')
  // start date: a real day, not before the posting day, at most two years ahead
  const day = at.slice(0, 10)
  if (!isDay(input.startDate) || input.startDate < day || Date.parse(input.startDate) > Date.parse(day) + 731 * DAY_MS) return fail('startDate')
  if (!isLangs(input.languages) || input.languages.length === 0) return fail('languages')
  if (!oneOf(EDU, input.education)) return fail('education')
  if (!isBenefits(input.benefits)) return fail('benefits')
  return { ok: true, value: { id, employerId, company: input.company, position: input.position, industry: input.industry, skills: [...input.skills], minYears: input.minYears, details: input.details,
    headcount: input.headcount, employment: input.employment, salary: input.salary ? { ...input.salary } : null, startDate: input.startDate,
    languages: input.languages.map((l) => ({ ...l })), education: input.education, benefits: [...input.benefits],
    country: input.place.country, province: input.place.province, createdAt: at, synthetic: true } }
}

/* ---------- weekly posting allowance (owner, Oct 2026): 3 free per rolling 7 days; 10 with the membership package ---------- */
export const postLimit = (st: MatchState) => (st.member ? MEMBER_POSTS_PER_WEEK : FREE_POSTS_PER_WEEK)
/** my posts created in the 7 days before `now` (the demo clock counts) */
export const postsThisWeek = (st: MatchState, now: number) => st.posts.filter((p) => p.employerId === MY_EMPLOYER && now - Date.parse(p.createdAt) < 7 * DAY_MS && Date.parse(p.createdAt) <= now).length
export const canPost = (st: MatchState, now: number) => postsThisWeek(st, now) < postLimit(st)

/* ---------- the step-by-step release ---------- */
export const nowWith = (dayOffset: number, real = Date.now()) => real + dayOffset * DAY_MS
/** a post stops escalating once somebody has accepted it */
export const isTaken = (post: Post, acc: Acceptance[]) => acc.some((a) => a.postId === post.id)
/** 1 on the day of posting, 2 after one day, 3 after two days (while nobody has accepted; a taken post keeps the step it reached) */
export function tierOf(post: Post, now: number, acc: Acceptance[] = []): Tier {
  const first = acc.filter((a) => a.postId === post.id).map((a) => Date.parse(a.at)).sort((x, y) => x - y)[0]
  const until = first ?? now
  const days = Math.floor((until - Date.parse(post.createdAt)) / DAY_MS)
  return days >= 2 ? 3 : days >= 1 ? 2 : 1
}
const samePlace = (p: Place, q: Place) => p.country === q.country && p.province === q.province
/** same field: the pin's industry matches, or the pin shares at least one skill with the post */
export const sameField = (pin: Pin, post: Post) => pin.industry === post.industry || pin.skills.some((s) => post.skills.includes(s))
/** the earliest step at which this seeker is reached by the post (null = never) */
export function reachTier(post: Post, s: Seeker): Tier | null {
  const here = s.pins.filter((p) => samePlace(p, post))
  if (here.some((p) => sameField(p, post))) return 1
  if (here.length) return 2
  if (s.pins.some((p) => p.country === post.country)) return 3
  return null
}
export const isVisibleTo = (post: Post, s: Seeker, now: number, acc: Acceptance[]) => { const r = reachTier(post, s); return r !== null && r <= tierOf(post, now, acc) }
/** the posts this seeker can currently see, newest first */
export const offersFor = (st: MatchState, s: Seeker, now: number) => st.posts.filter((p) => isVisibleTo(p, s, now, st.acceptances)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

/* ---------- accepting and forwarding ---------- */
export function accept(st: MatchState, postId: string, seekerId: string, id: string, at: string): Outcome<Acceptance> {
  const post = st.posts.find((p) => p.id === postId)
  const s = seekerId === ME ? st.me : st.seekers.find((x) => x.id === seekerId)
  if (!post || !s) return fail('unknown')
  if (!isVisibleTo(post, s, Date.parse(at), st.acceptances)) return fail('notOpen')
  if (st.acceptances.some((a) => a.postId === postId && a.seekerId === seekerId)) return fail('already')
  return { ok: true, value: { id, postId, seekerId, at, status: 'accepted' } }
}
/** simulated: marks the case as forwarded to the employment authority; no data leaves the browser */
export const forward = (a: Acceptance, at: string): Acceptance => (a.status === 'forwarded' ? a : { ...a, status: 'forwarded', forwardedAt: at })

/* ---------- validation of stored data (never trust the browser) ---------- */
const isPin = (v: unknown): v is Pin => isPlace(v) && isObj(v) && isId(v.id) && isIndustry(v.industry) && isSkills(v.skills) && isIso(v.at)
const isSeeker = (v: unknown): v is Seeker => isObj(v) && isId(v.id) && typeof v.name === 'string' && v.name.length <= 40 && (v.origin === null || isPlace(v.origin))
  && Array.isArray(v.pins) && v.pins.length <= MAX_PINS && v.pins.every(isPin) && v.synthetic === true
/** a post saved before Oct 2026 has none of the new details: they read as "not stated" */
const LEGACY = { headcount: null, employment: null, salary: null, startDate: null, languages: [], education: 'none', benefits: [] } as const
const withLegacy = (v: Record<string, unknown>): Record<string, unknown> => ('headcount' in v ? v : { ...v, ...LEGACY, languages: [], benefits: [] })
const isLegacyDetails = (v: Record<string, unknown>) => v.headcount === null && v.employment === null && v.salary === null && v.startDate === null
  && Array.isArray(v.languages) && v.languages.length === 0 && v.education === 'none' && Array.isArray(v.benefits) && v.benefits.length === 0
const isPost = (v: unknown): v is Post => {
  if (!isPlace(v) || !isObj(v) || !isId(v.id) || !isId(v.employerId) || !isIso(v.createdAt) || v.synthetic !== true) return false
  const base = { ...(v as unknown as PostInput), place: { country: v.country, province: v.province } }
  // the original fields are checked with the same rules as a new post; the new details either all present and valid, or all "not stated"
  if (isLegacyDetails(v)) return makePost({ ...base, headcount: 1, employment: 'permanent', salary: null, startDate: v.createdAt.slice(0, 10), languages: [{ lang: 'th', level: 'basic' }], education: 'none', benefits: [] }, 'x', 'y', v.createdAt).ok
  return makePost(base, 'x', 'y', v.createdAt).ok
}
const isAcc = (v: unknown): v is Acceptance => isObj(v) && isId(v.id) && isId(v.postId) && isId(v.seekerId) && isIso(v.at) && (v.status === 'accepted' || (v.status === 'forwarded' && isIso(v.forwardedAt)))
export function parseState(raw: unknown): MatchState | null {
  if (!isObj(raw) || raw.version !== 1) return null
  if (!(raw.role === null || raw.role === 'seeker' || raw.role === 'employer')) return null
  if (typeof raw.dayOffset !== 'number' || !Number.isInteger(raw.dayOffset) || raw.dayOffset < 0 || raw.dayOffset > 60) return null
  if (!isSeeker(raw.me) || raw.me.id !== ME || typeof raw.myCompany !== 'string' || raw.myCompany.length > 80) return null
  // data saved before Oct 2026: posts without the new details, no membership flag
  const postsIn = Array.isArray(raw.posts) ? raw.posts.map((p) => (isObj(p) ? withLegacy(p) : p)) : raw.posts
  const member = raw.member === undefined ? false : raw.member
  if (typeof member !== 'boolean') return null
  if (!Array.isArray(raw.seekers) || !raw.seekers.every(isSeeker) || !Array.isArray(postsIn) || !postsIn.every(isPost) || !Array.isArray(raw.acceptances) || !raw.acceptances.every(isAcc)) return null
  const st = { ...(raw as unknown as MatchState), posts: postsIn as Post[], member }
  const posts = new Set(st.posts.map((p) => p.id)), people = new Set([ME, ...st.seekers.map((s) => s.id)])
  if (posts.size !== st.posts.length || people.size !== st.seekers.length + 1) return null
  if (!st.acceptances.every((a) => posts.has(a.postId) && people.has(a.seekerId))) return null
  if (!st.posts.every((p) => p.employerId === MY_EMPLOYER || p.employerId.startsWith('employer:'))) return null
  return st
}
export { COUNTRIES }
