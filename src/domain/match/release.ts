// The release of a post to job seekers in five levels, and the weekly allowances (owner, Oct 2026). Pure: no React, no storage.
// The same rules run with the local demo data and with the database (where the pins of others arrive only as anonymous counts).
import { CYCLE_DAYS, EXPIRY_WARN_DAYS, NATIONWIDE_UNTIL_DAYS, PIN_LIFE_DAYS, POST_LIFE_DAYS, ROUNDS, STEP_HOURS,
  type Country, type Industry, type Level, type Post, type Skill } from './types'

export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000
/** what the release needs to know about a pin (no owner): place, field and when it was made */
export interface PinLike { country: Country; province: string; industry: Industry; skills: Skill[]; at: string }

/** a pin counts for a month after it was made */
export const pinActive = (p: Pick<PinLike, 'at'>, now: number) => { const t = Date.parse(p.at); return t <= now && now - t < PIN_LIFE_DAYS * DAY_MS }
/** same field: the pin's industry matches, or the pin shares at least one skill with the post */
export const sameField = (pin: Pick<PinLike, 'industry' | 'skills'>, post: Pick<Post, 'industry' | 'skills'>) => pin.industry === post.industry || pin.skills.some((s) => post.skills.includes(s))
/** which level this pin qualifies for (1 best … 4); null when it is in another country (→ only level 5 reaches it) */
export function ruleOf(pin: PinLike, post: Post): Exclude<Level, 5> | null {
  if (pin.country !== post.country) return null
  const here = pin.province === post.province, field = sameField(pin, post)
  return here && field ? 1 : field ? 2 : here ? 3 : 4
}
/** a seeker's level for a post: the best of their active pins; 5 when none is in that country */
export function matchLevel(post: Post, pins: PinLike[], now: number): Level {
  let best: Level = 5
  for (const p of pins) { if (!pinActive(p, now)) continue; const r = ruleOf(p, post); if (r !== null && r < best) best = r }
  return best
}

const hourOf = (iso: string) => Math.floor(Date.parse(iso) / HOUR_MS) * HOUR_MS
export interface Schedule {
  /** start of this release (posting time or last renewal) */
  start: number
  /** level-1 groups: the hour their pins were made, earliest first (at most 24); group k opens at start + k hours */
  groups: number[]
  /** when each level ends (level 5 ends when the post expires) */
  end1: number; end2: number; end3: number; end4: number
  expiresAt: number; warnAt: number
}
/**
 * Level 1: the pins that match province + field are grouped by the hour they were made; the earliest group gets the post first,
 * every following hour the next group joins (earlier groups keep it), for up to 24 groups; 24 h after the last group opened level 2
 * starts. No matching pin → level 2 at once. Pins made later than the 24 rounds wait for level 2 (they match it too).
 */
export function scheduleOf(post: Post, pool: PinLike[], now: number): Schedule {
  const start = Date.parse(post.releasedAt)
  const lastJoin = start + ROUNDS * HOUR_MS
  const hours = new Set<number>()
  for (const p of pool) if (pinActive(p, now) && Date.parse(p.at) <= lastJoin && ruleOf(p, post) === 1) hours.add(hourOf(p.at))
  const groups = [...hours].sort((a, b) => a - b).slice(0, ROUNDS)
  const end1 = groups.length ? start + (groups.length - 1) * HOUR_MS + STEP_HOURS * HOUR_MS : start
  const end2 = end1 + STEP_HOURS * HOUR_MS, end3 = end2 + STEP_HOURS * HOUR_MS
  const expiresAt = start + POST_LIFE_DAYS * DAY_MS
  return { start, groups, end1, end2, end3, end4: Math.max(end3, start + NATIONWIDE_UNTIL_DAYS * DAY_MS), expiresAt, warnAt: expiresAt - EXPIRY_WARN_DAYS * DAY_MS }
}
/** the level the post has reached at `now`, or 'expired' once its 6 months are over */
export function stageAt(s: Schedule, now: number): Level | 'expired' {
  if (now >= s.expiresAt) return 'expired'
  return now < s.end1 ? 1 : now < s.end2 ? 2 : now < s.end3 ? 3 : now < s.end4 ? 4 : 5
}
export const isExpired = (post: Post, now: number) => now >= Date.parse(post.releasedAt) + POST_LIFE_DAYS * DAY_MS

export interface Reach { level: Level; stage: Level | 'expired'; visible: boolean; /** when it opens for this seeker (null = already open, or not before a later level) */ opensAt: number | null }
/** how far a post may go (owner, Oct 2026): a verified company all five levels, a verified private person up to level 3,
 *  an employer not yet verified levels 1 and 2 only; a post the employer keeps in its own country stops at level 4 */
type CapOf = Pick<Post, 'verified' | 'verifiedAs'> & { domesticOnly?: boolean }
export const levelCap = (post: CapOf): Level => {
  const byTrust: Level = !post.verified ? 2 : post.verifiedAs === 'person' ? 3 : 5
  return post.domesticOnly && byTrust > 4 ? 4 : byTrust
}
export const capStage = (stage: Level | 'expired', post: CapOf): Level | 'expired' => (stage !== 'expired' && stage > levelCap(post) ? levelCap(post) : stage)
/** the level a post has reached now, with the cap for unverified employers */
export const stageOf = (post: Post, pool: PinLike[], now: number) => capStage(stageAt(scheduleOf(post, pool, now), now), post)
/** can this seeker (their own pins) see the post now, and at which level does it reach them */
export function reachFor(post: Post, myPins: PinLike[], pool: PinLike[], now: number): Reach {
  const s = scheduleOf(post, pool, now)
  const stage = capStage(stageAt(s, now), post)
  const level = matchLevel(post, myPins, now)
  if (stage === 'expired') return { level, stage, visible: false, opensAt: null }
  if (level === 1 && stage === 1) {
    // my group: the hour of my earliest matching pin that took part in the rounds
    const mine = myPins.filter((p) => pinActive(p, now) && ruleOf(p, post) === 1).map((p) => s.groups.indexOf(hourOf(p.at))).filter((k) => k >= 0)
    if (!mine.length) return { level, stage, visible: false, opensAt: s.end1 }
    const opens = s.start + Math.min(...mine) * HOUR_MS
    return { level, stage, visible: now >= opens, opensAt: now >= opens ? null : opens }
  }
  const visible = level <= stage
  const opensAt = visible || level > levelCap(post) ? null : level === 2 ? s.end1 : level === 3 ? s.end2 : level === 4 ? s.end3 : s.end4
  return { level, stage, visible, opensAt }
}

/* ---------- weekly allowances: a cycle starts with its first use and lasts 7 days; then everything comes back ---------- */
export interface Quota { used: number; limit: number; left: number; /** when the allowance comes back (null = no cycle running) */ resetAt: number | null }
export function cycleQuota(uses: string[], now: number, limit: number): Quota {
  let start: number | null = null, n = 0
  for (const t of uses.map((u) => Date.parse(u)).filter((t) => t <= now).sort((a, b) => a - b)) {
    if (start === null || t >= start + CYCLE_DAYS * DAY_MS) { start = t; n = 1 } else n++
  }
  if (start === null || now >= start + CYCLE_DAYS * DAY_MS) return { used: 0, limit, left: limit, resetAt: null }
  return { used: n, limit, left: Math.max(0, limit - n), resetAt: start + CYCLE_DAYS * DAY_MS }
}
