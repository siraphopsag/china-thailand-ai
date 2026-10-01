/**
 * Legal Knowledge Base (structured): Country → Region → Authority → Domain → Requirement → Document → Source.
 * Pure data, updateable without touching application logic. Adding an ASEAN country = adding its authorities,
 * documents and requirements here (plus their texts in locales/kb.ts); no code changes elsewhere.
 *
 * Reliability rules applied to this file:
 *  - Only real authorities, and only URLs that were checked to open (agency home pages). No fees, deadlines or detailed procedures.
 *  - A requirement states WHAT applies at a general level; details (exact documents, office, online/offline) stay "to be verified".
 *  - Status is never written by hand: it is derived from the trust state of the linked sources (see requirementStatus).
 */
export type Country = 'TH' | 'CN'
export type Domain = 'employment' | 'work_auth' | 'immigration' | 'registration' | 'investment' | 'industry' | 'tax' | 'social' | 'licensing' | 'contract'
export const DOMAINS: Domain[] = ['registration', 'investment', 'industry', 'licensing', 'tax', 'employment', 'contract', 'social', 'work_auth', 'immigration']
export type ReqStatus = 'ACTIVE' | 'SUPERSEDED' | 'NEEDS_VERIFICATION' | 'DRAFT'

/** How the responsible office follows from the business location. */
export type OfficeRule =
  | { kind: 'national' } // one national authority
  | { kind: 'provincial'; capitalCode?: string } // a local office per province (capital handled by a separate text when capitalCode matches)
  | { kind: 'unknown' } // cannot be determined reliably → "Responsible office requires verification"
export interface Authority { id: string; country: Country; url?: string; office: OfficeRule }

/** Conditions derived from the Shared Business Context. A requirement applies when ALL of its triggers hold. */
export type Trigger = 'company' | 'foreign_owner' | 'hire' | 'foreign_worker' | 'manufacturing'
export interface DocSpec { id: string; country?: Country; issuer: string } // issuer: authority id, or 'origin_state' / 'embassy' / 'parties'
export interface Requirement {
  id: string
  country: Country
  domain: Domain
  triggers: Trigger[]
  authority: string
  documents: string[]
  /** ids in data/legal/registry.ts; empty = no source in the system yet (status DRAFT) */
  sources: string[]
  /** province codes when the requirement only applies there (none of the initial records are regional) */
  regions?: string[]
  optional?: boolean
  /** id of the requirement that replaces this one (status becomes SUPERSEDED) */
  supersededBy?: string
}

export const AUTHORITIES: Authority[] = [
  // Thailand
  { id: 'th-doe', country: 'TH', url: 'https://www.doe.go.th/', office: { kind: 'provincial', capitalCode: 'TH-10' } },
  { id: 'th-imm', country: 'TH', url: 'https://www.immigration.go.th/', office: { kind: 'provincial' } },
  { id: 'th-dbd', country: 'TH', url: 'https://www.dbd.go.th/', office: { kind: 'provincial', capitalCode: 'TH-10' } },
  { id: 'th-boi', country: 'TH', url: 'https://www.boi.go.th/', office: { kind: 'national' } },
  { id: 'th-rd', country: 'TH', url: 'https://www.rd.go.th/', office: { kind: 'provincial' } },
  { id: 'th-sso', country: 'TH', url: 'https://www.sso.go.th/', office: { kind: 'provincial', capitalCode: 'TH-10' } },
  { id: 'th-diw', country: 'TH', url: 'https://www.diw.go.th/', office: { kind: 'provincial', capitalCode: 'TH-10' } },
  { id: 'th-dlpw', country: 'TH', url: 'https://www.labour.go.th/', office: { kind: 'provincial', capitalCode: 'TH-10' } },
  // China
  { id: 'cn-samr', country: 'CN', url: 'https://www.samr.gov.cn/', office: { kind: 'provincial' } },
  { id: 'cn-ndrc', country: 'CN', url: 'https://www.ndrc.gov.cn/', office: { kind: 'national' } },
  { id: 'cn-mofcom', country: 'CN', url: 'https://www.mofcom.gov.cn/', office: { kind: 'national' } },
  { id: 'cn-sta', country: 'CN', url: 'https://www.chinatax.gov.cn/', office: { kind: 'provincial' } },
  { id: 'cn-mohrss', country: 'CN', url: 'https://www.mohrss.gov.cn/', office: { kind: 'provincial' } },
  { id: 'cn-nia', country: 'CN', url: 'https://www.nia.gov.cn/', office: { kind: 'provincial' } },
  { id: 'cn-local-wp', country: 'CN', office: { kind: 'unknown' } }, // local authority for foreigners' work permits: name and office vary by city → verify
]

export const DOCUMENTS: DocSpec[] = [
  { id: 'passport', issuer: 'origin_state' },
  { id: 'th_visa', country: 'TH', issuer: 'embassy' },
  { id: 'th_work_permit', country: 'TH', issuer: 'th-doe' },
  { id: 'th_company_cert', country: 'TH', issuer: 'th-dbd' },
  { id: 'th_fbl', country: 'TH', issuer: 'th-dbd' },
  { id: 'th_boi_cert', country: 'TH', issuer: 'th-boi' },
  { id: 'th_factory_license', country: 'TH', issuer: 'th-diw' },
  { id: 'th_tax_id', country: 'TH', issuer: 'th-rd' },
  { id: 'th_sso_reg', country: 'TH', issuer: 'th-sso' },
  { id: 'cn_visa', country: 'CN', issuer: 'embassy' },
  { id: 'cn_work_permit', country: 'CN', issuer: 'cn-local-wp' },
  { id: 'cn_residence_permit', country: 'CN', issuer: 'cn-nia' },
  { id: 'cn_business_license', country: 'CN', issuer: 'cn-samr' },
  { id: 'cn_tax_reg', country: 'CN', issuer: 'cn-sta' },
  { id: 'employment_contract', issuer: 'parties' },
]

export const REQUIREMENTS: Requirement[] = [
  // ---------- Thailand
  { id: 'th.company_registration', country: 'TH', domain: 'registration', triggers: ['company'], authority: 'th-dbd', documents: ['th_company_cert'], sources: ['th-dbd-reg'] },
  { id: 'th.foreign_business', country: 'TH', domain: 'investment', triggers: ['company', 'foreign_owner'], authority: 'th-dbd', documents: ['th_fbl'], sources: ['th-fba'] },
  { id: 'th.boi', country: 'TH', domain: 'investment', triggers: ['company'], authority: 'th-boi', documents: ['th_boi_cert'], sources: ['th-boi'], optional: true },
  { id: 'th.factory', country: 'TH', domain: 'industry', triggers: ['manufacturing'], authority: 'th-diw', documents: ['th_factory_license'], sources: [] },
  { id: 'th.tax_registration', country: 'TH', domain: 'tax', triggers: ['company'], authority: 'th-rd', documents: ['th_tax_id'], sources: ['th-tax'] },
  { id: 'th.withholding', country: 'TH', domain: 'tax', triggers: ['hire'], authority: 'th-rd', documents: [], sources: ['th-tax'] },
  { id: 'th.social_security', country: 'TH', domain: 'social', triggers: ['hire'], authority: 'th-sso', documents: ['th_sso_reg'], sources: ['th-sso'] },
  { id: 'th.employment_terms', country: 'TH', domain: 'contract', triggers: ['hire'], authority: 'th-dlpw', documents: ['employment_contract'], sources: ['th-lpa', 'th-ccc-hire'] },
  { id: 'th.work_permit', country: 'TH', domain: 'work_auth', triggers: ['foreign_worker'], authority: 'th-doe', documents: ['passport', 'th_work_permit'], sources: ['th-labour'] },
  { id: 'th.stay_permission', country: 'TH', domain: 'immigration', triggers: ['foreign_worker'], authority: 'th-imm', documents: ['passport', 'th_visa'], sources: ['th-labour'] },
  // ---------- China
  { id: 'cn.company_registration', country: 'CN', domain: 'registration', triggers: ['company'], authority: 'cn-samr', documents: ['cn_business_license'], sources: ['cn-fil'] },
  { id: 'cn.negative_list', country: 'CN', domain: 'investment', triggers: ['company', 'foreign_owner'], authority: 'cn-ndrc', documents: [], sources: ['cn-neglist-2024'] },
  { id: 'cn.investment_info', country: 'CN', domain: 'investment', triggers: ['company', 'foreign_owner'], authority: 'cn-mofcom', documents: [], sources: ['cn-fil'] },
  { id: 'cn.industry_permits', country: 'CN', domain: 'licensing', triggers: ['manufacturing'], authority: 'cn-samr', documents: [], sources: [] },
  { id: 'cn.tax_registration', country: 'CN', domain: 'tax', triggers: ['company'], authority: 'cn-sta', documents: ['cn_tax_reg'], sources: ['cn-tax'] },
  { id: 'cn.iit_withholding', country: 'CN', domain: 'tax', triggers: ['hire'], authority: 'cn-sta', documents: [], sources: ['cn-tax'] },
  { id: 'cn.social_insurance', country: 'CN', domain: 'social', triggers: ['hire'], authority: 'cn-mohrss', documents: [], sources: ['cn-labor', 'cn-lcl-impl'] },
  { id: 'cn.labor_contract', country: 'CN', domain: 'contract', triggers: ['hire'], authority: 'cn-mohrss', documents: ['employment_contract'], sources: ['cn-labor'] },
  { id: 'cn.work_permit', country: 'CN', domain: 'work_auth', triggers: ['foreign_worker'], authority: 'cn-local-wp', documents: ['passport', 'cn_work_permit'], sources: ['cn-immigration'] },
  { id: 'cn.residence_permit', country: 'CN', domain: 'immigration', triggers: ['foreign_worker'], authority: 'cn-nia', documents: ['passport', 'cn_visa', 'cn_residence_permit'], sources: ['cn-immigration'] },
]

export const authorityOf = (id: string) => AUTHORITIES.find((a) => a.id === id)
export const documentOf = (id: string) => DOCUMENTS.find((d) => d.id === id)
export const requirementOf = (id: string) => REQUIREMENTS.find((r) => r.id === id)
