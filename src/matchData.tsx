import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addPin, applyTo, caseBlocksDelete, canPost, cancel, clampFuture, decide, employerVerified, holding, localDay, makePost, openCaseFor, parseState, planUntil, poolOf, promote, removePin, renewPost, requestPersonVerify, requestVerify, withoutExpired, type ApplyInput, type Outcome, type PostInput, type Problem } from './domain/match/logic'
import { applyCaseAction, submitCase, type CaseAction } from './domain/match/cases'
import { cleanPhone, cleanRegNo } from './domain/match/verify'
import { reportPost, type ReportGroup, type ReportReason } from './domain/match/reports'
import { HOUR_MS, pinActive, type PinLike } from './domain/match/release'
import { seedState } from './domain/match/seed'
import type { PinGroup } from './domain/match/market'
import { simPinRow, simPostRow, type SimPin, type SimPost } from './domain/match/simulate'
import { HOLDS_PLACE, MAX_CLOCK_HOURS, ME, MY_EMPLOYER, type Acceptance, type Country, type Industry, type MatchState, type PlanId, type Place, type Post, type Role, type Skill, type VerifyKind } from './domain/match/types'
import { buildState, dbProblem, postToRow, rowToAcceptance, rowToPost, statsByProvince, statsToGroups, statsToPool, verifyOf, type AcceptanceRow, type AdminStats, type CaseRow, type PinStatRow, type PostRow, type ProfileRow, type ReportRow, reportQueue } from './domain/match/remote'
import { getClient, takeNext, useAuth } from './auth'
import { go } from './store'

/**
 * State of the matching prototype (owner, Oct 2026) in one of two modes, behind the same interface so the pages do not care:
 *  • 'remote' — signed in: posts, pins, applications, allowance uses and profile settings live in the Supabase database (shared by
 *    everyone, permissions enforced there; see supabase/migrations). Other people's pins arrive only as anonymous counts;
 *  • 'local'  — the demo kept in this browser (key below): used when accounts are not set up, and as the fallback when the
 *    service cannot be reached, so the site keeps working (a notice says so).
 * 'signedOut' (accounts work, nobody signed in) and 'loading' show the sign-in prompt / a wait instead of data.
 * The demo clock (hours added to the real time, to show the release levels) always stays in this browser; it moves what the
 * website shows, not the database's own limits.
 */
export const MATCH_KEY = 'call.match.poc.v1'
const CLOCK_KEY = 'call.match.clock.h'
export type DataMode = 'local' | 'remote' | 'signedOut' | 'loading'
/** per post: places held, of those waiting for the employer, and reservations */
export interface Counts { held: number; pending: number; reserved: number }

function load(): MatchState {
  try { const raw = localStorage.getItem(MATCH_KEY); if (raw) { const st = parseState(JSON.parse(raw)); if (st) return st } } catch { /* fall back to the seed */ }
  return seedState()
}
const readClock = () => { try { const n = Number(localStorage.getItem(CLOCK_KEY)); return Number.isInteger(n) && n >= 0 && n <= MAX_CLOCK_HOURS ? n : 0 } catch { return 0 } }
const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const emptyState = (clockHours = 0): MatchState => ({ ...seedState(), role: null, posts: [], seekers: [], acceptances: [], clockHours, myCompany: '', member: false, memberUntil: null, credits: [], cases: [], employerVerify: null })
/** an employer waiting for verification, as the agency (administrator) sees it; id null = me in the local demo */
export interface PendingVerify { id: string | null; name: string; company: string; kind: VerifyKind; country: Country; regNo: string; phone4?: string; at: string }
const CASE_RPC: Record<CaseAction['kind'], string> = { accept: 'accept', doc: 'doc', test: 'test', train: 'train', trainAdd: 'train_add', trainRemove: 'train_remove', permit: 'permit', departure: 'departure', departOk: 'depart_ok', note: 'note', arrived: 'arrived', date: 'date', trainDate: 'train_date' }
const fail = <T,>(problem: Problem): Outcome<T> => ({ ok: false, problem })
export const nowWith = (clockHours: number, real = Date.now()) => real + clockHours * HOUR_MS
export function countsFrom(acc: Acceptance[]): Record<string, Counts> {
  const out: Record<string, Counts> = {}
  for (const a of acc) {
    const c = (out[a.postId] ??= { held: 0, pending: 0, reserved: 0 })
    if (HOLDS_PLACE.includes(a.status)) c.held++
    if (a.status === 'accepted') c.pending++
    if (a.status === 'reserved') c.reserved++
  }
  return out
}
type Db = Awaited<ReturnType<typeof getClient>>

interface Ctx {
  st: MatchState
  /** the (demo) clock: what the release levels and ages show */
  now: number
  /** the time the weekly allowances and pin lifetimes follow: the demo clock in the local demo; real time when signed in,
   *  because the database keeps its own real time (bug hunt, Oct 2026: the two disagreed) */
  limitNow: number
  mode: DataMode
  /** every active pin as the release needs it (others' pins: anonymous in database mode) */
  pool: PinLike[]
  /** active pins per province (board map) */
  pinsByProvince: Record<string, number>
  /** active pins as anonymous groups with a count (the market view) */
  pinGroups: PinGroup[]
  counts: Record<string, Counts>
  setRole: (r: Role | null) => Promise<void>
  setOrigin: (p: Place | null) => Promise<void>
  pin: (input: { place: Place; industry: Industry; skills: Skill[] }) => Promise<Outcome<unknown>>
  unpin: (id: string) => Promise<void>
  post: (input: PostInput) => Promise<Outcome<Post>>
  /** change one of my own posts (keeps its dates, so its place in the release) */
  editPost: (id: string, input: PostInput) => Promise<Outcome<Post>>
  /** delete one of my own posts — or any post when signed in as an administrator */
  deletePost: (id: string) => Promise<boolean>
  /** start the release of my post again (uses one post of the weekly allowance) */
  renew: (id: string) => Promise<Outcome<unknown>>
  /** take a membership plan (simulated: free during the trial, no payment); returns the new end date */
  subscribe: (plan: PlanId) => Promise<string | null>
  /** apply (takes a place) or reserve (the post is full) */
  apply: (postId: string, input: ApplyInput) => Promise<Outcome<Acceptance>>
  /** the employer confirms or declines an application */
  decide: (accId: string, confirm: boolean) => Promise<boolean>
  /** the seeker withdraws an application or a reservation (not once its case has gone to the agency) */
  withdraw: (accId: string) => Promise<Outcome<unknown>>
  /** the employer sends a company registration number for verification */
  requestVerification: (country: Country, regNo: string) => Promise<Outcome<unknown>>
  /** an employer who is a private person: a mobile number confirmed with a code (only its last 4 digits are sent) */
  requestPersonVerification: (country: Country, phone: string) => Promise<Outcome<unknown>>
  /** the agency (administrator; anyone in the local demo) approves or rejects an employer — null = me in the demo */
  decideVerification: (userId: string | null, ok: boolean) => Promise<boolean>
  /** employers waiting for verification (agency view) */
  pendingVerifications: PendingVerify[]
  /** one step of a case (see cases.ts): the agency's actions, or the employer confirming the arrival */
  caseAct: (caseId: string, action: CaseAction) => Promise<Outcome<unknown>>
  /** may act as the agency: an administrator — or anyone in the local demo, where there are no accounts */
  agency: boolean
  /** report a suspicious post (once per post, not my own); it then leaves my board */
  report: (postId: string, reason: ReportReason, note: string) => Promise<Outcome<unknown>>
  /** administrator: open reports grouped by post */
  reports: ReportGroup[]
  /** administrator: add simulated posts and/or pins (the generator, 0008) — everything is labelled "simulated data" */
  addSamples: (posts: SimPost[], pins: SimPin[]) => Promise<Outcome<{ posts: number; pins: number }>>
  /** administrator: remove simulated posts and/or pins */
  clearSamples: (posts: boolean, pins: boolean) => Promise<Outcome<{ posts: number; pins: number }>>
  /** administrator: not a problem (shown again) · remove the post · suspend its employer */
  moderate: (postId: string, action: 'dismiss' | 'remove' | 'suspend') => Promise<Outcome<unknown>>
  advanceClock: (hours: number) => void
  resetClock: () => void
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
  const [remotePool, setPool] = useState<PinStatRow[]>([])
  const [remoteCounts, setCounts] = useState<Record<string, Counts> | null>(null)
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [people, setPeople] = useState<ProfileRow[]>([])
  const [reportRows, setReportRows] = useState<ReportRow[]>([])
  // until the first load for this account has arrived, pages wait instead of showing an empty state (e.g. "choose a role")
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const mode: DataMode = base === 'remote' && loadedFor !== userId ? 'loading' : base
  const loadSeq = useRef(0), purged = useRef(false)
  const refresh = useCallback(async () => {
    if (base !== 'remote' || !userId) return
    const seq = ++loadSeq.current
    try {
      const sb = await getClient()
      if (!purged.current) { purged.current = true; void sb.rpc('purge_expired').then(() => undefined, () => undefined) } // posts past 6 months, pins past a month
      const [prof, posts, pins, accs, uses, pinStats, counts, people, allPins, st, cases, reps] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
        sb.from('posts').select('*').order('created_at', { ascending: false }),
        sb.from('pins').select('*').eq('seeker_id', userId).order('created_at'),
        sb.from('acceptances').select('*').order('created_at'),
        sb.from('quota_events').select('kind, created_at').order('created_at'),
        sb.rpc('pin_stats'),
        sb.rpc('post_counts'),
        admin ? sb.from('profiles').select('*') : Promise.resolve({ data: [] }),
        admin ? sb.from('pins').select('*') : Promise.resolve({ data: [] }),
        admin ? sb.rpc('admin_stats') : Promise.resolve({ data: null }),
        sb.from('cases').select('*').order('created_at'), // missing before 0004 → no cases
        sb.from('reports').select('*').order('created_at'), // mine (everyone's for administrators); missing before 0005 → none
      ])
      if (seq !== loadSeq.current) return // a newer load started meanwhile
      setRemote(buildState({ admin, uid: userId, name: userName, profile: prof.data ?? null, posts: (posts.data ?? []) as PostRow[], pins: pins.data ?? [], acceptances: accs.data ?? [],
        clockHours: 0, credits: uses.data ?? [], people: people.data ?? [], allPins: allPins.data ?? [], cases: (cases.data ?? []) as CaseRow[], reports: (reps.data ?? []) as ReportRow[] }))
      setPeople((people.data ?? []) as ProfileRow[])
      setReportRows(admin ? (reps.data ?? []) as ReportRow[] : [])
      setPool(Array.isArray(pinStats.data) ? pinStats.data as PinStatRow[] : [])
      setCounts(Array.isArray(counts.data) ? Object.fromEntries((counts.data as { post_id: string; held: number; pending: number; reserved: number }[]).map((r) => [r.post_id, { held: Number(r.held), pending: Number(r.pending), reserved: Number(r.reserved) }])) : null)
      const s = Array.isArray(st.data) ? st.data[0] : st.data
      setStats(s ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])) as unknown as AdminStats : null)
      setLoadedFor(userId)
    } catch { /* keep what we have; the next refresh tries again */ }
  }, [base, userId, userName, admin])
  useEffect(() => { void refresh() }, [refresh])
  // others' changes (new posts, someone applied) show up when the tab comes back into view and every 30 s while it is visible
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
      go(n.next || (n.role === 'employer' ? 'hire' : n.role === 'seeker' ? 'seek' : ''), { replace: true })
    })()
  }, [mode, userId, refresh])
  useEffect(() => { try { localStorage.setItem(CLOCK_KEY, String(clock)) } catch { /* ignore */ } }, [clock])

  const raw = mode === 'local' ? localSt : mode === 'remote' ? { ...remoteSt, clockHours: clock } : emptyState(clock)
  const now = nowWith(raw.clockHours)
  // posts past their 6 months are gone (the database removes them too)
  const st = useMemo(() => withoutExpired(raw, now), [raw, now])
  const pool = useMemo<PinLike[]>(() => (mode === 'remote' ? [...st.me.pins, ...statsToPool(remotePool)] : poolOf(st)), [mode, st, remotePool])
  const pinsByProvince = useMemo(() => {
    if (mode === 'remote') return statsByProvince(remotePool.filter((r) => Date.parse(r.hour) > now - 30 * 24 * HOUR_MS))
    return pool.filter((p) => pinActive(p, now)).reduce<Record<string, number>>((m, p) => ({ ...m, [p.province]: (m[p.province] ?? 0) + 1 }), {})
  }, [mode, remotePool, pool, now])
  const pinGroups = useMemo<PinGroup[]>(() => {
    if (mode === 'remote') return statsToGroups(remotePool.filter((r) => Date.parse(r.hour) > now - 30 * 24 * HOUR_MS))
    return pool.filter((p) => pinActive(p, now)).map((p) => ({ country: p.country, province: p.province, industry: p.industry, at: p.at, n: 1, sample: (p as { sample?: boolean }).sample ? 1 : 0 }))
  }, [mode, remotePool, pool, now])
  const counts = useMemo(() => (mode === 'remote' && remoteCounts ? remoteCounts : countsFrom(st.acceptances)), [mode, remoteCounts, st.acceptances])
  const at = useCallback(() => new Date(nowWith(raw.clockHours)).toISOString(), [raw.clockHours])
  const limitNow = mode === 'remote' ? Date.now() : now

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
    const mineAcc = (accId: string) => st.acceptances.find((a) => a.id === accId)
    const today = () => localDay(at())
    const pendingVerifications: PendingVerify[] = local
      ? (st.employerVerify?.status === 'pending' ? [{ id: null, name: '—', company: st.myCompany, ...st.employerVerify }] : [])
      : people.flatMap((p) => { const v = p.id && verifyOf(p); return v && v.status === 'pending' ? [{ id: p.id!, name: p.full_name || '—', company: p.company ?? '', kind: v.kind, country: v.country, regNo: v.regNo, ...(v.phone4 ? { phone4: v.phone4 } : {}), at: p.verify_at ?? '' }] : [] })
    // signed in: limits are checked at the real time, like the database does
    const limitAt = () => (local ? at() : new Date().toISOString())
    return {
      st, now, limitNow, mode, pool, pinsByProvince, pinGroups, counts, stats: local ? null : stats, pendingVerifications, agency: local || admin, reports: local ? [] : reportQueue(reportRows),
      setRole: async (role) => { if (local) setLocal((s) => ({ ...s, role })); else await profile({ user_type: role }) },
      setOrigin: async (origin) => { if (local) setLocal((s) => ({ ...s, me: { ...s.me, origin } })); else await profile({ origin_country: origin?.country ?? null, origin_province: origin?.province ?? null }) },
      pin: async (input) => {
        const when = limitAt()
        const r = addPin(st, input, uid('pin'), when) // the same checks as the database, with field-level messages
        if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, me: r.value, credits: [...s.credits, { kind: 'pin', at: when }] })); return r }
        return write((sb) => sb.from('pins').insert({ country: input.place.country, province: input.place.province, industry: input.industry, skills: input.skills }), () => null)
      },
      unpin: async (id) => { if (local) setLocal((s) => ({ ...s, me: removePin(s.me, id) })); else await write((sb) => sb.from('pins').delete().eq('id', id), () => null) },
      post: async (input) => {
        if (!canPost(st, limitNow)) return { ok: false, problem: 'quota' } as const // weekly allowance used up
        const when = at()
        const made = makePost(input, uid('post'), MY_EMPLOYER, when); if (!made.ok) return made
        const r = { ok: true as const, value: { ...made.value, verified: employerVerified(st), ...(employerVerified(st) ? { verifiedAs: st.employerVerify!.kind } : {}) } }
        if (local) { setLocal((s) => ({ ...s, myCompany: input.company, posts: [r.value, ...s.posts], credits: [...s.credits, { kind: 'post', at: when }] })); return r }
        if (input.company !== st.myCompany) await profile({ company: input.company })
        return write((sb) => sb.from('posts').insert(postToRow(input)).select().single(), (row) => rowToPost(row as PostRow, userId!))
      },
      editPost: async (id, input) => {
        const old = st.posts.find((p) => p.id === id && p.employerId === MY_EMPLOYER); if (!old) return fail('unknown')
        // fewer people than already hold a place cannot be asked for (bug hunt, Oct 2026: it showed "3/1 places")
        if (input.headcount < (counts[id]?.held ?? holding(st.acceptances, id))) return { ok: false, problem: 'belowHeld' } as const
        // an unchanged start date is checked against the posting day (a post whose start has passed can still be corrected)
        const r = makePost(input, id, MY_EMPLOYER, old.startDate && input.startDate === old.startDate ? old.createdAt : at()); if (!r.ok) return r
        const value = { ...r.value, createdAt: old.createdAt, releasedAt: old.releasedAt }
        // more people wanted: places go to the queue at once, as the database does
        if (local) { setLocal((s) => ({ ...s, myCompany: input.company, posts: s.posts.map((p) => (p.id === id ? value : p)), acceptances: promote(s.acceptances, value, at()) })); return { ok: true, value } }
        return write((sb) => sb.from('posts').update(postToRow(input)).eq('id', id).select().single(), (row) => rowToPost(row as PostRow, userId!))
      },
      deletePost: async (id) => {
        if (caseBlocksDelete(st, id)) return false
        if (local) { setLocal((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id), acceptances: s.acceptances.filter((a) => a.postId !== id), cases: s.cases.filter((c) => c.postId !== id) })); return true }
        const r = await write((sb) => sb.from('posts').delete().eq('id', id).select('id'), (rows) => (Array.isArray(rows) ? rows.length : 0))
        return r.ok && r.value > 0 // row security may silently delete nothing
      },
      renew: async (id) => {
        const when = limitAt()
        const r = renewPost(st, id, when); if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, posts: s.posts.map((p) => (p.id === id ? r.value : p)), credits: [...s.credits, { kind: 'renew', at: when }] })); return r }
        return write((sb) => sb.rpc('renew_post', { p_id: id }), () => null)
      },
      subscribe: async (plan) => {
        const until = planUntil(st, plan, limitNow) // signed in: from the real time, like the database
        if (local) { setLocal((s) => ({ ...s, member: true, memberUntil: until })); return until }
        return (await profile({ member: true, member_until: until })).ok ? until : null
      },
      apply: async (postId, input) => {
        const r = applyTo(st, pool, postId, ME, input, uid('acc'), at()); if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, acceptances: [...s.acceptances, r.value] })); return r }
        return write((sb) => sb.from('acceptances').insert({ post_id: postId, intro: input.intro, available_from: input.availableFrom }).select().single(), (row) => rowToAcceptance(row as AcceptanceRow, userId!))
      },
      decide: async (accId, confirm) => {
        if (local) {
          const a = mineAcc(accId), p = a && st.posts.find((x) => x.id === a.postId)
          if (!p || p.employerId !== MY_EMPLOYER) return false
          const when = at()
          const r = decide(st, accId, confirm, when); if (!r.ok) return false
          setLocal((s) => {
            if (!confirm) return { ...s, acceptances: r.value }
            const opened = openCaseFor(s, r.value, accId, uid('case'), when) // confirmed → a case opens (handed over at once if I am verified)
            return { ...s, acceptances: opened.acceptances, cases: opened.cases }
          })
          return true
        }
        return (await write((sb) => sb.rpc('decide_application', { p_id: accId, p_confirm: confirm }), () => null)).ok
      },
      withdraw: async (accId) => {
        const r = cancel(st, accId, at()); if (!r.ok) return r // also: not once the case has gone to the agency
        if (local) { setLocal((s) => ({ ...s, acceptances: r.value, cases: s.cases.filter((c) => c.accId !== accId) })); return r }
        const d = await write((sb) => sb.from('acceptances').delete().eq('id', accId).select('id'), (rows) => (Array.isArray(rows) ? rows.length : 0))
        return d.ok && d.value === 0 ? { ok: false, problem: 'state' } : d // row security may silently delete nothing
      },
      requestVerification: async (country, regNo) => {
        const r = requestVerify(country, cleanRegNo(regNo), at()); if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, employerVerify: r.value, posts: s.posts.map((p) => (p.employerId === MY_EMPLOYER ? { ...p, verified: false, verifiedAs: undefined } : p)) })); return r }
        return profile({ verify_country: country, verify_reg: r.value.regNo }) // the database marks it a company (0007)
      },
      requestPersonVerification: async (country, phone) => {
        const r = requestPersonVerify(country, cleanPhone(country, phone), at()); if (!r.ok) return r
        if (local) { setLocal((s) => ({ ...s, employerVerify: r.value, posts: s.posts.map((p) => (p.employerId === MY_EMPLOYER ? { ...p, verified: false, verifiedAs: undefined } : p)) })); return r }
        return profile({ verify_kind: 'person', verify_country: country, verify_phone4: r.value.phone4, verify_reg: null })
      },
      decideVerification: async (userId, ok) => {
        if (local) {
          if (!st.employerVerify) return false
          const when = at()
          setLocal((s) => {
            if (!s.employerVerify) return s
            const ev = { ...s.employerVerify, status: ok ? 'verified' as const : 'rejected' as const, decidedAt: when }
            const mine = new Set(s.posts.filter((p) => p.employerId === MY_EMPLOYER).map((p) => p.id))
            // approved: my posts become verified and my waiting cases go to the agency
            const cases = ok ? s.cases.map((c) => (mine.has(c.postId) ? submitCase(c, when) : c)) : s.cases
            const handed = new Set(cases.filter((c) => mine.has(c.postId) && c.steps.submitted).map((c) => c.accId))
            return { ...s, employerVerify: ev, posts: s.posts.map((p) => (mine.has(p.id) ? { ...p, verified: ok, verifiedAs: ok ? ev.kind : undefined } : p)), cases,
              acceptances: s.acceptances.map((a) => (handed.has(a.id) && a.status === 'confirmed' ? { ...a, status: 'forwarded' as const, forwardedAt: when } : a)) }
          })
          return true
        }
        if (!userId) return false
        return (await write((sb) => sb.rpc('verify_employer', { p_user: userId, p_ok: ok }), () => null)).ok
      },
      addSamples: async (posts, pins) => {
        if (local) {
          // the demo: simulated employers and one simulated crowd of job seekers
          const made = posts.flatMap((p, i) => { const r = makePost(p, uid('post'), `employer:sim-${i % 9}`, p.createdAt); return r.ok ? [{ ...r.value, verified: p.verified, ...(p.verified ? { verifiedAs: p.verifiedAs ?? 'company' as const } : {}), sample: true }] : [] })
          const crowd = pins.map((p) => ({ id: uid('pin'), country: p.country, province: p.province, industry: p.industry, skills: [...p.skills], at: p.at, sample: true }))
          setLocal((s) => {
            const old = s.seekers.find((x) => x.id === 'seeker:sim')
            const sim = { id: 'seeker:sim', name: '—', origin: null, pins: [...(old?.pins ?? []), ...crowd], synthetic: true as const }
            return { ...s, posts: [...made, ...s.posts], seekers: crowd.length ? [...s.seekers.filter((x) => x.id !== 'seeker:sim'), sim] : s.seekers }
          })
          return { ok: true, value: { posts: made.length, pins: crowd.length } }
        }
        return write((sb) => sb.rpc('admin_add_samples', { p_posts: posts.map(simPostRow), p_pins: pins.map(simPinRow) }), (d) => d as { posts: number; pins: number })
      },
      clearSamples: async (posts, pins) => {
        if (local) {
          const gone = new Set(st.posts.filter((p) => posts && p.sample).map((p) => p.id)), np = gone.size, nn = pins ? st.seekers.find((x) => x.id === 'seeker:sim')?.pins.length ?? 0 : 0
          setLocal((s) => ({ ...s, posts: s.posts.filter((p) => !gone.has(p.id)), acceptances: s.acceptances.filter((a) => !gone.has(a.postId)), cases: s.cases.filter((c) => !gone.has(c.postId)),
            seekers: pins ? s.seekers.filter((x) => x.id !== 'seeker:sim') : s.seekers }))
          return { ok: true, value: { posts: np, pins: nn } }
        }
        return write((sb) => sb.rpc('admin_clear_samples', { p_posts: posts, p_pins: pins }), (d) => d as { posts: number; pins: number })
      },
      caseAct: async (caseId, action) => {
        const c = st.cases.find((x) => x.id === caseId); if (!c) return fail('unknown')
        // checked here in both modes (clear messages); the database checks the same again
        const r = applyCaseAction(c, action, at(), today())
        if (!r.ok) return fail(r.problem === 'name' ? 'caseText' : r.problem === 'available' ? 'departDate' : r.problem === 'contact' ? 'contact' : 'state')
        if (local) { setLocal((s) => ({ ...s, cases: s.cases.map((x) => (x.id === caseId ? r.value : x)) })); return r }
        const key = 'key' in action ? action.key : 'id' in action ? action.id : null
        const value = 'name' in action ? action.name : 'date' in action ? action.date : 'text' in action ? action.text : null
        return write((sb) => sb.rpc('case_action', { p_id: caseId, p_action: CASE_RPC[action.kind], p_key: key, p_value: value }), () => null)
      },
      report: async (postId, reason, note) => {
        const r = reportPost(st, postId, reason, note, uid('rep'), at())
        if (!r.ok) return fail(r.problem)
        if (local) { setLocal((s) => ({ ...s, reports: [...s.reports, r.value] })); return r }
        const w = await write((sb) => sb.from('reports').insert({ post_id: postId, reason, note: r.value.note }), () => null)
        return !w.ok && w.problem === 'already' ? fail('reported') : w
      },
      moderate: async (postId, action) => {
        if (local) return fail('state') // no administrators in the local demo
        return write((sb) => sb.rpc('moderate_post', { p_post: postId, p_action: action }), () => null)
      },
      advanceClock: (hours) => {
        const step = (c: number) => Math.min(MAX_CLOCK_HOURS, c + hours)
        if (local) setLocal((s) => ({ ...s, clockHours: step(s.clockHours) })); else setClock(step)
      },
      // back to real time: whatever was made while the clock ran ahead moves to now, so it does not vanish (demo)
      resetClock: () => { if (local) setLocal((s) => clampFuture(s, Date.now())); else setClock(0) },
      reset: () => { if (local) { const fresh = seedState(); setLocal((s) => ({ ...fresh, role: s.role })) } else setClock(0) },
    }
  }, [st, now, limitNow, mode, pool, pinsByProvince, pinGroups, counts, stats, at, refresh, userId, admin, people, reportRows])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useMatch = () => { const c = useContext(C); if (!c) throw new Error('match'); return c }
