import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { accept, addPin, canPost, forward, makePost, nowWith, parseState, removePin, type Outcome, type PostInput } from './domain/match/logic'
import { seedState } from './domain/match/seed'
import { ME, MY_EMPLOYER, type Acceptance, type Industry, type MatchState, type Place, type Post, type Role, type Skill } from './domain/match/types'
import { buildState, dbProblem, postToRow, rowToPost, type AdminStats, type PostRow } from './domain/match/remote'
import { getClient, takeNext, useAuth } from './auth'
import { go } from './store'

/**
 * State of the matching prototype (owner, Oct 2026) in one of two modes, behind the same interface so the pages do not care:
 *  • 'remote' — signed in: posts, pins, acceptances and profile settings live in the Supabase database (shared by everyone,
 *    permissions enforced there by row level security; see supabase/migrations/0002_matching.sql);
 *  • 'local'  — the demo kept in this browser (key below): used when accounts are not set up, and as the fallback when the
 *    service cannot be reached, so the site keeps working (a notice says so).
 * 'signedOut' (accounts work, nobody signed in) and 'loading' show the sign-in prompt / a wait instead of data.
 * The demo clock (days added to the real time, to show the step-by-step release) always stays in this browser.
 */
export const MATCH_KEY = 'call.match.poc.v1'
const CLOCK_KEY = 'call.match.clock'
export type DataMode = 'local' | 'remote' | 'signedOut' | 'loading'

function load(): MatchState {
  try { const raw = localStorage.getItem(MATCH_KEY); if (raw) { const st = parseState(JSON.parse(raw)); if (st) return st } } catch { /* fall back to the seed */ }
  return seedState()
}
const readClock = () => { try { const n = Number(localStorage.getItem(CLOCK_KEY)); return Number.isInteger(n) && n >= 0 && n <= 60 ? n : 0 } catch { return 0 } }
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const emptyState = (dayOffset = 0): MatchState => ({ ...seedState(), role: null, posts: [], seekers: [], acceptances: [], dayOffset, myCompany: '', member: false })
const fail = <T,>(problem: 'network' | 'unknown'): Outcome<T> => ({ ok: false, problem })
type Db = Awaited<ReturnType<typeof getClient>>

interface Ctx {
  st: MatchState
  now: number
  mode: DataMode
  setRole: (r: Role | null) => Promise<void>
  setOrigin: (p: Place | null) => Promise<void>
  pin: (input: { place: Place; industry: Industry; skills: Skill[] }) => Promise<Outcome<unknown>>
  unpin: (id: string) => Promise<void>
  post: (input: PostInput) => Promise<Outcome<Post>>
  /** change one of my own posts (keeps its date, so its place in the step-by-step release) */
  editPost: (id: string, input: PostInput) => Promise<Outcome<Post>>
  /** delete one of my own posts — or any post when signed in as an administrator */
  deletePost: (id: string) => Promise<boolean>
  /** membership package (simulated: free in the prototype, no payment) */
  subscribe: () => Promise<void>
  acceptOffer: (postId: string) => Promise<Outcome<Acceptance>>
  forwardCase: (accId: string) => Promise<void>
  advanceDay: () => void
  reset: () => void
  /** numbers for the back office (administrators, database mode only) */
  stats: AdminStats | null
}
const C = createContext<Ctx | null>(null)

export function MatchProvider({ children, initial }: { children: ReactNode; initial?: MatchState }) {
  const auth = useAuth()
  const base: DataMode = initial ? 'local'
    : auth.status === 'off' || auth.online === false ? 'local'
    : auth.status === 'loading' || auth.online === null ? 'loading'
    : auth.status === 'signedIn' && auth.user ? 'remote' : 'signedOut'
  const userId = auth.user?.id ?? null, userName = auth.user?.name ?? '', admin = auth.isAdmin

  /* ---------- local demo ---------- */
  const [localSt, setLocal] = useState<MatchState>(() => initial ?? (typeof window === 'undefined' ? seedState() : load()))
  useEffect(() => { if (initial) return; try { localStorage.setItem(MATCH_KEY, JSON.stringify(localSt)) } catch { /* storage unavailable */ } }, [localSt, initial])

  /* ---------- database ---------- */
  const [clock, setClock] = useState(() => (typeof window === 'undefined' ? 0 : readClock()))
  const [remoteSt, setRemote] = useState<MatchState>(() => emptyState())
  const [stats, setStats] = useState<AdminStats | null>(null)
  // until the first load for this account has arrived, pages wait instead of showing an empty state (e.g. "choose a role")
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const mode: DataMode = base === 'remote' && loadedFor !== userId ? 'loading' : base
  const loadSeq = useRef(0)
  const refresh = useCallback(async () => {
    if (base !== 'remote' || !userId) return
    const seq = ++loadSeq.current
    try {
      const sb = await getClient()
      const [prof, posts, pins, accs, people, allPins, st] = await Promise.all([
        sb.from('profiles').select('user_type, company, origin_country, origin_province, member').eq('id', userId).maybeSingle(),
        sb.from('posts').select('*').order('created_at', { ascending: false }),
        sb.from('pins').select('*').eq('seeker_id', userId).order('created_at'),
        sb.from('acceptances').select('*').order('created_at'),
        admin ? sb.from('profiles').select('id, full_name, user_type, company, origin_country, origin_province, member') : Promise.resolve({ data: [] }),
        admin ? sb.from('pins').select('*') : Promise.resolve({ data: [] }),
        admin ? sb.rpc('admin_stats') : Promise.resolve({ data: null }),
      ])
      if (seq !== loadSeq.current) return // a newer load started meanwhile
      setRemote(buildState({ uid: userId, name: userName, profile: prof.data ?? null, posts: (posts.data ?? []) as PostRow[], pins: pins.data ?? [], acceptances: accs.data ?? [],
        dayOffset: 0, people: people.data ?? [], allPins: allPins.data ?? [] }))
      const s = Array.isArray(st.data) ? st.data[0] : st.data
      setStats(s ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])) as unknown as AdminStats : null)
      setLoadedFor(userId)
    } catch { /* keep what we have; the next refresh tries again */ }
  }, [base, userId, userName, admin])
  useEffect(() => { void refresh() }, [refresh])
  // others' changes (new posts, someone accepted) show up when the tab comes back into view and every 30 s while it is visible
  useEffect(() => {
    if (base !== 'remote') return
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onFocus); window.addEventListener('focus', onFocus)
    const t = window.setInterval(onFocus, 30_000)
    return () => { document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('focus', onFocus); window.clearInterval(t) }
  }, [base, refresh])
  // after signing in: apply the role chosen before signing in, then go where the visitor was heading
  useEffect(() => {
    if (mode !== 'remote' || !userId) return
    const n = takeNext(); if (!n) return
    void (async () => {
      if (n.role) { try { const sb = await getClient(); await sb.from('profiles').update({ user_type: n.role }).eq('id', userId); await refresh() } catch { /* the role can be chosen again */ } }
      go(n.next || (n.role === 'employer' ? 'hire' : n.role === 'seeker' ? 'seek' : ''))
    })()
  }, [mode, userId, refresh])
  useEffect(() => { try { localStorage.setItem(CLOCK_KEY, String(clock)) } catch { /* ignore */ } }, [clock])

  const st = mode === 'local' ? localSt : mode === 'remote' ? { ...remoteSt, dayOffset: clock } : emptyState(clock)
  const now = nowWith(st.dayOffset)
  const at = useCallback(() => new Date(nowWith(st.dayOffset)).toISOString(), [st.dayOffset])

  const value = useMemo<Ctx>(() => {
    const local = mode === 'local' // nothing is written while signed out or still checking
    // a database write: run it, map a refusal to a problem, then reload what everyone sees
    const write = async <T,>(run: (sb: Db) => PromiseLike<{ data?: unknown; error: { message?: string; code?: string } | null }>, ok: (data: unknown) => T): Promise<Outcome<T>> => {
      if (!userId) return fail('network')
      try {
        const sb = await getClient()
        const { data, error } = await run(sb)
        if (error) return { ok: false, problem: dbProblem(error) }
        await refresh(); return { ok: true, value: ok(data) }
      } catch { return fail('network') }
    }
    const profile = (patch: Record<string, unknown>) => write((sb) => sb.from('profiles').update(patch).eq('id', userId!), () => null)
    return {
      st, now, mode, stats: local ? null : stats,
      setRole: async (role) => { if (local) setLocal((s) => ({ ...s, role })); else await profile({ user_type: role }) },
      setOrigin: async (origin) => { if (local) setLocal((s) => ({ ...s, me: { ...s.me, origin } })); else await profile({ origin_country: origin?.country ?? null, origin_province: origin?.province ?? null }) },
      pin: async (input) => {
        const r = addPin(st.me, input, uid('pin'), at()) // the same checks as the database, with field-level messages
        if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, me: r.value })); return r }
        return write((sb) => sb.from('pins').insert({ country: input.place.country, province: input.place.province, industry: input.industry, skills: input.skills }), () => null)
      },
      unpin: async (id) => { if (local) setLocal((s) => ({ ...s, me: removePin(s.me, id) })); else await write((sb) => sb.from('pins').delete().eq('id', id), () => null) },
      post: async (input) => {
        if (!canPost(st, now)) return { ok: false, problem: 'quota' } as const // weekly allowance reached
        const r = makePost(input, uid('post'), MY_EMPLOYER, at()); if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, myCompany: input.company, posts: [r.value, ...s.posts] })); return r }
        if (input.company !== st.myCompany) await profile({ company: input.company })
        return write((sb) => sb.from('posts').insert(postToRow(input)).select().single(), (row) => rowToPost(row as PostRow, userId!))
      },
      editPost: async (id, input) => {
        const old = st.posts.find((p) => p.id === id && p.employerId === MY_EMPLOYER); if (!old) return fail('unknown')
        const r = makePost(input, id, MY_EMPLOYER, at()); if (!r.ok) return r
        const value = { ...r.value, createdAt: old.createdAt }
        if (local) { setLocal((s) => ({ ...s, myCompany: input.company, posts: s.posts.map((p) => (p.id === id ? value : p)) })); return { ok: true, value } }
        return write((sb) => sb.from('posts').update(postToRow(input)).eq('id', id).select().single(), (row) => rowToPost(row as PostRow, userId!))
      },
      deletePost: async (id) => {
        if (local) { setLocal((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id), acceptances: s.acceptances.filter((a) => a.postId !== id) })); return true }
        return (await write((sb) => sb.from('posts').delete().eq('id', id), () => null)).ok
      },
      subscribe: async () => { if (local) setLocal((s) => ({ ...s, member: true })); else await profile({ member: true }) },
      acceptOffer: async (postId) => {
        const r = accept(st, postId, ME, uid('acc'), at()); if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, acceptances: [...s.acceptances, r.value] })); return r }
        return write((sb) => sb.from('acceptances').insert({ post_id: postId }), () => r.value)
      },
      forwardCase: async (accId) => {
        if (local) setLocal((s) => ({ ...s, acceptances: s.acceptances.map((a) => (a.id === accId ? forward(a, at()) : a)) }))
        else await write((sb) => sb.from('acceptances').update({ status: 'forwarded' }).eq('id', accId), () => null)
      },
      advanceDay: () => { if (local) setLocal((s) => ({ ...s, dayOffset: Math.min(60, s.dayOffset + 1) })); else setClock((c) => Math.min(60, c + 1)) },
      reset: () => { if (local) { const fresh = seedState(); setLocal((s) => ({ ...fresh, role: s.role })) } else setClock(0) },
    }
  }, [st, now, mode, stats, at, refresh, userId])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useMatch = () => { const c = useContext(C); if (!c) throw new Error('match'); return c }
