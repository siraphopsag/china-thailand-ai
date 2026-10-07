// Pure rules of the matching prototype (no React, no storage): pins, posts, weekly allowances, applications and the reservation
// queue, renewals, and the validation of stored data. The release levels live in release.ts.
import { isObj } from '../../profileSchema'
import { provinces } from '../../locales/provinces'
import { BENEFITS, COUNTRIES, CURRENCIES, EDU, EMPLOYMENT, EXPIRY_WARN_DAYS, FREE_POSTS_PER_WEEK, HOLDS_PLACE, MEMBER_PINS_PER_WEEK, MEMBER_WARN_DAYS, PLANS, type PlanId, INDUSTRIES, LANGS, LANG_LEVELS, MAX_CLOCK_HOURS, ME, MEMBER_POSTS_PER_WEEK, MY_EMPLOYER,
  PINS_PER_WEEK, POST_LIFE_DAYS, SKILLS, type Acceptance, type AppStatus, type Benefit, type Country, type Credit, type Edu, type Employment, type Industry, type LanguageSkill, type MatchState,
  type Pin, type Place, type Post, type Salary, type Seeker, type Skill, type VerifyKind } from './types'
import { DAY_MS, HOUR_MS, cycleQuota, isExpired, pinActive, reachFor, type PinLike } from './release'
import { currentStep, lastUpdate, newCase, parseCase, type Case } from './cases'
import { parseReports, reportedIds } from './reports'
import { isMobile, isRegNo, phoneLast4 } from './verify'

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

/** the calendar day (YYYY-MM-DD) of a moment in the visitor's own time zone — date pickers work in local days, not UTC */
export const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const isCountry = (v: unknown): v is Country => v === 'TH' || v === 'CN'
/** a first-level division code of that country that exists on the map (e.g. TH-50, CN-SH) */
export const isProvinceOf = (c: Country, v: unknown): v is string => typeof v === 'string' && v.startsWith(c + '-') && `prov.${v}` in provinces
export const isPlace = (v: unknown): v is Place => isObj(v) && isCountry(v.country) && isProvinceOf(v.country, v.province)
const isIndustry = (v: unknown): v is Industry => typeof v === 'string' && (INDUSTRIES as readonly string[]).includes(v)
const isSkills = (v: unknown): v is Skill[] => Array.isArray(v) && v.length > 0 && v.length <= SKILLS.length && v.every((s) => (SKILLS as readonly string[]).includes(s)) && new Set(v).size === v.length
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9:_-]{1,40}$/.test(v)

export type Problem = 'place' | 'industry' | 'skills' | 'limit' | 'duplicate' | 'company' | 'position' | 'details' | 'years' | 'contact' | 'notOpen' | 'already' | 'unknown'
  | 'headcount' | 'employment' | 'salary' | 'startDate' | 'languages' | 'education' | 'benefits' | 'quota' | 'network' | 'intro' | 'available' | 'state' | 'belowHeld' | 'dbOld' | 'regNo' | 'caseStarted' | 'caseText' | 'departDate' | 'reported' | 'reportLimit' | 'reportNote' | 'suspended' | 'phone' | 'code'
const oneOf = <T extends string>(all: readonly T[], v: unknown): v is T => typeof v === 'string' && (all as readonly string[]).includes(v)
const VERIFY_KINDS: readonly VerifyKind[] = ['company', 'person']
const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const isLangs = (v: unknown): v is LanguageSkill[] => Array.isArray(v) && v.length <= LANGS.length && v.every((l) => isObj(l) && Object.keys(l).length === 2 && oneOf(LANGS, l.lang) && oneOf(LANG_LEVELS, l.level))
  && new Set(v.map((l) => (l as LanguageSkill).lang)).size === v.length
const isBenefits = (v: unknown): v is Benefit[] => Array.isArray(v) && v.every((b) => oneOf(BENEFITS, b)) && new Set(v).size === v.length
const isSalary = (v: unknown): v is Salary => isObj(v) && Object.keys(v).length === 3 && intIn(v.min, 1, 10_000_000) && intIn(v.max, 1, 10_000_000) && oneOf(CURRENCIES, v.currency)
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'))
/** a real day, not before `at`'s day, at most two years ahead */
const dayWithin = (v: unknown, at: string): v is string => { const day = localDay(at); return isDay(v) && v >= day && Date.parse(v) <= Date.parse(day) + 731 * DAY_MS }
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: Problem }
const fail = <T,>(problem: Problem): Outcome<T> => ({ ok: false, problem })
const text = (v: unknown, min: number, max: number, field: Problem): Problem | null => { const p = textProblem(v, min, max); return p === null ? null : p === 'contact' ? 'contact' : field }

/* ---------- weekly allowances (owner, Oct 2026): a cycle starts with its first use; after 7 days the full allowance is back ---------- */
/** a membership counts until its end date (memberships from before the plans have none) */
export const memberActive = (st: MatchState, now: number) => st.member && (!st.memberUntil || Date.parse(st.memberUntil) > now)
export const postLimit = (st: MatchState, now: number) => (st.unlimited ? Infinity : memberActive(st, now) ? MEMBER_POSTS_PER_WEEK : FREE_POSTS_PER_WEEK)
/** new posts and renewals share one allowance */
export const postQuota = (st: MatchState, now: number) => cycleQuota(st.credits.filter((c) => c.kind !== 'pin').map((c) => c.at), now, postLimit(st, now))
export const pinQuota = (st: MatchState, now: number) => cycleQuota(st.credits.filter((c) => c.kind === 'pin').map((c) => c.at), now, st.unlimited ? Infinity : memberActive(st, now) ? MEMBER_PINS_PER_WEEK : PINS_PER_WEEK)
/** taking a plan: it runs from now, or adds on to a membership that is still running */
export function planUntil(st: MatchState, plan: PlanId, now: number): string {
  const months = PLANS.find((p) => p.id === plan)!.months
  const from = new Date(memberActive(st, now) && st.memberUntil ? Math.max(now, Date.parse(st.memberUntil)) : now)
  from.setUTCMonth(from.getUTCMonth() + months)
  return from.toISOString()
}
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
  if (!st.unlimited && activePins(st.me, now).some((p) => p.country === input.place.country && p.province === input.place.province && p.industry === input.industry)) return fail('duplicate')
  const pin: Pin = { id, country: input.place.country, province: input.place.province, industry: input.industry, skills: [...input.skills], at }
  return { ok: true, value: { ...st.me, pins: [...activePins(st.me, now), pin] } }
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
    country: input.place.country, province: input.place.province, createdAt: at, releasedAt: at, verified: false, synthetic: true } }
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
export const offersFor = (st: MatchState, pool: PinLike[], now: number) => { const reported = reportedIds(st); return st.posts
  .filter((p) => p.employerId !== MY_EMPLOYER && !reported.has(p.id) && reachFor(p, st.me.pins, pool, now).visible)
  .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt)) }
/** what a post still shows after its 6 months: nothing (the post and its applications are removed) */
export const hasOpenCase = (st: MatchState, postId: string) => st.cases.some((c) => c.postId === postId && currentStep(c) !== null)
export const withoutExpired = (st: MatchState, now: number): MatchState => {
  const gone = (p: Post) => isExpired(p, now) && !hasOpenCase(st, p.id) // a case still running keeps its post (it can take months)
  if (!st.posts.some(gone)) return st
  const posts = st.posts.filter((p) => !gone(p)), ids = new Set(posts.map((p) => p.id))
  return { ...st, posts, acceptances: st.acceptances.filter((a) => ids.has(a.postId)), cases: st.cases.filter((c) => ids.has(c.postId)) }
}
/** a post whose case the agency has taken (and that has not finished) cannot be deleted by its employer */
export const caseBlocksDelete = (st: MatchState, postId: string) => st.cases.some((c) => c.postId === postId && !!c.steps.accepted && !c.steps.arrived)
/** my posts carry my verification (local demo); in the database it is kept on each post */
export const employerVerified = (st: MatchState) => st.employerVerify?.status === 'verified'
/** the employer confirms: a case opens and goes to the agency at once if the employer is verified (then the application reads "forwarded") */
export function openCaseFor(st: MatchState, accs: Acceptance[], accId: string, caseId: string, at: string): { acceptances: Acceptance[]; cases: Case[] } {
  const a = accs.find((x) => x.id === accId)
  const post = a && st.posts.find((p) => p.id === a.postId)
  if (!a || !post || a.status !== 'confirmed' || st.cases.some((c) => c.accId === accId)) return { acceptances: accs, cases: st.cases }
  const verified = post.employerId === MY_EMPLOYER ? employerVerified(st) : post.verified
  const c = newCase(caseId, a, at, verified)
  return { acceptances: verified ? accs.map((x) => (x.id === accId ? { ...x, status: 'forwarded' as const, forwardedAt: at } : x)) : accs, cases: [...st.cases, c] }
}
/** a registration number for verification: right form and check digit, then it waits for approval */
export function requestVerify(country: Country, regNo: string, at: string): Outcome<NonNullable<MatchState['employerVerify']>> {
  if (!isCountry(country) || !isRegNo(country, regNo)) return fail('regNo')
  return { ok: true, value: { kind: 'company', country, regNo, status: 'pending', at } }
}
/** a private person: a mobile number confirmed with a code; only its last 4 digits go on (owner, Oct 2026) */
export function requestPersonVerify(country: Country, phone: string, at: string): Outcome<NonNullable<MatchState['employerVerify']>> {
  if (!isCountry(country) || !isMobile(country, phone)) return fail('phone')
  return { ok: true, value: { kind: 'person', country, regNo: '', phone4: phoneLast4(phone), status: 'pending', at } }
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
  if (st.cases.some((c) => c.accId === accId && (c.steps.submitted || c.steps.accepted))) return fail('caseStarted')
  if (a.status === 'forwarded' || a.status === 'rejected') return fail('state')
  const post = st.posts.find((p) => p.id === a.postId)
  const next = st.acceptances.filter((x) => x.id !== accId)
  return { ok: true, value: post ? promote(next, post, at) : next }
}
/** simulated: the admin marks a confirmed case as forwarded to the employment authority; no data leaves the browser */
export const forward = (a: Acceptance, at: string): Acceptance => (a.status === 'confirmed' ? { ...a, status: 'forwarded', forwardedAt: at } : a)

/* ---------- validation of stored data (never trust the browser) ----------
 * Bug hunt, Oct 2026: one bad or out-of-range item used to throw away the whole saved demo (role, posts, pins, applications).
 * Now each item is checked on its own and only the bad ones are dropped; only a broken frame (version, "me") starts over. */
const MAX_STORED_PINS = MEMBER_PINS_PER_WEEK * 6 // a month of pins at ten a week (members), with room — the newest are kept
const isPin = (v: unknown): v is Pin => isPlace(v) && isObj(v) && isId(v.id) && isIndustry(v.industry) && isSkills(v.skills) && isIso(v.at)
const pinsOf = (v: unknown): Pin[] => (Array.isArray(v) ? v.filter(isPin).sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX_STORED_PINS).reverse() : [])
const isSeekerFrame = (v: unknown): v is Seeker => isObj(v) && isId(v.id) && typeof v.name === 'string' && v.name.length <= 40 && (v.origin === null || isPlace(v.origin)) && v.synthetic === true
const seekerOf = (v: unknown): Seeker | null => (isSeekerFrame(v) ? { ...v, pins: pinsOf(v.pins) } : null)
/** a post saved before Oct 2026 has none of the new details: they read as "not stated" */
const LEGACY = { headcount: null, employment: null, salary: null, startDate: null, languages: [], education: 'none', benefits: [] } as const
const withLegacy = (v: Record<string, unknown>): Record<string, unknown> => ('headcount' in v ? v : { ...v, ...LEGACY, languages: [], benefits: [] })
const isLegacyDetails = (v: Record<string, unknown>) => v.headcount === null && v.employment === null && v.salary === null && v.startDate === null
  && Array.isArray(v.languages) && v.languages.length === 0 && v.education === 'none' && Array.isArray(v.benefits) && v.benefits.length === 0
const isPost = (v: unknown): v is Post => {
  if (!isPlace(v) || !isObj(v) || !isId(v.id) || !isId(v.employerId) || !isIso(v.createdAt) || !isIso(v.releasedAt) || Date.parse(v.releasedAt) < Date.parse(v.createdAt) || v.synthetic !== true) return false
  if (!(v.employerId === MY_EMPLOYER || v.employerId.startsWith('employer:'))) return false
  const base = { ...(v as unknown as PostInput), place: { country: v.country, province: v.province } }
  // the original fields are checked with the same rules as a new post; the new details either all present and valid, or all "not stated"
  if (isLegacyDetails(v)) return makePost({ ...base, headcount: 1, employment: 'permanent', salary: null, startDate: localDay(v.createdAt), languages: [{ lang: 'th', level: 'basic' }], education: 'none', benefits: [] }, 'x', 'y', v.createdAt).ok
  // the start date was checked when it was saved (against that day); here any real day is fine, so an edit cannot break a reload
  return typeof v.verified === 'boolean' && isDay(v.startDate) && makePost({ ...base, startDate: localDay(v.createdAt) }, 'x', 'y', v.createdAt).ok
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
  if (raw.version !== 1) return null
  const days = typeof raw.dayOffset === 'number' && Number.isInteger(raw.dayOffset) && raw.dayOffset >= 0 && raw.dayOffset <= 60 ? raw.dayOffset : 0
  const posts = Array.isArray(raw.posts) ? raw.posts.map((p) => (isObj(p) ? { ...withLegacy(p), releasedAt: p.releasedAt ?? p.createdAt } : p)) : raw.posts
  const accs = Array.isArray(raw.acceptances) ? raw.acceptances.map((a) => (isObj(a) ? { intro: '', availableFrom: null, ...a } : a)) : raw.acceptances
  const mine = Array.isArray(posts) ? posts.filter((p) => isObj(p) && p.employerId === MY_EMPLOYER && isIso(p.createdAt)).map((p) => ({ kind: 'post', at: (p as { createdAt: string }).createdAt })) : []
  const pins = isObj(raw.me) && Array.isArray(raw.me.pins) ? raw.me.pins.filter((p) => isObj(p) && isIso(p.at)).map((p) => ({ kind: 'pin', at: (p as { at: string }).at })) : []
  const { dayOffset: _d, ...rest } = raw
  return { ...rest, version: 2, clockHours: days * 24, posts, acceptances: accs, credits: [...mine, ...pins] }
}
export function parseState(input: unknown): MatchState | null {
  if (!isObj(input)) return null
  const raw = upgrade(input); if (!raw) return null
  const me = seekerOf(raw.me); if (!me || me.id !== ME) return null
  const seekers = (Array.isArray(raw.seekers) ? raw.seekers.map(seekerOf) : []).filter((s): s is Seeker => !!s && s.id !== ME)
    .filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i)
  // data saved before Oct 2026: posts without the new details
  // posts saved before verification existed: samples count as verified, my own as not yet
  const posts = (Array.isArray(raw.posts) ? raw.posts.map((p) => (isObj(p) ? { ...withLegacy(p), verified: typeof p.verified === 'boolean' ? p.verified : p.employerId !== MY_EMPLOYER, verifiedAs: oneOf(VERIFY_KINDS, p.verifiedAs) ? p.verifiedAs : undefined, sample: p.employerId !== MY_EMPLOYER } : p)) : []).filter(isPost)
    .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i)
  const postIds = new Set(posts.map((p) => p.id)), people = new Set([ME, ...seekers.map((s) => s.id)])
  const seen = new Set<string>()
  const acceptances = (Array.isArray(raw.acceptances) ? raw.acceptances : []).filter(isAcc)
    .filter((a) => { const k = `${a.postId}|${a.seekerId}`; if (!postIds.has(a.postId) || !people.has(a.seekerId) || seen.has(k)) return false; seen.add(k); return true })
  const credits = (Array.isArray(raw.credits) ? raw.credits.filter(isCredit) : []).sort((a, b) => a.at.localeCompare(b.at)).slice(-500)
  const accIds = new Set(acceptances.map((a) => a.id))
  const cases = (Array.isArray(raw.cases) ? raw.cases.map(parseCase) : []).filter((c): c is Case => !!c && accIds.has(c.accId) && postIds.has(c.postId))
    .filter((c, i, all) => all.findIndex((x) => x.accId === c.accId) === i)
  const ev = raw.employerVerify
  // a company (registration number) or, from Oct 2026, a private person (last 4 digits of a phone); saved before: a company
  const person = isObj(ev) && ev.kind === 'person'
  const employerVerify = isObj(ev) && isCountry(ev.country) && (person ? typeof ev.phone4 === 'string' && /^\d{4}$/.test(ev.phone4) : typeof ev.regNo === 'string' && isRegNo(ev.country, ev.regNo))
    && (ev.status === 'pending' || ev.status === 'verified' || ev.status === 'rejected') && isIso(ev.at)
    ? { kind: person ? 'person' : 'company', country: ev.country, regNo: person ? '' : ev.regNo, ...(person ? { phone4: ev.phone4 } : {}), status: ev.status, at: ev.at, ...(isIso(ev.decidedAt) ? { decidedAt: ev.decidedAt } : {}) } as MatchState['employerVerify'] : null
  return {
    version: 2,
    role: raw.role === 'seeker' || raw.role === 'employer' ? raw.role : null,
    clockHours: intIn(raw.clockHours, 0, MAX_CLOCK_HOURS) ? raw.clockHours : 0,
    me, myCompany: typeof raw.myCompany === 'string' && raw.myCompany.length <= 80 ? raw.myCompany : '',
    member: raw.member === true, memberUntil: isIso(raw.memberUntil) ? raw.memberUntil : null, seekers, posts, acceptances, credits, cases, employerVerify,
    reports: parseReports(raw.reports, postIds),
  }
}
/** "Back to real time" (demo): anything stamped later than now is moved to now, so nothing made while the clock ran ahead disappears */
export function clampFuture(st: MatchState, now: number): MatchState {
  const iso = new Date(now).toISOString()
  const fix = (t: string) => (Date.parse(t) > now ? iso : t)
  const fixOpt = (t: string | undefined) => (t === undefined ? t : fix(t))
  const pins = (s: Seeker): Seeker => ({ ...s, pins: s.pins.map((p) => ({ ...p, at: fix(p.at) })) })
  return {
    ...st, clockHours: 0, me: pins(st.me), seekers: st.seekers.map(pins),
    posts: st.posts.map((p) => ({ ...p, createdAt: fix(p.createdAt), releasedAt: fix(p.releasedAt) })),
    acceptances: st.acceptances.map((a) => ({ ...a, at: fix(a.at), promotedAt: fixOpt(a.promotedAt), decidedAt: fixOpt(a.decidedAt), forwardedAt: fixOpt(a.forwardedAt) })),
    credits: st.credits.map((c) => ({ ...c, at: fix(c.at) })),
    reports: st.reports.map((r) => ({ ...r, at: fix(r.at) })),
    cases: st.cases.map((c) => ({ ...c, createdAt: fix(c.createdAt), steps: Object.fromEntries(Object.entries(c.steps).map(([k, v]) => [k, v ? fix(v) : v])) })),
  }
}
/**
 * What the notifications page lists — the bell shows the same count (bug hunt, Oct 2026: they did not match).
 * Seeker: posts open to me that I have not applied to (only once I have pins) + news about my applications.
 * Employer: applicants waiting for my decision, posts with reservations, posts about to expire.
 */
export function inbox(st: MatchState, pool: PinLike[], now: number, reservedOf: (postId: string) => number) {
  const applied = new Set(st.acceptances.filter((a) => a.seekerId === ME).map((a) => a.postId))
  const hasPins = activePins(st.me, now).length > 0
  const offers = st.role === 'seeker' && hasPins ? offersFor(st, pool, now).filter((p) => !applied.has(p.id)) : []
  // an application with a case is followed through the case (its news counts there, not here)
  const updates = st.role === 'seeker' ? st.acceptances.filter((a) => a.seekerId === ME && !st.cases.some((c) => c.accId === a.id) && (a.status === 'confirmed' || a.status === 'rejected' || a.status === 'forwarded' || (a.status === 'accepted' && !!a.promotedAt))) : []
  const mine = st.role === 'employer' ? st.posts.filter((p) => p.employerId === MY_EMPLOYER) : []
  const ids = new Set(mine.map((p) => p.id))
  const waiting = st.acceptances.filter((a) => ids.has(a.postId) && a.status === 'accepted')
  const reserved = mine.filter((p) => reservedOf(p.id) > 0)
  const expiring = mine.filter((p) => now >= Date.parse(p.releasedAt) + (POST_LIFE_DAYS - EXPIRY_WARN_DAYS) * DAY_MS)
  // a membership ending within a week (both roles)
  const memberEnds = memberActive(st, now) && st.memberUntil && Date.parse(st.memberUntil) - now <= MEMBER_WARN_DAYS * DAY_MS ? Date.parse(st.memberUntil) : null
  const myCases = st.cases.filter((c) => (st.role === 'seeker' && c.seekerId === ME) || (st.role === 'employer' && ids.has(c.postId)))
  const caseNews = myCases.filter((c) => currentStep(c) !== null && (now - Date.parse(lastUpdate(c)) < 3 * DAY_MS || (st.role === 'employer' && currentStep(c) === 'arrived')))
  return { hasPins, offers, updates, waiting, reserved, expiring, memberEnds, cases: myCases, caseNews,
    count: offers.length + updates.length + waiting.length + reserved.length + expiring.length + (memberEnds ? 1 : 0) + caseNews.length }
}
export { COUNTRIES }
