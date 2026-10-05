// The case after a match (owner, Oct 2026): once the employer confirms a job seeker, a case opens and is handed to the employment
// agency with the employer's need and the chosen worker. Both sides then follow it step by step until the worker starts work.
// In the prototype an administrator plays the agency; real handling is meant for the Department of Employment or a licensed
// agency. Documents are a checklist only — no files are collected. Pure: no React, no storage.
import { textProblem } from './logic'

export const CASE_STEPS = ['opened', 'submitted', 'accepted', 'documents', 'tests', 'training', 'permit', 'departure', 'arrived'] as const
export type CaseStep = (typeof CASE_STEPS)[number]
export const DOCS = ['passport', 'health', 'contract'] as const
export const TESTS = ['language', 'skill'] as const
export const PERMITS = ['workPermit', 'visa'] as const
export type Doc = (typeof DOCS)[number]
export type TestKey = (typeof TESTS)[number]
export type PermitKey = (typeof PERMITS)[number]
/** courses before departure: built-in ones start with "@" (shown in the visitor's language); the agency can add its own */
export const DEFAULT_TRAININGS = ['orient', 'lang', 'law', 'safety'] as const
export interface Training { id: string; name: string; done: boolean }
export interface Case {
  id: string; accId: string; postId: string; seekerId: string
  /** when each step was completed */
  steps: Partial<Record<CaseStep, string>>
  docs: Partial<Record<Doc, boolean>>; tests: Partial<Record<TestKey, boolean>>; permit: Partial<Record<PermitKey, boolean>>
  trainings: Training[]
  /** planned departure day (YYYY-MM-DD) */
  departureDate: string | null
  /** a short note from the agency to both sides (no contact details) */
  note: string
  createdAt: string
}
export type CaseAction =
  | { kind: 'accept' } | { kind: 'doc'; key: Doc } | { kind: 'test'; key: TestKey } | { kind: 'train'; id: string }
  | { kind: 'trainAdd'; name: string } | { kind: 'trainRemove'; id: string } | { kind: 'permit'; key: PermitKey }
  | { kind: 'departure'; date: string } | { kind: 'departOk' } | { kind: 'note'; text: string } | { kind: 'arrived' }
/** who may do it: the agency does everything except confirming the arrival, which is the employer's */
export const actorOf = (a: CaseAction['kind']): 'agency' | 'employer' => (a === 'arrived' ? 'employer' : 'agency')
export type CaseProblem = 'state' | 'contact' | 'name' | 'available' | 'unknown'
export type CaseOutcome = { ok: true; value: Case } | { ok: false; problem: CaseProblem }

/** the step being worked on (null = the worker has arrived) */
export const currentStep = (c: Case): CaseStep | null => CASE_STEPS.find((s) => !c.steps[s]) ?? null
/** how many of the 9 steps are done */
export const stepsDone = (c: Case) => CASE_STEPS.filter((s) => c.steps[s]).length
export const trainingsLeft = (c: Case) => c.trainings.filter((x) => !x.done).length
/** the latest moment something was completed (for "updated" notices) */
export const lastUpdate = (c: Case) => { const t = Object.values(c.steps).filter((x): x is string => !!x).sort(); return t[t.length - 1] ?? c.createdAt }

/** a case opens when the employer confirms; it goes to the agency at once if the employer is verified */
export function newCase(id: string, acc: { id: string; postId: string; seekerId: string }, at: string, employerVerified: boolean): Case {
  return {
    id, accId: acc.id, postId: acc.postId, seekerId: acc.seekerId,
    steps: employerVerified ? { opened: at, submitted: at } : { opened: at },
    docs: {}, tests: {}, permit: {}, trainings: DEFAULT_TRAININGS.map((k) => ({ id: k, name: `@${k}`, done: false })),
    departureDate: null, note: '', createdAt: at,
  }
}
/** handed to the agency (when the employer becomes verified later) */
export const submitCase = (c: Case, at: string): Case => (c.steps.submitted ? c : { ...c, steps: { ...c.steps, submitted: at } })

const done = (step: CaseStep, c: Case, at: string): Case => ({ ...c, steps: { ...c.steps, [step]: at } })
const all = <K extends string>(keys: readonly K[], m: Partial<Record<K, boolean>>) => keys.every((k) => m[k])
/**
 * One action on a case. Steps go in order: a checklist can only be changed while its step is the current one, and the step
 * completes by itself once every item is ticked. `today` is YYYY-MM-DD for the departure day check.
 */
export function applyCaseAction(c: Case, a: CaseAction, at: string, today: string): CaseOutcome {
  const now = currentStep(c)
  const need = (s: CaseStep) => now === s
  const fail = (problem: CaseProblem): CaseOutcome => ({ ok: false, problem })
  switch (a.kind) {
    case 'accept': return need('accepted') ? { ok: true, value: done('accepted', c, at) } : fail('state')
    case 'doc': {
      if (!need('documents')) return fail('state')
      const docs = { ...c.docs, [a.key]: !c.docs[a.key] }
      const next = { ...c, docs }
      return { ok: true, value: all(DOCS, docs) ? done('documents', next, at) : next }
    }
    case 'test': {
      if (!need('tests')) return fail('state')
      const tests = { ...c.tests, [a.key]: !c.tests[a.key] }
      const next = { ...c, tests }
      return { ok: true, value: all(TESTS, tests) ? done('tests', next, at) : next }
    }
    case 'train': {
      if (!need('training') || !c.trainings.some((x) => x.id === a.id)) return fail('state')
      const trainings = c.trainings.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x))
      const next = { ...c, trainings }
      return { ok: true, value: trainings.length > 0 && trainings.every((x) => x.done) ? done('training', next, at) : next }
    }
    case 'trainAdd': {
      if (c.steps.training || stepsDone(c) < 2) return fail('state')
      const p = textProblem(a.name, 2, 60); if (p) return fail(p === 'contact' ? 'contact' : 'name')
      if (c.trainings.length >= 12) return fail('state')
      return { ok: true, value: { ...c, trainings: [...c.trainings, { id: `t${Date.parse(at).toString(36)}${c.trainings.length}`, name: a.name, done: false }] } }
    }
    case 'trainRemove': {
      if (c.steps.training || !c.trainings.some((x) => x.id === a.id)) return fail('state')
      const trainings = c.trainings.filter((x) => x.id !== a.id)
      if (!trainings.length) return fail('state') // at least one course stays
      const next = { ...c, trainings }
      return { ok: true, value: need('training') && trainings.every((x) => x.done) ? done('training', next, at) : next }
    }
    case 'permit': {
      if (!need('permit')) return fail('state')
      const permit = { ...c.permit, [a.key]: !c.permit[a.key] }
      const next = { ...c, permit }
      return { ok: true, value: all(PERMITS, permit) ? done('permit', next, at) : next }
    }
    case 'departure': {
      if (!need('departure')) return fail('state')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || a.date < today) return fail('available')
      return { ok: true, value: { ...c, departureDate: a.date } }
    }
    case 'departOk': return need('departure') && c.departureDate ? { ok: true, value: done('departure', c, at) } : fail('state')
    case 'note': {
      const p = textProblem(a.text, 0, 300); if (p) return fail(p === 'contact' ? 'contact' : 'name')
      return { ok: true, value: { ...c, note: a.text } }
    }
    case 'arrived': return need('arrived') ? { ok: true, value: done('arrived', c, at) } : fail('state')
  }
}

/* ---------- stored cases (local demo): checked item by item ---------- */
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const flags = <K extends string>(keys: readonly K[], v: unknown): Partial<Record<K, boolean>> | null =>
  isObj(v) && Object.entries(v).every(([k, x]) => (keys as readonly string[]).includes(k) && typeof x === 'boolean') ? v as Partial<Record<K, boolean>> : null
export function parseCase(v: unknown): Case | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.accId !== 'string' || typeof v.postId !== 'string' || typeof v.seekerId !== 'string' || !isIso(v.createdAt)) return null
  if (!isObj(v.steps) || !Object.entries(v.steps).every(([k, x]) => (CASE_STEPS as readonly string[]).includes(k) && isIso(x))) return null
  // steps are completed in order: no gap before a completed step
  const doneFlags = CASE_STEPS.map((s) => !!(v.steps as Record<string, unknown>)[s])
  if (!doneFlags[0] || doneFlags.some((d, i) => d && i > 0 && !doneFlags[i - 1])) return null
  const docs = flags(DOCS, v.docs), tests = flags(TESTS, v.tests), permit = flags(PERMITS, v.permit)
  if (!docs || !tests || !permit) return null
  if (!Array.isArray(v.trainings) || v.trainings.length < 1 || v.trainings.length > 12 || !v.trainings.every((x) => isObj(x) && typeof x.id === 'string' && typeof x.name === 'string' && x.name.length <= 61 && typeof x.done === 'boolean')) return null
  if (!(v.departureDate === null || (typeof v.departureDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.departureDate)))) return null
  if (typeof v.note !== 'string' || textProblem(v.note, 0, 300) !== null) return null
  return v as unknown as Case
}
