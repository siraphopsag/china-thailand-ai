// Pure rules of the matching prototype (no React, no storage): pins, posts, weekly allowances, applications and the reservation
// queue, renewals, and the validation of stored data. The release levels live in release.ts.
import { isObj } from '../../profileSchema'
import { provinces } from '../../locales/provinces'
import { BENEFITS, COUNTRIES, CURRENCIES, EDU, EMPLOYMENT, FREE_POSTS_PER_WEEK, HOLDS_PLACE, INDUSTRIES, LANGS, LANG_LEVELS, MAX_CLOCK_HOURS, ME, MEMBER_POSTS_PER_WEEK, MY_EMPLOYER,
  PINS_PER_WEEK, SKILLS, type Acceptance, type AppStatus, type Benefit, type Country, type Credit, type Edu, type Employment, type Industry, type LanguageSkill, type MatchState,
  type Pin, type Place, type Post, type Salary, type Seeker, type Skill } from './types'
import { DAY_MS, HOUR_MS, cycleQuota, isExpired, pinActive, reachFor, type PinLike } from './release'

export { DAY_MS, HOUR_MS }
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

export const isCountry = (v: unknown): v is Country => v === 'TH' || v === 'CN'
/** a first-level division code of that country that exists on the map (e.g. TH-50, CN-SH) */
export const isProvinceOf = (c: Country, v: unknown): v is string => typeof v === 'string' && v.startsWith(c + '-') && `prov.${v}` in provinces
export const isPlace = (v: unknown): v is Place => isObj(v) && isCountry(v.country) && isProvinceOf(v.country, v.province)
const isIndustry = (v: unknown): v is Industry => typeof v === 'string' && (INDUSTRIES as readonly string[]).includes(v)
const isSkills = (v: unknown): v is Skill[] => Array.isArray(v) && v.length > 0 && v.length <= SKILLS.length && v.every((s) => (SKILLS as readonly string[]).includes(s)) && new Set(v).size === v.length
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9:_-]{1,40}$/.test(v)

export type Problem = 'place' | 'industry' | 'skills' | 'limit' | 'duplicate' | 'company' | 'position' | 'details' | 'years' | 'contact' | 'notOpen' | 'already' | 'unknown'
  | 'headcount' | 'employment' | 'salary' | 'startDate' | 'languages' | 'education' | 'benefits' | 'quota' | 'network' | 'intro' | 'available' | 'state'
const oneOf = <T extends string>(all: readonly T[], v: unknown): v is T => typeof v === 'string' && (all as readonly string[]).includes(v)
const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const isLangs = (v: unknown): v is LanguageSkill[] => Array.isArray(v) && v.length <= LANGS.length && v.every((l) => isObj(l) && Object.keys(l).length === 2 && oneOf(LANGS, l.lang) && oneOf(LANG_LEVELS, l.level))
  && new Set(v.map((l) => (l as LanguageSkill).lang)).size === v.length
const isBenefits = (v: unknown): v is Benefit[] => Array.isArray(v) && v.every((b) => oneOf(BENEFITS, b)) && new Set(v).size === v.length
const isSalary = (v: unknown): v is Salary => isObj(v) && Object.keys(v).length === 3 && intIn(v.min, 1, 10_000_000) && intIn(v.max, 1, 10_000_000) && oneOf(CURRENCIES, v.currency)
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'))
/** a real day, not before `at`'s day, at most two years ahead */
const dayWithin = (v: unknown, at: string): v is string => { const day = at.slice(0, 10); return isDay(v) && v >= day && Date.parse(v) <= Date.parse(day) + 731 * DAY_MS }
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: Problem }
const fail = <T,>(problem: Problem): Outcome<T> => ({ ok: false, problem })
const text = (v: unknown, min: number, max: number, field: Problem): Problem | null => { const p = textProblem(v, min, max); return p === null ? null : p === 'contact' ? 'contact' : field }

/* ---------- weekly allowances (owner, Oct 2026): a cycle starts with its first use; after 7 days the full allowance is back ---------- */
export const postLimit = (st: MatchState) => (st.member ? MEMBER_POSTS_PER_WEEK : FREE_POSTS_PER_WEEK)
/** new posts and renewals share one allowance */
export const postQuota = (st: MatchState, now: number) => cycleQuota(st.credits.filter((c) => c.kind !== 'pin').map((c) => c.at), now, postLimit(st))
export const pinQuota = (st: MatchState, now: number) => cycleQuota(st.credits.filter((c) => c.kind === 'pin').map((c) => c.at), now, PINS_PER_WEEK)
export const canPost = (st: MatchState, now: number) => postQuota(st, now).left > 0

/* ---------- pins ---------- */
export const activePins = (s: Seeker, now: number) => s.pins.filter((p) => pinActive(p, now))
/** 5 pins per weekly cycle; one pin per province and field at a time; a real province of the chosen country; at least one skill */
export function addPin(st: MatchState, input: { place: Place; industry: Industry; skills: Skill[] }, id: string, at: string): Outcome<Seeker> {
  if (!isPlace(input.place)) return fail('place')
  if (!isIndustry(input.industry)) return fail('industry')
  if (!isSkills(input.skills)) return fail('skills')
  const now = Date.parse(at)
  if (pinQuota(st, now).left <= 0) return fail('limit')
  if (activePins(st.me, now).some((p) => p.country === input.place.country && p.province === input.place.province && p.industry === input.industry)) return fail('duplicate')
  const pin: Pin = { id, country: input.place.country, province: input.place.province, industry: input.industry, skills: [...input.skills], at }
  return { ok: true, value: { ...st.me, pins: [...st.me.pins, pin] } }
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
  if (!dayWithin(input.startDate, at)) return fail('startDate')
  if (!isLangs(input.languages) || input.languages.length === 0) return fail('languages')
  if (!oneOf(EDU, input.education)) return fail('education')
  if (!isBenefits(input.benefits)) return fail('benefits')
  return { ok: true, value: { id, employerId, company: input.company, position: input.position, industry: input.industry, skills: [...input.skills], minYears: input.minYears, details: input.details,
    headcount: input.headcount, employment: input.employment, salary: input.salary ? { ...input.salary } : null, startDate: input.startDate,
    languages: input.languages.map((l) => ({ ...l })), education: input.education, benefits: [...input.benefits],
    country: input.place.country, province: input.place.province, createdAt: at, releasedAt: at, synthetic: true } }
}
/** renewing uses one post from the weekly allowance and starts the release again at level 1, with a fresh 6 months */
export function renewPost(st: MatchState, postId: string, at: string): Outcome<Post> {
  const p = st.posts.find((x) => x.id === postId && x.employerId === MY_EMPLOYER); if (!p) return fail('unknown')
  if (!canPost(st, Date.parse(at))) return fail('quota')
  return { ok: true, value: { ...p, releasedAt: at } }
}

/* ---------- who sees which post ---------- */
/** every active pin as the release sees it (in the local demo: the sample seekers and me) */
export const poolOf = (st: MatchState): PinLike[] => [...st.me.pins, ...st.seekers.flatMap((s) => s.pins)]
/** the posts open to me now (not my own), newest release first */
export const offersFor = (st: MatchState, pool: PinLike[], now: number) => st.posts
  .filter((p) => p.employerId !== MY_EMPLOYER && reachFor(p, st.me.pins, pool, now).visible)
  .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
/** what a post still shows after its 6 months: nothing (the post and its applications are removed) */
export const withoutExpired = (st: MatchState, now: number): MatchState => {
  if (!st.posts.some((p) => isExpired(p, now))) return st
  const posts = st.posts.filter((p) => !isExpired(p, now)), ids = new Set(posts.map((p) => p.id))
  return { ...st, posts, acceptances: st.acceptances.filter((a) => ids.has(a.postId)) }
}

/* ---------- applications and the reservation queue ---------- */
export const capacityOf = (p: Post) => p.headcount ?? 1
export const holding = (acc: Acceptance[], postId: string) => acc.filter((a) => a.postId === postId && HOLDS_PLACE.includes(a.status)).length
export const isFull = (acc: Acceptance[], p: Post) => holding(acc, p.id) >= capacityOf(p)
/** open = places left · waiting = full, someone waits for the employer · closed = full and every place confirmed */
export function postState(acc: Acceptance[], p: Post): 'open' | 'waiting' | 'closed' {
  if (!isFull(acc, p)) return 'open'
  return acc.some((a) => a.postId === p.id && a.status === 'accepted') ? 'waiting' : 'closed'
}
export interface ApplyInput { intro: string; availableFrom: string }
/** apply to an open post (takes a place) or reserve a full one (joins the queue); only once per post */
export function applyTo(st: MatchState, pool: PinLike[], postId: string, seekerId: string, input: ApplyInput, id: string, at: string): Outcome<Acceptance> {
  const post = st.posts.find((p) => p.id === postId)
  const s = seekerId === ME ? st.me : st.seekers.find((x) => x.id === seekerId)
  if (!post || !s) return fail('unknown')
  if ((seekerId === ME && post.employerId === MY_EMPLOYER) || !reachFor(post, s.pins, pool, Date.parse(at)).visible) return fail('notOpen')
  if (st.acceptances.some((a) => a.postId === postId && a.seekerId === seekerId)) return fail('already')
  const t = text(input.intro, 0, 300, 'intro'); if (t) return fail(t)
  if (!dayWithin(input.availableFrom, at)) return fail('available')
  const status: AppStatus = isFull(st.acceptances, post) ? 'reserved' : 'accepted'
  return { ok: true, value: { id, postId, seekerId, at, status, intro: input.intro, availableFrom: input.availableFrom } }
}
/** fill free places from the queue: the earliest reservation first */
export function promote(acc: Acceptance[], post: Post, at: string): Acceptance[] {
  let out = acc
  while (holding(out, post.id) < capacityOf(post)) {
    const next = out.filter((a) => a.postId === post.id && a.status === 'reserved').sort((a, b) => a.at.localeCompare(b.at))[0]
    if (!next) break
    out = out.map((a) => (a.id === next.id ? { ...a, status: 'accepted', promotedAt: at } : a))
  }
  return out
}
/** the employer confirms or declines an application that holds a place; a declined place goes to the queue */
export function decide(st: MatchState, accId: string, confirm: boolean, at: string): Outcome<Acceptance[]> {
  const a = st.acceptances.find((x) => x.id === accId); if (!a) return fail('unknown')
  const post = st.posts.find((p) => p.id === a.postId); if (!post) return fail('unknown')
  if (a.status !== 'accepted') return fail('state')
  const next = st.acceptances.map((x) => (x.id === accId ? { ...x, status: (confirm ? 'confirmed' : 'rejected') as AppStatus, decidedAt: at } : x))
  return { ok: true, value: promote(next, post, at) }
}
/** the seeker withdraws (an application or a reservation); a freed place goes to the queue */
export function cancel(st: MatchState, accId: string, at: string): Outcome<Acceptance[]> {
  const a = st.acceptances.find((x) => x.id === accId && x.seekerId === ME); if (!a) return fail('unknown')
  if (a.status === 'forwarded' || a.status === 'rejected') return fail('state')
  const post = st.posts.find((p) => p.id === a.postId)
  const next = st.acceptances.filter((x) => x.id !== accId)
  return { ok: true, value: post ? promote(next, post, at) : next }
}
/** simulated: the admin marks a confirmed case as forwarded to the employment authority; no data leaves the browser */
export const forward = (a: Acceptance, at: string): Acceptance => (a.status === 'confirmed' ? { ...a, status: 'forwarded', forwardedAt: at } : a)

/* ---------- validation of stored data (never trust the browser) ---------- */
const MAX_STORED_PINS = PINS_PER_WEEK * 6 // five a week for a month of pins, with room
const isPin = (v: unknown): v is Pin => isPlace(v) && isObj(v) && isId(v.id) && isIndustry(v.industry) && isSkills(v.skills) && isIso(v.at)
const isSeeker = (v: unknown): v is Seeker => isObj(v) && isId(v.id) && typeof v.name === 'string' && v.name.length <= 40 && (v.origin === null || isPlace(v.origin))
  && Array.isArray(v.pins) && v.pins.length <= MAX_STORED_PINS && v.pins.every(isPin) && v.synthetic === true
/** a post saved before Oct 2026 has none of the new details: they read as "not stated" */
const LEGACY = { headcount: null, employment: null, salary: null, startDate: null, languages: [], education: 'none', benefits: [] } as const
const withLegacy = (v: Record<string, unknown>): Record<string, unknown> => ('headcount' in v ? v : { ...v, ...LEGACY, languages: [], benefits: [] })
const isLegacyDetails = (v: Record<string, unknown>) => v.headcount === null && v.employment === null && v.salary === null && v.startDate === null
  && Array.isArray(v.languages) && v.languages.length === 0 && v.education === 'none' && Array.isArray(v.benefits) && v.benefits.length === 0
const isPost = (v: unknown): v is Post => {
  if (!isPlace(v) || !isObj(v) || !isId(v.id) || !isId(v.employerId) || !isIso(v.createdAt) || !isIso(v.releasedAt) || Date.parse(v.releasedAt) < Date.parse(v.createdAt) || v.synthetic !== true) return false
  const base = { ...(v as unknown as PostInput), place: { country: v.country, province: v.province } }
  // the original fields are checked with the same rules as a new post; the new details either all present and valid, or all "not stated"
  if (isLegacyDetails(v)) return makePost({ ...base, headcount: 1, employment: 'permanent', salary: null, startDate: v.createdAt.slice(0, 10), languages: [{ lang: 'th', level: 'basic' }], education: 'none', benefits: [] }, 'x', 'y', v.createdAt).ok
  return makePost(base, 'x', 'y', v.createdAt).ok
}
const STATUSES: readonly AppStatus[] = ['accepted', 'reserved', 'confirmed', 'rejected', 'forwarded']
const optIso = (v: unknown) => v === undefined || isIso(v)
const isAcc = (v: unknown): v is Acceptance => isObj(v) && isId(v.id) && isId(v.postId) && isId(v.seekerId) && isIso(v.at) && oneOf(STATUSES, v.status)
  && textProblem(v.intro, 0, 300) === null && (v.availableFrom === null || isDay(v.availableFrom))
  && optIso(v.promotedAt) && optIso(v.decidedAt) && optIso(v.forwardedAt) && (v.status !== 'forwarded' || isIso(v.forwardedAt))
const isCredit = (v: unknown): v is Credit => isObj(v) && (v.kind === 'post' || v.kind === 'renew' || v.kind === 'pin') && isIso(v.at)
/** data saved before the five-level release (version 1): days → hours, posts released when posted, uses taken from my posts and pins */
function upgrade(raw: Record<string, unknown>): Record<string, unknown> | null {
  if (raw.version === 2) return raw
  if (raw.version !== 1 || typeof raw.dayOffset !== 'number' || !Number.isInteger(raw.dayOffset) || raw.dayOffset < 0 || raw.dayOffset > 60) return null
  const posts = Array.isArray(raw.posts) ? raw.posts.map((p) => (isObj(p) ? { ...withLegacy(p), releasedAt: p.releasedAt ?? p.createdAt } : p)) : raw.posts
  const accs = Array.isArray(raw.acceptances) ? raw.acceptances.map((a) => (isObj(a) ? { intro: '', availableFrom: null, ...a } : a)) : raw.acceptances
  const mine = Array.isArray(posts) ? posts.filter((p) => isObj(p) && p.employerId === MY_EMPLOYER && isIso(p.createdAt)).map((p) => ({ kind: 'post', at: (p as { createdAt: string }).createdAt })) : []
  const pins = isObj(raw.me) && Array.isArray(raw.me.pins) ? raw.me.pins.filter((p) => isObj(p) && isIso(p.at)).map((p) => ({ kind: 'pin', at: (p as { at: string }).at })) : []
  const { dayOffset, ...rest } = raw
  return { ...rest, version: 2, clockHours: (dayOffset as number) * 24, posts, acceptances: accs, credits: [...mine, ...pins] }
}
export function parseState(input: unknown): MatchState | null {
  if (!isObj(input)) return null
  const raw = upgrade(input); if (!raw) return null
  if (!(raw.role === null || raw.role === 'seeker' || raw.role === 'employer')) return null
  if (!intIn(raw.clockHours, 0, MAX_CLOCK_HOURS)) return null
  if (!isSeeker(raw.me) || raw.me.id !== ME || typeof raw.myCompany !== 'string' || raw.myCompany.length > 80) return null
  // data saved before Oct 2026: posts without the new details, no membership flag
  const postsIn = Array.isArray(raw.posts) ? raw.posts.map((p) => (isObj(p) ? withLegacy(p) : p)) : raw.posts
  const member = raw.member === undefined ? false : raw.member
  if (typeof member !== 'boolean') return null
  if (!Array.isArray(raw.seekers) || !raw.seekers.every(isSeeker) || !Array.isArray(postsIn) || !postsIn.every(isPost) || !Array.isArray(raw.acceptances) || !raw.acceptances.every(isAcc)) return null
  if (!Array.isArray(raw.credits) || raw.credits.length > 500 || !raw.credits.every(isCredit)) return null
  const st = { ...(raw as unknown as MatchState), posts: postsIn as Post[], member }
  const posts = new Set(st.posts.map((p) => p.id)), people = new Set([ME, ...st.seekers.map((s) => s.id)])
  if (posts.size !== st.posts.length || people.size !== st.seekers.length + 1) return null
  if (!st.acceptances.every((a) => posts.has(a.postId) && people.has(a.seekerId))) return null
  if (new Set(st.acceptances.map((a) => `${a.postId}|${a.seekerId}`)).size !== st.acceptances.length) return null
  if (!st.posts.every((p) => p.employerId === MY_EMPLOYER || p.employerId.startsWith('employer:'))) return null
  return st
}
export { COUNTRIES }
