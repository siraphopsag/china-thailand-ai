import { createContext, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import type { ActionItem, AlertItem, ContractInput, Direction, EmploymentInput, Profile, StepStatus } from './types'
import { emptyContract, emptyEmployment, baseAlerts, restaurantEmployment, restaurantProfile } from './data/demo'
import { buildProfile } from './interview'
import { tourRoutes } from './data/culture'
import { KEYS, STATE_VERSION, safeGet, safeSet } from './storage'
import { cleanProfile, isObj, str } from './profileSchema'
import { tr } from './i18n/core'
import type { MsgKey } from './locales'
import { emptyEmployeeCheck, sanitizeEmployeeCheck, type EmployeeCheck } from './services/compliance'

export { cleanProfile }
export interface HistoryItem { at: string; key: MsgKey; vars?: Record<string, string> } // `at` is an ISO timestamp, formatted when displayed
export type Mode = 'real' | 'demo'
/** Snapshot of a completed action, so finished work stays counted even if the risk that created it later disappears. */
export interface ActionSnap { title: string; riskLabel: string; owner: string; riskId: string }
export { DOC_STATES, type DocState } from './services/compliance'
import { DOC_STATES, type DocState } from './services/compliance'
/** What the user came to do (chosen on the landing page). Decides where the journey starts and ends. */
export type Goal = 'expand' | 'employee' | 'documents'
const GOALS: Goal[] = ['expand', 'employee', 'documents']
interface State {
  goal: Goal | null
  direction: Direction | null
  /** ISO 3166-2 code chosen on the map (e.g. TH-20), or null when no province was chosen */
  originProvince: string | null
  destinationProvince: string | null
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
  /** Employee Compliance Check answers (one employee) */
  employeeCheck: EmployeeCheck
  /** Status the user recorded for each required document (kb document id → status); files are never uploaded */
  docStatus: Record<string, DocState>
  docLang: Record<string, 'th' | 'zh' | 'en'>
  docStamp: Record<string, string> // data fingerprint at generation time → detects outdated drafts
  extraAlerts: AlertItem[]
  regChanged: boolean
  analysisDone: boolean
  history: HistoryItem[]
}
const initial: State = {
  goal: null, direction: null, originProvince: null, destinationProvince: null, answers: {}, profile: null, employment: emptyEmployment, contract: emptyContract, stepOverrides: {}, actionStatus: {}, actionSnap: {}, tour: null, checks: {}, docs: {}, employeeCheck: emptyEmployeeCheck, docStatus: {}, docLang: {}, docStamp: {},
  extraAlerts: [], regChanged: false, analysisDone: false, history: [],
}
const now = () => new Date().toISOString()
/** The demo is the end-to-end restaurant example (fictional data, labelled as such). */
const demoState = (): State => ({ ...initial, goal: 'expand', direction: 'TH_CN', originProvince: 'TH-10', destinationProvince: 'CN-SH', profile: restaurantProfile, employment: restaurantEmployment, analysisDone: true,
  employeeCheck: { nationality: 'TH', role: '', employer: '', province: 'CN-SH', type: 'fulltime', start: '', stay: 'none', auth: 'no', docs: ['passport'] }, history: [{ at: now(), key: 'hist.demo' }] })

/** Small stable fingerprint of the business data (not security-related). */
export function fingerprint(...parts: unknown[]): string {
  const s = JSON.stringify(parts); let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/* ---------- defensive loading: never trust what is in localStorage ---------- */
const STEP_VALUES: StepStatus[] = ['todo', 'doing', 'waitdoc', 'waitver', 'review', 'done', 'fix']
const fill = <T extends object>(empty: T, raw: unknown): T => {
  const src = isObj(raw) ? raw : {}
  return Object.fromEntries(Object.keys(empty).map((k) => [k, str(src[k])])) as T
}
const mapOf = <V,>(raw: unknown, ok: (v: unknown) => v is V): Record<string, V> => (isObj(raw) ? (Object.fromEntries(Object.entries(raw).filter(([, v]) => ok(v))) as Record<string, V>) : {})
const isStep = (v: unknown): v is StepStatus => STEP_VALUES.includes(v as StepStatus)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isString = (v: unknown): v is string => typeof v === 'string'
const isDocState = (v: unknown): v is DocState => DOC_STATES.includes(v as DocState)
const isLang = (v: unknown): v is 'th' | 'zh' | 'en' => v === 'th' || v === 'zh' || v === 'en'
const isSnap = (v: unknown): v is ActionSnap => isObj(v) && typeof v.title === 'string' && typeof v.riskLabel === 'string' && typeof v.owner === 'string' && typeof v.riskId === 'string'
function sanitizeAnswers(raw: unknown): Record<string, string | string[]> {
  if (!isObj(raw)) return {}
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string' || (Array.isArray(v) && v.every((x) => typeof x === 'string')))) as Record<string, string | string[]>
}
const provCode = (v: unknown): string | null => (typeof v === 'string' && /^(TH|CN)-[A-Z0-9]{2,3}$/.test(v) ? v : null)
export function sanitizeState(raw: unknown): State {
  if (!isObj(raw)) return initial
  const profile = cleanProfile(raw.profile)
  return {
    goal: GOALS.includes(raw.goal as Goal) ? (raw.goal as Goal) : null,
    direction: raw.direction === 'CN_TH' ? 'CN_TH' : raw.direction === 'TH_CN' ? 'TH_CN' : profile ? profile.direction : null,
    originProvince: provCode(raw.originProvince), destinationProvince: provCode(raw.destinationProvince),
    answers: sanitizeAnswers(raw.answers), profile, employment: fill(emptyEmployment, raw.employment), contract: fill(emptyContract, raw.contract),
    stepOverrides: mapOf(raw.stepOverrides, isStep) as Record<number, StepStatus>, actionStatus: mapOf(raw.actionStatus, isStep), actionSnap: mapOf(raw.actionSnap, isSnap), tour: null,
    checks: mapOf(raw.checks, isBool), docs: mapOf(raw.docs, isBool), employeeCheck: sanitizeEmployeeCheck(raw.employeeCheck), docStatus: mapOf(raw.docStatus, isDocState), docLang: mapOf(raw.docLang, isLang), docStamp: mapOf(raw.docStamp, isString),
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
  /** Origin and destination of the cross-border journey, derived from `direction` so there is a single source of truth. */
  originCountry: 'TH' | 'CN' | null
  destinationCountry: 'TH' | 'CN' | null
  set: (patch: Partial<State>) => void
  startDemo: () => void
  exitDemo: () => void
  /** Begin a real analysis: leaves the demo and opens the geographic onboarding. Nothing is replaced until a route is chosen. */
  beginNew: () => void
  /** Start a new real Business Context for origin → destination (and optional provinces). Asks before replacing an existing real profile; false = the user kept it.
   *  `location` pre-answers the interview question about where the business will operate, so it is not asked again. */
  chooseDirection: (d: Direction, geo?: { originProvince?: string | null; destinationProvince?: string | null; location?: string; goal?: Goal }) => boolean
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
    originCountry: s.direction ? (s.direction === 'TH_CN' ? 'TH' : 'CN') : null,
    destinationCountry: s.direction ? (s.direction === 'TH_CN' ? 'CN' : 'TH') : null,
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
      go('start')
    },
    chooseDirection: (d, geo) => {
      const existing = mode === 'demo' ? load('real').profile : s.profile
      if (existing && !window.confirm(tr('start.confirm'))) return false
      setMode('real')
      const goal = geo?.goal ?? 'expand'
      const base = { ...initial, goal, direction: d, originProvince: provCode(geo?.originProvince), destinationProvince: provCode(geo?.destinationProvince), answers: (geo?.location ? { location: geo.location } : {}) as Record<string, string | string[]> }
      if (goal === 'employee') {
        // checking one employee needs no business interview: a minimal context (hiring, in the chosen country) is enough to start
        const answers = { ...base.answers, forms: ['hire'], btype: 'other' }
        const { profile } = buildProfile(answers, d)
        setS({ ...base, answers, profile: { ...profile, destProvince: base.destinationProvince ?? undefined } })
        go('employee')
      } else { setS(base); go('interview') }
      return true
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
/** In-app link: a real <a href> (so it is announced as a link and can be opened in a new tab) that routes without a reload on a plain click. */
export function NavLink({ to, onNavigate, children, ...rest }: { to: string; onNavigate?: () => void; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  return <a href={'/' + to} {...rest} onClick={(e) => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onNavigate?.(); go(to) }}>{children}</a>
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
