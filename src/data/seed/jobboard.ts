import type { Actor, Snapshot } from '../../domain/jobboard/types'

/**
 * SYNTHETIC seed for the job-board PoC. Every person and organisation is invented; no job here is a real vacancy and
 * no record contains identity numbers, passport numbers, contact details or documents. Names carry "(Synthetic)" on purpose.
 *
 * Cases the tests rely on:
 * - org_0001 / org_0002 verified, org_0003 pending verification, org_0004 rejected
 * - jobs in every review state; job_0001 has applications from both workers (ownership and cross-ownership checks)
 * - every application's status history is complete and follows the allowed transitions
 */
const T = (day: number, hour = 9) => `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`

export const JOBBOARD_SEED: Snapshot = {
  version: 1,
  admins: [{ id: 'adm_0001', synthetic: true, displayName: 'Reviewer (Synthetic)' }],
  workers: [
    { id: 'wkr_0001', synthetic: true, displayName: 'Ploy (Synthetic)', headline: 'Quality control engineer, automotive parts', skills: ['quality_control', 'mechanical_engineering'],
      yearsExperience: 6, education: 'bachelor', languages: [{ lang: 'th', level: 'native' }, { lang: 'en', level: 'professional' }, { lang: 'zh', level: 'conversational' }], preferredProvinces: ['CN-JS', 'CN-SH'], updatedAt: T(1) },
    { id: 'wkr_0002', synthetic: true, displayName: 'Narin (Synthetic)', headline: 'Hotel operations manager', skills: ['hospitality_management', 'thai_chinese_translation'],
      yearsExperience: 9, education: 'master', languages: [{ lang: 'th', level: 'native' }, { lang: 'zh', level: 'professional' }], preferredProvinces: ['CN-SH', 'CN-GD'], updatedAt: T(1) },
  ],
  organizations: [
    { id: 'org_0001', synthetic: true, name: 'Example Precision Parts (Synthetic)', industry: 'manufacturing', province: 'CN-JS', verification: 'verified', createdAt: T(1) },
    { id: 'org_0002', synthetic: true, name: 'Sample Riverside Hotels (Synthetic)', industry: 'hospitality', province: 'CN-SH', verification: 'verified', createdAt: T(1) },
    { id: 'org_0003', synthetic: true, name: 'Placeholder Data Studio (Synthetic)', industry: 'technology', province: 'CN-GD', verification: 'pending', createdAt: T(2) },
    { id: 'org_0004', synthetic: true, name: 'Fictional Trading House (Synthetic)', industry: 'logistics', province: 'CN-ZJ', verification: 'rejected', createdAt: T(2) },
  ],
  jobs: [
    { id: 'job_0001', synthetic: true, organizationId: 'org_0001', title: 'Quality Control Engineer (Synthetic)', industry: 'manufacturing', skills: ['quality_control'], minYears: 3, province: 'CN-JS', contractMonths: 24, review: 'approved', createdAt: T(3), updatedAt: T(4) },
    { id: 'job_0002', synthetic: true, organizationId: 'org_0001', title: 'Production Planning Lead (Synthetic)', industry: 'manufacturing', skills: ['project_management'], minYears: 5, province: 'CN-JS', contractMonths: 24, review: 'pending_review', createdAt: T(5), updatedAt: T(5) },
    { id: 'job_0003', synthetic: true, organizationId: 'org_0001', title: 'Electrical Maintenance Engineer (Synthetic)', industry: 'manufacturing', skills: ['electrical_engineering'], minYears: 2, province: 'CN-JS', contractMonths: 12, review: 'draft', createdAt: T(6), updatedAt: T(6) },
    { id: 'job_0004', synthetic: true, organizationId: 'org_0002', title: 'Front Office Manager (Synthetic)', industry: 'hospitality', skills: ['hospitality_management'], minYears: 5, province: 'CN-SH', contractMonths: 24, review: 'approved', createdAt: T(3), updatedAt: T(4) },
    { id: 'job_0005', synthetic: true, organizationId: 'org_0002', title: 'Thai Cuisine Sous Chef (Synthetic)', industry: 'food_service', skills: ['culinary_arts'], minYears: 4, province: 'CN-SH', contractMonths: 12, review: 'rejected', createdAt: T(5), updatedAt: T(6) },
    { id: 'job_0006', synthetic: true, organizationId: 'org_0002', title: 'Guest Relations Specialist (Synthetic)', industry: 'hospitality', skills: ['thai_chinese_translation'], minYears: 2, province: 'CN-SH', contractMonths: 12, review: 'closed', createdAt: T(2), updatedAt: T(8) },
    { id: 'job_0007', synthetic: true, organizationId: 'org_0003', title: 'Data Analyst (Synthetic)', industry: 'technology', skills: ['data_analysis'], minYears: 2, province: 'CN-GD', contractMonths: 12, review: 'draft', createdAt: T(6), updatedAt: T(6) },
  ],
  applications: [
    { id: 'app_0001', synthetic: true, jobId: 'job_0001', workerId: 'wkr_0001', status: 'under_review', createdAt: T(5), updatedAt: T(6) },
    { id: 'app_0002', synthetic: true, jobId: 'job_0004', workerId: 'wkr_0002', status: 'submitted', createdAt: T(6), updatedAt: T(6) },
    { id: 'app_0003', synthetic: true, jobId: 'job_0001', workerId: 'wkr_0002', status: 'shortlisted', createdAt: T(5), updatedAt: T(7) },
    { id: 'app_0004', synthetic: true, jobId: 'job_0006', workerId: 'wkr_0001', status: 'not_selected', createdAt: T(3), updatedAt: T(7) },
  ],
  statusEvents: [
    { id: 'sev_0001', synthetic: true, applicationId: 'app_0001', from: null, to: 'submitted', by: 'worker', at: T(5) },
    { id: 'sev_0002', synthetic: true, applicationId: 'app_0001', from: 'submitted', to: 'under_review', by: 'employer', at: T(6) },
    { id: 'sev_0003', synthetic: true, applicationId: 'app_0002', from: null, to: 'submitted', by: 'worker', at: T(6) },
    { id: 'sev_0004', synthetic: true, applicationId: 'app_0003', from: null, to: 'submitted', by: 'worker', at: T(5, 10) },
    { id: 'sev_0005', synthetic: true, applicationId: 'app_0003', from: 'submitted', to: 'under_review', by: 'employer', at: T(6, 10) },
    { id: 'sev_0006', synthetic: true, applicationId: 'app_0003', from: 'under_review', to: 'shortlisted', by: 'employer', at: T(7) },
    { id: 'sev_0007', synthetic: true, applicationId: 'app_0004', from: null, to: 'submitted', by: 'worker', at: T(3) },
    { id: 'sev_0008', synthetic: true, applicationId: 'app_0004', from: 'submitted', to: 'not_selected', by: 'employer', at: T(7) },
  ],
  auditEvents: [
    { id: 'aud_0001', synthetic: true, at: T(2), adminId: 'adm_0001', action: 'org.verify', target: { type: 'organization', id: 'org_0001' }, from: 'pending', to: 'verified', reason: 'information_consistent' },
    { id: 'aud_0002', synthetic: true, at: T(2), adminId: 'adm_0001', action: 'org.verify', target: { type: 'organization', id: 'org_0002' }, from: 'pending', to: 'verified', reason: 'information_consistent' },
    { id: 'aud_0003', synthetic: true, at: T(3), adminId: 'adm_0001', action: 'org.reject', target: { type: 'organization', id: 'org_0004' }, from: 'pending', to: 'rejected', reason: 'information_incomplete' },
    { id: 'aud_0004', synthetic: true, at: T(4), adminId: 'adm_0001', action: 'job.approve', target: { type: 'job', id: 'job_0001' }, from: 'pending_review', to: 'approved', reason: 'information_consistent' },
    { id: 'aud_0005', synthetic: true, at: T(4), adminId: 'adm_0001', action: 'job.approve', target: { type: 'job', id: 'job_0004' }, from: 'pending_review', to: 'approved', reason: 'information_consistent' },
    { id: 'aud_0006', synthetic: true, at: T(6), adminId: 'adm_0001', action: 'job.reject', target: { type: 'job', id: 'job_0005' }, from: 'pending_review', to: 'rejected', reason: 'information_incomplete' },
  ],
}

/** The personas a future persona switcher can offer (simulated; choosing one proves nothing about who the user is). */
export const SEED_PERSONAS: { label: string; actor: Actor }[] = [
  { label: 'Visitor', actor: { kind: 'visitor' } },
  { label: 'Worker · Ploy (Synthetic)', actor: { kind: 'worker', workerId: 'wkr_0001' } },
  { label: 'Worker · Narin (Synthetic)', actor: { kind: 'worker', workerId: 'wkr_0002' } },
  { label: 'Employer · Example Precision Parts (Synthetic)', actor: { kind: 'employer', organizationId: 'org_0001' } },
  { label: 'Employer · Sample Riverside Hotels (Synthetic)', actor: { kind: 'employer', organizationId: 'org_0002' } },
  { label: 'Employer · Placeholder Data Studio (Synthetic)', actor: { kind: 'employer', organizationId: 'org_0003' } },
  { label: 'Admin · Reviewer (Synthetic)', actor: { kind: 'admin', adminId: 'adm_0001' } },
]
