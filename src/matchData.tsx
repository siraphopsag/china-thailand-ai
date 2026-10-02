import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { accept, addPin, forward, makePost, nowWith, parseState, removePin, type Outcome, type PostInput } from './domain/match/logic'
import { seedState } from './domain/match/seed'
import { ME, MY_EMPLOYER, type Acceptance, type Industry, type MatchState, type Place, type Post, type Role, type Skill } from './domain/match/types'

/**
 * State of the matching prototype, kept in this browser only (key below). Stored data is validated before use and replaced by
 * the synthetic seed when invalid. No login exists yet: the chosen role is a setting, and the admin sign-in below is a
 * prototype gate whose credentials live in this client code (visible to anyone) — not security; replace before real use.
 */
export const MATCH_KEY = 'call.match.poc.v1'
const ADMIN_KEY = 'call.admin.poc'
const ADMIN = { id: 'AdminCALL', password: 'AdminCALL101' } // prototype only (owner-provided test values)
/** prototype administrator check (client-side, not security) */
export const checkAdmin = (id: string, password: string) => id.trim() === ADMIN.id && password === ADMIN.password

function load(): MatchState {
  try { const raw = localStorage.getItem(MATCH_KEY); if (raw) { const st = parseState(JSON.parse(raw)); if (st) return st } } catch { /* fall back to the seed */ }
  return seedState()
}
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

interface Ctx {
  st: MatchState
  now: number
  setRole: (r: Role | null) => void
  setOrigin: (p: Place | null) => void
  pin: (input: { place: Place; industry: Industry; skills: Skill[] }) => Outcome<unknown>
  unpin: (id: string) => void
  setCompany: (name: string) => void
  post: (input: PostInput) => Outcome<Post>
  acceptOffer: (postId: string) => Outcome<Acceptance>
  isAdmin: boolean
  login: (id: string, password: string) => boolean
  logout: () => void
  forwardCase: (accId: string) => void
  advanceDay: () => void
  reset: () => void
}
const C = createContext<Ctx | null>(null)

export function MatchProvider({ children, initial }: { children: ReactNode; initial?: MatchState }) {
  const [st, setSt] = useState<MatchState>(() => initial ?? (typeof window === 'undefined' ? seedState() : load()))
  const [isAdmin, setAdmin] = useState(() => { try { return sessionStorage.getItem(ADMIN_KEY) === '1' } catch { return false } })
  useEffect(() => { if (initial) return; try { localStorage.setItem(MATCH_KEY, JSON.stringify(st)) } catch { /* storage unavailable */ } }, [st, initial])
  const now = nowWith(st.dayOffset)
  const at = useCallback(() => new Date(nowWith(st.dayOffset)).toISOString(), [st.dayOffset])
  const value = useMemo<Ctx>(() => ({
    st, now, isAdmin,
    setRole: (role) => setSt((s) => ({ ...s, role })),
    setOrigin: (origin) => setSt((s) => ({ ...s, me: { ...s.me, origin } })),
    pin: (input) => { const r = addPin(st.me, input, uid('pin'), at()); if (r.ok) setSt((s) => ({ ...s, me: r.value })); return r },
    unpin: (id) => setSt((s) => ({ ...s, me: removePin(s.me, id) })),
    setCompany: (myCompany) => setSt((s) => ({ ...s, myCompany })),
    post: (input) => { const r = makePost(input, uid('post'), MY_EMPLOYER, at()); if (r.ok) setSt((s) => ({ ...s, myCompany: input.company, posts: [r.value, ...s.posts] })); return r },
    acceptOffer: (postId) => { const r = accept(st, postId, ME, uid('acc'), at()); if (r.ok) setSt((s) => ({ ...s, acceptances: [...s.acceptances, r.value] })); return r },
    login: (id, password) => {
      const ok = checkAdmin(id, password)
      if (ok) { setAdmin(true); try { sessionStorage.setItem(ADMIN_KEY, '1') } catch { /* ignore */ } }
      return ok
    },
    logout: () => { setAdmin(false); try { sessionStorage.removeItem(ADMIN_KEY) } catch { /* ignore */ } },
    forwardCase: (accId) => setSt((s) => ({ ...s, acceptances: s.acceptances.map((a) => (a.id === accId ? forward(a, at()) : a)) })),
    advanceDay: () => setSt((s) => ({ ...s, dayOffset: Math.min(60, s.dayOffset + 1) })),
    reset: () => { const fresh = seedState(); setSt((s) => ({ ...fresh, role: s.role })) },
  }), [st, now, isAdmin, at])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useMatch = () => { const c = useContext(C); if (!c) throw new Error('match'); return c }
