/**
 * Compliance engine: Shared Business Context → relevant requirements → documents → verification → employee check → actions.
 * Pure and rule-based. It never decides that anything (or anyone) is legal or illegal; it only reports what is known,
 * what is missing and which authority must verify it. All requirement data comes from data/legal/kb.ts.
 */
import type { ActionItem, Direction, Profile, StepStatus } from '../types'
import type { Trust } from '../data/legal/types.js'
import { AUTHORITIES, DOCUMENTS, DOMAINS, REQUIREMENTS, authorityOf, documentOf, type Country, type Domain, type ReqStatus, type Requirement, type Trigger } from '../data/legal/kb.js'
import { assess, citationFor } from '../data/legal/trust.js'
import { getEntry } from '../data/legal/registry.js'
import { tr, type Lang } from '../i18n/core.js'
import { messages, type MsgKey } from '../locales/index.js'

const K = (s: string) => s as MsgKey
const MSG_KEYS = messages as Record<string, unknown>

/* ---------- employee check input (stored in the Business Context) ---------- */
export type Nat = '' | 'TH' | 'CN' | 'OTHER'
export interface EmployeeCheck {
  nationality: Nat
  role: string
  employer: string
  province: string // ISO 3166-2 code of the workplace
  type: '' | 'fulltime' | 'parttime' | 'secondment'
  start: string // YYYY-MM-DD
  stay: '' | 'none' | 'tourist' | 'business' | 'work' | 'resident' | 'unknown'
  auth: '' | 'yes' | 'applying' | 'no' | 'unknown'
  docs: string[] // passport | visa | work_permit | contract
}
export const emptyEmployeeCheck: EmployeeCheck = { nationality: '', role: '', employer: '', province: '', type: '', start: '', stay: '', auth: '', docs: [] }
export const EC_OPTIONS = {
  nationality: ['TH', 'CN', 'OTHER'], type: ['fulltime', 'parttime', 'secondment'], stay: ['none', 'tourist', 'business', 'work', 'resident', 'unknown'],
  auth: ['yes', 'applying', 'no', 'unknown'], docs: ['passport', 'visa', 'work_permit', 'contract'],
} as const
const pick = <T extends string>(v: unknown, ok: readonly T[]): T | '' => (ok.includes(v as T) ? (v as T) : '')
const s = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '')
/** Never trust stored data: unknown values fall back to "not answered". */
export function sanitizeEmployeeCheck(raw: unknown): EmployeeCheck {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    nationality: pick(r.nationality, EC_OPTIONS.nationality), role: s(r.role), employer: s(r.employer),
    province: typeof r.province === 'string' && /^(TH|CN)-[A-Z0-9]{2,3}$/.test(r.province) ? r.province : '',
    type: pick(r.type, EC_OPTIONS.type), start: typeof r.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.start) ? r.start : '',
    stay: pick(r.stay, EC_OPTIONS.stay), auth: pick(r.auth, EC_OPTIONS.auth),
    docs: Array.isArray(r.docs) ? [...new Set(r.docs.filter((d): d is string => (EC_OPTIONS.docs as readonly string[]).includes(d as string)))] : [],
  }
}
export const ecStarted = (e: EmployeeCheck) => !!e.nationality

/* ---------- Shared Business Context → retrieval context ---------- */
export interface ComplianceContext { country: Country | null; origin: Country | null; province: string | null; flags: Set<Trigger> }
export const destinationOf = (d: Direction): Country => (d === 'TH_CN' ? 'CN' : 'TH')
export function contextFrom(p: Profile | null, ec: EmployeeCheck = emptyEmployeeCheck): ComplianceContext {
  if (!p) return { country: null, origin: null, province: null, flags: new Set() }
  const country = destinationOf(p.direction)
  const origin: Country = country === 'TH' ? 'CN' : 'TH'
  const flags = new Set<Trigger>()
  const company = p.forms.some((f) => f === 'company' || f === 'invest')
  if (company) flags.add('company')
  if (company && (p.holders.find((h) => h.id === 'origin')?.percent ?? 0) > 0) flags.add('foreign_owner') // the origin-side investor is foreign in the destination
  const foreignEmployee = !!ec.nationality && ec.nationality !== country
  if (p.forms.includes('hire') || p.forms.includes('send') || p.employees > 0 || p.crossBorderWorkers || ecStarted(ec)) flags.add('hire')
  if (p.crossBorderWorkers || p.forms.includes('send') || foreignEmployee) flags.add('foreign_worker')
  if (p.businessType === 'manufacturing') flags.add('manufacturing')
  const province = p.destProvince && p.destProvince.startsWith(country + '-') ? p.destProvince : null
  return { country, origin, province, flags }
}

/** Only the requirements whose triggers all hold, for the destination country (and region when a record is regional). */
export function retrieveRequirements(ctx: ComplianceContext, reqs: Requirement[] = REQUIREMENTS): Requirement[] {
  if (!ctx.country) return []
  const seen = new Set<string>()
  return reqs
    .filter((r) => r.country === ctx.country && r.triggers.every((t) => ctx.flags.has(t)) && (!r.regions || (!!ctx.province && r.regions.includes(ctx.province))))
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => DOMAINS.indexOf(a.domain) - DOMAINS.indexOf(b.domain))
}

/* ---------- status, derived from the linked sources (never written by hand) ---------- */
/** ACTIVE only when every linked source is human-verified; SUPERSEDED wins; no source at all = DRAFT; anything else = NEEDS_VERIFICATION. */
export function statusFrom(trusts: Trust[], superseded = false): ReqStatus {
  if (superseded) return 'SUPERSEDED'
  if (!trusts.length) return 'DRAFT'
  return trusts.every((t) => t === 'VERIFIED') ? 'ACTIVE' : 'NEEDS_VERIFICATION'
}
export function requirementStatus(r: Requirement, now = new Date(), trustOf: (id: string) => Trust = (id) => assess(id, now).trust): ReqStatus {
  return statusFrom(r.sources.map(trustOf), !!r.supersededBy)
}

/* ---------- responsible office ---------- */
/** local = a provincial/city office was named (its exact area still has to be confirmed) */
export interface Office { text: string; resolved: boolean; local?: boolean }
/** The local office follows from the workplace province; when it cannot be determined the answer is "requires verification", never a guess. */
export function resolveOffice(authorityId: string, province: string | null, lang?: Lang): Office {
  const a = authorityOf(authorityId)
  if (!a || a.office.kind === 'unknown') return { text: tr('kb.office.unknown', undefined, lang), resolved: false }
  if (a.office.kind === 'national') return { text: `${tr(K('kb.a.' + a.id), undefined, lang)} — ${tr('kb.office.national', undefined, lang)}`, resolved: true }
  if (!province || !province.startsWith(a.country + '-')) return { text: tr('kb.office.unknown', undefined, lang), resolved: false }
  const capital = a.office.capitalCode === province && 'kb.o.' + a.id + '.capital' in MSG_KEYS
  const key = capital ? 'kb.o.' + a.id + '.capital' : 'kb.o.' + a.id
  if (!(key in MSG_KEYS)) return { text: tr('kb.office.unknown', undefined, lang), resolved: false }
  return { text: tr(K(key), { place: tr(K('prov.' + province), undefined, lang) }, lang), resolved: true, local: true }
}

/* ---------- full record (the knowledge-base metadata, in one language) ---------- */
export interface RequirementView {
  id: string
  country: Country
  region: string | null
  legal_domain: Domain
  requirement: string
  description: string
  responsible_authority: string
  authority_url?: string
  office: Office
  required_documents: { id: string; name: string; purpose: string; issuer: string; submitTo: string }[]
  procedure: string
  official_source: { id: string; title: string; url: string; isOfficialText: boolean }[]
  source_url?: string
  effective_date?: string
  last_verified?: string
  status: ReqStatus
  language: Lang
  notes: string
  optional: boolean
}
const issuerName = (issuer: string, lang?: Lang) => (issuer.startsWith('th-') || issuer.startsWith('cn-') ? tr(K('kb.a.' + issuer), undefined, lang) : tr(K('kb.issuer.' + issuer), undefined, lang))
export function viewRequirement(r: Requirement, province: string | null, lang: Lang, now = new Date()): RequirementView {
  const auth = authorityOf(r.authority)
  const authName = tr(K('kb.a.' + r.authority), undefined, lang)
  const cites = r.sources.map((id) => citationFor(id, lang)).filter((c): c is NonNullable<typeof c> => !!c)
  const reviewed = cites.map((c) => c.reviewedAt).filter((x): x is string => !!x).sort()
  const effective = cites.map((c) => c.effectiveDate).filter((x): x is string => !!x).sort()
  return {
    id: r.id, country: r.country, region: r.regions ? r.regions.join(', ') : province, legal_domain: r.domain,
    requirement: tr(K('kb.r.' + r.id + '.t'), undefined, lang), description: tr(K('kb.r.' + r.id + '.d'), undefined, lang),
    responsible_authority: authName, authority_url: auth?.url, office: resolveOffice(r.authority, province, lang),
    required_documents: r.documents.map((d) => {
      const spec = documentOf(d)
      const submitTo = spec && (spec.issuer.startsWith('th-') || spec.issuer.startsWith('cn-')) ? resolveOffice(spec.issuer, province, lang).text : tr('nv.channelVerify', undefined, lang)
      return { id: d, name: tr(K('kb.doc.' + d), undefined, lang), purpose: tr(K('kb.doc.' + d + '.p'), undefined, lang), issuer: spec ? issuerName(spec.issuer, lang) : '-', submitTo }
    }),
    procedure: tr('nv.nextText', { authority: authName }, lang), // no step-by-step procedure is stated until a reviewer supplies one
    official_source: r.sources.map((id) => { const e = getEntry(id); return { id, title: tr(K('reg.' + id + '.title'), undefined, lang) || e?.instrument || id, url: e?.textUrl ?? e?.agencyUrl ?? '', isOfficialText: !!e?.textUrl } }),
    source_url: r.sources.map((id) => getEntry(id)?.textUrl ?? getEntry(id)?.agencyUrl).find(Boolean),
    effective_date: effective[0], last_verified: reviewed[reviewed.length - 1],
    status: requirementStatus(r, now), language: lang,
    notes: [r.optional ? tr('nv.optional', undefined, lang) : '', !r.sources.length ? tr('nv.noSource', undefined, lang) : ''].filter(Boolean).join(' · '),
    optional: !!r.optional,
  }
}

/** Documents needed by a set of requirements, each listed once with the requirements that need it. */
export function requiredDocuments(reqs: Requirement[]): { id: string; requirementIds: string[] }[] {
  const m = new Map<string, string[]>()
  for (const r of reqs) for (const d of r.documents) m.set(d, [...(m.get(d) ?? []), r.id])
  return [...m.entries()].map(([id, requirementIds]) => ({ id, requirementIds }))
}

/* ---------- employee compliance check ---------- */
export type EcStatus = 'VERIFIED' | 'NEEDS_INFORMATION' | 'NEEDS_VERIFICATION' | 'POTENTIAL_COMPLIANCE_ISSUE' | 'NOT_APPLICABLE'
export const EC_ITEMS = ['identity', 'stay', 'work_auth', 'work_permit', 'employer', 'occupation', 'workplace', 'contract', 'social'] as const
export type EcItemId = (typeof EC_ITEMS)[number]
export interface EcItem { id: EcItemId; status: EcStatus; requirementIds: string[]; authorityIds: string[]; evidence: string[]; note?: MsgKey }
const MAP: Record<Country, Record<EcItemId, { req: string[]; auth: string[]; ev: string[] }>> = {
  TH: {
    identity: { req: ['th.work_permit'], auth: ['th-imm'], ev: ['passport'] },
    stay: { req: ['th.stay_permission'], auth: ['th-imm'], ev: ['th_visa'] },
    work_auth: { req: ['th.work_permit'], auth: ['th-doe'], ev: ['th_work_permit'] },
    work_permit: { req: ['th.work_permit'], auth: ['th-doe'], ev: ['th_work_permit'] },
    employer: { req: ['th.company_registration'], auth: ['th-dbd'], ev: ['th_company_cert'] },
    occupation: { req: ['th.work_permit'], auth: ['th-doe'], ev: [] },
    workplace: { req: ['th.work_permit'], auth: ['th-doe'], ev: [] },
    contract: { req: ['th.employment_terms'], auth: ['th-dlpw'], ev: ['employment_contract'] },
    social: { req: ['th.social_security'], auth: ['th-sso'], ev: ['th_sso_reg'] },
  },
  CN: {
    identity: { req: ['cn.work_permit'], auth: ['cn-nia'], ev: ['passport'] },
    stay: { req: ['cn.residence_permit'], auth: ['cn-nia'], ev: ['cn_visa', 'cn_residence_permit'] },
    work_auth: { req: ['cn.work_permit'], auth: ['cn-local-wp'], ev: ['cn_work_permit'] },
    work_permit: { req: ['cn.work_permit'], auth: ['cn-local-wp'], ev: ['cn_work_permit'] },
    employer: { req: ['cn.company_registration'], auth: ['cn-samr'], ev: ['cn_business_license'] },
    occupation: { req: ['cn.work_permit'], auth: ['cn-local-wp'], ev: [] },
    workplace: { req: ['cn.work_permit'], auth: ['cn-local-wp'], ev: [] },
    contract: { req: ['cn.labor_contract'], auth: ['cn-mohrss'], ev: ['employment_contract'] },
    social: { req: ['cn.social_insurance'], auth: ['cn-mohrss'], ev: [] },
  },
}
const CROSS_BORDER: EcItemId[] = ['identity', 'stay', 'work_auth', 'work_permit', 'occupation']
/** Rules (deliberately conservative): a user-provided document is "confirmed by you", never "verified by the authority";
 *  a mismatch is a POTENTIAL issue to verify, never a verdict. */
export function evaluateEmployeeCheck(e: EmployeeCheck, country: Country, today = new Date().toISOString().slice(0, 10)): EcItem[] {
  const has = (d: string) => e.docs.includes(d)
  const local = !!e.nationality && e.nationality === country
  const started = !!e.start && e.start <= today
  const status = (id: EcItemId): { status: EcStatus; note?: MsgKey } => {
    if (local && CROSS_BORDER.includes(id)) return { status: 'NOT_APPLICABLE', note: 'ec.local' }
    switch (id) {
      case 'identity': return !e.nationality ? { status: 'NEEDS_INFORMATION' } : { status: has('passport') ? 'VERIFIED' : 'NEEDS_INFORMATION' }
      case 'stay':
        if (!e.stay || e.stay === 'unknown') return { status: 'NEEDS_INFORMATION' }
        if (e.stay === 'tourist') return { status: 'POTENTIAL_COMPLIANCE_ISSUE', note: 'ec.stay.tourist' }
        if ((e.stay === 'work' || e.stay === 'resident') && has('visa')) return { status: 'VERIFIED' }
        return { status: 'NEEDS_VERIFICATION' }
      case 'work_auth':
        if (!e.auth || e.auth === 'unknown') return { status: 'NEEDS_INFORMATION' }
        if (e.auth === 'yes') return { status: has('work_permit') ? 'VERIFIED' : 'NEEDS_VERIFICATION' }
        if (e.auth === 'no' && started) return { status: 'POTENTIAL_COMPLIANCE_ISSUE' } // the intended start date has passed without permission
        return { status: 'NEEDS_VERIFICATION' }
      case 'work_permit': return { status: has('work_permit') ? 'VERIFIED' : 'NEEDS_INFORMATION' }
      case 'employer': return { status: e.employer.trim() ? 'NEEDS_VERIFICATION' : 'NEEDS_INFORMATION' }
      case 'occupation': return e.role.trim() ? { status: 'NEEDS_VERIFICATION', note: K('ec.i.occupation.' + country) } : { status: 'NEEDS_INFORMATION' }
      case 'workplace': return { status: e.province && e.province.startsWith(country + '-') ? 'VERIFIED' : 'NEEDS_INFORMATION' }
      case 'contract': return { status: has('contract') ? 'VERIFIED' : 'NEEDS_INFORMATION' }
      case 'social': return { status: e.type ? 'NEEDS_VERIFICATION' : 'NEEDS_INFORMATION' }
    }
  }
  return EC_ITEMS.map((id) => { const m = MAP[country][id]; return { id, ...status(id), requirementIds: m.req, authorityIds: m.auth, evidence: m.ev } })
}
export const ecCounts = (items: EcItem[]) => {
  const n = (st: EcStatus) => items.filter((i) => i.status === st).length
  return { v: n('VERIFIED'), i: n('NEEDS_INFORMATION'), r: n('NEEDS_VERIFICATION'), p: n('POTENTIAL_COMPLIANCE_ISSUE'), na: n('NOT_APPLICABLE') }
}

/* ---------- employee check → actions ---------- */
const ACTION_STATUS: Partial<Record<EcStatus, StepStatus>> = { POTENTIAL_COMPLIANCE_ISSUE: 'todo', NEEDS_INFORMATION: 'waitdoc', NEEDS_VERIFICATION: 'waitver' }
export function employeeActions(items: EcItem[]): ActionItem[] {
  return items.filter((i) => ACTION_STATUS[i.status]).map((i) => ({
    id: 'act-ec-' + i.id, riskId: 'employee', riskLabel: tr('ec.risk'), title: tr(K('ec.i.' + i.id + '.next')), owner: tr('kb.act.owner'), status: ACTION_STATUS[i.status]!,
  }))
}

/* ---------- risk ↔ requirement links (Requirement → Document → Verification → Risk) ---------- */
const RISK_DOMAINS: Record<string, Domain[]> = {
  legal: ['registration', 'investment', 'industry', 'licensing'], ownership: ['investment'], nominee: ['investment'],
  employment: ['employment', 'contract', 'social', 'work_auth', 'immigration'], tax: ['tax'], documents: DOMAINS,
}
export function riskLinks(riskId: string, reqs: Requirement[]) {
  const ds = RISK_DOMAINS[riskId] ?? []
  const rs = reqs.filter((r) => ds.includes(r.domain))
  return { requirementIds: rs.map((r) => r.id), authorityIds: [...new Set(rs.map((r) => r.authority))], evidence: [...new Set(rs.flatMap((r) => r.documents))] }
}

/* ---------- user-facing processing stages (no internal reasoning) ---------- */
export function stages(p: Profile, reqs: Requirement[], missing: number, risks: number, actions: number, lang?: Lang, now = new Date()) {
  const country = destinationOf(p.direction)
  const place = tr(K('country.' + country), undefined, lang) + (p.destProvince ? ' · ' + tr(K('prov.' + p.destProvince), undefined, lang) : '')
  const st = reqs.map((r) => requirementStatus(r, now))
  return [
    tr('st.1', undefined, lang), tr('st.2', undefined, lang), tr('st.3', { place }, lang), tr('st.4', { n: reqs.length }, lang), tr('st.5', { n: missing }, lang),
    tr('st.6', { v: st.filter((x) => x === 'ACTIVE').length, u: st.filter((x) => x !== 'ACTIVE').length }, lang), tr('st.7', { n: risks }, lang), tr('st.8', { n: actions }, lang),
  ]
}

/** Every URL the knowledge base can show (used by tests: nothing outside the checked list). */
export const kbUrls = () => [...new Set(AUTHORITIES.map((a) => a.url).filter((u): u is string => !!u))]
export { DOCUMENTS }
