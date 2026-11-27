// The end system after arrival (v2 model, owner Nov 2026). Five check-ins (the first 24 hours, days 3, 7, 15 and 30) ask the worker four short
// questions; a "no" on pay, passport, hours or safety, a missed check-in, or the worker's secret word written in the note raises an
// alert that only the C.A.L.L. team sees (the employer never sees the answers). After day 30 the worker may review the employer:
// stars and fixed points, no free text, shown on the employer's posts as an anonymous total. A complaint the worker asks C.A.L.L.
// to file is first given a credibility score from the evidence and the case record (against false reports); anything that may
// endanger life or freedom is forwarded at once without that check. Pure: no React, no storage.
import { AGENCIES, URGENT, type ProblemKind } from './reportPack'
import type { Country } from './types'

/* ---------- check-ins ---------- */
/** the first 24 hours (arrival day), then days 3, 7, 15 and 30 (owner's blueprint, 27 Nov 2026; before: 1, 7, 30) */
export const CHECKIN_DAYS = [1, 3, 7, 15, 30] as const
/** workers who arrived before the five check-ins began keep the three they were told about (review, 27 Nov 2026) */
export const FIVE_CHECKINS_FROM = '2026-11-27'
export const checkinDaysFor = (arrival: string): readonly CheckDay[] => (arrival < FIVE_CHECKINS_FROM ? [1, 7, 30] : CHECKIN_DAYS)
export type CheckDay = (typeof CHECKIN_DAYS)[number]
/** days after the due day before a check-in counts as missed */
export const CHECKIN_GRACE = 2
export interface CheckIn {
  day: CheckDay; at: string
  paid: 'yes' | 'no' | 'notYet'
  passport: 'me' | 'employer' | 'other'
  hours: 'ok' | 'over'
  safe: 'yes' | 'no'
  note: string
  /** the note contained the worker's secret word (set by the page; never shown to the worker or the employer) */
  silent?: boolean
}
export type CheckState = 'done' | 'open' | 'missed' | 'upcoming'
export type CheckFlag = 'unpaid' | 'passport' | 'hours' | 'unsafe' | 'silent'

const addDays = (day: string, n: number) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export const dueDay = (arrival: string, d: CheckDay) => addDays(arrival, d - 1)

/** where each check-in stands on `today` (YYYY-MM-DD) for a worker who arrived on `arrival` */
export function checkinStates(arrival: string, done: CheckIn[], today: string): { day: CheckDay; due: string; state: CheckState }[] {
  return checkinDaysFor(arrival).map((day) => {
    const due = dueDay(arrival, day)
    const state: CheckState = done.some((c) => c.day === day) ? 'done' : today < due ? 'upcoming' : today > addDays(due, CHECKIN_GRACE) ? 'missed' : 'open'
    return { day, due, state }
  })
}
/** what in one check-in needs the team's attention ("not paid yet" on the arrival day is normal) */
export function checkinFlags(c: CheckIn): CheckFlag[] {
  const f: CheckFlag[] = []
  if (c.paid === 'no' || (c.paid === 'notYet' && c.day === 30)) f.push('unpaid')
  if (c.passport !== 'me') f.push('passport')
  if (c.hours === 'over') f.push('hours')
  if (c.safe === 'no') f.push('unsafe')
  if (c.silent) f.push('silent')
  return f
}
/** the secret word is found case-insensitively anywhere in the note (at least 3 characters, so it is not hit by chance) */
export const hasSecret = (note: string, secret: string | undefined) => !!secret && secret.trim().length >= 3 && note.toLowerCase().includes(secret.trim().toLowerCase())

export type TeamAlert = { kind: 'missed'; day: CheckDay } | { kind: 'flag'; day: CheckDay; flag: CheckFlag }
/** what the C.A.L.L. team is alerted to, most serious first */
export function teamAlerts(arrival: string, done: CheckIn[], today: string): TeamAlert[] {
  const order: CheckFlag[] = ['silent', 'unsafe', 'passport', 'unpaid', 'hours']
  const flags = done.flatMap((c) => checkinFlags(c).map((flag) => ({ kind: 'flag' as const, day: c.day, flag })))
    .sort((a, b) => order.indexOf(a.flag) - order.indexOf(b.flag))
  const missed = checkinStates(arrival, done, today).filter((s) => s.state === 'missed').map((s) => ({ kind: 'missed' as const, day: s.day }))
  return [...flags, ...missed]
}

/* ---------- closing the job and the worker review (owner's blueprint, 27 Nov 2026) ---------- */
/** the employer reviews the worker once 30 days have passed since the arrival (the same day the worker's last check-in opens) */
export const canCloseJob = (arrival: string, today: string) => today >= dueDay(arrival, 30)
/** the worker's side is closed as a success once the day-30 check-in is in and no complaint is still being checked */
export const jobClosed = (done: CheckIn[], complaints: Pick<Complaint, 'status'>[]) => done.some((c) => c.day === 30) && !complaints.some((c) => c.status === 'checking' || c.status === 'needMore')
export const WORKER_GOOD = ['onTime', 'skilled', 'communicates', 'followsRules', 'teamwork'] as const
export const WORKER_BAD = ['late', 'absent', 'poorWork', 'breaksRules', 'leftEarly'] as const
/** what an employer says about a worker: stars and fixed points, no free text (shown to later employers as an anonymous total) */
export interface WorkerReview { seekerId: string; at: string; stars: number; good: string[]; bad: string[] }
export function workerReviewProblem(r: Pick<WorkerReview, 'stars' | 'good' | 'bad'>): 'stars' | 'points' | null {
  if (!Number.isInteger(r.stars) || r.stars < 1 || r.stars > 5) return 'stars'
  return r.good.every((x) => (WORKER_GOOD as readonly string[]).includes(x)) && r.bad.every((x) => (WORKER_BAD as readonly string[]).includes(x)) ? null : 'points'
}

/* ---------- employer review ---------- */
export const REVIEW_GOOD = ['paidOnTime', 'fairHours', 'safeWork', 'goodHousing', 'respect'] as const
export const REVIEW_BAD = ['latePay', 'longHours', 'unsafeWork', 'poorHousing', 'deductions'] as const
export interface EmployerReview { employerId: string; at: string; stars: number; good: string[]; bad: string[] }
/** a review opens once the day-30 check-in is done */
export const canReview = (done: CheckIn[]) => done.some((c) => c.day === 30)
export function reviewProblem(r: Pick<EmployerReview, 'stars' | 'good' | 'bad'>): 'stars' | 'points' | null {
  if (!Number.isInteger(r.stars) || r.stars < 1 || r.stars > 5) return 'stars'
  const ok = (xs: string[], all: readonly string[]) => xs.every((x) => all.includes(x))
  return ok(r.good, REVIEW_GOOD) && ok(r.bad, REVIEW_BAD) ? null : 'points'
}
/** the anonymous total shown on posts: count, average to one decimal, the points most often given */
export function reviewSummary<R extends Pick<EmployerReview, 'stars' | 'good' | 'bad'>>(rs: R[]): { n: number; avg: number; good: string[]; bad: string[] } | null {
  if (!rs.length) return null
  const top = (key: 'good' | 'bad') => {
    const count = new Map<string, number>(); rs.forEach((r) => r[key].forEach((x) => count.set(x, (count.get(x) ?? 0) + 1)))
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
  }
  return { n: rs.length, avg: Math.round((rs.reduce((s, r) => s + r.stars, 0) / rs.length) * 10) / 10, good: top('good'), bad: top('bad') }
}

/* ---------- a complaint filed through C.A.L.L. ---------- */
export type ComplaintStatus = 'checking' | 'needMore' | 'forwarded' | 'acknowledged'
export interface Complaint {
  id: string; caseId: string; problem: ProblemKind; country: Country; province: string
  note: string; evidence: string[]; at: string
  urgent: boolean; score: number; reasons: CredReason[]
  status: ComplaintStatus; agency: string
  history: { at: string; status: ComplaintStatus }[]
  /** where it happened, when the worker shared the phone's location (owner's blueprint, 27 Nov 2026) */
  loc?: GeoPoint
}
export interface GeoPoint { lat: number; lng: number }
export const isGeoPoint = (v: unknown): v is GeoPoint => !!v && typeof v === 'object' && Number.isFinite((v as GeoPoint).lat) && Number.isFinite((v as GeoPoint).lng) && Math.abs((v as GeoPoint).lat) <= 90 && Math.abs((v as GeoPoint).lng) <= 180
/** a map link for a point: AMap in China, Google Maps elsewhere (opened by the person; nothing is sent by the app) */
export const mapLinkOf = (l: GeoPoint, country: Country) => (country === 'CN' ? `https://uri.amap.com/marker?position=${l.lng},${l.lat}` : `https://maps.google.com/?q=${l.lat},${l.lng}`)
export type CredReason = 'evidence' | 'detail' | 'case' | 'arrived' | 'checkin'
/** which check-in answers back up which problem */
const BACKS: Record<ProblemKind, CheckFlag[]> = { unpaid: ['unpaid'], passport: ['passport'], forced: ['hours', 'unsafe', 'silent', 'passport'], violence: ['unsafe', 'silent'], fee: [], other: [] }
/** the score at or above which the team can forward without asking for more */
export const CRED_STRONG = 60
export const CRED_WEAK = 35

/** how far the case record and the evidence back the complaint (0–100) and why */
export function credibility(p: { problem: ProblemKind; evidence: string[]; note: string; hasCase: boolean; arrived: boolean; flags: CheckFlag[] }): { score: number; reasons: CredReason[] } {
  let score = 0; const reasons: CredReason[] = []
  const ev = Math.min(p.evidence.length, 3) * 15
  if (ev) { score += ev; reasons.push('evidence') }
  if (p.note.trim().length >= 40) { score += 10; reasons.push('detail') }
  if (p.hasCase) { score += 15; reasons.push('case') }
  if (p.arrived) { score += 10; reasons.push('arrived') }
  if (p.flags.some((f) => BACKS[p.problem].includes(f))) { score += 20; reasons.push('checkin') }
  return { score: Math.min(100, score), reasons }
}
export const credLevel = (score: number): 'strong' | 'medium' | 'weak' => (score >= CRED_STRONG ? 'strong' : score >= CRED_WEAK ? 'medium' : 'weak')

/** a new complaint: urgent ones (life or freedom, or an "unsafe" / secret-word check-in) go to the agency at once */
export function fileComplaint(p: { loc?: GeoPoint | null; id: string; caseId: string; problem: ProblemKind; country: Country; province: string; note: string; evidence: string[]; at: string; hasCase: boolean; arrived: boolean; flags: CheckFlag[] }): Complaint {
  const { score, reasons } = credibility(p)
  const urgent = URGENT.includes(p.problem) || p.flags.includes('unsafe') || p.flags.includes('silent')
  const status: ComplaintStatus = urgent ? 'forwarded' : 'checking'
  return { id: p.id, caseId: p.caseId, problem: p.problem, country: p.country, province: p.province, note: p.note.trim(), evidence: p.evidence, at: p.at,
    urgent, score, reasons, status, agency: AGENCIES[p.problem][p.country][0], history: [{ at: p.at, status }], ...(isGeoPoint(p.loc) ? { loc: { lat: p.loc.lat, lng: p.loc.lng } } : {}) }
}
/** the team and the agency move a complaint on; the worker answers "need more" with more evidence */
export type ComplaintAction = { kind: 'forward' } | { kind: 'askMore' } | { kind: 'acknowledge' } | { kind: 'addEvidence'; evidence: string[]; note: string; flags: CheckFlag[]; hasCase: boolean; arrived: boolean }
export function actComplaint(c: Complaint, a: ComplaintAction, at: string): Complaint | null {
  const go = (status: ComplaintStatus, patch: Partial<Complaint> = {}): Complaint => ({ ...c, ...patch, status, history: [...c.history, { at, status }] })
  switch (a.kind) {
    case 'forward': return c.status === 'checking' ? go('forwarded') : null
    case 'askMore': return c.status === 'checking' ? go('needMore') : null
    case 'acknowledge': return c.status === 'forwarded' ? go('acknowledged') : null
    case 'addEvidence': {
      if (c.status !== 'needMore') return null
      const evidence = [...new Set([...c.evidence, ...a.evidence])], note = a.note.trim() || c.note
      const { score, reasons } = credibility({ problem: c.problem, evidence, note, hasCase: a.hasCase, arrived: a.arrived, flags: a.flags })
      return go('checking', { evidence, note, score, reasons })
    }
  }
}
