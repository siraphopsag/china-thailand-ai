import { describe, expect, it } from 'vitest'
import { buildProfile } from './interview'
import { AUTHORITIES, DOCUMENTS, REQUIREMENTS, type Requirement } from './data/legal/kb'
import { registry } from './data/legal/registry'
import {
  contextFrom, ecCounts, emptyEmployeeCheck, employeeActions, evaluateEmployeeCheck, kbUrls, requiredDocuments, requirementStatus, resolveOffice,
  retrieveRequirements, sanitizeEmployeeCheck, statusFrom, viewRequirement, type EmployeeCheck,
} from './services/compliance'
import { assessRisks, deriveActions } from './services/engines'
import { messages } from './locales/index'
import { withLang } from './i18n/core'
import type { EmploymentInput } from './types'

const emp = { mode: '', nationality: '', location: '', duration: '', salary: '', hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' } as EmploymentInput
const prof = (forms: string[], dir: 'TH_CN' | 'CN_TH', extra: Record<string, unknown> = {}) => ({ ...buildProfile({ name: 'Acme', btype: 'manufacturing', forms }, dir).profile, ...extra })
const ids = (rs: Requirement[]) => rs.map((r) => r.id)
const ec = (x: Partial<EmployeeCheck>): EmployeeCheck => ({ ...emptyEmployeeCheck, ...x })
const M = messages as Record<string, readonly string[]>

describe('knowledge base integrity (nothing invented, nothing dangling)', () => {
  it('every URL the knowledge base can show is one of the agency home pages that were checked to open', () => {
    const checked = ['https://www.doe.go.th/', 'https://www.immigration.go.th/', 'https://www.dbd.go.th/', 'https://www.boi.go.th/', 'https://www.rd.go.th/', 'https://www.sso.go.th/', 'https://www.diw.go.th/', 'https://www.labour.go.th/',
      'https://www.samr.gov.cn/', 'https://www.ndrc.gov.cn/', 'https://www.mofcom.gov.cn/', 'https://www.chinatax.gov.cn/', 'https://www.mohrss.gov.cn/', 'https://www.nia.gov.cn/']
    for (const u of kbUrls()) expect(checked, u).toContain(u)
  })
  it('every requirement points at a real authority, real documents and existing legal records; ids are unique', () => {
    expect(new Set(ids(REQUIREMENTS)).size).toBe(REQUIREMENTS.length)
    for (const r of REQUIREMENTS) {
      expect(AUTHORITIES.some((a) => a.id === r.authority), r.id).toBe(true)
      for (const d of r.documents) expect(DOCUMENTS.some((x) => x.id === d), d).toBe(true)
      for (const s of r.sources) expect(registry.some((e) => e.id === s), s).toBe(true)
      expect(AUTHORITIES.find((a) => a.id === r.authority)!.country).toBe(r.country)
    }
  })
  it('every requirement, authority and document has text in Thai, Chinese and English', () => {
    const keys = [...REQUIREMENTS.flatMap((r) => [`kb.r.${r.id}.t`, `kb.r.${r.id}.d`]), ...AUTHORITIES.map((a) => `kb.a.${a.id}`), ...DOCUMENTS.flatMap((d) => [`kb.doc.${d.id}`, `kb.doc.${d.id}.p`])]
    for (const k of keys) expect(M[k]?.length === 3 && M[k].every((s) => s.trim().length > 0), k).toBe(true)
  })
  it('the texts state no fees, amounts or deadlines', () => {
    const kbTexts = Object.entries(M).filter(([k]) => k.startsWith('kb.r.') || k.startsWith('kb.doc.')).flatMap(([, v]) => v).join('\n')
    expect(kbTexts).not.toMatch(/\d+\s*(บาท|baht|元|yuan|วัน|days?|天|เดือน|months?|个月)/i)
  })
})

describe('retrieval from the Shared Business Context', () => {
  it('TH → CN returns only Chinese requirements; CN → TH returns only Thai ones', () => {
    const cn = retrieveRequirements(contextFrom(prof(['company', 'hire', 'send'], 'TH_CN')))
    const th = retrieveRequirements(contextFrom(prof(['company', 'hire', 'send'], 'CN_TH')))
    expect(cn.length).toBeGreaterThan(5); expect(cn.every((r) => r.country === 'CN')).toBe(true)
    expect(th.length).toBeGreaterThan(5); expect(th.every((r) => r.country === 'TH')).toBe(true)
    expect(ids(cn)).toContain('cn.work_permit'); expect(ids(th)).toContain('th.work_permit')
  })
  it('only what the plan triggers: no company → no registration; no staff → no employment requirements', () => {
    const goods = retrieveRequirements(contextFrom(prof(['goods'], 'CN_TH', { businessType: 'retail' })))
    expect(goods).toEqual([])
    const companyOnly = ids(retrieveRequirements(contextFrom(prof(['company'], 'CN_TH', { businessType: 'retail', employees: 0, crossBorderWorkers: false }))))
    expect(companyOnly).toContain('th.company_registration'); expect(companyOnly).not.toContain('th.work_permit'); expect(companyOnly).not.toContain('th.social_security')
  })
  it('an employee check with a foreign national adds the work-authorisation requirements even when the plan did not mention it', () => {
    const p = prof(['company'], 'CN_TH', { employees: 0, crossBorderWorkers: false })
    expect(ids(retrieveRequirements(contextFrom(p)))).not.toContain('th.work_permit')
    expect(ids(retrieveRequirements(contextFrom(p, ec({ nationality: 'CN' }))))).toContain('th.work_permit')
    expect(ids(retrieveRequirements(contextFrom(p, ec({ nationality: 'TH' }))))).not.toContain('th.work_permit') // a Thai national in Thailand
  })
  it('no context, duplicates and regional records are handled', () => {
    expect(retrieveRequirements(contextFrom(null))).toEqual([])
    const ctx = contextFrom(prof(['company'], 'CN_TH'))
    const dup = retrieveRequirements(ctx, [...REQUIREMENTS, ...REQUIREMENTS])
    expect(new Set(ids(dup)).size).toBe(dup.length)
    const regional: Requirement = { id: 'th.x', country: 'TH', domain: 'licensing', triggers: ['company'], authority: 'th-dbd', documents: [], sources: [], regions: ['TH-20'] }
    expect(retrieveRequirements(ctx, [regional])).toEqual([])
    expect(retrieveRequirements(contextFrom(prof(['company'], 'CN_TH', { destProvince: 'TH-20' })), [regional]).length).toBe(1)
  })
  it('a province of the wrong country is ignored (origin province never decides the destination office)', () => {
    expect(contextFrom(prof(['company'], 'CN_TH', { destProvince: 'CN-SH' })).province).toBeNull()
  })
  it('documents needed by several requirements are listed once', () => {
    const docs = requiredDocuments(retrieveRequirements(contextFrom(prof(['company', 'hire', 'send'], 'CN_TH'))))
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length)
    expect(docs.find((d) => d.id === 'passport')!.requirementIds.length).toBe(2)
  })
})

describe('status is derived from the sources, never set by hand', () => {
  it('rules: no source = DRAFT, superseded wins, all verified = ACTIVE, anything else = NEEDS_VERIFICATION', () => {
    expect(statusFrom([])).toBe('DRAFT')
    expect(statusFrom(['VERIFIED'], true)).toBe('SUPERSEDED')
    expect(statusFrom(['VERIFIED', 'VERIFIED'])).toBe('ACTIVE')
    expect(statusFrom(['VERIFIED', 'STALE'])).toBe('NEEDS_VERIFICATION')
    expect(statusFrom(['GAP'])).toBe('NEEDS_VERIFICATION')
  })
  it('with today\'s data nothing shows as verified (no human review exists yet), and requirements without a source are drafts', () => {
    for (const r of REQUIREMENTS) expect(requirementStatus(r), r.id).toBe(r.sources.length ? 'NEEDS_VERIFICATION' : 'DRAFT')
    const r = REQUIREMENTS[0]
    expect(requirementStatus(r, new Date(), () => 'VERIFIED')).toBe('ACTIVE')
    expect(requirementStatus({ ...r, supersededBy: 'x' }, new Date(), () => 'VERIFIED')).toBe('SUPERSEDED')
  })
  it('the full record carries every metadata field, with no verification date when nobody has reviewed it', () => {
    const v = viewRequirement(REQUIREMENTS.find((r) => r.id === 'th.work_permit')!, 'TH-20', 'en')
    for (const k of ['country', 'region', 'legal_domain', 'requirement', 'description', 'responsible_authority', 'required_documents', 'procedure', 'official_source', 'source_url', 'status', 'language', 'notes'] as const) expect(v, k).toHaveProperty(k)
    expect(v.last_verified).toBeUndefined(); expect(v.effective_date).toBeUndefined(); expect(v.status).toBe('NEEDS_VERIFICATION')
    expect(v.official_source.every((s) => !s.isOfficialText)).toBe(true) // only agency pages so far
  })
})

describe('responsible office', () => {
  it('follows the workplace province; Bangkok has its own wording; unknown → "requires verification"', () => {
    expect(resolveOffice('th-doe', 'TH-20', 'en').text).toMatch(/Chon Buri/)
    expect(resolveOffice('th-doe', 'TH-10', 'en').text).toMatch(/Bangkok Area/)
    expect(resolveOffice('th-doe', null, 'en')).toEqual({ text: 'Responsible office requires verification', resolved: false })
    expect(resolveOffice('cn-local-wp', 'CN-SH', 'en').resolved).toBe(false)
    expect(resolveOffice('th-doe', 'CN-SH', 'en').resolved).toBe(false)
    expect(resolveOffice('th-boi', 'TH-20', 'en').text).toMatch(/national/i)
    expect(resolveOffice('nope', 'TH-20', 'en').resolved).toBe(false)
  })
})

describe('employee compliance check', () => {
  const allowed = ['VERIFIED', 'NEEDS_INFORMATION', 'NEEDS_VERIFICATION', 'POTENTIAL_COMPLIANCE_ISSUE', 'NOT_APPLICABLE']
  it('case: Chinese national to work in Thailand on a tourist status, no permission, start date passed → potential issues, never a verdict', () => {
    const items = evaluateEmployeeCheck(ec({ nationality: 'CN', stay: 'tourist', auth: 'no', start: '2026-01-01', role: 'Engineer' }), 'TH', '2026-10-01')
    const st = Object.fromEntries(items.map((i) => [i.id, i.status]))
    expect(st.stay).toBe('POTENTIAL_COMPLIANCE_ISSUE'); expect(st.work_auth).toBe('POTENTIAL_COMPLIANCE_ISSUE')
    expect(st.identity).toBe('NEEDS_INFORMATION'); expect(st.occupation).toBe('NEEDS_VERIFICATION')
    expect(items.every((i) => allowed.includes(i.status))).toBe(true)
    expect(items.find((i) => i.id === 'work_auth')!.authorityIds).toEqual(['th-doe'])
  })
  it('the same answers before the start date are a verification task, not an issue', () => {
    const st = Object.fromEntries(evaluateEmployeeCheck(ec({ nationality: 'CN', stay: 'business', auth: 'no', start: '2027-01-01' }), 'TH', '2026-10-01').map((i) => [i.id, i.status]))
    expect(st.work_auth).toBe('NEEDS_VERIFICATION'); expect(st.stay).toBe('NEEDS_VERIFICATION')
  })
  it('case: Thai national seconded to China with documents in hand → confirmed by the user (still not by the authority)', () => {
    const items = evaluateEmployeeCheck(ec({ nationality: 'TH', stay: 'work', auth: 'yes', docs: ['passport', 'visa', 'work_permit', 'contract'], province: 'CN-SH', type: 'secondment', employer: 'Acme', role: 'Manager' }), 'CN')
    const st = Object.fromEntries(items.map((i) => [i.id, i.status]))
    for (const k of ['identity', 'stay', 'work_auth', 'work_permit', 'contract', 'workplace']) expect(st[k], k).toBe('VERIFIED')
    expect(st.employer).toBe('NEEDS_VERIFICATION'); expect(st.social).toBe('NEEDS_VERIFICATION')
    expect(items.find((i) => i.id === 'work_auth')!.authorityIds).toEqual(['cn-local-wp'])
  })
  it('a national of the country of work is outside the cross-border items', () => {
    const items = evaluateEmployeeCheck(ec({ nationality: 'TH' }), 'TH')
    expect(items.filter((i) => i.status === 'NOT_APPLICABLE').map((i) => i.id).sort()).toEqual(['identity', 'occupation', 'stay', 'work_auth', 'work_permit'])
  })
  it('open items become actions with the matching status; nothing is created for confirmed items', () => {
    const items = evaluateEmployeeCheck(ec({ nationality: 'CN', stay: 'tourist', docs: ['passport'] }), 'TH')
    const acts = employeeActions(items)
    expect(acts.find((a) => a.id === 'act-ec-stay')!.status).toBe('todo')
    expect(acts.find((a) => a.id === 'act-ec-work_auth')!.status).toBe('waitdoc')
    expect(acts.some((a) => a.id === 'act-ec-identity')).toBe(false)
    expect(ecCounts(items).v).toBe(1)
  })
  it('stored answers are sanitised', () => {
    const s = sanitizeEmployeeCheck({ nationality: 'XX', province: '<b>', docs: ['passport', 'passport', 'evil'], start: 'tomorrow', role: 5 })
    expect(s).toEqual({ ...emptyEmployeeCheck, docs: ['passport'] })
    expect(sanitizeEmployeeCheck(null)).toEqual(emptyEmployeeCheck)
  })
  it('the check never calls a person legal or illegal (only the disclaimer mentions the words, to say it does not)', () => {
    const txt = Object.entries(M).filter(([k]) => k.startsWith('ec.') && k !== 'ec.disclaimer' && k !== 'ec.m.POTENTIAL_COMPLIANCE_ISSUE').flatMap(([, v]) => v).join('\n')
    expect(txt).not.toMatch(/ถูกกฎหมาย|ผิดกฎหมาย|合法|违法|\blegal\b|illegal/i)
  })
})

describe('chain: requirement → document → verification → risk → action', () => {
  it('risks carry the requirements, authorities and evidence they rest on', () => {
    const r = assessRisks(prof(['company', 'hire', 'send'], 'CN_TH'), emp)
    const e = r.find((x) => x.id === 'employment')!
    expect(e.requirementIds).toContain('th.work_permit'); expect(e.authorityIds).toContain('th-doe'); expect(e.evidence).toContain('th_work_permit')
    expect(r.find((x) => x.id === 'legal')!.requirementIds).toContain('th.company_registration')
  })
  it('an employee check adds one summary risk; its actions come from the check, not from the risk', () => {
    const p = prof(['company', 'hire'], 'CN_TH')
    const check = ec({ nationality: 'CN', stay: 'tourist' })
    const r = assessRisks(p, emp, check).find((x) => x.id === 'employee')!
    expect(r.level).toBe('HIGH'); expect(r.requirementIds).toContain('th.stay_permission')
    expect(deriveActions(p, emp).some((a) => a.riskId === 'employee')).toBe(false)
    expect(assessRisks(p, emp).some((x) => x.id === 'employee')).toBe(false)
  })
  it('works in all three languages', () => {
    for (const l of ['th', 'zh', 'en'] as const) {
      const v = withLang(l, () => viewRequirement(REQUIREMENTS[0], 'TH-10', l))
      expect(v.requirement).toBe(M['kb.r.' + REQUIREMENTS[0].id + '.t'][['th', 'zh', 'en'].indexOf(l)])
    }
  })
})
