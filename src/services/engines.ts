import type {
  ActionItem, AIResponse, ContractInput, EmploymentArea, EmploymentInput, Holder, Level, NomineeResult, Profile, RiskCardData, RiskIndicator, RoadmapStep, Verification,
} from '../types'
import { dv, tk, tr, withLang, type Lang } from '../i18n/core.js'
import { escapeHtml } from '../utils/labels.js'
import { terms } from '../data/culture.js'
import type { MsgKey } from '../locales/index.js'
import type { Citation } from '../data/legal/types.js'
import { registry } from '../data/legal/registry.js'
import { liveLegal, toVerification, type LegalView } from '../data/legal/trust.js'
import { answerSpecific, asksSpecificDetail, guardResponse } from './legalGuard.js'
import { contextFrom, ecCounts, ecStarted, evaluateEmployeeCheck, retrieveRequirements, riskLinks, type EmployeeCheck } from './compliance.js'
import { requirementOf } from '../data/legal/kb.js'

const GAP = 25 // ส่วนต่าง (จุดเปอร์เซ็นต์) ที่ถือว่าควรตรวจสอบเพิ่มเติม
const K = (s: string) => s as MsgKey

export const hasCompany = (p: Profile) => p.forms.some((f) => f === 'company' || f === 'invest')
export const hasSend = (p: Profile) => p.forms.includes('send')
export const targetCountry = (p: Profile) => (p.direction === 'TH_CN' ? 'CN' : 'TH')
export const holdersSum = (p: Profile) => p.holders.reduce((a, h) => a + h.percent, 0)
export const holderName = (h: Holder) => tk('holder', h.nationality)
const majority = (p: Profile) => [...p.holders].sort((a, b) => b.percent - a.percent)[0]

/* ---------- Ownership ---------- */
export interface OwnershipDim { key: string; title: string; status: Level; note: string }
export function ownershipDims(p: Profile): OwnershipDim[] {
  const gap = (h: Holder, v: number) => Math.abs(v - h.percent)
  const worst = (f: (h: Holder) => number) => Math.max(...p.holders.map((h) => gap(h, f(h))))
  const lv = (g: number): Level => (g >= GAP ? 'NEEDS_REVIEW' : 'LOW')
  const sumOk = Math.round(holdersSum(p)) === 100
  const row = (key: string, title: MsgKey, g: number, ok: MsgKey, bad: MsgKey): OwnershipDim => ({ key, title: tr(title), status: lv(g), note: tr(g >= GAP ? bad : ok) })
  return [
    { key: 'own', title: tr('dim.own.t'), status: sumOk ? 'LOW' : 'NEEDS_REVIEW', note: sumOk ? tr('dim.own.ok') : tr('dim.own.bad', { sum: holdersSum(p) }) },
    row('fund', 'dim.fund.t', worst((h) => h.capital), 'dim.fund.ok', 'dim.fund.bad'),
    row('ctl', 'dim.ctl.t', worst((h) => h.voting), 'dim.ctl.ok', 'dim.ctl.bad'),
    row('dir', 'dim.dir.t', worst((h) => h.board), 'dim.dir.ok', 'dim.dir.bad'),
    row('eco', 'dim.eco.t', worst((h) => h.economic), 'dim.eco.ok', 'dim.eco.bad'),
    { key: 'agr', title: tr('dim.agr.t'), status: p.sideAgreement === 'yes' ? 'HIGH' : p.sideAgreement === 'unknown' ? 'NEEDS_REVIEW' : 'LOW',
      note: p.sideAgreement === 'yes' ? tr('dim.agr.yes') : p.sideAgreement === 'unknown' ? tr('dim.agr.unk') : tr('dim.agr.no', { holder: holderName(majority(p)) }) },
  ]
}

/** Rows for the "ownership ≠ control ≠ funding" visual. null = unknown. */
export interface OwnRow { key: string; origin: number | null; partner: number | null; mismatch: boolean }
export function ownershipRows(p: Profile): OwnRow[] {
  const o = p.holders.find((h) => h.id === 'origin')!
  const pa = p.holders.find((h) => h.id === 'partner')!
  const mgmt: [number, number] | null = p.operator === 'origin' ? [100, 0] : p.operator === 'partner' ? [0, 100] : p.operator === 'joint' ? [50, 50] : null
  const mk = (key: string, a: number | null, b: number | null): OwnRow => ({ key, origin: a, partner: b, mismatch: key !== 'shares' && a !== null && Math.abs(a - o.percent) >= GAP })
  return [
    mk('shares', o.percent, pa.percent), mk('funding', o.capital, pa.capital), mk('voting', o.voting, pa.voting),
    mk('board', o.board, pa.board), mk('economic', o.economic, pa.economic), mk('management', mgmt ? mgmt[0] : null, mgmt ? mgmt[1] : null),
  ]
}

/* ---------- Nominee risk (risk screening, never a legal verdict) ---------- */
export type IndicatorCategory = 'funding' | 'control' | 'ownership' | 'economic' | 'management'
export const indicatorCategory = (key: string): IndicatorCategory => {
  const t = key.split('-')[0]
  return t === 'fund' ? 'funding' : t === 'eco' ? 'economic' : t === 'investor' ? 'ownership' : t === 'operator' ? 'management' : 'control'
}
function mkInd(key: string, vars: Record<string, string | number>): RiskIndicator {
  const t = key.split('-')[0]
  return { key, text: tr(K(`ind.${t}.text`), vars), why: tr(K(`ind.${t}.why`)), verify: tr(K(`ind.${t}.verify`)), missing: tr(K(`ind.${t}.missing`)), next: tr(K(`ind.${t}.next`)) }
}
export function detectNomineeRisk(p: Profile): NomineeResult {
  const ind: RiskIndicator[] = []
  const unknowns: string[] = []
  if (!hasCompany(p)) {
    return { level: 'LOW', indicators: [], unknowns: [], stop: false, headline: tr('nom.none.h'), answer: tr('nom.none.a'), reason: tr('nom.none.r'), next: [tr('nom.none.n')] }
  }
  p.holders.forEach((h) => {
    const v = { holder: holderName(h), percent: h.percent }
    if (Math.abs(h.capital - h.percent) >= GAP) ind.push(mkInd('fund-' + h.id, { ...v, value: h.capital }))
    if (Math.abs(h.economic - h.percent) >= GAP) ind.push(mkInd('eco-' + h.id, { ...v, value: h.economic }))
    if (Math.abs(h.voting - h.percent) >= GAP || Math.abs(h.board - h.percent) >= GAP) ind.push(mkInd('ctl-' + h.id, v))
  })
  const maj = majority(p)
  ;(p.unknownFacts ?? []).forEach((u) => unknowns.push(tr(K('unk.' + u))))
  if (p.realInvestor === 'unknown') unknowns.push(tr('unk.realInvestor'))
  else if (p.realInvestor !== 'shared' && p.realInvestor !== maj.id && maj.percent > 50) ind.push(mkInd('investor', {}))
  if (p.operator === 'unknown') unknowns.push(tr('unk.operator'))
  else if (p.operator !== 'joint' && p.operator !== maj.id && maj.percent > 50) ind.push(mkInd('operator', {}))
  if (p.sideAgreement === 'yes') ind.push(mkInd('agr', {}))
  if (p.sideAgreement === 'unknown') unknowns.push(tr('unk.agreement'))
  if (Math.round(holdersSum(p)) !== 100) unknowns.push(tr('unk.sum'))

  // Severity is not a plain count: some combinations are serious on their own.
  //  - funding that does not match shareholding + any second indicator
  //  - an undisclosed side agreement + a funding / control / real-investor / management mismatch
  //  - three or more different kinds of indicators
  const types = new Set(ind.map((i) => i.key.split('-')[0]))
  const critical = (types.has('fund') && types.size >= 2) || (types.has('agr') && ['fund', 'ctl', 'investor', 'operator'].some((x) => types.has(x)))
  const level: Level = types.size >= 3 || critical ? 'HIGH' : types.size >= 1 ? 'MEDIUM' : unknowns.length ? 'NEEDS_REVIEW' : 'LOW'
  const stop = level === 'HIGH'
  const next =
    level === 'LOW' ? [tr('nom.next.low')]
    : level === 'NEEDS_REVIEW' ? [tr('nom.next.rev1'), tr('nom.next.rev2')]
    : [tr('nom.next.s1'), tr('nom.next.s2'), tr('nom.next.s3'), tr('nom.next.s4')]
  return {
    level, indicators: ind, unknowns, stop, next,
    headline: level === 'LOW' ? tr('nom.h.low') : tr('nom.h.flag'),
    answer: level === 'LOW' ? tr('nom.a.low') : tr('nom.a.flag'),
    reason: ind.length ? tr('nom.r.ind', { n: ind.length }) : unknowns.length ? tr('nom.r.unk') : tr('nom.r.ok'),
  }
}

/** ผลกระทบที่อาจเกี่ยวข้อง — ไม่ระบุโทษเฉพาะเจาะจงเพราะข้อเท็จจริงยังไม่พอ */
export const noPenalty = () => tr('cons.none')
export function consequences(p: Profile) {
  const c = targetCountry(p)
  return [
    { id: 1, issue: tr('cons.1.issue'), law: tr(K(`cons.1.law.${c}`)), regId: c === 'TH' ? 'th-fba' : 'cn-neglist-2024', consequence: noPenalty(), why: tr('cons.1.why'), v: 'EXPERT' as Verification, next: tr('cons.1.next') },
    { id: 2, issue: tr('cons.2.issue'), law: tr(K(`cons.2.law.${c}`)), regId: c === 'TH' ? 'th-dbd-reg' : 'cn-fil', consequence: noPenalty(), why: tr('cons.2.why'), v: 'NEED_INFO' as Verification, next: tr('cons.2.next') },
  ]
}
export const compliantOptions = () => (['A', 'B', 'C', 'D'] as const).map((k) => ({ k, t: tr(K(`copt.${k}.t`)), d: tr(K(`copt.${k}.d`)) }))

/* ---------- Employment ---------- */
export function analyzeEmployment(e: EmploymentInput, p: Profile | null): EmploymentArea[] {
  const tc = p ? targetCountry(p) : 'CN'
  const cross = /send|cross/.test(e.mode ?? '')
  const miss = (v?: string) => !(v ?? '').trim()
  const sid = (th: string, cn: string) => (tc === 'TH' ? th : cn)
  const row = (id: string, v: string | undefined, sourceId: string, forceReview = false): EmploymentArea => {
    const area = tr(K(`emp.a.${id}`))
    if (miss(v)) return { id, area, status: 'NEEDS_REVIEW', note: tr('emp.missing'), sourceId, missing: true }
    return { id, area, status: forceReview ? 'NEEDS_REVIEW' : 'LOW', note: tr(K(`emp.n.${id}`)), sourceId, missing: false }
  }
  return [
    row('employer', p ? dv(p.companyName) : '', sid('th-dbd-reg', 'cn-fil')),
    row('nationality', e.nationality, sid('th-labour', 'cn-immigration')),
    row('location', e.location, sid('th-labour', 'cn-labor')),
    row('duration', e.duration, sid('th-labour', 'cn-labor'), true),
    row('salary', e.salary, sid('th-tax', 'cn-tax'), true),
    row('hours', e.hours, sid('th-labour', 'cn-labor'), true),
    row('leave', e.leave, sid('th-labour', 'cn-labor'), true),
    row('social', e.socialSecurity, sid('th-labour', 'cn-labor'), true),
    row('workauth', e.workAuth, sid('th-labour', 'cn-immigration'), true),
    row('contract', e.mode, sid('th-labour', 'cn-labor'), true),
    row('tax', e.tax || (cross ? '' : 'x'), sid('th-tax', 'cn-tax'), true),
  ]
}

/* ---------- Risk cards ---------- */
/** Risks + their knowledge-base links (requirement → authority → evidence). With an employee check, one more card summarises it. */
export function assessRisks(p: Profile, emp: EmploymentInput, ec?: EmployeeCheck): RiskCardData[] {
  const reqs = retrieveRequirements(contextFrom(p, ec))
  const out = baseRisks(p, emp).map((r) => ({ ...r, sourceIds: [...new Set(r.sourceIds)], ...(r.level === 'LOW' && !r.sourceIds.length ? {} : riskLinks(r.id, reqs)) }))
  if (ec && ecStarted(ec)) {
    const items = evaluateEmployeeCheck(ec, targetCountry(p))
    const c = ecCounts(items)
    const open = items.filter((i) => i.status === 'POTENTIAL_COMPLIANCE_ISSUE' || i.status === 'NEEDS_INFORMATION' || i.status === 'NEEDS_VERIFICATION')
    const title = (id: string) => tr(K('ec.i.' + id + '.t'))
    const rids = [...new Set(open.flatMap((i) => i.requirementIds))]
    out.push({
      id: 'employee', category: tr('ec.risk'), level: c.p ? 'HIGH' : open.length ? 'NEEDS_REVIEW' : 'LOW', verification: 'NEED_INFO',
      found: tr('ec.summary', c), why: tr('ec.disclaimer'),
      unknown: items.filter((i) => i.status === 'NEEDS_INFORMATION').map((i) => title(i.id)),
      check: items.filter((i) => i.status === 'POTENTIAL_COMPLIANCE_ISSUE' || i.status === 'NEEDS_VERIFICATION').map((i) => title(i.id)),
      next: open.length ? tr(K('ec.i.' + (open.find((i) => i.status === 'POTENTIAL_COMPLIANCE_ISSUE') ?? open[0]).id + '.next')) : tr('risk.next.na'),
      sourceIds: [...new Set(rids.flatMap((id) => requirementOf(id)?.sources ?? []))],
      requirementIds: rids, authorityIds: [...new Set(open.flatMap((i) => i.authorityIds))], evidence: [...new Set(open.flatMap((i) => i.evidence))],
    })
  }
  return out
}
function baseRisks(p: Profile, emp: EmploymentInput): RiskCardData[] {
  const tc = targetCountry(p)
  const nom = detectNomineeRisk(p)
  const dims = ownershipDims(p)
  const ownLvl: Level = dims.some((d) => d.status === 'HIGH') ? 'HIGH' : dims.filter((d) => d.status === 'NEEDS_REVIEW').length >= 2 ? 'MEDIUM' : dims.some((d) => d.status === 'NEEDS_REVIEW') ? 'NEEDS_REVIEW' : 'LOW'
  const empAreas = analyzeEmployment(emp, p)
  const missEmp = empAreas.filter((a) => a.missing).length
  const restricted = ['retail', 'service'].includes(p.businessType)
  const regulated = !!p.regulatedGoods && p.regulatedGoods !== 'none'
  const nr = restricted || regulated
  const legalSrc = tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'
  // does the plan involve people at all? if not, employment and employee-tax findings are not relevant yet
  const staff = p.forms.includes('hire') || p.forms.includes('send') || p.employees > 0 || p.crossBorderWorkers
  // place-specific checks (only facts that hold for the whole area; details are left to verification)
  const placeChecks = [...(p.destProvince && ['TH-20', 'TH-21', 'TH-24'].includes(p.destProvince) ? [tr('risk.legal.c.eec')] : []), ...(p.destProvince?.startsWith('CN-') ? [tr('risk.legal.c.ftz', { place: tr(K('prov.' + p.destProvince)) })] : [])]
  // a mismatch is a known difference; an unanswered side-agreement question is an unknown, not a mismatch
  const flagged = dims.filter((d) => d.status !== 'LOW' && !(d.key === 'agr' && p.sideAgreement === 'unknown')).map((d) => d.title)
  const ownUnknown = [...(p.unknownFacts ?? []).map((u) => tr(K('unk.' + u))), ...(hasCompany(p) && p.sideAgreement === 'unknown' ? [tr('unk.agreement')] : [])]
  const missing = (ids?: string[]) => empAreas.filter((a) => a.missing && (!ids || ids.includes(a.id))).map((a) => a.area)
  return [
    { id: 'legal', category: tr('risk.cat.legal'), level: nr ? 'NEEDS_REVIEW' : 'MEDIUM', verification: 'NEED_INFO', found: tr('risk.found.legal'), unknown: [], why: tr(nr ? 'risk.legal.why.review' : 'risk.legal.why.base'),
      sourceIds: [legalSrc], check: [tr('risk.legal.c1'), tr('risk.legal.c2'), ...placeChecks], next: tr('risk.legal.next') },
    { id: 'ownership', category: tr('risk.cat.ownership'), level: ownLvl, verification: 'NEED_INFO', found: flagged.length ? tr('risk.found.own.flag', { list: flagged.join(', ') }) : ownUnknown.length ? tr('risk.found.own.unk', { n: ownUnknown.length }) : tr('risk.found.own.ok'), unknown: ownUnknown, why: tr('risk.own.why'), sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-fba'],
      check: dims.filter((d) => d.status !== 'LOW').map((d) => d.title), next: tr('risk.own.next') },
    { id: 'nominee', category: tr('risk.cat.nominee'), level: nom.level, verification: nom.level === 'LOW' ? 'NEED_INFO' : 'EXPERT', found: nom.headline, unknown: nom.unknowns, why: nom.reason, sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-fba'],
      check: [...new Set(nom.indicators.map((i) => i.verify))].slice(0, 3), next: nom.next[0] },
    ...(staff ? <RiskCardData[]>[{ id: 'employment', category: tr('risk.cat.employment'), level: 'NEEDS_REVIEW', verification: 'NEED_INFO', found: missEmp ? tr('risk.found.emp.miss', { n: missEmp }) : tr('risk.found.emp.ok'), unknown: missing(), why: missEmp ? tr('risk.emp.why.miss', { n: missEmp }) : tr('risk.emp.why.ok'),
      sourceIds: [tc === 'CN' ? 'cn-labor' : 'th-labour', tc === 'CN' ? 'cn-immigration' : 'th-labour'], check: empAreas.filter((a) => a.status !== 'LOW').slice(0, 4).map((a) => a.area), next: tr('risk.emp.next') }] : [{ id: 'employment', category: tr('risk.cat.employment'), level: 'LOW' as Level, verification: 'NEED_INFO' as Verification, found: tr('risk.found.emp.na'), unknown: [], why: tr('risk.found.emp.na'), sourceIds: [], check: [], next: tr('risk.next.na') }]),
    ...(staff ? <RiskCardData[]>[{ id: 'tax', category: tr('risk.cat.tax'), level: p.crossBorderWorkers ? 'MEDIUM' : 'NEEDS_REVIEW', verification: 'NEED_INFO', found: tr('risk.found.tax'), unknown: missing(['salary', 'tax', 'duration']), why: tr(p.crossBorderWorkers ? 'risk.tax.why.cross' : 'risk.tax.why.none'),
      sourceIds: [tc === 'CN' ? 'cn-tax' : 'th-tax'], check: [tr('risk.tax.c1'), tr('risk.tax.c2'), tr('risk.tax.c3')], next: tr('risk.tax.next') }] : [{ id: 'tax', category: tr('risk.cat.tax'), level: 'LOW' as Level, verification: 'NEED_INFO' as Verification, found: tr('risk.found.tax.na'), unknown: [], why: tr('risk.found.tax.na'), sourceIds: [], check: [], next: tr('risk.next.na') }]),
    { id: 'language', category: tr('risk.cat.language'), level: 'MEDIUM', verification: 'NEED_INFO', found: tr('risk.found.language'), unknown: [], why: tr('risk.lang.why'), sourceIds: [tc === 'CN' ? 'cn-labor' : 'th-labour'],
      check: [tr('risk.lang.c1'), tr('risk.lang.c2')], next: tr('risk.lang.next') },
    { id: 'culture', category: tr('risk.cat.culture'), level: 'LOW', verification: 'NEED_INFO', found: tr('risk.found.culture'), unknown: [], why: tr('risk.cul.why'), sourceIds: [], check: [tr('risk.cul.c1')], next: tr('risk.cul.next') },
    { id: 'documents', category: tr('risk.cat.documents'), level: 'MEDIUM', verification: 'NEED_INFO', found: tr('risk.found.documents'), unknown: [], why: tr('risk.doc.why'), sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-dbd-reg'],
      check: [tr('risk.doc.c1'), tr('risk.doc.c2'), tr('risk.doc.c3')], next: tr('risk.doc.next') },
  ]
}

/* ---------- Risk → Action ---------- */
export function deriveActions(p: Profile, emp: EmploymentInput): ActionItem[] {
  const out: ActionItem[] = []
  const nom = detectNomineeRisk(p)
  const me = tr('act.owner.me')
  for (const r of assessRisks(p, emp)) {
    if (r.level === 'LOW' || r.id === 'employee') continue // employee-check actions come from compliance.employeeActions
    if (r.id === 'nominee') {
      const seen = new Set<string>()
      nom.indicators.forEach((i) => { const k = i.key.split('-')[0]; if (seen.has(k)) return; seen.add(k); out.push({ id: 'act-nominee-' + k, riskId: r.id, riskLabel: r.category, title: i.next, owner: me, status: 'todo' }) })
      if (nom.stop || nom.level === 'MEDIUM') out.push({ id: 'act-nominee-expert', riskId: r.id, riskLabel: r.category, title: tr('act.expert'), owner: tr('act.owner.expert'), status: 'todo' })
      if (!nom.indicators.length) out.push({ id: 'act-nominee-info', riskId: r.id, riskLabel: r.category, title: nom.next[0], owner: me, status: 'todo' })
      continue
    }
    out.push({ id: 'act-' + r.id, riskId: r.id, riskLabel: r.category, title: r.next, owner: r.id === 'tax' ? tr('act.owner.tax') : r.id === 'employment' ? tr('act.owner.hr') : me, status: 'todo' })
  }
  return out
}
export const riskRoute = (riskId: string) => ({ nominee: 'ownership', ownership: 'ownership', employment: 'employment', legal: 'navigator', employee: 'employee', req: 'plan', tax: 'employment', language: 'employment', culture: 'language', documents: 'documents' }[riskId] ?? 'roadmap')

/* ---------- Roadmap ---------- */
export function generateRoadmap(p: Profile): RoadmapStep[] {
  const nom = detectNomineeRisk(p)
  const flagged = nom.level !== 'LOW'
  const tc = targetCountry(p)
  const S = (id: number, docs: number, status: RoadmapStep['status'], o: { desc?: string; next?: string; note?: string } = {}): RoadmapStep => ({
    id, title: tr(K(`rm.${id}.t`)), description: o.desc ?? tr(K(`rm.${id}.d`)), docs: Array.from({ length: docs }, (_, i) => tr(K(`rm.${id}.doc${i + 1}`))),
    why: tr(K(`rm.${id}.w`)), next: o.next ?? tr(K(`rm.${id}.n`)), status, note: o.note,
  })
  return [
    S(1, 2, 'done'),
    S(2, 2, 'review', { desc: tr(K(`rm.2.d.${tc}`)) }),
    S(3, 3, flagged ? 'fix' : 'review', { next: flagged ? tr('rm.3.n.flag') : tr('rm.3.n.ok'), note: flagged ? tr('rm.3.note') : undefined }),
    S(4, 2, flagged ? 'fix' : 'review', { next: nom.next[0], note: flagged ? tr('rm.4.note') : undefined }),
    S(5, 2, 'doing'),
    S(6, 3, 'todo'),
    S(7, 1, 'todo', { next: flagged ? tr('rm.7.n.flag') : tr('rm.7.n.ok'), note: flagged ? tr('rm.7.note') : undefined }),
    S(8, 1, 'todo'),
  ]
}

/* ---------- Contract (one structured dataset → three language versions) ---------- */
export const contractKeys: (keyof ContractInput)[] = ['employer', 'employee', 'nationality', 'job', 'location', 'startDate', 'duration', 'salary', 'hours', 'leave', 'probation']
export const contractLabel = (k: keyof ContractInput) => tr(K(`ctr.f.${k}`))
export const draftNote = () => tr('draft.note')
function contractText(c: ContractInput): string {
  const v = (x: string) => (dv(x).trim() ? dv(x).trim() : tr('ctr.miss'))
  return [
    tr('ctr.t.title'), tr('draft.note'), '',
    tr('ctr.t.a1', { employer: v(c.employer), employee: v(c.employee), nationality: v(c.nationality) }),
    tr('ctr.t.a2', { job: v(c.job) }), tr('ctr.t.a3', { location: v(c.location) }), tr('ctr.t.a4', { start: v(c.startDate), duration: v(c.duration) }),
    tr('ctr.t.a5', { probation: v(c.probation) }), tr('ctr.t.a6', { salary: v(c.salary) }), tr('ctr.t.a7', { benefits: v(c.benefits) }),
    tr('ctr.t.a8', { hours: v(c.hours) }), tr('ctr.t.a9', { leave: v(c.leave) }), tr('ctr.t.a10', { other: v(c.other) }), tr('ctr.t.a11'), tr('ctr.t.a12'),
  ].join('\n')
}
export function generateContract(c: ContractInput, mode = '') {
  const missing = contractKeys.filter((k) => !dv(c[k]).trim())
  const cross = /send|cross/.test(mode ?? "")
  const checks: { t: string; id: string; v: Verification }[] = [
    { t: tr('ctr.chk.1'), id: 'cn-labor', v: 'NEED_INFO' }, { t: tr('ctr.chk.2'), id: 'cn-labor', v: 'NEED_INFO' }, { t: tr('ctr.chk.3'), id: 'cn-immigration', v: 'NEED_INFO' },
    { t: tr('ctr.chk.4'), id: 'cn-tax', v: 'NEED_INFO' }, { t: tr('ctr.chk.5'), id: 'cn-labor', v: 'EXPERT' },
    ...(cross ? [{ t: tr('ctr.chk.x1'), id: 'cn-labor', v: 'NEED_INFO' as Verification }, { t: tr('ctr.chk.x2'), id: 'cn-tax', v: 'EXPERT' as Verification }]
      : mode ? [{ t: tr('ctr.chk.l1'), id: 'cn-labor', v: 'NEED_INFO' as Verification }] : []),
  ]
  const text = { th: withLang('th', () => contractText(c)), zh: withLang('zh', () => contractText(c)), en: withLang('en', () => contractText(c)) } as Record<Lang, string>
  return { missing, checks, text, ready: !!(dv(c.employer).trim() && dv(c.employee).trim() && dv(c.job).trim()), completeness: Math.round(((contractKeys.length - missing.length) / contractKeys.length) * 100) }
}

/* ---------- Documents ---------- */
export const docIds = ['brief', 'business', 'ownership', 'employment', 'contract', 'report', 'translation', 'plan'] as const
export type DocType = (typeof docIds)[number]
export const docTitle = (t: DocType) => tr(K(`doc.${t}.t`))
export const docDesc = (t: DocType) => tr(K(`doc.${t}.d`))
/** "Thailand · Chon Buri → China · Shanghai" (provinces only when chosen on the map). */
export function routeText(p: Profile): string {
  const from = p.direction === 'TH_CN' ? 'TH' : 'CN', to = from === 'TH' ? 'CN' : 'TH'
  const part = (c: string, pr?: string) => tk('country', c) + (pr ? ' · ' + tr(K('prov.' + pr)) : '')
  return `${part(from, p.originProvince)} → ${part(to, p.destProvince)}`
}
export function buildDocument(type: DocType, p: Profile, emp: EmploymentInput, con: ContractInput, lang: Lang, actions: ActionItem[] = []) {
  return withLang(lang, () => {
    const head = `${docTitle(type)}\n${tr('doc.brand')}\n${tr('doc.head', { company: dv(p.companyName), dir: tk('dir', p.direction) })}\n${tr('doc.created', { date: new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : lang === 'zh' ? 'zh-CN' : 'en-GB') })}\n`
    let body = ''
    if (type === 'business') body = [tr('doc.b.1', { v: dv(p.activity) }), tr('doc.b.2'), tr('doc.b.3', { v: p.regulatedGoods ? tk('opt.regulated', p.regulatedGoods) : '-' }), tr('doc.b.4', { v: p.crossBorder.map((x) => tk('opt.cross', x)).join(', ') || '-' })].map((x) => '☐ ' + x).join('\n')
    if (type === 'ownership') body = [...p.holders.map((h) => '☐ ' + tr('doc.o.holder', { holder: holderName(h), percent: h.percent, capital: h.capital, economic: h.economic })), '☐ ' + tr('doc.o.1'), '☐ ' + tr('doc.o.2'), '☐ ' + tr('doc.o.3')].join('\n')
    if (type === 'employment') body = analyzeEmployment(emp, p).map((a) => `☐ ${a.area} — ${a.status === 'LOW' ? tr('doc.e.has') : tr('doc.e.review')}`).join('\n')
    if (type === 'contract') { const g = generateContract(con, emp.mode); body = `${draftNote()}\n\n${tr('doc.c.missing')}\n${g.missing.map((m) => '- ' + contractLabel(m)).join('\n') || '-'}\n\n${g.text[lang]}` }
    if (type === 'report') body = assessRisks(p, emp).map((r) => `• ${r.category}: ${tk('level', r.level)} — ${r.why}\n  ${tr('doc.r.next')}: ${r.next}`).join('\n') + `\n\n${tr('c.disclaimer')}`
    if (type === 'translation') body = terms.map((x) => `${tr(K(`term.${x.n}.n`))} | ${x.orig} | ${tr(K(`term.${x.n}.m`))}`).join('\n')
    if (type === 'brief') {
      const nom = detectNomineeRisk(p)
      const risks = assessRisks(p, emp).filter((r) => r.level !== 'LOW')
      const from = p.direction === 'TH_CN' ? 'TH' : 'CN'
      const sec = (k: string) => `\n■ ${tr(K('doc.br.' + k))}`
      const L: string[] = [sec('route'), routeText(p)]
      L.push(sec('biz'), `${tr(K('bp.type'))}: ${p.businessType === 'other' && p.businessTypeOther ? p.businessTypeOther : tk('opt.btype', p.businessType)}`, `${tr(K('bp.activity'))}: ${dv(p.activity) || '-'}`,
        `${tr('doc.br.forms')}: ${p.forms.map((f) => tk('opt.forms', f, { from: tk('country', from) })).join(', ') || '-'}`, `${tr('doc.br.staff')}: ${p.employees}`)
      if (hasCompany(p)) L.push(sec('own'), ...p.holders.map((h) => { const unk = new Set(p.unknownFacts ?? []); const v = (fact: string, n: number) => (unk.has(fact) ? '?' : n + '%'); return tr('doc.br.holder', { holder: holderName(h), percent: v('shares', h.percent), capital: v('funding', h.capital), voting: v('voting', h.voting), board: v('board', h.board), economic: v('economic', h.economic) }) }), ...nom.unknowns.map((u) => '? ' + u))
      L.push(sec('found'), ...(risks.length ? risks.map((r) => `• ${r.category} [${tk('level', r.level)} · ${tk('verify', r.verification)}]\n  ${r.found}\n  ${tr('find.why')}: ${r.why}`) : [tr('find.none')]))
      const qs = [...new Set([...risks.flatMap((r) => r.unknown), ...risks.flatMap((r) => r.check)])].slice(0, 12)
      L.push(sec('ask'), ...(qs.length ? qs.map((q, i) => `${i + 1}. ${q}`) : ['-']))
      const open = actions.filter((a) => a.status !== 'done')
      if (actions.length) L.push(sec('tasks'), tr('doc.br.taskCount', { done: actions.length - open.length, total: actions.length }), ...open.slice(0, 8).map((a) => '☐ ' + a.title))
      const ids = [...new Set(risks.flatMap((r) => r.sourceIds))]
      L.push(sec('src'), ...ids.map((id) => { const c = liveLegal.cite(id); return `- ${tr(K('reg.' + id + '.auth'))}: ${tr(K('reg.' + id + '.title'))} — ${c ? tk('verify', toVerification(c.trust)) : '-'}` }))
      body = L.join('\n')
    }
    if (type === 'plan') body = generateRoadmap(p).map((s) => `${tr('doc.p.step', { n: s.id })} ${s.title}\n  ${s.description}\n  ${tr('doc.p.docs')}: ${s.docs.join(', ')}\n  ${tr('doc.p.next')}: ${s.next}`).join('\n')
    return { title: docTitle(type), text: head + '\n' + body + `\n\n${tr('c.disclaimer')}`, lang }
  })
}
export const docToHtml = (title: string, text: string, lang: Lang) =>
  `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : lang}"><meta charset="utf-8"><title>${escapeHtml(title)}</title><body style="font-family:'Noto Sans Thai','Microsoft YaHei',sans-serif;max-width:800px;margin:2rem auto;line-height:1.7"><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre></body></html>`

/* ---------- Orchestrator ---------- */
/**
 * Intent screening for the free-text assistant. This is a keyword/pattern heuristic, NOT a safety system:
 * the engines below only return templated, lawful guidance, so they cannot produce concealment instructions.
 * When a real LLM is connected, it needs its own policy + a proper classifier (see README).
 */
const LAWFUL = /(legally|lawful|lawfully|in compliance|compliant|ถูกกฎหมาย|โดยชอบด้วยกฎหมาย|合法|合规)/i
const CONCEAL = /(hide|conceal|disguise|mask|cover up|keep (it )?secret|ซ่อน|ปกปิด|อำพราง|ปิดบัง|隐瞒|隐藏|掩盖)/i
const EVADE_VERB = /(avoid|bypass|circumvent|evade|get around|sidestep|work around|หลบ|เลี่ยง|หลีกเลี่ยง|规避|绕过|绕开|避开)/i
const OWN_NOUN = /(owner|ownership|shareholder|shares?|stake|investor|foreign (ownership|investment)|restriction|limit|threshold|negative list|เจ้าของ|ผู้ถือหุ้น|หุ้น|ผู้ลงทุน|ข้อจำกัด|สัดส่วน|股|所有|投资|限制|比例)/i
const NOMINEE = /(nominee|straw ?(man|person)|fake shareholder|dummy shareholder|proxy shareholder|นอมินี|ถือหุ้นแทน|คนถือหุ้นแทน|ผู้ถือหุ้นปลอม|代持|假股东|挂名|名义股东)/i
const SETUP = /(set ?up|create|arrange|find|get|hir(?:e|ing)|use|appoint|recruit|need|want|หา|จัดตั้ง|จัดหา|ใช้|อยากได้|ต้องการ|找|安排|设立|需要|想)/i
const NAME_TRICK = /((in|under)\s+(a\s+|my\s+)?(friend|relative|cousin|someone|another person|somebody|employee)('s)?\s+name|ใช้ชื่อ(คน|เพื่อน|ญาติ|ลูกน้อง)|ใส่ชื่อ(คน|เพื่อน|ญาติ)|借.{0,4}名)/i
const EDU = /(what is|what are|explain|meaning|define|is it (legal|illegal|allowed)|risk|why|คืออะไร|หมายความว่า|อธิบาย|ผิดกฎหมายไหม|ผิดไหม|ทำได้ไหม|เสี่ยง|什么是|是什么|是否合法|违法吗|风险|为什么)/i
export type Intent = 'evade' | 'educate' | 'normal'
export function classifyIntent(q: string): Intent {
  if ((CONCEAL.test(q) && OWN_NOUN.test(q)) || (EVADE_VERB.test(q) && OWN_NOUN.test(q) && !LAWFUL.test(q)) || NAME_TRICK.test(q)) return 'evade'
  if (NOMINEE.test(q)) return EDU.test(q) ? 'educate' : SETUP.test(q) ? 'evade' : 'educate'
  return 'normal'
}
const MODS: [RegExp, string][] = [
  [/พนักงาน|จ้าง|แรงงาน|สัญญาจ้าง|ส่งไป|employ|staff|hir(?:e|ing)|worker|secon|员工|雇|用工|派/i, 'Employment AI'], [/ภาษี|tax|税/i, 'Tax Analysis AI'], [/หุ้น|ผู้ถือหุ้น|เจ้าของ|ควบคุม|share|owner|control|股|控制/i, 'Ownership Analysis AI'],
  [/นอมินี|ผู้ลงทุนจริง|แหล่งเงิน|nominee|real investor|source of fund|代持|实际投资/i, 'Nominee Risk AI'], [/สัญญา|เอกสาร|ร่าง|contract|document|draft|合同|文件|草案/i, 'Document AI'],
  [/ภาษา|แปล|จีน|อังกฤษ|language|translat|语言|翻译/i, 'Language AI'], [/วัฒนธรรม|เจรจา|ประชุม|สื่อสาร|culture|negotiat|meeting|文化|谈判|会议/i, 'Culture & Communication AI'],
  [/กฎหมาย|ลงทุน|ใบอนุญาต|ข้อจำกัด|เปิดบริษัท|law|invest|licen|restrict|company|法|投资|许可|公司/i, 'Legal Analysis AI'],
]
/** Which regulation records an answer for these modules rests on (deduplicated, one or both countries). */
function pickSources(modules: string[], hit: boolean, countries: ('TH' | 'CN')[]): string[] {
  const ids = countries.flatMap((c) => {
    const cn = c === 'CN'
    return hit ? [cn ? 'cn-neglist-2024' : 'th-fba']
      : modules.includes('Employment AI') ? [cn ? 'cn-labor' : 'th-labour', ...(cn ? ['cn-immigration'] : [])]
      : modules.includes('Tax Analysis AI') ? [cn ? 'cn-tax' : 'th-tax']
      : [cn ? 'cn-neglist-2024' : 'th-fba']
  })
  return [...new Set(ids)]
}
/** Employment instruments the registry knows by name only (no reviewed content in the app). Shown so the gap is visible, not hidden. */
const employmentGaps = (countries: ('TH' | 'CN')[]) => registry.filter((e) => e.gap && e.area === 'employment' && countries.includes(e.country)).map((e) => e.id)

export function orchestrate(q: string, p: Profile | null, lang?: Lang, legal: LegalView = liveLegal): AIResponse {
  const run = (): AIResponse => {
    /** Every answer passes the legal guard (citations, grounding, unsupported-claim check). Employment answers also list the instruments the app has no content for. */
    const fin = (r: AIResponse, gapIds: string[] = []): AIResponse => {
      const g = guardResponse(r, legal, { lang })
      const gaps = gapIds.map((id) => legal.cite(id, lang)).filter((c): c is Citation => !!c)
      if (!gaps.length) return g
      return { ...g, citations: [...(g.citations ?? []), ...gaps], grounding: g.grounding === 'VERIFIED' ? 'PARTIAL' : g.grounding }
    }
    const intent = classifyIntent(q)
    if (intent === 'evade')
      return fin({ blocked: true, kind: 'blocked', modules: ['Legal Analysis AI', 'Nominee Risk AI'], risk: 'HIGH', answer: tr('orch.block.a'), reason: tr('orch.block.r'), sources: ['th-fba', 'cn-neglist-2024'], next: tr('orch.block.n') })
    if (intent === 'educate')
      return fin({ kind: 'educational', modules: ['Legal Analysis AI', 'Nominee Risk AI'], risk: 'NEEDS_REVIEW', answer: tr('orch.edu.a'), reason: tr('orch.edu.r'), sources: ['th-fba', 'cn-neglist-2024'], next: tr('orch.edu.n') })
    const modules = MODS.filter(([r]) => r.test(q)).map(([, n]) => n)
    const isStaff = /ส่ง.*พนักงาน|พนักงาน.*(ไป|ข้าม)|send.*(staff|employee)|secon|派.*员工|外派/i.test(q)
    if (/พนักงาน|จ้าง|ส่งไป|staff|employ|hir(?:e|ing)|员工|雇|外派/i.test(q) && !modules.includes('Legal Analysis AI')) modules.push('Legal Analysis AI')
    if (isStaff) for (const x of ['Tax Analysis AI', 'Document AI']) if (!modules.includes(x)) modules.push(x)
    if (/สัญญา|contract|合同/i.test(q) && !modules.includes('Language AI')) modules.push('Language AI')
    const employment = modules.includes('Employment AI') || /สัญญาจ้าง|contract|合同/i.test(q)
    if (asksSpecificDetail(q)) {
      // Exact penalties / figures / periods / article numbers: only a verified record may be quoted; otherwise say plainly that the app cannot answer.
      const cs: ('TH' | 'CN')[] = p ? [targetCountry(p)] : ['TH', 'CN']
      const ms = employment ? [...modules, 'Employment AI'] : modules
      return fin(answerSpecific(ms.length ? pickSources(ms, false, cs) : [], modules, legal), employment ? employmentGaps(cs) : [])
    }
    if (!p) return fin({ modules: ['Business Intake AI'], risk: 'NEEDS_REVIEW', answer: tr('orch.nop.a'), reason: tr('orch.nop.r'), sources: [], next: tr('orch.nop.n') })
    if (!modules.length) return fin({ modules: ['Business Intake AI'], risk: 'NEEDS_REVIEW', answer: tr('orch.noq.a'), reason: tr('orch.noq.r'), sources: [], next: tr('orch.noq.n') })
    const tc = targetCountry(p)
    const nom = detectNomineeRisk(p)
    const hit = modules.includes('Nominee Risk AI') || modules.includes('Ownership Analysis AI')
    const srcs = pickSources(modules, hit, [tc])
    return fin({
      modules, sources: srcs, risk: (hit ? nom.level : 'NEEDS_REVIEW') as Level,
      answer: hit ? nom.answer : tr('orch.gen.a'),
      reason: hit ? nom.reason : tr('orch.gen.r', { n: modules.length, company: dv(p.companyName) }),
      next: hit ? nom.next[0] : tr('orch.gen.n'),
    }, !hit && modules.includes('Employment AI') ? employmentGaps([tc]) : [])
  }
  return lang ? withLang(lang, run) : run()
}

/* ---------- Verification layer ---------- */
export interface VerifyStep { name: string; ok: boolean; note: string }
export function verifyAnalysis(p: Profile, emp: EmploymentInput): { steps: VerifyStep[]; recheck: boolean; final: Verification } {
  const risks = assessRisks(p, emp)
  const srcIds = new Set(risks.flatMap((r) => r.sourceIds))
  const nom = detectNomineeRisk(p)
  const sumOk = Math.round(holdersSum(p)) === 100
  const steps: VerifyStep[] = [
    { name: tr('ver.1.n'), ok: srcIds.size > 0, note: tr('ver.1.t', { n: srcIds.size }) },
    { name: tr('ver.2.n'), ok: risks.filter((r) => r.category !== tr('risk.cat.culture')).every((r) => r.sourceIds.length > 0), note: tr('ver.2.t') },
    { name: tr('ver.3.n'), ok: sumOk, note: sumOk ? tr('ver.3.ok') : tr('ver.3.bad') },
    { name: tr('ver.4.n'), ok: analyzeEmployment(emp, p).every((a) => !a.missing), note: tr('ver.4.t') },
    { name: tr('ver.5.n'), ok: !nom.stop, note: nom.stop ? tr('ver.5.stop') : tr('ver.5.ok') },
  ]
  const final: Verification = steps.some((s) => !s.ok) ? (nom.stop ? 'EXPERT' : 'NEED_INFO') : 'NEED_INFO'
  return { steps, recheck: !steps[2].ok, final }
}
