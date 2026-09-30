import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AlertItem, ContractInput, Direction, EmploymentInput, Profile, StepStatus } from './types'
import { demoContract, demoEmployment, demoProfile, emptyContract, emptyEmployment, baseAlerts } from './data/demo'
import { tourRoutes } from './data/culture'
import type { MsgKey } from './locales'

export interface HistoryItem { at: string; key: MsgKey; vars?: Record<string, string> }
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
const KEY = 'cnth-prototype-v2'
const now = () => new Date().toLocaleTimeString()

interface Ctx extends State {
  set: (patch: Partial<State>) => void
  startDemo: () => void
  reset: () => void
  log: (key: MsgKey, vars?: Record<string, string>) => void
  alerts: AlertItem[]
}
const C = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return { ...initial, ...JSON.parse(raw), tour: null } } catch { /* ignore */ }
    return initial
  })
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }, [s])
  const value = useMemo<Ctx>(() => ({
    ...s,
    set: (patch) => setS((x) => ({ ...x, ...patch })),
    log: (key, vars) => setS((x) => ({ ...x, history: [{ at: now(), key, vars }, ...x.history].slice(0, 8) })),
    startDemo: () => setS({ ...initial, direction: 'TH_CN', profile: demoProfile, employment: demoEmployment, contract: demoContract, tour: 0, history: [{ at: now(), key: 'hist.demo' }] }),
    reset: () => setS(initial),
    alerts: [...s.extraAlerts, ...(s.profile ? baseAlerts : [])],
  }), [s])
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
