import { describe, expect, it } from 'vitest'
import { assessRisks, buildDocument, deriveActions, routeText } from './services/engines'
import { buildProfile } from './interview'
import { cleanProfile } from './profileSchema'
import type { ContractInput, EmploymentInput } from './types'

const emp = { mode: '', nationality: '', location: '', duration: '', salary: '', hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' } as EmploymentInput
const con = {} as ContractInput
const prof = (forms: string[], dir: 'TH_CN' | 'CN_TH', extra: Record<string, unknown> = {}) => ({ ...buildProfile({ name: 'Acme', btype: 'manufacturing', forms }, dir).profile, ...extra })

describe('findings follow the plan and the place', () => {
  it('a plan without staff does not raise employment or employee-tax work', () => {
    const p = prof(['goods'], 'TH_CN')
    const r = assessRisks(p, emp)
    expect(r.find((x) => x.id === 'employment')!.level).toBe('LOW'); expect(r.find((x) => x.id === 'tax')!.level).toBe('LOW')
    expect(deriveActions(p, emp).some((a) => a.riskId === 'employment' || a.riskId === 'tax')).toBe(false)
  })
  it('a plan with hiring still checks employment', () => {
    expect(assessRisks(prof(['hire'], 'TH_CN'), emp).find((x) => x.id === 'employment')!.level).not.toBe('LOW')
  })
  it('a destination in the EEC adds the EEC check; a destination province in China adds the free-trade-zone check', () => {
    const eec = assessRisks(prof(['company'], 'CN_TH', { destProvince: 'TH-20' }), emp).find((x) => x.id === 'legal')!
    expect(eec.check.join(' ')).toMatch(/EEC/)
    const ftz = assessRisks(prof(['company'], 'TH_CN', { destProvince: 'CN-SH' }), emp).find((x) => x.id === 'legal')!
    expect(ftz.check.join(' ')).toMatch(/FTZ|free trade|自由贸易/i)
    expect(assessRisks(prof(['company'], 'CN_TH'), emp).find((x) => x.id === 'legal')!.check.join(' ')).not.toMatch(/EEC/)
  })
})

describe('case brief for a lawyer or advisor', () => {
  it.each(['th', 'zh', 'en'] as const)('%s: route with provinces, the facts, the findings, the questions and the sources — no raw keys', (lang) => {
    const p = prof(['company', 'hire'], 'TH_CN', { originProvince: 'TH-20', destProvince: 'CN-SH' })
    const acts = deriveActions(p, emp).map((a, i) => ({ ...a, status: i === 0 ? ('done' as const) : a.status }))
    const d = buildDocument('brief', p, emp, con, lang, acts)
    expect(d.text).not.toMatch(/doc\.br\.|prov\.|undefined|NaN/)
    expect(d.text.split('■').length).toBeGreaterThanOrEqual(7)
    expect(d.text).toMatch(lang === 'zh' ? /上海/ : lang === 'th' ? /ชลบุรี/ : /Shanghai/)
  })
  it('facts the user has not given are shown as unknown, never as the default numbers', () => {
    const d = buildDocument('brief', prof(['company'], 'TH_CN'), emp, con, 'en')
    expect(d.text).toMatch(/shares \?/); expect(d.text).not.toMatch(/shares 50%/)
  })
  it('the route reads origin → destination with the provinces only when chosen', () => {
    expect(routeText(prof([], 'CN_TH'))).not.toMatch(/·/)
  })
})

describe('provinces in the profile are validated', () => {
  it('keeps real ISO 3166-2 codes and drops anything else', () => {
    const p = prof(['company'], 'TH_CN')
    expect(cleanProfile({ ...p, originProvince: 'TH-20', destProvince: '<img src=x>' })).toMatchObject({ originProvince: 'TH-20', destProvince: undefined })
  })
})
