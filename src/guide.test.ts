import { describe, expect, it } from 'vitest'
import { applicationGuide, caseGuide } from './domain/match/guide'
import { newCase, type Case } from './domain/match/cases'
import { messages } from './locales'

// "what to do now" after matching (owner, 27 Nov 2026: nobody knew the next step, nor how and when to do documents and training)
const at = '2026-11-28T09:00:00.000Z'
const withSteps = (keys: string[], extra: Partial<Case> = {}): Case => {
  const c = newCase('c1', { id: 'a1', postId: 'p1', seekerId: 'seeker:x' }, at, false)
  return { ...c, steps: Object.fromEntries(keys.map((k) => [k, at])), ...extra }
}

describe('what to do now', () => {
  it('an application: waiting for the employer, in the queue, or not picked', () => {
    const a = { id: 'a1', postId: 'p1', seekerId: 'me', at, status: 'accepted' as const, intro: '', availableFrom: null }
    expect(applicationGuide(a)).toMatchObject({ key: 'applied', who: ['employer'], links: ['chat'], next: 'case' })
    expect(applicationGuide({ ...a, status: 'reserved' }).key).toBe('queue')
    expect(applicationGuide({ ...a, status: 'rejected' })).toMatchObject({ key: 'declined', links: ['board'], next: null })
    // ended by the chat's contact rule: says why, not "the employer did not pick you" (28 Nov 2026)
    expect(applicationGuide({ ...a, status: 'rejected', endedFor: 'contact', endedBy: 'seeker' }).key).toBe('endedMe')
    expect(applicationGuide({ ...a, status: 'rejected', endedFor: 'contact', endedBy: 'employer' }).key).toBe('endedThem')
  })
  it('the documents step: the worker attaches, the employer sends the contract; the team date shows', () => {
    const c = withSteps(['opened', 'submitted', 'accepted'], { dates: { documents: '2026-12-02' } })
    expect(caseGuide(c, 'seeker')).toMatchObject({ key: 'documents', who: ['you', 'team'], links: ['docs', 'contract'], next: 'tests', dates: [{ kind: 'documents', day: '2026-12-02' }] })
    expect(caseGuide(c, 'employer')).toMatchObject({ key: 'documents', links: ['contract', 'chat'] })
  })
  it('the training step: courses left and the dates of the ones still open', () => {
    const base = withSteps(['opened', 'submitted', 'accepted', 'documents', 'tests'])
    const c = { ...base, trainings: base.trainings.map((x, i) => (i === 0 ? { ...x, done: true } : i === 1 ? { ...x, date: '2026-12-05' } : x)) }
    const g = caseGuide(c, 'seeker')
    expect(g.key).toBe('training'); expect(g.left).toBe(c.trainings.length - 1); expect(g.dates).toEqual([{ kind: 'training', day: '2026-12-05', name: c.trainings[1].name }])
  })
  it('waiting for the employer verification, then the end with check-ins', () => {
    expect(caseGuide(withSteps(['opened']), 'employer')).toMatchObject({ key: 'submitted', who: ['you'], links: ['verify', 'chat'] })
    expect(caseGuide(withSteps(['opened']), 'seeker')).toMatchObject({ key: 'submitted', who: ['employer'] })
    expect(caseGuide(withSteps(['opened', 'submitted', 'accepted', 'documents', 'tests', 'training', 'permit', 'departure']), 'seeker')).toMatchObject({ key: 'arrived', next: 'checkins' })
    expect(caseGuide(withSteps(['opened', 'submitted', 'accepted', 'documents', 'tests', 'training', 'permit', 'departure', 'arrived']), 'seeker').key).toBe('done')
  })
  it('every step has words for both sides in all three languages', () => {
    const keys = ['submitted', 'accepted', 'documents', 'tests', 'training', 'permit', 'departure', 'arrived', 'done'].flatMap((k) => [`gd.s.${k}.seeker`, `gd.s.${k}.employer`])
    for (const k of [...keys, 'gd.s.applied.seeker', 'gd.s.queue.seeker', 'gd.s.declined.seeker', 'gd.s.endedMe.seeker', 'gd.s.endedThem.seeker', 'gd.st.endedMe', 'gd.st.endedThem']) {
      const m = (messages as Record<string, readonly string[]>)[k]; expect(m, k).toBeDefined()
      expect(m[0]).toMatch(/[฀-๿]/); expect(m[1]).toMatch(/[一-鿿]/); expect(m[2]).toMatch(/[A-Za-z]/)
    }
  })
})
