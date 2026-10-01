import { describe, expect, it } from 'vitest'
import { JOURNEY, journeyCurrent, journeyDone } from './journey'
import { assessRisks, deriveActions } from './services/engines'
import { buildProfile } from './interview'
import { withLang } from './i18n/core'
import type { EmploymentInput } from './types'

const f = (o: Partial<Parameters<typeof journeyDone>[0]> = {}) => ({ hasProfile: true, unknownCount: 0, analysisDone: false, actionTotal: 5, actionsDone: 0, ...o })
const emptyEmp: EmploymentInput = { mode: '', nationality: '', location: '', duration: '', salary: '', hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' } as EmploymentInput

describe('five-step journey', () => {
  it('has exactly five steps that end in Risks & Actions', () => {
    expect(JOURNEY.map((s) => s.id)).toEqual([1, 2, 3, 4, 5]); expect(JOURNEY[4].route).toBe('roadmap')
  })
  it('without a business nothing is done and the user is on step 1', () => {
    const d = journeyDone(f({ hasProfile: false }))
    expect(d.every((x) => !x)).toBe(true); expect(journeyCurrent(d)).toBe(0)
  })
  it('missing ownership facts keep step 2 open, but the analysis can still run (it is not a gate)', () => {
    const d = journeyDone(f({ unknownCount: 3 }))
    expect(d).toEqual([true, false, false, false, false]); expect(journeyCurrent(d)).toBe(1)
    expect(journeyDone(f({ unknownCount: 3, analysisDone: true }))[2]).toBe(true)
  })
  it('after the analysis the user is sent to what to do next; finishing every task completes the journey', () => {
    expect(journeyCurrent(journeyDone(f({ analysisDone: true })))).toBe(4)
    expect(journeyDone(f({ analysisDone: true, actionsDone: 5 })).every(Boolean)).toBe(true)
    expect(journeyDone(f({ analysisDone: true, actionTotal: 0 }))[4]).toBe(false) // nothing to do is not the same as done
  })
  it('a page can say where the user is', () => { expect(journeyCurrent(journeyDone(f()), 3)).toBe(3); expect(journeyCurrent(journeyDone(f()), 9)).toBe(2) })
})

describe('every finding has the same five parts, in every language', () => {
  const quick = buildProfile({ name: 'Acme', btype: 'manufacturing', forms: ['company', 'hire'] }, 'TH_CN').profile
  it.each(['th', 'zh', 'en'] as const)('%s: found, why, verify and next are filled; unknowns come from real gaps', (lang) => withLang(lang, () => {
    const risks = assessRisks(quick, emptyEmp)
    for (const r of risks) {
      expect(r.found.length, r.id).toBeGreaterThan(5); expect(r.found).not.toMatch(/^risk\./)
      expect(r.why.length).toBeGreaterThan(5); expect(r.next.length).toBeGreaterThan(5); expect(Array.isArray(r.unknown)).toBe(true)
    }
    const own = risks.find((r) => r.id === 'ownership')!
    expect(own.unknown.length).toBeGreaterThan(3) // quick start: shares, funding, voting, board, agreement are unknown
    expect(own.found).not.toMatch(/Agreement|ข้อตกลง|协议/) // an unanswered question is reported as unknown, not as a mismatch
    expect(risks.find((r) => r.id === 'employment')!.unknown.length).toBeGreaterThan(0)
  }))
  it('a verification list never repeats the same item', () => {
    for (const r of assessRisks(quick, emptyEmp)) expect(new Set(r.check).size, r.id).toBe(r.check.length)
  })
  it('every finding that is not low leads to at least one task (finding → action)', () => {
    const risks = assessRisks(quick, emptyEmp), acts = deriveActions(quick, emptyEmp)
    for (const r of risks.filter((x) => x.level !== 'LOW')) expect(acts.some((a) => a.riskId === r.id), r.id).toBe(true)
  })
})
