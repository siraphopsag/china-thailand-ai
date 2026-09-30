export type Direction = 'TH_CN' | 'CN_TH'
export type Level = 'LOW' | 'MEDIUM' | 'HIGH' | 'NEEDS_REVIEW'
export type Verification = 'VERIFIED' | 'PARTIAL' | 'NEED_INFO' | 'NO_SOURCE' | 'EXPERT'
export type StepStatus = 'todo' | 'doing' | 'review' | 'done' | 'fix'
export type Tri = 'yes' | 'no' | 'unknown'

/** ผู้ถือหุ้น: origin = ฝั่งประเทศต้นทาง (เป็นต่างชาติในประเทศเป้าหมาย), partner = ฝั่งท้องถิ่นของประเทศเป้าหมาย */
export interface Holder {
  id: 'origin' | 'partner'
  label: string
  nationality: 'TH' | 'CN'
  percent: number // สัดส่วนหุ้น
  capital: number // สัดส่วนเงินลงทุนที่ผู้ถือหุ้นรายนี้เป็นผู้จัดหา
  voting: number // สัดส่วนสิทธิออกเสียง
  board: number // สัดส่วนกรรมการที่ผู้ถือหุ้นรายนี้แต่งตั้ง
  economic: number // สัดส่วนสิทธิประโยชน์ทางเศรษฐกิจ (เงินปันผล/ผลกำไร)
}

export interface Profile {
  companyName: string
  direction: Direction
  businessType: string
  activity: string
  forms: string[]
  investmentRange: string
  employees: number
  crossBorderWorkers: boolean
  holders: Holder[]
  realInvestor: 'origin' | 'partner' | 'shared' | 'unknown'
  operator: 'origin' | 'partner' | 'joint' | 'unknown'
  sideAgreement: Tri // มีข้อตกลงนอกเอกสารที่มีผลต่ออำนาจ/ผลประโยชน์หรือไม่ ('yes' = มี)
  products: string
  regulatedGoods: string
  location: string
  crossBorder: string[]
  unknownFacts?: string[] // ข้อเท็จจริงที่ผู้ใช้ตอบว่ายังไม่ทราบ
  isDemo?: boolean
}

export interface Regulation {
  id: string
  country: 'TH' | 'CN'
  authority: string
  topic: string
  title: string
  rule: string // คำอธิบายภาษาไทยแบบย่อ
  originalTerm?: string
  applicableBusinessType: string
  applicableNationality: string
  sourceUrl: string
  publicationDate: string
  effectiveDate: string
  lastVerified: string
  verificationStatus: Verification
  isSample: boolean
  supersededBy?: string
}

export interface RiskIndicator { key: string; text: string; why: string; verify: string }
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
  why: string
  sourceIds: string[]
  check: string[]
  next: string
  verification: Verification
}

export interface EmploymentInput {
  mode: string
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
export interface EmploymentArea { area: string; status: Level; note: string; sourceId: string }

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
  id: string; changed: string; when: string; profile: string; sourceId: string
  impact: string; next: string; isSample: boolean; severity: Level
}

export interface ChecklistItem { id: string; group: string; text: string }

export interface AIResponse {
  answer: string; reason: string; sources: string[]; risk: Level; next: string
  modules: string[]; blocked?: boolean
}
