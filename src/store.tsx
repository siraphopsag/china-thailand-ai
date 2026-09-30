import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AlertItem, ContractInput, Direction, EmploymentInput, Profile, StepStatus } from './types'
import { demoContract, demoEmployment, demoProfile, emptyContract, emptyEmployment, baseAlerts } from './data/demo'

interface State {
  direction: Direction | null
  profile: Profile | null
  employment: EmploymentInput
  contract: ContractInput
  stepOverrides: Record<number, StepStatus>
  checks: Record<string, boolean>
  docs: Record<string, boolean>
  extraAlerts: AlertItem[]
  regChanged: boolean
  analysisDone: boolean
  history: { at: string; text: string }[]
}
const initial: State = {
  direction: null, profile: null, employment: emptyEmployment, contract: emptyContract, stepOverrides: {}, checks: {}, docs: {},
  extraAlerts: [], regChanged: false, analysisDone: false, history: [],
}
const KEY = 'cnth-prototype-v1'

interface Ctx extends State {
  set: (patch: Partial<State>) => void
  startDemo: () => void
  reset: () => void
  log: (text: string) => void
  alerts: AlertItem[]
}
const C = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) return { ...initial, ...JSON.parse(raw) } } catch { /* ignore */ }
    return initial
  })
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } }, [s])
  const value = useMemo<Ctx>(() => ({
    ...s,
    set: (patch) => setS((x) => ({ ...x, ...patch })),
    log: (text) => setS((x) => ({ ...x, history: [{ at: new Date().toLocaleTimeString('th-TH'), text }, ...x.history].slice(0, 8) })),
    startDemo: () => setS({ ...initial, direction: 'TH_CN', profile: demoProfile, employment: demoEmployment, contract: demoContract, history: [{ at: new Date().toLocaleTimeString('th-TH'), text: 'โหลดข้อมูล Demo (ข้อมูลสมมติ)' }] }),
    reset: () => setS(initial),
    alerts: [...s.extraAlerts, ...(s.profile ? baseAlerts.map((a) => ({ ...a, profile: s.profile!.companyName })) : [])],
  }), [s])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useStore = () => { const c = useContext(C); if (!c) throw new Error('store'); return c }

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
