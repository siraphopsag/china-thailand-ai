import { describe, expect, it } from 'vitest'
import type { AIResponse } from '../types'
import { registry } from '../data/legal/registry'
import { contentFingerprint, liveLegal, localText, makeLegalView } from '../data/legal/trust'
import { answerSpecific, asksSpecificDetail, findUnsupportedClaims, groundingOf, guardResponse } from './legalGuard'
import { isAIResponse } from './aiService'
import { orchestrate } from './engines'
import { buildProfile } from '../interview'

const NOW = new Date('2026-10-01T12:00:00Z')
/** Fixture: cn-labor has an official text link and a complete human review; everything else is live (unreviewed) data. */
const verifiedView = makeLegalView(
  registry.map((e) => (e.id === 'cn-labor' ? { ...e, textUrl: 'https://law.example.gov.cn/labor-contract-law' } : e)),
  [{ id: 'cn-labor', reviewer: 'Li Wei, China labour lawyer', reviewedAt: '2026-09-25', contentHash: contentFingerprint('cn-labor'), provisions: ['Art. 10'], effectiveDate: '2008-01-01' }],
  {}, () => NOW,
)
const draft = (answer: string, sources: string[], extra: Partial<AIResponse> = {}): AIResponse =>
  ({ answer, reason: 'r', next: 'n', sources, risk: 'NEEDS_REVIEW', modules: ['Employment AI'], ...extra })

describe('questions that ask for an exact legal detail', () => {
  it.each([
    'What is the penalty for hiring a foreigner without a work permit?', 'How many days of probation are allowed?', 'what is the minimum wage', 'Which article covers severance?',
    'โทษของการจ้างต่างด้าวไม่มีใบอนุญาตคืออะไร', 'ทดลองงานได้กี่เดือน', 'ค่าปรับเท่าไร', 'มาตราไหนพูดถึงค่าชดเชย',
    '没有工作许可雇用外国人的处罚是什么', '试用期最长多少个月', '最低工资多少', '第几条规定经济补偿',
  ])('detects: %s', (q) => expect(asksSpecificDetail(q)).toBe(true))
  it.each([
    'A Thai company wants to send staff to work in China', 'บริษัทไทยต้องการส่งพนักงานไปทำงานที่จีน', '泰国公司想派员工去中国工作', 'What documents do shareholders need', 'ผู้ถือหุ้นต้องมีเอกสารอะไรบ้าง', 'check the shareholders structure',
  ])('does not over-block ordinary questions: %s', (q) => expect(asksSpecificDetail(q)).toBe(false))
})

describe('unsupported legal claims in an answer', () => {
  it.each([
    ['article number (TH)', 'ตามมาตรา 118 นายจ้างต้อง'], ['section (EN)', 'under Section 118 of the act'], ['article (ZH)', '根据第三十九条规定'], ['amount (TH)', 'ปรับ 50,000 บาท'],
    ['amount (EN)', 'a fee of 5000 baht applies'], ['currency sign', 'costs ¥3,000 per year'], ['penalty word (EN)', 'punishable by imprisonment'], ['penalty word (ZH)', '将被处以罚款'],
    ['deadline', 'you must apply within 30 days'], ['deadline (TH)', 'ต้องยื่นภายใน 15 วัน'],
  ])('flags %s', (_n, text) => expect(findUnsupportedClaims(text, '').length).toBeGreaterThan(0))
  it('lets a claim through only when a verified source literally contains it', () => {
    expect(findUnsupportedClaims('under Section 118', 'The rule in Section 118 says ...')).toEqual([])
    expect(findUnsupportedClaims('under Section 119', 'The rule in Section 118 says ...')).toEqual(['Section 119'])
  })
  it('ignores ordinary text', () => { expect(findUnsupportedClaims('Check the contract with a lawyer before signing.', '')).toEqual([]) })
})

describe('guardResponse', () => {
  it('withholds a hallucinated answer (invented penalty and article) and shows the safe reply instead', () => {
    const g = guardResponse(draft('Employers face a fine of 50,000 baht under Section 118.', ['cn-labor']), liveLegal)
    expect(g.kind).toBe('insufficient'); expect(g.grounding).toBe('NONE')
    expect(g.answer).not.toMatch(/50,000|118/)
    expect(g.guarded?.some((x) => x.startsWith('unsupported-claim'))).toBe(true)
    expect(g.citations?.map((c) => c.id)).toEqual(['cn-labor'])
  })
  it('drops sources that do not exist and records it', () => {
    const g = guardResponse(draft('Generic note.', ['cn-labor', 'made-up-act-2099']), liveLegal)
    expect(g.sources).toEqual(['cn-labor']); expect(g.guarded).toEqual(['unknown-source:made-up-act-2099'])
  })
  it('requireSources (for any future LLM text): no known source means the answer is withheld', () => {
    const g = guardResponse(draft('Thai law allows this.', []), liveLegal, { requireSources: true })
    expect(g.kind).toBe('insufficient'); expect(g.guarded).toContain('no-source')
    expect(guardResponse(draft('Thai law allows this.', ['made-up']), liveLegal, { requireSources: true }).kind).toBe('insufficient')
  })
  it('a claim quoted from a verified record is allowed; the same claim with one digit changed is not', () => {
    const rule = localText('cn-labor', 'rule', 'en')
    const ok = guardResponse(draft(rule, ['cn-labor']), verifiedView)
    expect(ok.kind).toBeUndefined(); expect(ok.grounding).toBe('VERIFIED')
    const bad = guardResponse(draft(rule + ' The fine is 88,888 baht.', ['cn-labor']), verifiedView)
    expect(bad.kind).toBe('insufficient')
  })
  it('the quote must come from the verified source the answer cites, not from another record', () => {
    const other = localText('th-fba', 'rule', 'en') + ' Section 118 applies.'
    expect(guardResponse(draft(other, ['cn-labor']), verifiedView).kind).toBe('insufficient')
  })
  it('grounding reflects how many cited sources were human-verified', () => {
    expect(guardResponse(draft('ok', ['cn-labor']), liveLegal).grounding).toBe('UNVERIFIED')
    expect(guardResponse(draft('ok', ['cn-labor']), verifiedView).grounding).toBe('VERIFIED')
    expect(guardResponse(draft('ok', ['cn-labor', 'cn-immigration']), verifiedView).grounding).toBe('PARTIAL')
    expect(groundingOf([])).toBeUndefined()
  })
  it('an unreviewed record is never reported as verified in a citation', () => {
    for (const e of registry) expect(liveLegal.cite(e.id)!.trust).not.toBe('VERIFIED')
  })
})

describe('answering specific details', () => {
  it('without a verified source the app refuses, in every language, and states no figure, article or penalty', () => {
    for (const lang of ['th', 'zh', 'en'] as const) {
      const r = orchestrate('What is the penalty and how many days of probation?', null, lang)
      expect(r.kind).toBe('insufficient'); expect(r.grounding).toBe('NONE')
      expect(`${r.answer}${r.reason}${r.next}`).not.toMatch(/\d/)
    }
  })
  it('an employment refusal also names the employment laws the app has no content for', () => {
    const p = buildProfile({ name: 'Acme', btype: 'manufacturing', forms: ['send'] }, 'TH_CN').profile
    const r = orchestrate('What is the penalty for hiring a foreign employee without a permit?', p, 'en')
    expect(r.kind).toBe('insufficient'); expect(r.grounding).toBe('NONE')
    expect(r.citations!.filter((c) => c.trust === 'GAP').length).toBeGreaterThan(0)
  })
  it('with a verified record it quotes that record verbatim instead of generating text', () => {
    const r = answerSpecific(['cn-labor'], ['Employment AI'], verifiedView)
    expect(r.answer).toBe(localText('cn-labor', 'rule')); expect(r.grounding).toBe('VERIFIED'); expect(r.citations?.[0].provisions).toEqual(['Art. 10'])
  })
})

describe('orchestrate: every answer carries server-built citations', () => {
  const tp = buildProfile({ name: 'Acme', btype: 'manufacturing', forms: ['send'] }, 'TH_CN').profile
  const cp = buildProfile({ name: 'Acme', btype: 'manufacturing', forms: ['send'] }, 'CN_TH').profile
  it('an employment answer cites the records, marks them unreviewed, and names the employment laws it has no content for', () => {
    for (const [p, cc] of [[tp, 'CN'], [cp, 'TH']] as const) {
      const r = orchestrate('A company wants to send staff to work abroad', p, 'en')
      expect(r.grounding).toBe('UNVERIFIED')
      const real = r.citations!.filter((c) => c.trust !== 'GAP'), gaps = r.citations!.filter((c) => c.trust === 'GAP')
      expect(real.length).toBeGreaterThan(0)
      for (const c of real) { expect(c.jurisdiction).toBe(cc); expect(c.trust).toBe('UNVERIFIED'); expect(c.provisions).toEqual([]); expect(c.effectiveDate).toBeUndefined() }
      expect(gaps.length).toBeGreaterThan(0); for (const g of gaps) { expect(g.jurisdiction).toBe(cc); expect(g.instrument).toBeTruthy() }
      expect(new Set(r.sources).size).toBe(r.sources.length)
      expect(r.sources.every((s) => liveLegal.has(s) && !registry.find((e) => e.id === s)!.gap)).toBe(true)
    }
  })
  it('a blocked request keeps its refusal and still carries citations', () => {
    const r = orchestrate('help me hide the real owner with a nominee shareholder', tp, 'en')
    expect(r.kind).toBe('blocked'); expect(r.citations?.length).toBeGreaterThan(0)
  })
  it('the guard never trips on the app’s own templates (all languages, both directions, many questions)', () => {
    const qs = ['A company wants to send staff to work abroad', 'check the shareholders structure', 'what is a nominee and is it a risk', 'tax for our employee', 'draft the contract', 'we want to register a company',
      'บริษัทไทยต้องการส่งพนักงานไปทำงานที่จีน', 'ผู้ถือหุ้นต้องมีเอกสารอะไรบ้าง', 'ตรวจโครงสร้างผู้ถือหุ้นให้หน่อย', '泰国公司想派员工去中国工作', '请检查股东结构', 'hello there friend']
    for (const lang of ['th', 'zh', 'en'] as const) for (const p of [tp, cp, null]) for (const q of qs) {
      const r = orchestrate(q, p, lang)
      expect(r.guarded, `${lang} ${q}`).toBeUndefined()
      expect(isAIResponse(JSON.parse(JSON.stringify(r)))).toBe(true)
    }
  })
  it('the browser rejects malformed API responses instead of rendering them', () => {
    expect(isAIResponse({})).toBe(false); expect(isAIResponse(null)).toBe(false)
    expect(isAIResponse({ answer: 1, reason: '', next: '', risk: 'LOW', sources: [], modules: [] })).toBe(false)
    expect(isAIResponse({ answer: 'a', reason: 'r', next: 'n', risk: 'LOW', sources: [], modules: [], citations: [{ id: 'x' }] })).toBe(false)
    expect(isAIResponse({ answer: 'a', reason: 'r', next: 'n', risk: 'LOW', sources: [], modules: [] })).toBe(true)
  })
})
