import { describe, expect, it } from 'vitest'
import { JOBBOARD_KEY, browserStorage, createPersistentRepo, type KV } from './persist'
import { JOBBOARD_SEED } from '../../data/seed/jobboard'
import type { Actor } from './types'

const ploy: Actor = { kind: 'worker', workerId: 'wkr_0001' }
const narin: Actor = { kind: 'worker', workerId: 'wkr_0002' }
const empA: Actor = { kind: 'employer', organizationId: 'org_0001' }
const visitor: Actor = { kind: 'visitor' }
const UNRELATED = { 'cnth-real-v3': '{"v":3,"state":{}}', 'cnth-lang': 'zh', 'cnth-theme': 'dark' }

/** in-memory storage that records writes; starts with unrelated C.A.L.L. keys that must never change */
class FakeKV implements KV {
  m = new Map<string, string>(Object.entries(UNRELATED))
  writes: string[] = []
  removes: string[] = []
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.writes.push(k); this.m.set(k, v) }
  removeItem(k: string) { this.removes.push(k); this.m.delete(k) }
  unrelatedIntact() { return Object.entries(UNRELATED).every(([k, v]) => this.m.get(k) === v) }
}
const val = <T,>(r: { ok: true; value: T } | { ok: false; error: string; reason: string }): T => { if (!r.ok) throw new Error(`${r.error}: ${r.reason}`); return r.value }

describe('job-board persistence adapter', () => {
  it('starts from the seed when nothing is stored, and reading never writes', () => {
    const kv = new FakeKV()
    const p = createPersistentRepo(kv)
    expect(p.status).toBe('seed')
    expect(p.repo.snapshot()).toEqual(JOBBOARD_SEED)
    p.repo.listJobs(visitor); p.repo.getWorker(ploy, 'wkr_0001'); p.repo.listApplications(empA)
    expect(kv.writes).toEqual([])
  })
  it('saves after a successful mutation only; failed operations save nothing', () => {
    const kv = new FakeKV()
    const { repo } = createPersistentRepo(kv)
    expect(repo.createJob(visitor, { title: 'Analyst (Synthetic)', industry: 'finance', skills: ['data_analysis'], minYears: 1, province: 'CN-SH', contractMonths: 12 }).ok).toBe(false)
    expect(repo.submitApplication(ploy, { jobId: 'job_0004' } as never).ok).toBe(false) // no confirmation
    expect(repo.submitApplication(ploy, { jobId: 'job_0001', confirmed: true }).ok).toBe(false) // duplicate
    expect(repo.transitionApplication(narin, 'app_0001', 'withdrawn').ok).toBe(false) // someone else's
    expect(repo.transitionApplication(empA, 'app_0001', 'closed').ok).toBe(false) // invalid transition
    expect(kv.writes).toEqual([])
    val(repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true }))
    expect(kv.writes).toEqual([JOBBOARD_KEY])
    expect(JSON.parse(kv.getItem(JOBBOARD_KEY)!)).toEqual(repo.snapshot())
  })
  it('valid saved data survives a reload (a new adapter over the same storage)', () => {
    const kv = new FakeKV()
    val(createPersistentRepo(kv).repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true }))
    const again = createPersistentRepo(kv)
    expect(again.status).toBe('restored')
    expect(val(again.repo.listApplications(ploy)).map((a) => a.jobId).sort()).toEqual(['job_0001', 'job_0004', 'job_0006'])
  })
  it('tampered or malformed saved data is never used: the seed is loaded, the bad entry removed, other keys untouched', () => {
    const tamper = (f: (s: typeof JOBBOARD_SEED) => void) => { const s = structuredClone(JOBBOARD_SEED); f(s); return JSON.stringify(s) }
    for (const bad of ['{not json', '[]', '{"version":1}', tamper((s) => { s.applications[0].workerId = 'wkr_0002' }), tamper((s) => { s.organizations[1].verification = 'verified'; s.jobs[4].review = 'approved'; s.jobs[4].organizationId = 'org_9999' }),
      tamper((s) => { Object.assign(s.workers[0], { passportNo: 'X1234567' }) })]) {
      const kv = new FakeKV(); kv.m.set(JOBBOARD_KEY, bad)
      const p = createPersistentRepo(kv)
      expect(p.status, bad.slice(0, 30)).toBe('recovered')
      expect(p.repo.snapshot()).toEqual(JOBBOARD_SEED)
      expect(kv.m.has(JOBBOARD_KEY)).toBe(false)
      expect(kv.removes).toEqual([JOBBOARD_KEY])
      expect(kv.unrelatedIntact()).toBe(true)
    }
  })
  it('reset restores the seed and removes only the job-board key', () => {
    const kv = new FakeKV()
    const p = createPersistentRepo(kv)
    val(p.repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true }))
    p.reset()
    expect(p.repo.snapshot()).toEqual(JOBBOARD_SEED)
    expect(kv.m.has(JOBBOARD_KEY)).toBe(false)
    expect(kv.unrelatedIntact()).toBe(true)
    expect(createPersistentRepo(kv).status).toBe('seed')
    expect(p.repo.submitApplication(narin, { jobId: 'job_0006', confirmed: true }).ok).toBe(false) // closed job: refused, so nothing is saved
    expect(kv.m.has(JOBBOARD_KEY)).toBe(false)
  })
  it('unrelated keys are never written, even across many mutations', () => {
    const kv = new FakeKV()
    const { repo } = createPersistentRepo(kv)
    val(repo.createJob(empA, { title: 'Analyst (Synthetic)', industry: 'finance', skills: ['data_analysis'], minYears: 1, province: 'CN-SH', contractMonths: 12 }))
    val(repo.transitionApplication(empA, 'app_0001', 'shortlisted'))
    val(repo.updateWorker(ploy, 'wkr_0001', { yearsExperience: 8 }))
    expect(new Set(kv.writes)).toEqual(new Set([JOBBOARD_KEY]))
    expect(kv.unrelatedIntact()).toBe(true)
  })
  it('stores only the synthetic snapshot (no persona, no other data)', () => {
    const kv = new FakeKV()
    val(createPersistentRepo(kv).repo.updateWorker(ploy, 'wkr_0001', { yearsExperience: 8 }))
    expect(Object.keys(JSON.parse(kv.getItem(JOBBOARD_KEY)!)).sort()).toEqual(Object.keys(JOBBOARD_SEED).sort())
    expect(kv.getItem(JOBBOARD_KEY)).not.toMatch(/persona|"kind"/)
  })
  it('works without storage and survives storage that throws', () => {
    expect(browserStorage()).toBeNull() // no window in tests
    const none = createPersistentRepo(null)
    expect(val(none.repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true })).status).toBe('submitted')
    const broken: KV = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') }, removeItem: () => { throw new Error('blocked') } }
    const p = createPersistentRepo(broken)
    expect(p.status).toBe('seed')
    expect(val(p.repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true })).jobId).toBe('job_0004')
    expect(() => p.reset()).not.toThrow()
  })
})
