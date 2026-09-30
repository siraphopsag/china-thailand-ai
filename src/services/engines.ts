import type {
  ActionItem, AIResponse, ContractInput, EmploymentArea, EmploymentInput, Holder, Level, NomineeResult, Profile, RiskCardData, RiskIndicator, RoadmapStep, Verification,
} from '../types'
import { dv, tk, tr, withLang, type Lang } from '../i18n/core.js'
import { escapeHtml } from '../utils/labels.js'
import { terms } from '../data/culture.js'
import type { MsgKey } from '../locales/index.js'

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

  const types = new Set(ind.map((i) => i.key.split('-')[0]))
  const level: Level = types.size >= 3 ? 'HIGH' : types.size >= 1 ? 'MEDIUM' : unknowns.length ? 'NEEDS_REVIEW' : 'LOW'
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
  const cross = /send|cross/.test(e.mode)
  const miss = (v: string) => !v.trim()
  const sid = (th: string, cn: string) => (tc === 'TH' ? th : cn)
  const row = (id: string, v: string, sourceId: string, forceReview = false): EmploymentArea => {
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
export function assessRisks(p: Profile, emp: EmploymentInput): RiskCardData[] {
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
  return [
    { id: 'legal', category: tr('risk.cat.legal'), level: nr ? 'NEEDS_REVIEW' : 'MEDIUM', verification: 'NEED_INFO', why: tr(nr ? 'risk.legal.why.review' : 'risk.legal.why.base'),
      sourceIds: [legalSrc], check: [tr('risk.legal.c1'), tr('risk.legal.c2')], next: tr('risk.legal.next') },
    { id: 'ownership', category: tr('risk.cat.ownership'), level: ownLvl, verification: 'NEED_INFO', why: tr('risk.own.why'), sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-fba'],
      check: dims.filter((d) => d.status !== 'LOW').map((d) => d.title), next: tr('risk.own.next') },
    { id: 'nominee', category: tr('risk.cat.nominee'), level: nom.level, verification: nom.level === 'LOW' ? 'NEED_INFO' : 'EXPERT', why: nom.reason, sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-fba'],
      check: nom.indicators.map((i) => i.verify).slice(0, 3), next: nom.next[0] },
    { id: 'employment', category: tr('risk.cat.employment'), level: 'NEEDS_REVIEW', verification: 'NEED_INFO', why: missEmp ? tr('risk.emp.why.miss', { n: missEmp }) : tr('risk.emp.why.ok'),
      sourceIds: [tc === 'CN' ? 'cn-labor' : 'th-labour', tc === 'CN' ? 'cn-immigration' : 'th-labour'], check: empAreas.filter((a) => a.status !== 'LOW').slice(0, 4).map((a) => a.area), next: tr('risk.emp.next') },
    { id: 'tax', category: tr('risk.cat.tax'), level: p.crossBorderWorkers ? 'MEDIUM' : 'NEEDS_REVIEW', verification: 'NEED_INFO', why: tr(p.crossBorderWorkers ? 'risk.tax.why.cross' : 'risk.tax.why.none'),
      sourceIds: [tc === 'CN' ? 'cn-tax' : 'th-tax'], check: [tr('risk.tax.c1'), tr('risk.tax.c2'), tr('risk.tax.c3')], next: tr('risk.tax.next') },
    { id: 'language', category: tr('risk.cat.language'), level: 'MEDIUM', verification: 'NEED_INFO', why: tr('risk.lang.why'), sourceIds: [tc === 'CN' ? 'cn-labor' : 'th-labour'],
      check: [tr('risk.lang.c1'), tr('risk.lang.c2')], next: tr('risk.lang.next') },
    { id: 'culture', category: tr('risk.cat.culture'), level: 'LOW', verification: 'NEED_INFO', why: tr('risk.cul.why'), sourceIds: [], check: [tr('risk.cul.c1')], next: tr('risk.cul.next') },
    { id: 'documents', category: tr('risk.cat.documents'), level: 'MEDIUM', verification: 'NEED_INFO', why: tr('risk.doc.why'), sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-dbd-reg'],
      check: [tr('risk.doc.c1'), tr('risk.doc.c2'), tr('risk.doc.c3')], next: tr('risk.doc.next') },
  ]
}

/* ---------- Risk → Action ---------- */
export function deriveActions(p: Profile, emp: EmploymentInput): ActionItem[] {
  const out: ActionItem[] = []
  const nom = detectNomineeRisk(p)
  const me = tr('act.owner.me')
  for (const r of assessRisks(p, emp)) {
    if (r.level === 'LOW') continue
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
export const riskRoute = (riskId: string) => ({ nominee: 'nominee', ownership: 'ownership', employment: 'employment', legal: 'roadmap', tax: 'employment', language: 'contract', culture: 'language', documents: 'documents' }[riskId] ?? 'risk')

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
  const cross = /send|cross/.test(mode)
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
export const docIds = ['business', 'ownership', 'employment', 'contract', 'report', 'translation', 'plan'] as const
export type DocType = (typeof docIds)[number]
export const docTitle = (t: DocType) => tr(K(`doc.${t}.t`))
export const docDesc = (t: DocType) => tr(K(`doc.${t}.d`))
export function buildDocument(type: DocType, p: Profile, emp: EmploymentInput, con: ContractInput, lang: Lang) {
  return withLang(lang, () => {
    const head = `${docTitle(type)}\n${tr('doc.head', { company: dv(p.companyName), dir: tk('dir', p.direction) })}\n${tr('doc.created', { date: new Date().toLocaleDateString(lang === 'th' ? 'th-TH' : lang === 'zh' ? 'zh-CN' : 'en-GB') })}\n`
    let body = ''
    if (type === 'business') body = [tr('doc.b.1', { v: dv(p.activity) }), tr('doc.b.2'), tr('doc.b.3', { v: p.regulatedGoods ? tk('opt.regulated', p.regulatedGoods) : '-' }), tr('doc.b.4', { v: p.crossBorder.map((x) => tk('opt.cross', x)).join(', ') || '-' })].map((x) => '☐ ' + x).join('\n')
    if (type === 'ownership') body = [...p.holders.map((h) => '☐ ' + tr('doc.o.holder', { holder: holderName(h), percent: h.percent, capital: h.capital, economic: h.economic })), '☐ ' + tr('doc.o.1'), '☐ ' + tr('doc.o.2'), '☐ ' + tr('doc.o.3')].join('\n')
    if (type === 'employment') body = analyzeEmployment(emp, p).map((a) => `☐ ${a.area} — ${a.status === 'LOW' ? tr('doc.e.has') : tr('doc.e.review')}`).join('\n')
    if (type === 'contract') { const g = generateContract(con, emp.mode); body = `${draftNote()}\n\n${tr('doc.c.missing')}\n${g.missing.map((m) => '- ' + contractLabel(m)).join('\n') || '-'}\n\n${g.text[lang]}` }
    if (type === 'report') body = assessRisks(p, emp).map((r) => `• ${r.category}: ${tk('level', r.level)} — ${r.why}\n  ${tr('doc.r.next')}: ${r.next}`).join('\n') + `\n\n${tr('c.disclaimer')}`
    if (type === 'translation') body = terms.map((x) => `${tr(K(`term.${x.n}.n`))} | ${x.orig} | ${tr(K(`term.${x.n}.m`))}`).join('\n')
    if (type === 'plan') body = generateRoadmap(p).map((s) => `${tr('doc.p.step', { n: s.id })} ${s.title}\n  ${s.description}\n  ${tr('doc.p.docs')}: ${s.docs.join(', ')}\n  ${tr('doc.p.next')}: ${s.next}`).join('\n')
    return { title: docTitle(type), text: head + '\n' + body + `\n\n${tr('c.disclaimer')}`, lang }
  })
}
export const docToHtml = (title: string, text: string, lang: Lang) =>
  `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : lang}"><meta charset="utf-8"><title>${escapeHtml(title)}</title><body style="font-family:'Noto Sans Thai','Microsoft YaHei',sans-serif;max-width:800px;margin:2rem auto;line-height:1.7"><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre></body></html>`

/* ---------- Orchestrator ---------- */
const EVASION = /(ปกปิด|ซ่อน.*(เจ้าของ|ผู้ถือหุ้น|ผู้ลงทุน)|หลบ|เลี่ยง.*(กฎหมาย|ข้อจำกัด|สัดส่วน)|ผู้ถือหุ้นปลอม|หาคน.*ถือหุ้นแทน|ถือหุ้นแทน|สัญญาลับ|สัญญาหลอก|hide.*(owner|shareholder)|bypass|circumvent|evade|fake shareholder|nominee.*(set ?up|create|find|arrange)|代持|隐瞒|隐藏.*(股东|所有)|规避|绕过|假股东|阴阳合同)/i
const MODS: [RegExp, string][] = [
  [/พนักงาน|จ้าง|แรงงาน|สัญญาจ้าง|ส่งไป|employ|staff|hire|worker|secon|员工|雇|用工|派/i, 'Employment AI'], [/ภาษี|tax|税/i, 'Tax Analysis AI'], [/หุ้น|ผู้ถือหุ้น|เจ้าของ|ควบคุม|share|owner|control|股|控制/i, 'Ownership Analysis AI'],
  [/นอมินี|ผู้ลงทุนจริง|แหล่งเงิน|nominee|real investor|source of fund|代持|实际投资/i, 'Nominee Risk AI'], [/สัญญา|เอกสาร|ร่าง|contract|document|draft|合同|文件|草案/i, 'Document AI'],
  [/ภาษา|แปล|จีน|อังกฤษ|language|translat|语言|翻译/i, 'Language AI'], [/วัฒนธรรม|เจรจา|ประชุม|สื่อสาร|culture|negotiat|meeting|文化|谈判|会议/i, 'Culture & Communication AI'],
  [/กฎหมาย|ลงทุน|ใบอนุญาต|ข้อจำกัด|เปิดบริษัท|law|invest|licen|restrict|company|法|投资|许可|公司/i, 'Legal Analysis AI'],
]
export function orchestrate(q: string, p: Profile | null, lang?: Lang): AIResponse {
  const run = () => {
    if (EVASION.test(q))
      return { blocked: true, modules: ['Legal Analysis AI', 'Nominee Risk AI'], risk: 'HIGH' as Level, answer: tr('orch.block.a'), reason: tr('orch.block.r'), sources: ['th-fba', 'cn-neglist-2024'], next: tr('orch.block.n') }
    const modules = MODS.filter(([r]) => r.test(q)).map(([, n]) => n)
    const isStaff = /ส่ง.*พนักงาน|พนักงาน.*(ไป|ข้าม)|send.*(staff|employee)|secon|派.*员工|外派/i.test(q)
    if (/พนักงาน|จ้าง|ส่งไป|staff|employ|hire|员工|雇|外派/i.test(q) && !modules.includes('Legal Analysis AI')) modules.push('Legal Analysis AI')
    if (isStaff) for (const x of ['Tax Analysis AI', 'Document AI']) if (!modules.includes(x)) modules.push(x)
    if (/สัญญา|contract|合同/i.test(q) && !modules.includes('Language AI')) modules.push('Language AI')
    if (!p) return { modules: ['Business Intake AI'], risk: 'NEEDS_REVIEW' as Level, answer: tr('orch.nop.a'), reason: tr('orch.nop.r'), sources: [], next: tr('orch.nop.n') }
    if (!modules.length) return { modules: ['Business Intake AI'], risk: 'NEEDS_REVIEW' as Level, answer: tr('orch.noq.a'), reason: tr('orch.noq.r'), sources: [], next: tr('orch.noq.n') }
    const tc = targetCountry(p)
    const nom = detectNomineeRisk(p)
    const hit = modules.includes('Nominee Risk AI') || modules.includes('Ownership Analysis AI')
    const srcs = hit ? [tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'] : modules.includes('Employment AI') ? [tc === 'CN' ? 'cn-labor' : 'th-labour', tc === 'CN' ? 'cn-immigration' : 'th-labour'] : modules.includes('Tax Analysis AI') ? [tc === 'CN' ? 'cn-tax' : 'th-tax'] : [tc === 'CN' ? 'cn-neglist-2024' : 'th-fba']
    return {
      modules, sources: srcs, risk: (hit ? nom.level : 'NEEDS_REVIEW') as Level,
      answer: hit ? nom.answer : tr('orch.gen.a'),
      reason: hit ? nom.reason : tr('orch.gen.r', { n: modules.length, company: dv(p.companyName) }),
      next: hit ? nom.next[0] : tr('orch.gen.n'),
    }
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
