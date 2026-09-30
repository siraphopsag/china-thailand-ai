import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ActionItem, AlertItem, ContractInput, Direction, EmploymentInput, Profile, StepStatus } from './types'
import { demoContract, demoEmployment, demoProfile, emptyContract, emptyEmployment, baseAlerts } from './data/demo'
import { tourRoutes } from './data/culture'
import { KEYS, STATE_VERSION, safeGet, safeSet } from './storage'
import { cleanProfile, isObj, str } from './profileSchema'
import { tr } from './i18n/core'
import type { MsgKey } from './locales'

export { cleanProfile }
export interface HistoryItem { at: string; key: MsgKey; vars?: Record<string, string> } // `at` is an ISO timestamp, formatted when displayed
export type Mode = 'real' | 'demo'
/** Snapshot of a completed action, so finished work stays counted even if the risk that created it later disappears. */
export interface ActionSnap { title: string; riskLabel: string; owner: string; riskId: string }
interface State {
  direction: Direction | null
  answers: Record<string, string | string[]> // interview answers (language-neutral ids); the profile is built from them
  profile: Profile | null
  employment: EmploymentInput
  contract: ContractInput
  stepOverrides: Record<number, StepStatus>
  actionStatus: Record<string, StepStatus>
  actionSnap: Record<string, ActionSnap>
  tour: number | null
  checks: Record<string, boolean>
  docs: Record<string, boolean> // generated document types
  docLang: Record<string, 'th' | 'zh' | 'en'>
  docStamp: Record<string, string> // data fingerprint at generation time → detects outdated drafts
  extraAlerts: AlertItem[]
  regChanged: boolean
  analysisDone: boolean
  history: HistoryItem[]
}
const initial: State = {
  direction: null, answers: {}, profile: null, employment: emptyEmployment, contract: emptyContract, stepOverrides: {}, actionStatus: {}, actionSnap: {}, tour: null, checks: {}, docs: {}, docLang: {}, docStamp: {},
  extraAlerts: [], regChanged: false, analysisDone: false, history: [],
}
const now = () => new Date().toISOString()
const demoState = (): State => ({ ...initial, direction: 'TH_CN', profile: demoProfile, employment: demoEmployment, contract: demoContract, tour: 0, history: [{ at: now(), key: 'hist.demo' }] })

/** Small stable fingerprint of the business data (not security-related). */
export function fingerprint(...parts: unknown[]): string {
  const s = JSON.stringify(parts); let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/* ---------- defensive loading: never trust what is in localStorage ---------- */
const STEP_VALUES: StepStatus[] = ['todo', 'doing', 'review', 'done', 'fix']
const fill = <T extends object>(empty: T, raw: unknown): T => {
  const src = isObj(raw) ? raw : {}
  return Object.fromEntries(Object.keys(empty).map((k) => [k, str(src[k])])) as T
}
const mapOf = <V,>(raw: unknown, ok: (v: unknown) => v is V): Record<string, V> => (isObj(raw) ? (Object.fromEntries(Object.entries(raw).filter(([, v]) => ok(v))) as Record<string, V>) : {})
const isStep = (v: unknown): v is StepStatus => STEP_VALUES.includes(v as StepStatus)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isString = (v: unknown): v is string => typeof v === 'string'
const isLang = (v: unknown): v is 'th' | 'zh' | 'en' => v === 'th' || v === 'zh' || v === 'en'
const isSnap = (v: unknown): v is ActionSnap => isObj(v) && typeof v.title === 'string' && typeof v.riskLabel === 'string' && typeof v.owner === 'string' && typeof v.riskId === 'string'
function sanitizeAnswers(raw: unknown): Record<string, string | string[]> {
  if (!isObj(raw)) return {}
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string')))) as Record<string, string | string[]>
}
export function sanitizeState(raw: unknown): State {
  if (!isObj(raw)) return initial
  const profile = cleanProfile(raw.profile)
  return {
    direction: raw.direction === 'CN_TH' ? 'CN_TH' : raw.direction === 'TH_CN' ? 'TH_CN' : profile ? profile.direction : null,
    answers: sanitizeAnswers(raw.answers), profile, employment: fill(emptyEmployment, raw.employment), contract: fill(emptyContract, raw.contract),
    stepOverrides: mapOf(raw.stepOverrides, isStep) as Record<number, StepStatus>, actionStatus: mapOf(raw.actionStatus, isStep), actionSnap: mapOf(raw.actionSnap, isSnap), tour: null,
    checks: mapOf(raw.checks, isBool), docs: mapOf(raw.docs, isBool), docLang: mapOf(raw.docLang, isLang), docStamp: mapOf(raw.docStamp, isString),
    extraAlerts: Array.isArray(raw.extraAlerts) ? (raw.extraAlerts.filter((a) => isObj(a) && typeof a.id === 'string' && typeof a.titleKey === 'string' && typeof a.sourceId === 'string') as unknown as AlertItem[]) : [],
    regChanged: !!raw.regChanged, analysisDone: !!raw.analysisDone,
    history: Array.isArray(raw.history) ? (raw.history.filter((h) => isObj(h) && typeof h.key === 'string' && typeof h.at === 'string') as unknown as HistoryItem[]).slice(0, 8) : [],
  }
}
function load(mode: Mode): State {
  try {
    const slot = safeGet(mode === 'demo' ? KEYS.demo : KEYS.real) ?? (mode === 'real' ? safeGet(KEYS.legacy) : null)
    if (!slot) return mode === 'demo' ? demoState() : initial
    const parsed = JSON.parse(slot) as unknown
    const s = sanitizeState(isObj(parsed) && 'state' in parsed ? parsed.state : parsed) // supports the legacy un-versioned format
    if (mode === 'real' && s.profile?.isDemo) return { ...initial } // demo data never lives in the real slot
    return s
  } catch { return mode === 'demo' ? demoState() : initial }
}

interface Ctx extends State {
  mode: Mode
  set: (patch: Partial<State>) => void
  startDemo: () => void
  exitDemo: () => void
  /** Begin a real analysis: leaves the demo, and asks before replacing an existing real profile. */
  beginNew: () => void
  reset: () => void
  log: (key: MsgKey, vars?: Record<string, string>) => void
  /** Change an action's status; completed actions keep a snapshot so progress never goes backwards. */
  setActionStatus: (a: ActionItem, s: StepStatus) => void
  alerts: AlertItem[]
}
const C = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (safeGet(KEYS.mode) === 'demo' ? 'demo' : 'real'))
  const [s, setS] = useState<State>(() => load(mode))
  useEffect(() => {
    safeSet(mode === 'demo' ? KEYS.demo : KEYS.real, JSON.stringify({ v: STATE_VERSION, state: s }))
    safeSet(KEYS.mode, mode)
  }, [s, mode])
  const value = useMemo<Ctx>(() => ({
    ...s, mode,
    set: (patch) => setS((x) => ({ ...x, ...patch })),
    log: (key, vars) => setS((x) => ({ ...x, history: [{ at: now(), key, vars }, ...x.history].slice(0, 8) })),
    setActionStatus: (a, st) => setS((x) => {
      const snap = { ...x.actionSnap }
      if (st === 'done') snap[a.id] = { title: a.title, riskLabel: a.riskLabel, owner: a.owner, riskId: a.riskId }
      else delete snap[a.id]
      return { ...x, actionStatus: { ...x.actionStatus, [a.id]: st }, actionSnap: snap }
    }),
    startDemo: () => { setMode('demo'); setS(demoState()) }, // the real slot is left untouched in storage
    exitDemo: () => { setMode('real'); setS(load('real')) },
    beginNew: () => {
      if (mode === 'demo') { setMode('real'); setS(load('real')) }
      else if (s.profile && !window.confirm(tr('start.confirm'))) return
      go('direction')
    },
    reset: () => setS(mode === 'demo' ? demoState() : initial),
    alerts: [...s.extraAlerts, ...(s.profile ? baseAlerts : [])],
  }), [s, mode])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useStore = () => { const c = useContext(C); if (!c) throw new Error('store'); return c }
export const TOUR_LENGTH = tourRoutes.length

/* ---- history router (clean URLs, e.g. /dashboard) ---- */
const ROUTE_EVENT = 'app:navigate'
const current = () => window.location.pathname.split('/').filter(Boolean).join('/')
export const go = (r: string) => {
  if (current() !== r) window.history.pushState({}, '', '/' + r)
  window.dispatchEvent(new Event(ROUTE_EVENT)); window.scrollTo(0, 0)
}
export function useRoute() {
  const [r, setR] = useState(current)
  useEffect(() => {
    const f = () => setR(current())
    window.addEventListener('popstate', f); window.addEventListener(ROUTE_EVENT, f)
    return () => { window.removeEventListener('popstate', f); window.removeEventListener(ROUTE_EVENT, f) }
  }, [])
  return r
}
