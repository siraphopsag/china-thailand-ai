/**
 * Central permission policy for the job-board PoC: one pure function, `can(actor, action, resource)`.
 *
 * NOT A SECURITY BOUNDARY. In the PoC this runs in the browser on synthetic data: anyone can change their persona or edit browser
 * storage. The policy keeps the demonstrated workflows consistent and is written so the same rules can later run on a server
 * (or be mirrored as database row-level security). It must never be relied on to protect real people's data.
 *
 * Rules decide from the actual related records passed in (job ↔ organisation, application ↔ job ↔ worker), never from an owner id
 * the caller claims; mismatched records are denied. Anything not explicitly allowed is denied.
 */
import { TRANSITIONS, type Actor, type Application, type ApplicationStatus, type Job, type Organization, type TransitionBy, type WorkerProfile } from './types'

export interface JobResource { job: Job; organization: Organization }
export interface OrgResource { organization: Organization }
/** `via` is the application that links an applicant's profile to an employer's job (employers see only their own applicants) */
export interface WorkerResource { worker: WorkerProfile; via?: { application: Application; job: Job } }
export interface ApplicationResource { application: Application; job: Job }
export interface NewApplicationResource { worker: WorkerProfile; job: Job; organization: Organization }
export interface TransitionResource extends ApplicationResource { to: ApplicationStatus }

export interface ResourceFor {
  'job.read': JobResource
  'job.create': OrgResource
  'job.update': JobResource
  'job.submit': JobResource
  'job.close': JobResource
  'job.review': JobResource
  'org.read': OrgResource
  'org.requestVerification': OrgResource
  'org.verify': OrgResource
  'worker.read': WorkerResource
  'worker.update': WorkerResource
  'application.read': ApplicationResource
  'application.create': NewApplicationResource
  'application.transition': TransitionResource
  'audit.read': Record<string, never>
}
export type Action = keyof ResourceFor

const isWorker = (a: Actor, id: string) => a.kind === 'worker' && a.workerId === id
const isEmployerOf = (a: Actor, orgId: string) => a.kind === 'employer' && a.organizationId === orgId
/** the job record really belongs to the organisation record */
const linked = (r: JobResource) => r.job.organizationId === r.organization.id
/** a job anyone may see: approved or closed, posted by a verified organisation */
export const isPublicJob = (r: JobResource) => linked(r) && r.organization.verification === 'verified' && (r.job.review === 'approved' || r.job.review === 'closed')
/** a job a worker may apply to now */
export const isOpenJob = (r: JobResource) => isPublicJob(r) && r.job.review === 'approved'
/** who may move an application between two statuses, or null when the transition does not exist */
export const transitionBy = (from: ApplicationStatus, to: ApplicationStatus): TransitionBy | null => TRANSITIONS[from][to] ?? null

const rules: { [A in Action]: (actor: Actor, r: ResourceFor[A]) => boolean } = {
  'job.read': (a, r) => isPublicJob(r) || (linked(r) && (isEmployerOf(a, r.organization.id) || a.kind === 'admin')),
  // a rejected organisation cannot post; an unverified one may prepare drafts but cannot submit them
  'job.create': (a, r) => isEmployerOf(a, r.organization.id) && r.organization.verification !== 'rejected',
  'job.update': (a, r) => linked(r) && isEmployerOf(a, r.organization.id) && (r.job.review === 'draft' || r.job.review === 'rejected'),
  'job.submit': (a, r) => linked(r) && isEmployerOf(a, r.organization.id) && r.organization.verification === 'verified' && (r.job.review === 'draft' || r.job.review === 'rejected'),
  'job.close': (a, r) => linked(r) && isEmployerOf(a, r.organization.id) && r.job.review === 'approved',
  'job.review': (a, r) => linked(r) && a.kind === 'admin' && r.job.review === 'pending_review',
  'org.read': (a, r) => r.organization.verification === 'verified' || isEmployerOf(a, r.organization.id) || a.kind === 'admin',
  'org.requestVerification': (a, r) => isEmployerOf(a, r.organization.id) && (r.organization.verification === 'unverified' || r.organization.verification === 'rejected'),
  'org.verify': (a, r) => a.kind === 'admin' && r.organization.verification === 'pending',
  'worker.read': (a, r) => {
    if (isWorker(a, r.worker.id)) return true
    // an employer sees an applicant only through an application to one of its own jobs; admins have no need to read worker profiles in the PoC
    const v = r.via
    return !!v && a.kind === 'employer' && v.application.workerId === r.worker.id && v.application.jobId === v.job.id && v.job.organizationId === a.organizationId
  },
  'worker.update': (a, r) => isWorker(a, r.worker.id),
  'application.read': (a, r) => r.application.jobId === r.job.id && (isWorker(a, r.application.workerId) || isEmployerOf(a, r.job.organizationId)),
  'application.create': (a, r) => isWorker(a, r.worker.id) && isOpenJob(r),
  'application.transition': (a, r) => {
    if (r.application.jobId !== r.job.id) return false
    const by = transitionBy(r.application.status, r.to)
    return (by === 'worker' && isWorker(a, r.application.workerId)) || (by === 'employer' && isEmployerOf(a, r.job.organizationId))
  },
  'audit.read': (a) => a.kind === 'admin',
}

/** Deterministic and side-effect free. Unknown actions are denied. */
export function can<A extends Action>(actor: Actor, action: A, resource: ResourceFor[A]): boolean {
  const rule = rules[action] as ((a: Actor, r: ResourceFor[A]) => boolean) | undefined
  return rule ? rule(actor, resource) : false
}
