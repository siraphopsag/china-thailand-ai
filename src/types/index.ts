import type { Citation, ReasonCode, Trust } from '../data/legal/types'
export type Direction = 'TH_CN' | 'CN_TH'
export type Level = 'LOW' | 'MEDIUM' | 'HIGH' | 'NEEDS_REVIEW'
export type Verification = 'VERIFIED' | 'PARTIAL' | 'NEED_INFO' | 'NO_SOURCE' | 'EXPERT' | 'STALE' | 'CHANGED'
/** todo = not started · doing = in progress · waitdoc = waiting for document · waitver = waiting for verification · review = needs review · done = completed · fix = needs fixing */
export type StepStatus = 'todo' | 'doing' | 'waitdoc' | 'waitver' | 'review' | 'done' | 'fix'
export type Tri = 'yes' | 'no' | 'unknown'
export type Side = 'origin' | 'partner'

/** ผู้ถือหุ้น: origin = ฝั่งประเทศต้นทาง (เป็นต่างชาติในประเทศเป้าหมาย), partner = ฝั่งท้องถิ่นของประเทศเป้าหมาย */
export interface Holder {
  id: Side
  nationality: 'TH' | 'CN'
  percent: number // สัดส่วนหุ้น
  capital: number // สัดส่วนเงินลงทุนที่ผู้ถือหุ้นรายนี้เป็นผู้จัดหา
  voting: number // สัดส่วนสิทธิออกเสียง
  board: number // สัดส่วนกรรมการที่ผู้ถือหุ้นรายนี้แต่งตั้ง
  economic: number // สัดส่วนสิทธิประโยชน์ทางเศรษฐกิจ (เงินปันผล/ผลกำไร)
}

/** Fields holding option ids (forms, businessType, ...) are language-neutral; free text may be a "@token" resolved via dv(). */
export interface Profile {
  companyName: string
  direction: Direction
  businessType: string // id: manufacturing | retail | service | food | tech | other
  businessTypeOther?: string
  activity: string
  forms: string[] // ids: company | invest | goods | hire | send | partner | other
  investmentRange: string // id: lt10 | 10to50 | gt50 | unknown | ''
  employees: number
  crossBorderWorkers: boolean
  holders: Holder[]
  realInvestor: 'origin' | 'partner' | 'shared' | 'unknown'
  operator: 'origin' | 'partner' | 'joint' | 'unknown'
  sideAgreement: Tri
  products: string
  regulatedGoods: string // id: none | food | electrical | other | ''
  location: string
  crossBorder: string[] // ids: import | export | fx
  targetMarket?: string
  unknownFacts?: string[] // ids: funding | economic | voting | board
  /** ISO 3166-2 codes chosen on the map (optional) */
  originProvince?: string
  destProvince?: string
  isDemo?: boolean
}

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

export interface RiskIndicator { key: string; text: string; why: string; verify: string; missing: string; next: string }
export interface NomineeResult {
  level: Level
  indicators: RiskIndicator[]
  unknowns: string[]
  stop: boolean
  headline: string
  answer: string
  reason: string
  next: string[]
}

export interface RiskCardData {
  id: string
  category: string
  level: Level
  /** What we found (one sentence) */
  found: string
  /** Why it matters */
  why: string
  /** What we don't know yet */
  unknown: string[]
  sourceIds: string[]
  /** What to verify */
  check: string[]
  next: string
  verification: Verification
  /** Knowledge-base links: requirement ids, responsible authority ids and evidence document ids (data/legal/kb.ts) */
  requirementIds?: string[]
  authorityIds?: string[]
  evidence?: string[]
}
export interface ActionItem { id: string; riskId: string; riskLabel: string; title: string; owner: string; status: StepStatus }

export interface EmploymentInput {
  mode: string // id: hire_cn | hire_th | send_th_cn | send_cn_th | cross
  nationality: string
  location: string
  duration: string
  salary: string
  hours: string
  leave: string
  socialSecurity: string
  workAuth: string
  tax: string
}
export interface EmploymentArea { id: string; area: string; status: Level; note: string; sourceId: string; missing: boolean }

export interface ContractInput {
  employer: string; employee: string; nationality: string; job: string; location: string
  startDate: string; duration: string; salary: string; benefits: string; hours: string
  leave: string; probation: string; other: string
}

export interface RoadmapStep {
  id: number; title: string; description: string; docs: string[]; why: string; next: string
  status: StepStatus; note?: string
}

export interface AlertItem {
  id: string; titleKey: string; when: string; country: 'TH' | 'CN'; topicKey: string; sourceId: string
  impactKey: string; nextKey: string; isSample: boolean; severity: Level; profile?: string
}

export interface ChecklistItem { id: string; group: 'business' | 'ownership' | 'employment' }

export type Grounding = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'NONE'
export interface AIResponse {
  answer: string; reason: string; sources: string[]; risk: Level; next: string
  modules: string[]; blocked?: boolean; kind?: 'blocked' | 'educational' | 'insufficient'
  /** Per-source citation (jurisdiction, instrument, provisions, effective date, trust). Built by the server from the registry, never by the writer of the answer. */
  citations?: Citation[]
  /** How much of the answer rests on human-verified sources. Undefined when the answer cites no legal source. */
  grounding?: Grounding
  /** Reasons the guard replaced or trimmed the original answer. */
  guarded?: string[]
}
