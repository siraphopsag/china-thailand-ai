/**
 * Job-board PoC domain (Thai skilled workers ↔ employers in mainland China).
 *
 * Every record is SYNTHETIC: invented people and fictional organisations used only to demonstrate workflows.
 * Nothing here is a real job advertisement, a real application or a recruitment service.
 * Records deliberately have no fields for identity numbers, passports, contact details, health or criminal records.
 */

/** Marks a record as invented demo data. The validator rejects any record without it. */
export interface Synthetic { synthetic: true }

export type WorkerId = string // wkr_xxxx
export type OrganizationId = string // org_xxxx
export type JobId = string // job_xxxx
export type ApplicationId = string // app_xxxx
export type AdminId = string // adm_xxxx
export type StatusEventId = string // sev_xxxx
export type AuditEventId = string // aud_xxxx

/**
 * Who is acting. In this PoC the persona is chosen in the browser, so an Actor is a *claim*, not a verified identity:
 * the repository only checks that the referenced worker / organisation / admin exists in the synthetic data.
 */
export type Actor =
  | { kind: 'visitor' }
  | { kind: 'worker'; workerId: WorkerId }
  | { kind: 'employer'; organizationId: OrganizationId }
  /** simulated reviewer persona only — there is no real administrator account */
  | { kind: 'admin'; adminId: AdminId }
export type ActorKind = Actor['kind']

export const SKILLS = [
  'software_engineering', 'data_analysis', 'mechanical_engineering', 'electrical_engineering', 'civil_engineering', 'quality_control',
  'project_management', 'accounting_finance', 'marketing', 'hospitality_management', 'culinary_arts', 'thai_chinese_translation',
] as const
export type Skill = (typeof SKILLS)[number]

export const INDUSTRIES = ['manufacturing', 'technology', 'hospitality', 'food_service', 'education', 'logistics', 'finance'] as const
export type Industry = (typeof INDUSTRIES)[number]

export const EDUCATION = ['vocational', 'bachelor', 'master', 'doctorate'] as const
export type Education = (typeof EDUCATION)[number]

export const LANGS = ['th', 'zh', 'en'] as const
export const LANG_LEVELS = ['basic', 'conversational', 'professional', 'native'] as const
export interface LanguageSkill { lang: (typeof LANGS)[number]; level: (typeof LANG_LEVELS)[number] }

export interface SimulatedAdmin extends Synthetic { id: AdminId; displayName: string }

export interface WorkerProfile extends Synthetic {
  id: WorkerId
  /** invented first name for the persona; not editable */
  displayName: string
  headline: string
  skills: Skill[]
  yearsExperience: number
  education: Education
  languages: LanguageSkill[]
  /** ISO 3166-2 province codes in mainland China (e.g. CN-SH) */
  preferredProvinces: string[]
  updatedAt: string
}

/** Employer verification is a review state of the organisation, separate from who is acting. */
export const ORG_VERIFICATION = ['unverified', 'pending', 'verified', 'rejected'] as const
export type OrgVerification = (typeof ORG_VERIFICATION)[number]

export interface Organization extends Synthetic {
  id: OrganizationId
  name: string
  industry: Industry
  province: string
  verification: OrgVerification
  createdAt: string
}

/** Review state of a job post. Only `approved` (and `closed`) posts of a verified organisation are visible to the public. */
export const JOB_REVIEW = ['draft', 'pending_review', 'approved', 'rejected', 'closed'] as const
export type JobReview = (typeof JOB_REVIEW)[number]

export interface Job extends Synthetic {
  id: JobId
  /** exactly one owning organisation */
  organizationId: OrganizationId
  title: string
  industry: Industry
  skills: Skill[]
  minYears: number
  province: string
  contractMonths: number
  review: JobReview
  createdAt: string
  updatedAt: string
}

/**
 * Simulated application statuses. There is intentionally no "hired", "offer", "visa approved" or "work permit" status:
 * the PoC never represents an employment, visa or permit outcome.
 */
export const APPLICATION_STATUS = ['submitted', 'under_review', 'shortlisted', 'not_selected', 'withdrawn', 'closed'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number]

export interface Application extends Synthetic {
  id: ApplicationId
  jobId: JobId
  workerId: WorkerId
  status: ApplicationStatus
  createdAt: string
  updatedAt: string
}

/** Which side may move an application from one status to another. Anything not listed is an invalid transition. */
export type TransitionBy = 'worker' | 'employer'
export const TRANSITIONS: Readonly<Record<ApplicationStatus, Partial<Record<ApplicationStatus, TransitionBy>>>> = {
  submitted: { under_review: 'employer', not_selected: 'employer', withdrawn: 'worker' },
  under_review: { shortlisted: 'employer', not_selected: 'employer', withdrawn: 'worker' },
  shortlisted: { not_selected: 'employer', closed: 'employer', withdrawn: 'worker' },
  not_selected: {},
  withdrawn: {},
  closed: {},
}

export interface StatusEvent extends Synthetic {
  id: StatusEventId
  applicationId: ApplicationId
  /** null for the first event (the application was created) */
  from: ApplicationStatus | null
  to: ApplicationStatus
  by: TransitionBy
  at: string
}

export const AUDIT_ACTIONS = ['org.verify', 'org.reject', 'job.approve', 'job.reject'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]
/** Reasons are codes, not free text, so no personal details can end up in the log. */
export const REVIEW_REASONS = ['information_consistent', 'information_incomplete', 'content_not_allowed', 'suspected_misleading', 'other'] as const
export type ReviewReason = (typeof REVIEW_REASONS)[number]

/** Append-only record of a simulated administrative decision. */
export interface AuditEvent extends Synthetic {
  id: AuditEventId
  at: string
  adminId: AdminId
  action: AuditAction
  target: { type: 'organization'; id: OrganizationId } | { type: 'job'; id: JobId }
  from: string
  to: string
  reason: ReviewReason
}

/** The complete PoC state; also the shape a persistence adapter stores (after validation on load). */
export interface Snapshot {
  version: 1
  admins: SimulatedAdmin[]
  workers: WorkerProfile[]
  organizations: Organization[]
  jobs: Job[]
  applications: Application[]
  statusEvents: StatusEvent[]
  auditEvents: AuditEvent[]
}
