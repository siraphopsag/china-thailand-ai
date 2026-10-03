import type { Citation, LegalEntry, LegalReview, Observation, ReasonCode, Trust, TrustResult } from './types.js'
import type { Verification } from '../../types/index.js'
import { registry, getEntry } from './registry.js'
import { reviews as liveReviews } from './reviews.js'
import { observed as liveObserved } from './observed.js'
import { messages, type MsgKey } from '../../locales/index.js'
import { tr, type Lang } from '../../i18n/core.js'

/** A review older than this is treated as out of date. */
export const MAX_REVIEW_AGE_DAYS = 90
/** If the change-monitor has produced no observation for this long, "we would have noticed a change" is no longer true. */
export const MAX_MONITOR_AGE_DAYS = 30
const DAY = 86_400_000

/** Fast non-cryptographic fingerprint (cyrb53). Only detects accidental/unreviewed edits of the summary text; it is not a security hash. */
export function fingerprint(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

const FIELDS = ['auth', 'topic', 'title', 'rule'] as const
/** The user-visible summary text of a record in one language ('' if the record has none, e.g. coverage gaps). */
export function localText(id: string, field: (typeof FIELDS)[number], lang?: Lang): string {
  const k = `reg.${id}.${field}`
  return k in messages ? tr(k as MsgKey, undefined, lang) : ''
}
/** Every word of the summary in all three languages — what a reviewer signs off on. */
export const summaryText = (id: string) => (['th', 'zh', 'en'] as const).flatMap((l) => FIELDS.map((f) => localText(id, f, l))).join('\n')
export const contentFingerprint = (id: string) => fingerprint(summaryText(id))

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
const isHash = (s: unknown): s is string => typeof s === 'string' && s.length >= 8

/**
 * The single rule that decides whether a legal record may be presented as verified. Pure: all inputs are passed in.
 * Fails closed — every doubt lowers trust, nothing machine-made can raise it (only a human review entry can).
 */
export function assessWith(entry: LegalEntry | undefined, review: LegalReview | undefined, obs: Observation | undefined, fp: string, now: Date): TrustResult {
  const id = entry?.id ?? ''
  if (!entry) return { id, trust: 'NO_RECORD', reasons: ['no-entry'] }
  const base = { id: entry.id, observation: obs }
  if (entry.gap) return { ...base, trust: 'GAP', reasons: ['gap'] }
  if (!review) return { ...base, trust: 'UNVERIFIED', reasons: ['no-review'] }
  const ageDays = isDate(review.reviewedAt) ? Math.floor((now.getTime() - Date.parse(review.reviewedAt)) / DAY) : NaN
  const valid = review.id === entry.id && typeof review.reviewer === 'string' && review.reviewer.trim().length >= 3 && Number.isFinite(ageDays) && ageDays >= -1 && isHash(review.contentHash)
  if (!valid) return { ...base, review, trust: 'UNVERIFIED', reasons: ['bad-review'] }
  const r = { ...base, review, ageDays }
  // Nothing to compare the summary against: no official text link, or a link the admin has never monitored/hashed.
  const unverifiable: ReasonCode[] = []
  if (!entry.textUrl || !/^https:\/\//.test(entry.textUrl)) unverifiable.push('no-text-url')
  if (entry.watch && !isHash(review.sourceHash)) unverifiable.push('no-source-hash')
  if (unverifiable.length) return { ...r, trust: 'UNVERIFIED', reasons: unverifiable }
  const changed: ReasonCode[] = []
  if (review.contentHash !== fp) changed.push('summary-edited')
  if (entry.watch && obs?.hash && review.sourceHash !== obs.hash) changed.push('source-changed')
  if (changed.length) return { ...r, trust: 'CHANGED', reasons: changed }
  const stale: ReasonCode[] = []
  if (ageDays > MAX_REVIEW_AGE_DAYS) stale.push('review-old')
  if (entry.watch && (!obs?.hash || !(Date.parse(obs.at) >= now.getTime() - MAX_MONITOR_AGE_DAYS * DAY))) stale.push('monitor-stale')
  if (stale.length) return { ...r, trust: 'STALE', reasons: stale }
  return { ...r, trust: 'VERIFIED', reasons: [] }
}

export const assess = (id: string, now = new Date()): TrustResult =>
  assessWith(getEntry(id), liveReviews.find((x) => x.id === id), liveObserved[id], contentFingerprint(id), now)

/** Map the detailed trust state to the status chips the UI already knows. Only VERIFIED ever shows as verified. */
export const toVerification = (t: Trust): Verification =>
  ({ VERIFIED: 'VERIFIED', UNVERIFIED: 'EXPERT', STALE: 'STALE', CHANGED: 'CHANGED', NO_RECORD: 'NO_SOURCE', GAP: 'NO_SOURCE' } as const)[t]


export interface LegalView {
  has(id: string): boolean
  cite(id: string, lang?: Lang): Citation | undefined
  /** All-language summary text of a record, used to check that an answer quotes only what a reviewer approved. */
  text(id: string): string
}
/** Build a view over arbitrary data (tests inject fixtures; production uses `liveLegal`). */
export function makeLegalView(entries: LegalEntry[], revs: LegalReview[], obs: Record<string, Observation>, now: () => Date = () => new Date()): LegalView {
  const find = (id: string) => entries.find((x) => x.id === id)
  return {
    has: (id) => !!find(id),
    text: (id) => summaryText(id),
    cite(id, lang) {
      const en = find(id)
      if (!en) return undefined
      const rv = revs.find((x) => x.id === id)
      const t = assessWith(en, rv, obs[id], contentFingerprint(id), now())
      return {
        id, jurisdiction: en.country, authority: localText(id, 'auth', lang), title: localText(id, 'title', lang) || en.instrument || en.originalTerm || id,
        instrument: en.instrument, provisions: rv?.provisions ?? [], effectiveDate: rv?.effectiveDate, textUrl: en.textUrl, agencyUrl: en.agencyUrl,
        trust: t.trust, reasons: t.reasons, reviewedBy: rv?.reviewer, reviewedAt: rv?.reviewedAt, monitored: en.watch && !!en.textUrl,
      }
    },
  }
}
export const liveLegal: LegalView = makeLegalView(registry, liveReviews, liveObserved)

