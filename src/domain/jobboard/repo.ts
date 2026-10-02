/**
 * Job-board repository for the PoC: a small interface plus an in-memory implementation over the synthetic seed.
 *
 * Every operation looks up the real related records itself (from ids) and asks the central policy (`can`). Caller-supplied
 * owner ids are never accepted as proof: a new job always belongs to the acting employer's organisation and a new application
 * always to the acting worker. Returned records are copies, so callers cannot change state by mutating them.
 *
 * Client-side mock: NOT tamper-proof and NOT a security boundary (see policy.ts). Audit events can only be appended, by the
 * review operations; the interface has no way to edit or delete them — within this API, not against someone editing browser storage.
 */
import { JOBBOARD_SEED } from '../../data/seed/jobboard'
import { can, isOpenJob, transitionBy } from './policy'
import {
  INDUSTRIES, REVIEW_REASONS, type Actor, type Application, type ApplicationId, type ApplicationStatus, type AuditAction, type AuditEvent, type Industry, type Job, type JobId,
  type LanguageSkill, type Organization, type OrganizationId, type ReviewReason, type Skill, type Snapshot, type StatusEvent, type WorkerId, type WorkerProfile, type Education, EDUCATION,
} from './types'
import { LIMITS, isActor, isCnProvince, isContractMonths, isId, isLanguages, isProvinces, isSkills, isYears, parseSnapshot, textProblem, type IdKind } from './validate'

export type RepoErrorCode = 'not_found' | 'invalid' | 'unauthorized' | 'conflict'
export type Result<T> = { ok: true; value: T } | { ok: false; error: RepoErrorCode; reason: string }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = <T,>(error: RepoErrorCode, reason: string): Result<T> => ({ ok: false, error, reason })

export interface JobInput { title: string; industry: Industry; skills: Skill[]; minYears: number; province: string; contractMonths: number }
export type WorkerPatch = Partial<{ headline: string; skills: Skill[]; yearsExperience: number; education: Education; languages: LanguageSkill[]; preferredProvinces: string[] }>
/** `confirmed` must be the literal `true`, set only by the worker's own explicit confirmation step in the UI. */
export interface ApplicationInput { jobId: JobId; confirmed: true }

export interface JobBoardRepo {
  /** jobs the actor may see: public approved/closed jobs, plus all of an employer's own jobs, or every job for the admin persona */
  listJobs(actor: Actor): Result<Job[]>
  getJob(actor: Actor, id: JobId): Result<Job>
  getOrganization(actor: Actor, id: OrganizationId): Result<Organization>
  createJob(actor: Actor, input: JobInput): Result<Job>
  updateJob(actor: Actor, id: JobId, input: JobInput): Result<Job>
  submitJob(actor: Actor, id: JobId): Result<Job>
  closeJob(actor: Actor, id: JobId): Result<Job>
  requestVerification(actor: Actor): Result<Organization>
  /** simulated admin review; appends an audit event */
  reviewOrganization(actor: Actor, id: OrganizationId, decision: 'verify' | 'reject', reason: ReviewReason): Result<Organization>
  /** simulated admin review; appends an audit event */
  reviewJob(actor: Actor, id: JobId, decision: 'approve' | 'reject', reason: ReviewReason): Result<Job>
  getWorker(actor: Actor, id: WorkerId): Result<WorkerProfile>
  updateWorker(actor: Actor, id: WorkerId, patch: WorkerPatch): Result<WorkerProfile>
  /** an employer reads an applicant's profile through the application (only for its own jobs) */
  getApplicant(actor: Actor, applicationId: ApplicationId): Result<WorkerProfile>
  /** a worker's own applications, or an employer's applications for its own jobs (optionally one job) */
  listApplications(actor: Actor, jobId?: JobId): Result<Application[]>
  getApplication(actor: Actor, id: ApplicationId): Result<Application>
  submitApplication(actor: Actor, input: ApplicationInput): Result<Application>
  transitionApplication(actor: Actor, id: ApplicationId, to: ApplicationStatus): Result<Application>
  listStatusEvents(actor: Actor, applicationId: ApplicationId): Result<StatusEvent[]>
  listAuditEvents(actor: Actor): Result<AuditEvent[]>
  /** what the actor may review now: pending organisations and jobs waiting for review (simulated admin persona only) */
  listReviewQueue(actor: Actor): Result<{ organizations: Organization[]; jobs: Job[] }>
  /** copy of the whole state, for a persistence adapter */
  snapshot(): Snapshot
  /** restore the deterministic synthetic seed (a demo utility, not an admin action; it also clears the audit log) */
  reset(): void
}

const clone = <T,>(v: T): T => structuredClone(v)

function checkJobInput(v: JobInput): string | null {
  const tp = textProblem(v?.title, ...LIMITS.title)
  if (tp) return `title: ${tp}`
  if (!INDUSTRIES.includes(v.industry)) return 'industry'
  if (!isSkills(v.skills) || !v.skills.length) return 'skills'
  if (!isYears(v.minYears)) return 'minYears'
  if (!isCnProvince(v.province)) return 'province'
  if (!isContractMonths(v.contractMonths)) return 'contractMonths'
  return null
}
function checkWorkerPatch(p: WorkerPatch): string | null {
  if (typeof p !== 'object' || p === null) return 'patch'
  const allowed = ['headline', 'skills', 'yearsExperience', 'education', 'languages', 'preferredProvinces']
  const extra = Object.keys(p).find((k) => !allowed.includes(k))
  if (extra) return `field not editable: ${extra}`
  if (p.headline !== undefined) { const tp = textProblem(p.headline, ...LIMITS.headline); if (tp) return `headline: ${tp}` }
  if (p.skills !== undefined && !isSkills(p.skills)) return 'skills'
  if (p.yearsExperience !== undefined && !isYears(p.yearsExperience)) return 'yearsExperience'
  if (p.education !== undefined && !EDUCATION.includes(p.education)) return 'education'
  if (p.languages !== undefined && !isLanguages(p.languages)) return 'languages'
  if (p.preferredProvinces !== undefined && !isProvinces(p.preferredProvinces)) return 'preferredProvinces'
  return null
}

/**
 * In-memory repository. `initial` must already be a validated snapshot (use `loadSnapshot`); `now` makes timestamps deterministic in tests.
 */
export function createMemoryRepo(initial: Snapshot = JOBBOARD_SEED, opts: { now?: () => string } = {}): JobBoardRepo {
  const now = opts.now ?? (() => new Date().toISOString())
  let s: Snapshot = clone(initial)
  const prefix: Record<'job' | 'application' | 'statusEvent' | 'audit', string> = { job: 'job_', application: 'app_', statusEvent: 'sev_', audit: 'aud_' }
  const listFor = { job: () => s.jobs, application: () => s.applications, statusEvent: () => s.statusEvents, audit: () => s.auditEvents }
  /** next sequential id (deterministic: max existing number + 1) */
  const nextId = (kind: keyof typeof prefix) => {
    const n = listFor[kind]().reduce((m, r) => Math.max(m, Number(r.id.slice(4)) || 0), 0) + 1
    return prefix[kind] + String(n).padStart(4, '0')
  }

  const org = (id: string) => s.organizations.find((o) => o.id === id)
  const job = (id: string) => s.jobs.find((j) => j.id === id)
  const worker = (id: string) => s.workers.find((w) => w.id === id)
  const app = (id: string) => s.applications.find((a) => a.id === id)

  /** the actor must be well-formed and refer to a persona that exists in the synthetic data */
  const known = (a: Actor): boolean => {
    if (!isActor(a)) return false
    switch (a.kind) {
      case 'visitor': return true
      case 'worker': return !!worker(a.workerId)
      case 'employer': return !!org(a.organizationId)
      case 'admin': return s.admins.some((x) => x.id === a.adminId)
    }
  }
  /** shared prologue: actor known, id well-formed, record exists */
  function find<T>(a: Actor, kind: IdKind, id: unknown, get: (id: string) => T | undefined): Result<T> {
    if (!known(a)) return fail('unauthorized', 'unknown actor')
    if (!isId(kind, id)) return fail('invalid', `${kind} id`)
    const r = get(id)
    return r ? ok(r) : fail('not_found', kind)
  }
  const jobRes = (j: Job) => ({ job: j, organization: org(j.organizationId)! }) // referential integrity is guaranteed by validation
  const audit = (a: Actor & { kind: 'admin' }, action: AuditAction, target: AuditEvent['target'], from: string, to: string, reason: ReviewReason) => {
    s.auditEvents.push({ id: nextId('audit'), synthetic: true, at: now(), adminId: a.adminId, action, target, from, to, reason })
  }

  return {
    listJobs(a) {
      if (!known(a)) return fail('unauthorized', 'unknown actor')
      return ok(clone(s.jobs.filter((j) => can(a, 'job.read', jobRes(j)))))
    },
    getJob(a, id) {
      const r = find(a, 'job', id, job)
      if (!r.ok) return r
      return can(a, 'job.read', jobRes(r.value)) ? ok(clone(r.value)) : fail('unauthorized', 'job.read')
    },
    getOrganization(a, id) {
      const r = find(a, 'organization', id, org)
      if (!r.ok) return r
      return can(a, 'org.read', { organization: r.value }) ? ok(clone(r.value)) : fail('unauthorized', 'org.read')
    },
    createJob(a, input) {
      if (!known(a)) return fail('unauthorized', 'unknown actor')
      if (a.kind !== 'employer') return fail('unauthorized', 'job.create')
      const o = org(a.organizationId)! // the organisation comes from the actor, never from the input
      if (!can(a, 'job.create', { organization: o })) return fail('unauthorized', 'job.create')
      const bad = checkJobInput(input)
      if (bad) return fail('invalid', bad)
      const t = now()
      const j: Job = { id: nextId('job'), synthetic: true, organizationId: o.id, title: input.title, industry: input.industry, skills: [...input.skills], minYears: input.minYears, province: input.province, contractMonths: input.contractMonths, review: 'draft', createdAt: t, updatedAt: t }
      s.jobs.push(j)
      return ok(clone(j))
    },
    updateJob(a, id, input) {
      const r = find(a, 'job', id, job)
      if (!r.ok) return r
      if (!can(a, 'job.update', jobRes(r.value))) return fail('unauthorized', 'job.update')
      const bad = checkJobInput(input)
      if (bad) return fail('invalid', bad)
      Object.assign(r.value, { title: input.title, industry: input.industry, skills: [...input.skills], minYears: input.minYears, province: input.province, contractMonths: input.contractMonths, review: 'draft', updatedAt: now() })
      return ok(clone(r.value))
    },
    submitJob(a, id) {
      const r = find(a, 'job', id, job)
      if (!r.ok) return r
      if (!can(a, 'job.submit', jobRes(r.value))) return fail('unauthorized', 'job.submit')
      Object.assign(r.value, { review: 'pending_review', updatedAt: now() })
      return ok(clone(r.value))
    },
    closeJob(a, id) {
      const r = find(a, 'job', id, job)
      if (!r.ok) return r
      if (!can(a, 'job.close', jobRes(r.value))) return fail('unauthorized', 'job.close')
      Object.assign(r.value, { review: 'closed', updatedAt: now() })
      return ok(clone(r.value))
    },
    requestVerification(a) {
      if (!known(a)) return fail('unauthorized', 'unknown actor')
      if (a.kind !== 'employer') return fail('unauthorized', 'org.requestVerification')
      const o = org(a.organizationId)!
      if (!can(a, 'org.requestVerification', { organization: o })) return fail('unauthorized', 'org.requestVerification')
      o.verification = 'pending'
      return ok(clone(o))
    },
    reviewOrganization(a, id, decision, reason) {
      const r = find(a, 'organization', id, org)
      if (!r.ok) return r
      if (a.kind !== 'admin' || !can(a, 'org.verify', { organization: r.value })) return fail('unauthorized', 'org.verify')
      if ((decision !== 'verify' && decision !== 'reject') || !REVIEW_REASONS.includes(reason)) return fail('invalid', 'decision or reason')
      const from = r.value.verification
      r.value.verification = decision === 'verify' ? 'verified' : 'rejected'
      audit(a, decision === 'verify' ? 'org.verify' : 'org.reject', { type: 'organization', id: r.value.id }, from, r.value.verification, reason)
      return ok(clone(r.value))
    },
    reviewJob(a, id, decision, reason) {
      const r = find(a, 'job', id, job)
      if (!r.ok) return r
      if (a.kind !== 'admin' || !can(a, 'job.review', jobRes(r.value))) return fail('unauthorized', 'job.review')
      if ((decision !== 'approve' && decision !== 'reject') || !REVIEW_REASONS.includes(reason)) return fail('invalid', 'decision or reason')
      const from = r.value.review
      Object.assign(r.value, { review: decision === 'approve' ? 'approved' : 'rejected', updatedAt: now() })
      audit(a, decision === 'approve' ? 'job.approve' : 'job.reject', { type: 'job', id: r.value.id }, from, r.value.review, reason)
      return ok(clone(r.value))
    },
    getWorker(a, id) {
      const r = find(a, 'worker', id, worker)
      if (!r.ok) return r
      return can(a, 'worker.read', { worker: r.value }) ? ok(clone(r.value)) : fail('unauthorized', 'worker.read')
    },
    updateWorker(a, id, patch) {
      const r = find(a, 'worker', id, worker)
      if (!r.ok) return r
      if (!can(a, 'worker.update', { worker: r.value })) return fail('unauthorized', 'worker.update')
      const bad = checkWorkerPatch(patch)
      if (bad) return fail('invalid', bad)
      Object.assign(r.value, clone(Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))), { updatedAt: now() })
      return ok(clone(r.value))
    },
    getApplicant(a, applicationId) {
      const r = find(a, 'application', applicationId, app)
      if (!r.ok) return r
      const w = worker(r.value.workerId)!, j = job(r.value.jobId)!
      return can(a, 'worker.read', { worker: w, via: { application: r.value, job: j } }) ? ok(clone(w)) : fail('unauthorized', 'worker.read')
    },
    listApplications(a, jobId) {
      if (!known(a)) return fail('unauthorized', 'unknown actor')
      if (a.kind !== 'worker' && a.kind !== 'employer') return fail('unauthorized', 'application.read')
      if (jobId !== undefined && !isId('job', jobId)) return fail('invalid', 'job id')
      const list = s.applications.filter((x) => (jobId === undefined || x.jobId === jobId) && can(a, 'application.read', { application: x, job: job(x.jobId)! }))
      return ok(clone(list))
    },
    getApplication(a, id) {
      const r = find(a, 'application', id, app)
      if (!r.ok) return r
      return can(a, 'application.read', { application: r.value, job: job(r.value.jobId)! }) ? ok(clone(r.value)) : fail('unauthorized', 'application.read')
    },
    submitApplication(a, input) {
      if (!known(a)) return fail('unauthorized', 'unknown actor')
      if (a.kind !== 'worker') return fail('unauthorized', 'application.create')
      if (typeof input !== 'object' || input === null || input.confirmed !== true) return fail('invalid', 'confirmation required')
      if (!isId('job', input.jobId)) return fail('invalid', 'job id')
      const j = job(input.jobId)
      if (!j) return fail('not_found', 'job')
      const w = worker(a.workerId)! // the applicant is always the acting worker
      const res = jobRes(j)
      if (!isOpenJob(res)) return fail('conflict', 'job is not open')
      if (!can(a, 'application.create', { worker: w, ...res })) return fail('unauthorized', 'application.create')
      if (s.applications.some((x) => x.jobId === j.id && x.workerId === w.id)) return fail('conflict', 'already applied')
      const t = now()
      const created: Application = { id: nextId('application'), synthetic: true, jobId: j.id, workerId: w.id, status: 'submitted', createdAt: t, updatedAt: t }
      s.applications.push(created)
      s.statusEvents.push({ id: nextId('statusEvent'), synthetic: true, applicationId: created.id, from: null, to: 'submitted', by: 'worker', at: t })
      return ok(clone(created))
    },
    transitionApplication(a, id, to) {
      const r = find(a, 'application', id, app)
      if (!r.ok) return r
      const j = job(r.value.jobId)!
      if (!can(a, 'application.read', { application: r.value, job: j })) return fail('unauthorized', 'application.read')
      const by = transitionBy(r.value.status, to)
      if (!by) return fail('invalid', `transition ${r.value.status} → ${String(to)}`)
      if (!can(a, 'application.transition', { application: r.value, job: j, to })) return fail('unauthorized', 'application.transition')
      const t = now()
      s.statusEvents.push({ id: nextId('statusEvent'), synthetic: true, applicationId: r.value.id, from: r.value.status, to, by, at: t })
      Object.assign(r.value, { status: to, updatedAt: t })
      return ok(clone(r.value))
    },
    listStatusEvents(a, applicationId) {
      const r = find(a, 'application', applicationId, app)
      if (!r.ok) return r
      if (!can(a, 'application.read', { application: r.value, job: job(r.value.jobId)! })) return fail('unauthorized', 'application.read')
      return ok(clone(s.statusEvents.filter((e) => e.applicationId === r.value.id)))
    },
    listAuditEvents(a) {
      if (!known(a)) return fail('unauthorized', 'unknown actor')
      return can(a, 'audit.read', {}) ? ok(clone(s.auditEvents)) : fail('unauthorized', 'audit.read')
    },
    listReviewQueue(a) {
      if (!known(a)) return fail('unauthorized', 'unknown actor')
      if (a.kind !== 'admin') return fail('unauthorized', 'review queue')
      const organizations = s.organizations.filter((o) => can(a, 'org.verify', { organization: o }))
      const jobs = s.jobs.filter((j) => can(a, 'job.review', jobRes(j)))
      return ok(clone({ organizations, jobs }))
    },
    snapshot: () => clone(s),
    reset: () => { s = clone(JOBBOARD_SEED) },
  }
}

/**
 * Persistence adapter helper: turns stored text into a snapshot the repository may use. Anything unreadable or invalid is
 * not trusted and the synthetic seed is used instead (`restored: false` tells the caller to say so).
 */
export function loadSnapshot(text: string | null): { snapshot: Snapshot; restored: boolean; reason?: string } {
  if (!text) return { snapshot: clone(JOBBOARD_SEED), restored: false }
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { snapshot: clone(JOBBOARD_SEED), restored: false, reason: 'json' } }
  const r = parseSnapshot(raw)
  return r.ok ? { snapshot: clone(r.snapshot), restored: true } : { snapshot: clone(JOBBOARD_SEED), restored: false, reason: r.reason }
}
