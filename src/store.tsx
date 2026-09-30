import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AlertItem, ContractInput, Direction, EmploymentInput, Holder, Profile, Side, StepStatus } from './types'
import { demoContract, demoEmployment, demoProfile, emptyContract, emptyEmployment, baseAlerts } from './data/demo'
import { tourRoutes } from './data/culture'
import { KEYS, STATE_VERSION, safeGet, safeSet } from './storage'
import { tr } from './i18n/core'
import type { MsgKey } from './locales'

export interface HistoryItem { at: string; key: MsgKey; vars?: Record<string, string> }
export type Mode = 'real' | 'demo'
interface State {
  direction: Direction | null
  profile: Profile | null
  employment: EmploymentInput
  contract: ContractInput
  stepOverrides: Record<number, StepStatus>
  actionStatus: Record<string, StepStatus>
  tour: number | null
  checks: Record<string, boolean>
  docs: Record<string, boolean> // generated document types
  docLang: Record<string, 'th' | 'zh' | 'en'>
  extraAlerts: AlertItem[]
  regChanged: boolean
  analysisDone: boolean
  history: HistoryItem[]
}
const initial: State = {
  direction: null, profile: null, employment: emptyEmployment, contract: emptyContract, stepOverrides: {}, actionStatus: {}, tour: null, checks: {}, docs: {}, docLang: {},
  extraAlerts: [], regChanged: false, analysisDone: false, history: [],
}
const now = () => new Date().toLocaleTimeString()
const demoState = (): State => ({ ...initial, direction: 'TH_CN', profile: demoProfile, employment: demoEmployment, contract: demoContract, tour: 0, history: [{ at: now(), key: 'hist.demo' }] })

/* ---------- defensive loading: never trust what is in localStorage ---------- */
const STEP_VALUES: StepStatus[] = ['todo', 'doing', 'review', 'done', 'fix']
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const pick = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d)
function cleanHolder(h: unknown, id: Side): Holder | null {
  if (!isObj(h)) return null
  return { id, nationality: h.nationality === 'CN' ? 'CN' : 'TH', percent: num(h.percent), capital: num(h.capital), voting: num(h.voting), board: num(h.board), economic: num(h.economic) }
}
export function cleanProfile(p: unknown): Profile | null {
  if (!isObj(p)) return null
  const hs = Array.isArray(p.holders) ? p.holders : []
  const o = cleanHolder(hs.find((h) => isObj(h) && h.id === 'origin'), 'origin')
  const pa = cleanHolder(hs.find((h) => isObj(h) && h.id === 'partner'), 'partner')
  if (!o || !pa) return null
  return {
    companyName: str(p.companyName), direction: p.direction === 'CN_TH' ? 'CN_TH' : 'TH_CN', businessType: str(p.businessType) || 'other', businessTypeOther: p.businessTypeOther ? str(p.businessTypeOther) : undefined,
    activity: str(p.activity), forms: strs(p.forms), investmentRange: str(p.investmentRange), employees: Math.max(0, num(p.employees)), crossBorderWorkers: !!p.crossBorderWorkers,
    holders: [o, pa], realInvestor: pick(p.realInvestor, ['origin', 'partner', 'shared', 'unknown'], 'unknown'), operator: pick(p.operator, ['origin', 'partner', 'joint', 'unknown'], 'unknown'),
    sideAgreement: pick(p.sideAgreement, ['yes', 'no', 'unknown'], 'unknown'), products: str(p.products), regulatedGoods: str(p.regulatedGoods), location: str(p.location), crossBorder: strs(p.crossBorder),
    targetMarket: p.targetMarket ? str(p.targetMarket) : undefined, unknownFacts: strs(p.unknownFacts), isDemo: !!p.isDemo,
  }
}
const fill = <T extends object>(empty: T, raw: unknown): T => {
  const src = isObj(raw) ? raw : {}
  return Object.fromEntries(Object.keys(empty).map((k) => [k, str(src[k])])) as T
}
const mapOf = <V,>(raw: unknown, ok: (v: unknown) => v is V): Record<string, V> => (isObj(raw) ? (Object.fromEntries(Object.entries(raw).filter(([, v]) => ok(v))) as Record<string, V>) : {})
const isStep = (v: unknown): v is StepStatus => STEP_VALUES.includes(v as StepStatus)
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isLang = (v: unknown): v is 'th' | 'zh' | 'en' => v === 'th' || v === 'zh' || v === 'en'
export function sanitizeState(raw: unknown): State {
  if (!isObj(raw)) return initial
  const profile = cleanProfile(raw.profile)
  return {
    direction: raw.direction === 'CN_TH' ? 'CN_TH' : raw.direction === 'TH_CN' ? 'TH_CN' : profile ? profile.direction : null,
    profile, employment: fill(emptyEmployment, raw.employment), contract: fill(emptyContract, raw.contract),
    stepOverrides: mapOf(raw.stepOverrides, isStep) as Record<number, StepStatus>, actionStatus: mapOf(raw.actionStatus, isStep), tour: null,
    checks: mapOf(raw.checks, isBool), docs: mapOf(raw.docs, isBool), docLang: mapOf(raw.docLang, isLang),
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
