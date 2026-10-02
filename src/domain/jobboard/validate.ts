// Strict validation for job-board records (pure; no React, no DOM). Unlike the business store, which repairs what it can,
// these validators reject: a record that is not exactly right is not trusted at all.
import { isObj } from '../../profileSchema'
import { provinces } from '../../locales/provinces'
import {
  APPLICATION_STATUS, AUDIT_ACTIONS, EDUCATION, INDUSTRIES, JOB_REVIEW, LANG_LEVELS, LANGS, ORG_VERIFICATION, REVIEW_REASONS, SKILLS, TRANSITIONS,
  type Actor, type Application, type AuditEvent, type Job, type LanguageSkill, type Organization, type SimulatedAdmin, type Snapshot, type StatusEvent, type WorkerProfile,
} from './types'

const ID = { worker: /^wkr_[a-z0-9]{4,24}$/, organization: /^org_[a-z0-9]{4,24}$/, job: /^job_[a-z0-9]{4,24}$/, application: /^app_[a-z0-9]{4,24}$/, admin: /^adm_[a-z0-9]{4,24}$/, statusEvent: /^sev_[a-z0-9]{4,24}$/, audit: /^aud_[a-z0-9]{4,24}$/ } as const
export type IdKind = keyof typeof ID
export const isId = (kind: IdKind, v: unknown): v is string => typeof v === 'string' && ID[kind].test(v)

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/
export const isIsoTime = (v: unknown): v is string => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v))
/** Mainland-China province codes known to the map data (ISO 3166-2, e.g. CN-SH). */
export const isCnProvince = (v: unknown): v is string => typeof v === 'string' && /^CN-[A-Z]{2}$/.test(v) && `prov.${v}` in provinces
const oneOf = <T extends string>(all: readonly T[], v: unknown): v is T => typeof v === 'string' && (all as readonly string[]).includes(v)
const intIn = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const listOf = <T,>(v: unknown, ok: (x: unknown) => x is T, max: number): v is T[] => Array.isArray(v) && v.length <= max && v.every(ok) && new Set(v.map((x) => JSON.stringify(x))).size === v.length

/**
 * Short free text (titles, headlines, persona names). Text that looks like contact details — an e-mail address, a link or a
 * long run of digits such as a phone or ID number — is refused, so real personal or employer contact data cannot be typed in.
 */
export function textProblem(v: unknown, min: number, max: number): 'type' | 'length' | 'contact' | null {
  if (typeof v !== 'string') return 'type'
  const s = v.trim()
  if (s.length < min || s.length > max || s !== v) return 'length'
  if (/[^\s@]+@[^\s@]+/.test(s) || /(https?:\/\/|www\.)/i.test(s) || /\d[\d\s-]{6,}\d/.test(s)) return 'contact'
  return null
}
const isText = (min: number, max: number) => (v: unknown): v is string => textProblem(v, min, max) === null
export const LIMITS = { title: [3, 120], headline: [0, 120], name: [2, 80] } as const

export const isSkill = (v: unknown) => oneOf(SKILLS, v)
const isLangSkill = (v: unknown): v is LanguageSkill => isObj(v) && Object.keys(v).length === 2 && oneOf(LANGS, v.lang) && oneOf(LANG_LEVELS, v.level)
export const isSkills = (v: unknown) => listOf(v, isSkill, SKILLS.length)
export const isLanguages = (v: unknown): v is LanguageSkill[] => listOf(v, isLangSkill, LANGS.length) && new Set(v.map((l) => l.lang)).size === v.length
export const isProvinces = (v: unknown) => listOf(v, isCnProvince, 5)
export const isYears = (v: unknown) => intIn(v, 0, 50)
export const isContractMonths = (v: unknown) => intIn(v, 1, 60)

/** exact key set: unexpected (possibly sensitive) fields make the record invalid */
const keys = (o: Record<string, unknown>, expected: string[]) => Object.keys(o).length === expected.length && expected.every((k) => k in o)

export function isAdmin(v: unknown): v is SimulatedAdmin {
  return isObj(v) && keys(v, ['id', 'synthetic', 'displayName']) && v.synthetic === true && isId('admin', v.id) && isText(...LIMITS.name)(v.displayName)
}
export function isWorker(v: unknown): v is WorkerProfile {
  return isObj(v) && keys(v, ['id', 'synthetic', 'displayName', 'headline', 'skills', 'yearsExperience', 'education', 'languages', 'preferredProvinces', 'updatedAt']) &&
    v.synthetic === true && isId('worker', v.id) && isText(...LIMITS.name)(v.displayName) && isText(...LIMITS.headline)(v.headline) && isSkills(v.skills) &&
    isYears(v.yearsExperience) && oneOf(EDUCATION, v.education) && isLanguages(v.languages) && isProvinces(v.preferredProvinces) && isIsoTime(v.updatedAt)
}
export function isOrganization(v: unknown): v is Organization {
  return isObj(v) && keys(v, ['id', 'synthetic', 'name', 'industry', 'province', 'verification', 'createdAt']) && v.synthetic === true && isId('organization', v.id) &&
    isText(...LIMITS.name)(v.name) && oneOf(INDUSTRIES, v.industry) && isCnProvince(v.province) && oneOf(ORG_VERIFICATION, v.verification) && isIsoTime(v.createdAt)
}
export function isJob(v: unknown): v is Job {
  return isObj(v) && keys(v, ['id', 'synthetic', 'organizationId', 'title', 'industry', 'skills', 'minYears', 'province', 'contractMonths', 'review', 'createdAt', 'updatedAt']) &&
    v.synthetic === true && isId('job', v.id) && isId('organization', v.organizationId) && isText(...LIMITS.title)(v.title) && oneOf(INDUSTRIES, v.industry) &&
    isSkills(v.skills) && (v.skills as unknown[]).length > 0 && isYears(v.minYears) && isCnProvince(v.province) && isContractMonths(v.contractMonths) &&
    oneOf(JOB_REVIEW, v.review) && isIsoTime(v.createdAt) && isIsoTime(v.updatedAt)
}
export function isApplication(v: unknown): v is Application {
  return isObj(v) && keys(v, ['id', 'synthetic', 'jobId', 'workerId', 'status', 'createdAt', 'updatedAt']) && v.synthetic === true && isId('application', v.id) &&
    isId('job', v.jobId) && isId('worker', v.workerId) && oneOf(APPLICATION_STATUS, v.status) && isIsoTime(v.createdAt) && isIsoTime(v.updatedAt)
}
export function isStatusEvent(v: unknown): v is StatusEvent {
  return isObj(v) && keys(v, ['id', 'synthetic', 'applicationId', 'from', 'to', 'by', 'at']) && v.synthetic === true && isId('statusEvent', v.id) && isId('application', v.applicationId) &&
    (v.from === null || oneOf(APPLICATION_STATUS, v.from)) && oneOf(APPLICATION_STATUS, v.to) && (v.by === 'worker' || v.by === 'employer') && isIsoTime(v.at)
}
export function isAuditEvent(v: unknown): v is AuditEvent {
  if (!isObj(v) || !keys(v, ['id', 'synthetic', 'at', 'adminId', 'action', 'target', 'from', 'to', 'reason']) || v.synthetic !== true) return false
  const t = v.target
  const targetOk = isObj(t) && keys(t, ['type', 'id']) && ((t.type === 'organization' && isId('organization', t.id)) || (t.type === 'job' && isId('job', t.id)))
  return isId('audit', v.id) && isIsoTime(v.at) && isId('admin', v.adminId) && oneOf(AUDIT_ACTIONS, v.action) && targetOk &&
    typeof v.from === 'string' && typeof v.to === 'string' && oneOf(REVIEW_REASONS, v.reason)
}
export function isActor(v: unknown): v is Actor {
  if (!isObj(v)) return false
  switch (v.kind) {
    case 'visitor': return keys(v, ['kind'])
    case 'worker': return keys(v, ['kind', 'workerId']) && isId('worker', v.workerId)
    case 'employer': return keys(v, ['kind', 'organizationId']) && isId('organization', v.organizationId)
    case 'admin': return keys(v, ['kind', 'adminId']) && isId('admin', v.adminId)
    default: return false
  }
}

export type SnapshotResult = { ok: true; snapshot: Snapshot } | { ok: false; reason: string }
/**
 * Validates a whole stored snapshot: every record, unique ids, and every reference (job → organisation, application → job and worker,
 * status history → application, audit → target). Any problem rejects the snapshot as a whole; the caller then falls back to the seed.
 */
export function parseSnapshot(raw: unknown): SnapshotResult {
  const bad = (reason: string): SnapshotResult => ({ ok: false, reason })
  if (!isObj(raw) || raw.version !== 1) return bad('version')
  const lists = [['admins', isAdmin], ['workers', isWorker], ['organizations', isOrganization], ['jobs', isJob], ['applications', isApplication], ['statusEvents', isStatusEvent], ['auditEvents', isAuditEvent]] as const
  for (const [k, ok] of lists) {
    const list = raw[k]
    if (!Array.isArray(list) || list.length > 10_000) return bad(k)
    const i = list.findIndex((x) => !ok(x))
    if (i >= 0) return bad(`${k}[${i}]`)
    if (new Set(list.map((x) => (x as { id: string }).id)).size !== list.length) return bad(`${k}: duplicate id`)
  }
  const s = raw as unknown as Snapshot
  const orgs = new Set(s.organizations.map((o) => o.id)), workers = new Set(s.workers.map((w) => w.id)), admins = new Set(s.admins.map((a) => a.id))
  const jobs = new Map(s.jobs.map((j) => [j.id, j])), apps = new Map(s.applications.map((a) => [a.id, a]))
  for (const j of s.jobs) if (!orgs.has(j.organizationId)) return bad(`job ${j.id}: unknown organization`)
  const pairs = new Set<string>()
  for (const a of s.applications) {
    if (!jobs.has(a.jobId) || !workers.has(a.workerId)) return bad(`application ${a.id}: broken reference`)
    const pair = a.jobId + '|' + a.workerId
    if (pairs.has(pair)) return bad(`application ${a.id}: duplicate application`)
    pairs.add(pair)
  }
  // each application's history must start with its creation, follow allowed transitions and end at its current status
  for (const e of s.statusEvents) if (!apps.has(e.applicationId)) return bad(`status event ${e.id}: unknown application`)
  for (const a of s.applications) {
    const hist = s.statusEvents.filter((e) => e.applicationId === a.id)
    if (!hist.length || hist[0].from !== null || hist[0].to !== 'submitted' || hist[0].by !== 'worker') return bad(`application ${a.id}: history must start with submission`)
    for (let i = 1; i < hist.length; i++) {
      const p = hist[i - 1], e = hist[i]
      if (e.from !== p.to || TRANSITIONS[p.to][e.to] !== e.by || e.at < p.at) return bad(`status event ${e.id}: invalid transition`)
    }
    if (hist[hist.length - 1].to !== a.status) return bad(`application ${a.id}: status does not match history`)
  }
  for (const e of s.auditEvents) {
    if (!admins.has(e.adminId)) return bad(`audit ${e.id}: unknown admin`)
    if (!(e.target.type === 'organization' ? orgs.has(e.target.id) : jobs.has(e.target.id))) return bad(`audit ${e.id}: unknown target`)
  }
  return { ok: true, snapshot: s }
}
