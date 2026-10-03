import type { ReasonCode, Trust } from '../data/legal/types'
export type Verification = 'VERIFIED' | 'PARTIAL' | 'NEED_INFO' | 'NO_SOURCE' | 'EXPERT' | 'STALE' | 'CHANGED'

/** A legal source shown on the Legal sources page (built from data/legal; trust is derived, never set by hand). */
export interface Regulation {
  id: string
  country: 'TH' | 'CN'
  originalTerm?: string
  instrument?: string
  /** Where the "open source" link goes: the official text when an admin has supplied one, else the agency home page. */
  sourceUrl: string
  agencyUrl: string
  textUrl?: string
  publicationDate?: string
  effectiveDate?: string // only ever set from a human review
  provisions?: string[] // only ever set from a human review
  lastVerified?: string // date of the last human review; undefined = never reviewed
  reviewedBy?: string
  verificationStatus: Verification // derived from trust (data/legal/trust.ts), never set by hand
  trust: Trust
  trustReasons: ReasonCode[]
  monitored: boolean
  isSample: boolean
  supersededBy?: string
}

