import { describe, expect, it } from 'vitest'
import { createMemoryRepo, loadSnapshot, type JobBoardRepo, type JobInput, type Result } from './repo'
import { parseSnapshot } from './validate'
import { JOBBOARD_SEED, SEED_PERSONAS } from '../../data/seed/jobboard'
import type { Actor, Snapshot } from './types'

const visitor: Actor = { kind: 'visitor' }
const ploy: Actor = { kind: 'worker', workerId: 'wkr_0001' }
const narin: Actor = { kind: 'worker', workerId: 'wkr_0002' }
const empA: Actor = { kind: 'employer', organizationId: 'org_0001' }
const empB: Actor = { kind: 'employer', organizationId: 'org_0002' }
const empC: Actor = { kind: 'employer', organizationId: 'org_0003' }
const admin: Actor = { kind: 'admin', adminId: 'adm_0001' }

let tick = 0
const fresh = (): JobBoardRepo => { tick = 0; return createMemoryRepo(JOBBOARD_SEED, { now: () => `2026-10-01T00:00:${String(tick++).padStart(2, '0')}.000Z` }) }
const err = <T,>(r: Result<T>) => (r.ok ? 'ok' : r.error)
const val = <T,>(r: Result<T>): T => { if (!r.ok) throw new Error(`${r.error}: ${r.reason}`); return r.value }
const input: JobInput = { title: 'Logistics Coordinator (Synthetic)', industry: 'logistics', skills: ['project_management'], minYears: 2, province: 'CN-GD', contractMonths: 12 }
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort()

describe('synthetic seed', () => {
  it('passes the strict snapshot validator (all references and status histories consistent)', () => {
    expect(parseSnapshot(JOBBOARD_SEED)).toEqual({ ok: true, snapshot: JOBBOARD_SEED })
  })
  it('has the required personas and every record is marked synthetic', () => {
    expect(JOBBOARD_SEED.workers.length).toBeGreaterThanOrEqual(2)
    expect(JOBBOARD_SEED.organizations.filter((o) => o.verification === 'verified').length).toBeGreaterThanOrEqual(2)
    const all = [...JOBBOARD_SEED.admins, ...JOBBOARD_SEED.workers, ...JOBBOARD_SEED.organizations, ...JOBBOARD_SEED.jobs, ...JOBBOARD_SEED.applications, ...JOBBOARD_SEED.statusEvents, ...JOBBOARD_SEED.auditEvents]
    expect(all.every((r) => r.synthetic === true)).toBe(true)
    for (const n of [...JOBBOARD_SEED.workers.map((w) => w.displayName), ...JOBBOARD_SEED.organizations.map((o) => o.name), ...JOBBOARD_SEED.jobs.map((j) => j.title)]) expect(n).toMatch(/\(Synthetic\)$/)
  })
  it('contains nothing that looks like contact or identity data', () => {
    const text = JSON.stringify(JOBBOARD_SEED)
    expect(text).not.toMatch(/@|https?:|www\.|\d{7,}|passport|phone|email|address/i)
  })
  it('every persona refers to a record in the seed', () => {
    const repo = fresh()
    for (const p of SEED_PERSONAS) expect(err(repo.listJobs(p.actor)), p.label).toBe('ok')
  })
})

describe('repository: visitors', () => {
  it('list only public jobs', () => {
    expect(ids(val(fresh().listJobs(visitor)))).toEqual(['job_0001', 'job_0004', 'job_0006'])
  })
  it('cannot create jobs, apply, review, or read applications and the audit log', () => {
    const repo = fresh()
    expect(err(repo.createJob(visitor, input))).toBe('unauthorized')
    expect(err(repo.submitApplication(visitor, { jobId: 'job_0004', confirmed: true }))).toBe('unauthorized')
    expect(err(repo.reviewJob(visitor, 'job_0002', 'approve', 'information_consistent'))).toBe('unauthorized')
    expect(err(repo.reviewOrganization(visitor, 'org_0003', 'verify', 'information_consistent'))).toBe('unauthorized')
    expect(err(repo.listApplications(visitor))).toBe('unauthorized')
    expect(err(repo.listAuditEvents(visitor))).toBe('unauthorized')
    expect(err(repo.getWorker(visitor, 'wkr_0001'))).toBe('unauthorized')
    expect(err(repo.getJob(visitor, 'job_0003'))).toBe('unauthorized') // draft
  })
})

describe('repository: workers', () => {
  it('read and update their own profile and see their own applications', () => {
    const repo = fresh()
    expect(val(repo.getWorker(ploy, 'wkr_0001')).displayName).toBe('Ploy (Synthetic)')
    expect(val(repo.updateWorker(ploy, 'wkr_0001', { yearsExperience: 7 })).yearsExperience).toBe(7)
    expect(ids(val(repo.listApplications(ploy)))).toEqual(['app_0001', 'app_0004'])
    expect(val(repo.listStatusEvents(ploy, 'app_0001')).map((e) => e.to)).toEqual(['submitted', 'under_review'])
  })
  it('cannot read or change another worker\'s profile or applications', () => {
    const repo = fresh()
    expect(err(repo.getWorker(ploy, 'wkr_0002'))).toBe('unauthorized')
    expect(err(repo.updateWorker(ploy, 'wkr_0002', { headline: 'x' }))).toBe('unauthorized')
    expect(err(repo.getApplication(ploy, 'app_0003'))).toBe('unauthorized')
    expect(err(repo.listStatusEvents(ploy, 'app_0003'))).toBe('unauthorized')
    expect(err(repo.transitionApplication(ploy, 'app_0003', 'withdrawn'))).toBe('unauthorized')
    expect(val(repo.getApplication(narin, 'app_0003')).status).toBe('shortlisted') // unchanged
  })
  it('cannot edit the persona name or add unexpected fields', () => {
    const repo = fresh()
    expect(err(repo.updateWorker(ploy, 'wkr_0001', { displayName: 'Real Name' } as never))).toBe('invalid')
    expect(err(repo.updateWorker(ploy, 'wkr_0001', { passportNo: 'X' } as never))).toBe('invalid')
    expect(err(repo.updateWorker(ploy, 'wkr_0001', { headline: 'call me at 081 234 5678' }))).toBe('invalid')
  })
})

describe('repository: submitting an application', () => {
  it('requires the worker\'s explicit confirmation', () => {
    const repo = fresh()
    expect(err(repo.submitApplication(ploy, { jobId: 'job_0004' } as never))).toBe('invalid')
    expect(err(repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: 'yes' } as never))).toBe('invalid')
    expect(val(repo.listApplications(ploy)).some((a) => a.jobId === 'job_0004')).toBe(false)
    const created = val(repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true }))
    expect(created).toMatchObject({ id: 'app_0005', jobId: 'job_0004', workerId: 'wkr_0001', status: 'submitted', synthetic: true })
    expect(val(repo.listStatusEvents(ploy, created.id))).toEqual([{ id: 'sev_0009', synthetic: true, applicationId: 'app_0005', from: null, to: 'submitted', by: 'worker', at: created.createdAt }])
  })
  it('always files the application for the acting worker, ignoring any workerId in the input', () => {
    const repo = fresh()
    const created = val(repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true, workerId: 'wkr_0002' } as never))
    expect(created.workerId).toBe('wkr_0001')
  })
  it('employer and admin personas cannot apply; closed, unapproved, duplicate and unknown jobs are refused', () => {
    const repo = fresh()
    expect(err(repo.submitApplication(empA, { jobId: 'job_0004', confirmed: true }))).toBe('unauthorized')
    expect(err(repo.submitApplication(admin, { jobId: 'job_0004', confirmed: true }))).toBe('unauthorized')
    expect(err(repo.submitApplication(ploy, { jobId: 'job_0006', confirmed: true }))).toBe('conflict')
    expect(err(repo.submitApplication(ploy, { jobId: 'job_0002', confirmed: true }))).toBe('conflict')
    expect(err(repo.submitApplication(ploy, { jobId: 'job_0001', confirmed: true }))).toBe('conflict') // already applied
    expect(err(repo.submitApplication(ploy, { jobId: 'job_9999', confirmed: true }))).toBe('not_found')
  })
})

describe('repository: employers', () => {
  it('see their own jobs and the applications to them', () => {
    const repo = fresh()
    expect(ids(val(repo.listJobs(empA)))).toEqual(['job_0001', 'job_0002', 'job_0003', 'job_0004', 'job_0006'])
    expect(ids(val(repo.listApplications(empA)))).toEqual(['app_0001', 'app_0003'])
    expect(ids(val(repo.listApplications(empA, 'job_0001')))).toEqual(['app_0001', 'app_0003'])
    expect(val(repo.getApplicant(empA, 'app_0001')).id).toBe('wkr_0001')
  })
  it('cannot read or change another employer\'s jobs or applications', () => {
    const repo = fresh()
    expect(val(repo.listApplications(empB, 'job_0001'))).toEqual([])
    expect(err(repo.getApplication(empB, 'app_0001'))).toBe('unauthorized')
    expect(err(repo.getApplicant(empB, 'app_0001'))).toBe('unauthorized')
    expect(err(repo.transitionApplication(empB, 'app_0001', 'shortlisted'))).toBe('unauthorized')
    expect(err(repo.transitionApplication(empB, 'app_0001', 'closed'))).toBe('unauthorized') // invalid as well, but no information is leaked
    expect(err(repo.updateJob(empB, 'job_0003', input))).toBe('unauthorized')
    expect(err(repo.submitJob(empB, 'job_0003'))).toBe('unauthorized')
    expect(err(repo.closeJob(empB, 'job_0001'))).toBe('unauthorized')
    expect(err(repo.getJob(empB, 'job_0002'))).toBe('unauthorized')
    expect(val(repo.getJob(empA, 'job_0003')).review).toBe('draft') // unchanged
  })
  it('a new job always belongs to the acting employer\'s organisation and starts as a draft', () => {
    const repo = fresh()
    const j = val(repo.createJob(empA, { ...input, organizationId: 'org_0002' } as never))
    expect(j).toMatchObject({ id: 'job_0008', organizationId: 'org_0001', review: 'draft', synthetic: true })
    expect(val(repo.listJobs(visitor)).some((x) => x.id === j.id)).toBe(false)
  })
  it('job input is validated (title, contact-like text, enums, province, numbers)', () => {
    const repo = fresh()
    for (const bad of [{ title: 'x' }, { title: 'Email hr@example.com' }, { title: 'See www.example.com' }, { industry: 'mining' }, { skills: [] }, { skills: ['juggling'] },
      { province: 'TH-10' }, { province: 'CN-QQ' }, { minYears: -1 }, { minYears: 1.5 }, { contractMonths: 0 }]) {
      expect(err(repo.createJob(empA, { ...input, ...bad } as JobInput)), JSON.stringify(bad)).toBe('invalid')
    }
  })
  it('employer-side transitions follow the allowed order and are recorded', () => {
    const repo = fresh()
    expect(err(repo.transitionApplication(empA, 'app_0001', 'closed'))).toBe('invalid') // under_review → closed is not allowed
    expect(err(repo.transitionApplication(empA, 'app_0001', 'withdrawn'))).toBe('unauthorized') // only the worker can withdraw
    expect(err(repo.transitionApplication(empA, 'app_0001', 'hired' as never))).toBe('invalid')
    expect(val(repo.transitionApplication(empA, 'app_0001', 'shortlisted')).status).toBe('shortlisted')
    expect(val(repo.listStatusEvents(ploy, 'app_0001')).map((e) => `${e.from}>${e.to}:${e.by}`)).toEqual(['null>submitted:worker', 'submitted>under_review:employer', 'under_review>shortlisted:employer'])
    expect(err(repo.transitionApplication(empA, 'app_0004', 'shortlisted'))).toBe('unauthorized') // app_0004 is for org B's job
    expect(parseSnapshot(repo.snapshot()).ok).toBe(true)
  })
  it('an unverified organisation can draft but must be verified before submitting', () => {
    const repo = fresh()
    expect(err(repo.submitJob(empC, 'job_0007'))).toBe('unauthorized')
    val(repo.reviewOrganization(admin, 'org_0003', 'verify', 'information_consistent'))
    expect(val(repo.submitJob(empC, 'job_0007')).review).toBe('pending_review')
  })
})

describe('repository: simulated admin review and audit log', () => {
  it('non-admin actors cannot approve organisations or jobs', () => {
    const repo = fresh()
    for (const a of [visitor, ploy, empA, empC]) {
      expect(err(repo.reviewOrganization(a, 'org_0003', 'verify', 'information_consistent')), a.kind).toBe('unauthorized')
      expect(err(repo.reviewJob(a, 'job_0002', 'approve', 'information_consistent')), a.kind).toBe('unauthorized')
    }
    expect(val(repo.listAuditEvents(admin))).toHaveLength(JOBBOARD_SEED.auditEvents.length)
  })
  it('the admin persona reviews pending records and each decision appends one audit event', () => {
    const repo = fresh()
    expect(val(repo.reviewJob(admin, 'job_0002', 'approve', 'information_consistent')).review).toBe('approved')
    expect(val(repo.reviewOrganization(admin, 'org_0003', 'reject', 'information_incomplete')).verification).toBe('rejected')
    const log = val(repo.listAuditEvents(admin))
    expect(log.slice(-2).map((e) => [e.id, e.action, e.target.id, e.from, e.to, e.reason])).toEqual([
      ['aud_0007', 'job.approve', 'job_0002', 'pending_review', 'approved', 'information_consistent'],
      ['aud_0008', 'org.reject', 'org_0003', 'pending', 'rejected', 'information_incomplete'],
    ])
    expect(val(repo.listJobs(visitor)).some((j) => j.id === 'job_0002')).toBe(true)
    expect(err(repo.reviewJob(admin, 'job_0002', 'reject', 'other'))).toBe('unauthorized') // no longer pending
    expect(err(repo.reviewJob(admin, 'job_0003', 'approve', 'free text reason' as never))).toBe('unauthorized') // draft: not pending
  })
  it('rejects unknown decisions and reasons', () => {
    const repo = fresh()
    expect(err(repo.reviewJob(admin, 'job_0002', 'publish' as never, 'other'))).toBe('invalid')
    expect(err(repo.reviewJob(admin, 'job_0002', 'approve', 'because I said so' as never))).toBe('invalid')
  })
  it('audit events cannot be edited or deleted through the repository', () => {
    const repo = fresh()
    expect(Object.keys(repo).join(' ')).not.toMatch(/(update|delete|remove|edit|set)Audit/i)
    expect(Object.keys(repo).filter((k) => /audit/i.test(k))).toEqual(['listAuditEvents'])
    // mutating a returned copy changes nothing
    const copy = val(repo.listAuditEvents(admin))
    copy[0].to = 'tampered'; copy.length = 0
    expect(val(repo.listAuditEvents(admin))[0].to).toBe('verified')
    expect(val(repo.listAuditEvents(admin))).toHaveLength(JOBBOARD_SEED.auditEvents.length)
    // the snapshot is a copy too
    const snap = repo.snapshot(); snap.auditEvents.pop()
    expect(val(repo.listAuditEvents(admin))).toHaveLength(JOBBOARD_SEED.auditEvents.length)
  })
})

describe('repository: input safety', () => {
  it('malformed ids are invalid, unknown ids are not found, unknown actors are unauthorized', () => {
    const repo = fresh()
    for (const bad of ['', 'job_1', 'JOB_0001', 'job_0001;drop', '../job_0001', 42 as never]) expect(err(repo.getJob(empA, bad)), String(bad)).toBe('invalid')
    expect(err(repo.getJob(empA, 'job_9999'))).toBe('not_found')
    expect(err(repo.getApplication(ploy, 'app_9999'))).toBe('not_found')
    expect(err(repo.listJobs({ kind: 'worker', workerId: 'wkr_9999' }))).toBe('unauthorized')
    expect(err(repo.listJobs({ kind: 'admin', adminId: 'adm_9999' }))).toBe('unauthorized')
    expect(err(repo.listJobs({ kind: 'superuser' } as never))).toBe('unauthorized')
    expect(err(repo.listJobs({ kind: 'employer', organizationId: 'org_0001', role: 'admin' } as never))).toBe('unauthorized') // extra claims are not accepted
  })
  it('returned records are copies: mutating them does not change state', () => {
    const repo = fresh()
    const j = val(repo.getJob(empA, 'job_0003')); j.organizationId = 'org_0002'; j.review = 'approved'
    expect(val(repo.getJob(empA, 'job_0003'))).toMatchObject({ organizationId: 'org_0001', review: 'draft' })
  })
})

describe('persisted data and reset', () => {
  const broken = (f: (s: Snapshot) => void) => { const s = structuredClone(JOBBOARD_SEED); f(s); return JSON.stringify(s) }
  it('valid stored data is restored', () => {
    const repo = fresh()
    val(repo.submitApplication(ploy, { jobId: 'job_0004', confirmed: true }))
    const back = loadSnapshot(JSON.stringify(repo.snapshot()))
    expect(back.restored).toBe(true)
    expect(createMemoryRepo(back.snapshot).listApplications(ploy).ok && back.snapshot.applications).toHaveLength(5)
  })
  it('malformed or inconsistent stored data is never trusted; the seed is used instead', () => {
    const cases: [string, string | null][] = [
      ['empty', null], ['not json', '{oops'], ['wrong version', broken((s) => { (s as { version: number }).version = 2 })],
      ['not synthetic', broken((s) => { (s.workers[0] as { synthetic: boolean }).synthetic = false })],
      ['extra sensitive field', broken((s) => { Object.assign(s.workers[0], { passportNo: 'AA0000000' }) })],
      ['bad enum', broken((s) => { (s.jobs[0] as { review: string }).review = 'live' })],
      ['bad id', broken((s) => { s.jobs[0].id = 'job 1' })],
      ['duplicate id', broken((s) => { s.jobs[1].id = 'job_0001' })],
      ['job of unknown organisation', broken((s) => { s.jobs[0].organizationId = 'org_9999' })],
      ['application to unknown job', broken((s) => { s.applications[0].jobId = 'job_9999' })],
      ['application of unknown worker', broken((s) => { s.applications[0].workerId = 'wkr_9999' })],
      ['duplicate application', broken((s) => { s.applications[1].jobId = 'job_0001'; s.applications[1].workerId = 'wkr_0001' })],
      ['status not matching history', broken((s) => { s.applications[0].status = 'shortlisted' })],
      ['skipped transition', broken((s) => { s.statusEvents[1].to = 'closed'; s.applications[0].status = 'closed' })],
      ['wrong side made a transition', broken((s) => { s.statusEvents[1].by = 'worker' })],
      ['audit of unknown target', broken((s) => { s.auditEvents[0].target = { type: 'organization', id: 'org_9999' } })],
      ['contact details in a title', broken((s) => { s.jobs[0].title = 'Apply: hr@example.com' })],
      ['unknown province', broken((s) => { s.organizations[0].province = 'CN-QQ' })],
    ]
    for (const [name, text] of cases) {
      const r = loadSnapshot(text)
      expect(r.restored, name).toBe(false)
      expect(r.snapshot, name).toEqual(JOBBOARD_SEED)
    }
  })
  it('reset restores the deterministic seed', () => {
    const repo = fresh()
    val(repo.createJob(empA, input))
    val(repo.reviewJob(admin, 'job_0002', 'approve', 'information_consistent'))
    val(repo.transitionApplication(narin, 'app_0003', 'withdrawn'))
    expect(repo.snapshot()).not.toEqual(JOBBOARD_SEED)
    repo.reset()
    expect(repo.snapshot()).toEqual(JOBBOARD_SEED)
    expect(val(repo.createJob(empA, input)).id).toBe('job_0008') // id sequence restarts from the seed
  })
  it('the seed itself is never mutated by repository operations', () => {
    const before = JSON.stringify(JOBBOARD_SEED)
    const repo = fresh()
    val(repo.updateWorker(ploy, 'wkr_0001', { skills: ['data_analysis'] }))
    val(repo.closeJob(empA, 'job_0001'))
    expect(JSON.stringify(JOBBOARD_SEED)).toBe(before)
  })
})
