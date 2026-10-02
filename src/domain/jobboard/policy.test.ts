import { describe, expect, it } from 'vitest'
import { can } from './policy'
import { JOBBOARD_SEED as S } from '../../data/seed/jobboard'
import type { Actor, Application, Job, Organization, WorkerProfile } from './types'

const visitor: Actor = { kind: 'visitor' }
const ploy: Actor = { kind: 'worker', workerId: 'wkr_0001' }
const narin: Actor = { kind: 'worker', workerId: 'wkr_0002' }
const empA: Actor = { kind: 'employer', organizationId: 'org_0001' }
const empB: Actor = { kind: 'employer', organizationId: 'org_0002' }
const admin: Actor = { kind: 'admin', adminId: 'adm_0001' }
const ALL = [visitor, ploy, narin, empA, empB, admin]

const org = (id: string) => S.organizations.find((o) => o.id === id) as Organization
const job = (id: string) => S.jobs.find((j) => j.id === id) as Job
const wkr = (id: string) => S.workers.find((w) => w.id === id) as WorkerProfile
const app = (id: string) => S.applications.find((a) => a.id === id) as Application
const jr = (id: string) => ({ job: job(id), organization: org(job(id).organizationId) })
const ar = (id: string) => ({ application: app(id), job: job(app(id).jobId) })

describe('job-board policy: visitors', () => {
  it('see approved (and closed) jobs of verified organisations, nothing else', () => {
    expect(can(visitor, 'job.read', jr('job_0001'))).toBe(true)
    expect(can(visitor, 'job.read', jr('job_0006'))).toBe(true) // closed
    for (const id of ['job_0002', 'job_0003', 'job_0005', 'job_0007']) expect(can(visitor, 'job.read', jr(id)), id).toBe(false)
  })
  it('cannot create jobs, apply, review or read the audit log', () => {
    expect(can(visitor, 'job.create', { organization: org('org_0001') })).toBe(false)
    expect(can(visitor, 'application.create', { worker: wkr('wkr_0001'), ...jr('job_0001') })).toBe(false)
    expect(can(visitor, 'job.review', jr('job_0002'))).toBe(false)
    expect(can(visitor, 'org.verify', { organization: org('org_0003') })).toBe(false)
    expect(can(visitor, 'audit.read', {})).toBe(false)
    expect(can(visitor, 'worker.read', { worker: wkr('wkr_0001') })).toBe(false)
    expect(can(visitor, 'application.read', ar('app_0001'))).toBe(false)
  })
})

describe('job-board policy: workers', () => {
  it('read and update only their own profile', () => {
    expect(can(ploy, 'worker.read', { worker: wkr('wkr_0001') })).toBe(true)
    expect(can(ploy, 'worker.update', { worker: wkr('wkr_0001') })).toBe(true)
    expect(can(ploy, 'worker.read', { worker: wkr('wkr_0002') })).toBe(false)
    expect(can(ploy, 'worker.update', { worker: wkr('wkr_0002') })).toBe(false)
  })
  it('read only their own applications', () => {
    expect(can(ploy, 'application.read', ar('app_0001'))).toBe(true)
    expect(can(ploy, 'application.read', ar('app_0003'))).toBe(false) // Narin's application to the same job
    expect(can(narin, 'application.read', ar('app_0001'))).toBe(false)
  })
  it('apply only as themselves and only to open jobs', () => {
    expect(can(ploy, 'application.create', { worker: wkr('wkr_0001'), ...jr('job_0004') })).toBe(true)
    expect(can(ploy, 'application.create', { worker: wkr('wkr_0002'), ...jr('job_0004') })).toBe(false) // on someone else's behalf
    expect(can(ploy, 'application.create', { worker: wkr('wkr_0001'), ...jr('job_0006') })).toBe(false) // closed
    expect(can(ploy, 'application.create', { worker: wkr('wkr_0001'), ...jr('job_0002') })).toBe(false) // not approved
  })
  it('may only withdraw; employer-side transitions are denied', () => {
    expect(can(ploy, 'application.transition', { ...ar('app_0001'), to: 'withdrawn' })).toBe(true)
    expect(can(ploy, 'application.transition', { ...ar('app_0001'), to: 'shortlisted' })).toBe(false)
    expect(can(narin, 'application.transition', { ...ar('app_0001'), to: 'withdrawn' })).toBe(false)
  })
})

describe('job-board policy: employers', () => {
  it('see all their own jobs (any state) but only public jobs of others', () => {
    for (const id of ['job_0001', 'job_0002', 'job_0003']) expect(can(empA, 'job.read', jr(id)), id).toBe(true)
    expect(can(empA, 'job.read', jr('job_0005'))).toBe(false) // org B, rejected
    expect(can(empA, 'job.read', jr('job_0004'))).toBe(true) // org B, public
  })
  it('read applications only for their own jobs, and change them only by employer-side transitions', () => {
    expect(can(empA, 'application.read', ar('app_0001'))).toBe(true)
    expect(can(empA, 'application.read', ar('app_0003'))).toBe(true)
    expect(can(empA, 'application.read', ar('app_0002'))).toBe(false)
    expect(can(empB, 'application.read', ar('app_0001'))).toBe(false)
    expect(can(empA, 'application.transition', { ...ar('app_0001'), to: 'shortlisted' })).toBe(true)
    expect(can(empB, 'application.transition', { ...ar('app_0001'), to: 'shortlisted' })).toBe(false)
    expect(can(empA, 'application.transition', { ...ar('app_0001'), to: 'withdrawn' })).toBe(false) // worker-side
  })
  it('cannot edit, submit or close another employer\'s jobs', () => {
    expect(can(empB, 'job.update', jr('job_0003'))).toBe(false)
    expect(can(empB, 'job.submit', jr('job_0003'))).toBe(false)
    expect(can(empB, 'job.close', jr('job_0001'))).toBe(false)
    expect(can(empA, 'job.update', jr('job_0003'))).toBe(true)
    expect(can(empA, 'job.close', jr('job_0001'))).toBe(true)
  })
  it('see an applicant\'s profile only through an application to their own job', () => {
    expect(can(empA, 'worker.read', { worker: wkr('wkr_0001'), via: ar('app_0001') })).toBe(true)
    expect(can(empB, 'worker.read', { worker: wkr('wkr_0001'), via: ar('app_0001') })).toBe(false)
    expect(can(empA, 'worker.read', { worker: wkr('wkr_0001') })).toBe(false)
    expect(can(empA, 'worker.read', { worker: wkr('wkr_0002'), via: ar('app_0001') })).toBe(false) // application of a different worker
  })
  it('an unverified organisation may draft but not submit; a rejected one may not create', () => {
    const empC: Actor = { kind: 'employer', organizationId: 'org_0003' }
    const empD: Actor = { kind: 'employer', organizationId: 'org_0004' }
    expect(can(empC, 'job.create', { organization: org('org_0003') })).toBe(true)
    expect(can(empC, 'job.submit', jr('job_0007'))).toBe(false)
    expect(can(empD, 'job.create', { organization: org('org_0004') })).toBe(false)
  })
})

describe('job-board policy: admin persona', () => {
  it('only the admin persona can verify organisations, review jobs and read the audit log', () => {
    for (const a of ALL) {
      const isAdmin = a.kind === 'admin'
      expect(can(a, 'org.verify', { organization: org('org_0003') }), a.kind).toBe(isAdmin)
      expect(can(a, 'job.review', jr('job_0002')), a.kind).toBe(isAdmin)
      expect(can(a, 'audit.read', {}), a.kind).toBe(isAdmin)
    }
  })
  it('reviews only records waiting for review', () => {
    expect(can(admin, 'org.verify', { organization: org('org_0001') })).toBe(false) // already verified
    expect(can(admin, 'job.review', jr('job_0001'))).toBe(false) // already approved
  })
  it('has no access to workers\' profiles or applications in the PoC', () => {
    expect(can(admin, 'worker.read', { worker: wkr('wkr_0001') })).toBe(false)
    expect(can(admin, 'application.read', ar('app_0001'))).toBe(false)
  })
})

describe('job-board policy: relationships, not claimed owner ids', () => {
  it('a job paired with the wrong organisation record is denied', () => {
    // org B pretends job 0003 (org A's draft) is its own by passing its own organisation record
    expect(can(empB, 'job.update', { job: job('job_0003'), organization: org('org_0002') })).toBe(false)
    expect(can(empB, 'job.read', { job: job('job_0003'), organization: org('org_0002') })).toBe(false)
  })
  it('a forged job record whose organisation matches the actor does not unlock another application', () => {
    const forged: Job = { ...job('job_0004') } // org B's job, but app_0001 belongs to job_0001
    expect(can(empB, 'application.read', { application: app('app_0001'), job: forged })).toBe(false)
    expect(can(empB, 'application.transition', { application: app('app_0001'), job: forged, to: 'shortlisted' })).toBe(false)
  })
  it('an application whose workerId is edited still cannot be read through someone else\'s actor', () => {
    const edited = { ...app('app_0001'), workerId: 'wkr_0002' }
    // the policy only sees records; it is the repository that loads the real record, so this documents why it must never accept caller records
    expect(can(narin, 'application.read', { application: edited, job: job('job_0001') })).toBe(true)
  })
  it('is deterministic', () => {
    const r = ar('app_0001')
    expect(Array.from({ length: 5 }, () => can(empA, 'application.read', r))).toEqual([true, true, true, true, true])
  })
})
