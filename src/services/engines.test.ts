import { describe, expect, it } from 'vitest'
import type { Holder, Profile } from '../types'
import { analyzeEmployment, detectNomineeRisk, generateContract, hasCompany, orchestrate } from './engines'
import { demoProfile } from '../data/demo'
import { dv, withLang, type Lang } from '../i18n/core'
import { cleanProfile, sanitizeState } from '../store'

const H = (id: 'origin' | 'partner', nat: 'TH' | 'CN', percent: number, o: Partial<Holder> = {}): Holder => ({ id, nationality: nat, percent, capital: percent, voting: percent, board: percent, economic: percent, ...o })
const base: Profile = {
  companyName: 'X', direction: 'TH_CN', businessType: 'manufacturing', activity: 'a', forms: ['company'], investmentRange: '', employees: 0, crossBorderWorkers: false,
  holders: [H('origin', 'TH', 51), H('partner', 'CN', 49)], realInvestor: 'shared', operator: 'joint', sideAgreement: 'no', products: '', regulatedGoods: '', location: '', crossBorder: [],
}
const P = (o: Partial<Profile>): Profile => ({ ...base, ...o })
const level = (p: Profile) => detectNomineeRisk(p).level

/**
 * Expected levels below are a PROPOSED policy and must be reviewed by a qualified lawyer before real use.
 * They document intended behaviour so that changes to the scoring rules are deliberate, not accidental.
 */
describe('nominee risk screening — severity table', () => {
  const fundingMismatch = [H('origin', 'TH', 51, { capital: 0 }), H('partner', 'CN', 49, { capital: 100 })]
  const cases: [string, Profile, string][] = [
    ['51/49 fully aligned', base, 'LOW'],
    ['aligned but agreements unknown', P({ sideAgreement: 'unknown' }), 'NEEDS_REVIEW'],
    ['aligned but real investor unknown', P({ realInvestor: 'unknown' }), 'NEEDS_REVIEW'],
    ['shareholding totals 90%', P({ holders: [H('origin', 'TH', 50), H('partner', 'CN', 40)] }), 'NEEDS_REVIEW'],
    ['50/50 tie, real investor is one side', P({ holders: [H('origin', 'TH', 50), H('partner', 'CN', 50)], realInvestor: 'origin' }), 'LOW'],
    ['funding mismatch only', P({ holders: fundingMismatch }), 'MEDIUM'],
    ['economic rights mismatch only', P({ holders: [H('origin', 'TH', 51, { economic: 10 }), H('partner', 'CN', 49, { economic: 90 })] }), 'MEDIUM'],
    ['voting mismatch only', P({ holders: [H('origin', 'TH', 51, { voting: 10 }), H('partner', 'CN', 49, { voting: 90 })] }), 'MEDIUM'],
    ['undisclosed side agreement only', P({ sideAgreement: 'yes' }), 'MEDIUM'],
    ['real investor is not the majority holder only', P({ holders: [H('origin', 'TH', 60), H('partner', 'CN', 40)], realInvestor: 'partner' }), 'MEDIUM'],
    ['REGRESSION: 51% holder funds nothing + side agreement', P({ holders: fundingMismatch, sideAgreement: 'yes' }), 'HIGH'],
    ['funding mismatch + economic mismatch', P({ holders: [H('origin', 'TH', 51, { capital: 0, economic: 10 }), H('partner', 'CN', 49, { capital: 100, economic: 90 })] }), 'HIGH'],
    ['funding mismatch + manager is not the majority holder', P({ holders: [H('origin', 'TH', 60, { capital: 0 }), H('partner', 'CN', 40, { capital: 100 })], operator: 'partner' }), 'HIGH'],
    ['voting mismatch + side agreement', P({ holders: [H('origin', 'TH', 51, { voting: 10 }), H('partner', 'CN', 49, { voting: 90 })], sideAgreement: 'yes' }), 'HIGH'],
    ['side agreement + real investor mismatch', P({ holders: [H('origin', 'TH', 60), H('partner', 'CN', 40)], realInvestor: 'partner', sideAgreement: 'yes' }), 'HIGH'],
    ['same funding + agreement pattern, Chinese company entering Thailand', P({ direction: 'CN_TH', holders: [H('origin', 'CN', 49, { capital: 100 }), H('partner', 'TH', 51, { capital: 0 })], sideAgreement: 'yes' }), 'HIGH'],
    ['demo profile', { ...demoProfile }, 'HIGH'],
  ]
  it.each(cases)('%s → %s', (_n, p, expected) => { expect(level(p)).toBe(expected) })

  it('only HIGH pauses the path', () => {
    expect(detectNomineeRisk(P({ holders: fundingMismatch })).stop).toBe(false)
    expect(detectNomineeRisk(P({ holders: fundingMismatch, sideAgreement: 'yes' })).stop).toBe(true)
  })
  it('does not apply when no company/investment is planned', () => {
    const r = detectNomineeRisk(P({ forms: ['goods'], holders: fundingMismatch, sideAgreement: 'yes' }))
    expect(hasCompany(P({ forms: ['goods'] }))).toBe(false)
    expect(r.level).toBe('LOW'); expect(r.indicators).toHaveLength(0); expect(r.stop).toBe(false)
  })
  it('never calls anyone a nominee: no verdict wording in any language', () => {
    for (const lang of ['th', 'zh', 'en'] as Lang[]) {
      const r = withLang(lang, () => detectNomineeRisk(P({ holders: fundingMismatch, sideAgreement: 'yes' })))
      const text = [r.headline, r.answer, r.reason, ...r.next, ...r.indicators.flatMap((i) => [i.text, i.why, i.verify, i.missing, i.next])].join(' ')
      expect(text).not.toMatch(/คุณเป็นนอมินี|you are a nominee|您是代持/i)
      expect(text).not.toMatch(/\{\w+\}/) // no unreplaced placeholders
      r.indicators.forEach((i) => { expect(i.missing).toBeTruthy(); expect(i.verify).toBeTruthy(); expect(i.next).toBeTruthy() })
    }
  })
})

describe('robustness', () => {
  it('employment analysis tolerates missing fields', () => {
    expect(() => analyzeEmployment({ mode: 'send_th_cn' } as never, base)).not.toThrow()
    expect(() => analyzeEmployment({} as never, base)).not.toThrow()
    expect(() => generateContract({} as never, undefined)).not.toThrow()
  })
  it('dv resolves real keys only', () => {
    expect(dv('@abc')).toBe('@abc')
    expect(dv('@my company')).toBe('@my company')
    expect(dv('@demo.company')).not.toBe('@demo.company')
    expect(dv(undefined)).toBe('')
  })
  it('corrupted saved state is repaired instead of crashing', () => {
    const s = sanitizeState({ profile: { companyName: 'x', holders: [], forms: 'nope' }, employment: { mode: 5 }, stepOverrides: { 1: 'bogus', 2: 'done' }, history: 'x' })
    expect(s.profile).toBeNull()
    expect(s.employment.mode).toBe('')
    expect(s.stepOverrides).toEqual({ 2: 'done' })
    expect(sanitizeState('garbage').profile).toBeNull()
    expect(sanitizeState(null).history).toEqual([])
  })
  it('a valid profile survives sanitising unchanged in meaning', () => {
    const c = cleanProfile(JSON.parse(JSON.stringify(demoProfile)))!
    expect(c.holders.map((h) => h.percent)).toEqual([60, 40])
    expect(level(c)).toBe('HIGH')
    expect(() => analyzeEmployment(sanitizeState({ profile: demoProfile }).employment, c)).not.toThrow()
  })
  it('assistant refuses concealment requests but still answers with a safe default', () => {
    expect(orchestrate('I want a nominee setup to hide ownership', null, 'en').blocked).toBe(true)
    expect(orchestrate('what documents prove who owns the shares', null, 'en').blocked).toBeFalsy()
  })
})
