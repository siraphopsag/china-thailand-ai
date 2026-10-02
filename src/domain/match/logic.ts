// Pure rules of the matching prototype (no React, no storage): pins, posts, the step-by-step release and acceptances.
import { isObj } from '../../profileSchema'
import { provinces } from '../../locales/provinces'
import { textProblem } from '../jobboard/validate'
import { COUNTRIES, INDUSTRIES, MAX_PINS, ME, MY_EMPLOYER, SKILLS, type Acceptance, type Country, type Industry, type MatchState, type Pin, type Place, type Post, type Seeker, type Skill, type Tier } from './types'

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
export interface PostInput { place: Place; company: string; position: string; industry: Industry; skills: Skill[]; minYears: number; details: string }
export function makePost(input: PostInput, id: string, employerId: string, at: string): Outcome<Post> {
  if (!isPlace(input.place)) return fail('place')
  const t = text(input.company, 2, 80, 'company') ?? text(input.position, 3, 80, 'position') ?? text(input.details, 0, 600, 'details')
  if (t) return fail(t)
  if (!isIndustry(input.industry)) return fail('industry')
  if (!isSkills(input.skills)) return fail('skills')
  if (!Number.isInteger(input.minYears) || input.minYears < 0 || input.minYears > 40) return fail('years')
  return { ok: true, value: { id, employerId, company: input.company, position: input.position, industry: input.industry, skills: [...input.skills], minYears: input.minYears, details: input.details,
    country: input.place.country, province: input.place.province, createdAt: at, synthetic: true } }
}

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
const isPost = (v: unknown): v is Post => isPlace(v) && isObj(v) && isId(v.id) && isId(v.employerId) && isIso(v.createdAt) && v.synthetic === true
  && makePost({ ...(v as unknown as PostInput), place: { country: v.country, province: v.province } }, 'x', 'y', 'z').ok
const isAcc = (v: unknown): v is Acceptance => isObj(v) && isId(v.id) && isId(v.postId) && isId(v.seekerId) && isIso(v.at) && (v.status === 'accepted' || (v.status === 'forwarded' && isIso(v.forwardedAt)))
export function parseState(raw: unknown): MatchState | null {
  if (!isObj(raw) || raw.version !== 1) return null
  if (!(raw.role === null || raw.role === 'seeker' || raw.role === 'employer')) return null
  if (typeof raw.dayOffset !== 'number' || !Number.isInteger(raw.dayOffset) || raw.dayOffset < 0 || raw.dayOffset > 60) return null
  if (!isSeeker(raw.me) || raw.me.id !== ME || typeof raw.myCompany !== 'string' || raw.myCompany.length > 80) return null
  if (!Array.isArray(raw.seekers) || !raw.seekers.every(isSeeker) || !Array.isArray(raw.posts) || !raw.posts.every(isPost) || !Array.isArray(raw.acceptances) || !raw.acceptances.every(isAcc)) return null
  const st = raw as unknown as MatchState
  const posts = new Set(st.posts.map((p) => p.id)), people = new Set([ME, ...st.seekers.map((s) => s.id)])
  if (posts.size !== st.posts.length || people.size !== st.seekers.length + 1) return null
  if (!st.acceptances.every((a) => posts.has(a.postId) && people.has(a.seekerId))) return null
  if (!st.posts.every((p) => p.employerId === MY_EMPLOYER || p.employerId.startsWith('employer:'))) return null
  return st
}
export { COUNTRIES }
