import { describe, expect, it } from 'vitest'
import { QS, buildProfile, coreDone, firstUnanswered, isAnswered, prune, remaining, visibleQs, type A } from './interview'
import { detectNomineeRisk } from './services/engines'

const quick: A = { name: 'Acme', btype: 'manufacturing', forms: ['company', 'hire'] }

describe('quick start interview', () => {
  it('the quick start is exactly 3 questions (name, business type, what you want to do)', () => {
    const core = visibleQs(quick).filter((q) => q.core)
    expect(core.map((q) => q.id)).toEqual(['name', 'btype', 'forms'])
    expect(coreDone(quick)).toBe(true)
    expect(coreDone({ name: 'Acme', btype: 'manufacturing' })).toBe(false)
  })
  it('"other" business type adds one more core question', () => {
    expect(coreDone({ name: 'A', btype: 'other', forms: ['goods'] })).toBe(false)
    expect(coreDone({ name: 'A', btype: 'other', btypeOther: 'Tea shop', forms: ['goods'] })).toBe(true)
  })
  it('questions after the quick start are still pending and can be answered later', () => {
    expect(remaining(quick)).toBeGreaterThan(5)
    expect(visibleQs(quick)[firstUnanswered(quick)].core).toBeFalsy()
  })
  it('activityMore only appears for a short but given activity (no double counting)', () => {
    expect(visibleQs({ ...quick }).some((q) => q.id === 'activityMore')).toBe(false)
    expect(visibleQs({ ...quick, activity: 'tea' }).some((q) => q.id === 'activityMore')).toBe(true)
    expect(visibleQs({ ...quick, activity: 'Retail of tea products sold online' }).some((q) => q.id === 'activityMore')).toBe(false)
  })
  it('a profile from the quick start never treats missing ownership answers as "fine"', () => {
    const { profile } = buildProfile(quick, 'TH_CN')
    const r = detectNomineeRisk(profile)
    expect(profile.unknownFacts).toEqual(expect.arrayContaining(['shares', 'funding', 'voting', 'board']))
    expect(r.level).toBe('NEEDS_REVIEW')
    expect(r.unknowns.length).toBeGreaterThan(3)
    expect(r.stop).toBe(false)
  })
  it('a quick start without a company does not raise ownership questions', () => {
    const a: A = { name: 'A', btype: 'service', forms: ['goods'] }
    expect(visibleQs(a).some((q) => q.id === 'funding')).toBe(false)
    expect(detectNomineeRisk(buildProfile(a, 'TH_CN').profile).level).toBe('LOW')
  })
  it('stale answers are pruned when a choice changes', () => {
    const full: A = { ...quick, forms: ['send'], empNat: 'TH', empSalary: '28000' }
    expect(prune(full).empNat).toBe('TH')
    const changed = prune({ ...full, forms: ['goods'] })
    expect(changed.empNat).toBeUndefined(); expect(changed.empSalary).toBeUndefined()
  })
  it('every question has text and options for every choice in all locales', async () => {
    const { tr } = await import('./i18n/core')
    for (const lang of ['th', 'zh', 'en'] as const) for (const q of QS) {
      expect(tr(`q.${q.id}` as never, { from: 'A', to: 'B' }, lang)).not.toBe(`q.${q.id}`)
      for (const o of q.opts ?? []) expect(tr(`opt.${q.ns}.${o}` as never, { from: 'A', to: 'B' }, lang)).not.toBe(`opt.${q.ns}.${o}`)
    }
  })
  it('isAnswered handles strings and lists', () => {
    const q = QS.find((x) => x.id === 'forms')!
    expect(isAnswered({ forms: [] }, q)).toBe(false)
    expect(isAnswered({ forms: ['goods'] }, q)).toBe(true)
  })
})
