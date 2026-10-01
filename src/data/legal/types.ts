/** Trust model for legal information. A record is only "VERIFIED" when a named human reviewed it against the
 *  official text AND nothing has changed since (summary text, official source, time). Everything else fails closed. */
export type Trust = 'VERIFIED' | 'UNVERIFIED' | 'STALE' | 'CHANGED' | 'NO_RECORD' | 'GAP'
export type ReasonCode =
  | 'no-review' | 'bad-review' | 'no-text-url' | 'no-source-hash' | 'summary-edited' | 'source-changed' | 'review-old' | 'monitor-stale' | 'gap' | 'no-entry'

export type Area = 'investment' | 'employment' | 'immigration' | 'tax' | 'customs'

/** One known legal topic/instrument. Display text (authority/topic/title/rule in TH/ZH/EN) lives in locales (reg.<id>.*). */
export interface LegalEntry {
  id: string
  country: 'TH' | 'CN'
  area: Area
  /** Official name of the instrument in its original language — filled only where the record clearly rests on one law. */
  instrument?: string
  originalTerm?: string
  /** Agency home page: context only, NOT the legal text. */
  agencyUrl: string
  /** Deep link to the official text (Royal Gazette / Council of State / NPC law database / ministry notice). Added by an admin. */
  textUrl?: string
  /** true = scripts/legal-watch.ts fetches textUrl and compares a hash. Requires textUrl. */
  watch: boolean
  /** true = the instrument is known by name only; the app has no reviewed summary for it yet. */
  gap?: boolean
}

/** A named human's sign-off. Bound to the exact summary text and (when monitored) the exact source version they checked. */
export interface LegalReview {
  id: string
  reviewer: string // name + role, e.g. "Name Surname, Thai labour lawyer"
  reviewedAt: string // YYYY-MM-DD
  contentHash: string // fingerprint of the summary text that was reviewed
  sourceHash?: string // hash of the official text when reviewed (required when the entry is monitored)
  effectiveDate?: string
  provisions?: string[]
  note?: string
}

/** Machine observation written by scripts/legal-watch.ts. It can only ever lower trust, never raise it. */
export interface Observation { at: string; ok: boolean; status?: number; hash?: string; bytes?: number; error?: string }

export interface TrustResult {
  id: string
  trust: Trust
  reasons: ReasonCode[]
  review?: LegalReview
  observation?: Observation
  ageDays?: number
}

/** What an answer shows for each legal source. */
export interface Citation {
  id: string
  jurisdiction: 'TH' | 'CN'
  authority: string
  title: string
  instrument?: string
  provisions: string[]
  effectiveDate?: string
  textUrl?: string
  agencyUrl: string
  trust: Trust
  reasons: ReasonCode[]
  reviewedBy?: string
  reviewedAt?: string
  monitored: boolean
}
