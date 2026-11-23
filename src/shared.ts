// The four parts that used to stay in one browser — chat, contracts, job-seeker verification and the end system — shared through
// the database when signed in (owner, 23 Nov 2026: "the employer never saw the worker's chat"). See
// supabase/migrations/0014_shared_records.sql for who may read and write what. The local demo and the offline kit keep using the
// browser stores (chatStore.ts, contractStore.ts, aftercareStore.ts, seeker-verify.tsx) exactly as before.
// Changes from the other side arrive through Supabase Realtime, with a reload every 15 s while the page is visible as a back-up.
import { useCallback, useEffect, useRef, useState } from 'react'
import { getClient } from './auth'
import { dbProblem } from './domain/match/remote'
import type { Chat, ChatMsg, Interview, Side } from './domain/match/chat'
import type { EmployerReview } from './domain/match/aftercare'

export const isUuid = (v: string | null | undefined) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
/** 'dbOld': SQL 0014 has not been run yet · 'network': could not reach the database */
export type SyncProblem = 'dbOld' | 'network' | null
const problemOf = (e: unknown): SyncProblem => (dbProblem(e as { message?: string; code?: string }) === 'dbOld' ? 'dbOld' : 'network')
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`)

/* ---------- times: a real moment ↔ "YYYY-MM-DDTHH:mm" in the viewer's own time (the form fields and the calendar use these) ---------- */
const pad = (n: number) => String(n).padStart(2, '0')
export const toLocalStamp = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
export const fromLocalStamp = (s: string) => new Date(s).toISOString() // a date-time without a zone is read as local time

/** reload on demand, on Realtime events for the given tables and filter, and every 15 s while visible */
function useLive(key: string | null, load: () => Promise<void>, tables: { table: string; filter?: string }[]) {
  const loadRef = useRef(load); loadRef.current = load
  const spec = JSON.stringify(tables)
  useEffect(() => {
    if (!key) return
    let alive = true, unsub: (() => void) | undefined
    const run = () => { if (alive) void loadRef.current() }
    run()
    void getClient().then((sb) => {
      if (!alive) return
      let ch = sb.channel(`live:${key}:${Math.random().toString(36).slice(2, 8)}`)
      for (const t of JSON.parse(spec) as { table: string; filter?: string }[]) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t.table, ...(t.filter ? { filter: t.filter } : {}) }, run)
      ch.subscribe()
      unsub = () => { void sb.removeChannel(ch) }
    }).catch(() => undefined)
    const tick = window.setInterval(() => { if (document.visibilityState === 'visible') run() }, 15_000)
    const onShow = () => { if (document.visibilityState === 'visible') run() }
    document.addEventListener('visibilitychange', onShow)
    return () => { alive = false; unsub?.(); window.clearInterval(tick); document.removeEventListener('visibilitychange', onShow) }
  }, [key, spec])
}

/* ======================= chat ======================= */
interface MsgRow { id: string; side: string; body: string; phrase: string | null; masked: boolean; created_at: string }
interface IvRow { slots: string[]; mode: string; offered_at: string; chosen: string | null; chosen_at: string | null }
export const rowToMsg = (r: MsgRow): ChatMsg => ({ id: r.id, from: r.side === 'employer' ? 'employer' : 'seeker', at: new Date(r.created_at).toISOString(), text: r.body ?? '',
  ...(r.phrase ? { phrase: r.phrase } : {}), ...(r.masked ? { masked: true } : {}) })
export const rowToInterview = (r: IvRow): Interview => ({ slots: (r.slots ?? []).map(toLocalStamp), mode: r.mode === 'onsite' ? 'onsite' : 'video', offeredAt: new Date(r.offered_at).toISOString(),
  ...(r.chosen ? { chosen: toLocalStamp(r.chosen), chosenAt: new Date(r.chosen_at ?? r.offered_at).toISOString() } : {}) })

/** one conversation in the database: [chat, save, problem]. save() takes the whole chat as the page made it and sends only what is new */
export function useRemoteChat(accId: string | null): [Chat, (next: Chat) => void, SyncProblem, boolean] {
  const [chat, setChat] = useState<Chat>({ msgs: [] })
  const [problem, setProblem] = useState<SyncProblem>(null)
  const [loaded, setLoaded] = useState(false)
  const cur = useRef(chat); cur.current = chat
  const load = useCallback(async () => {
    if (!accId) return
    try {
      const sb = await getClient()
      const [m, iv] = await Promise.all([
        sb.from('chat_messages').select('id, side, body, phrase, masked, created_at').eq('acceptance_id', accId).order('created_at'),
        sb.from('chat_interviews').select('slots, mode, offered_at, chosen, chosen_at').eq('acceptance_id', accId).maybeSingle(),
      ])
      if (m.error) throw m.error
      if (iv.error) throw iv.error
      const msgs = (m.data as MsgRow[]).map(rowToMsg)
      // messages sent from here that the database has not returned yet stay on screen
      const pending = cur.current.msgs.filter((x) => (x as ChatMsg & { pending?: boolean }).pending && !msgs.some((y) => y.id === x.id))
      setChat({ msgs: [...msgs, ...pending], ...(iv.data ? { interview: rowToInterview(iv.data as IvRow) } : {}) })
      setProblem(null)
    } catch (e) { setProblem(problemOf(e)) } finally { setLoaded(true) }
  }, [accId])
  useLive(accId, load, [{ table: 'chat_messages', filter: `acceptance_id=eq.${accId}` }, { table: 'chat_interviews', filter: `acceptance_id=eq.${accId}` }])
  const save = useCallback((next: Chat) => {
    if (!accId) return
    const before = cur.current
    const fresh = next.msgs.filter((x) => !before.msgs.some((y) => y.id === x.id)).map((x) => ({ ...x, id: isUuid(x.id) ? x.id : newId(), pending: true }))
    setChat({ ...next, msgs: [...before.msgs, ...fresh] })
    void (async () => {
      try {
        const sb = await getClient()
        for (const x of fresh) {
          const { error } = await sb.from('chat_messages').insert({ id: x.id, acceptance_id: accId, body: x.phrase ? '' : x.text, phrase: x.phrase ?? null, masked: !!x.masked })
          if (error) throw error
        }
        const a = before.interview, b = next.interview
        if (b?.chosen && !a?.chosen) { const { error } = await sb.rpc('chat_pick_interview', { p_acc: accId, p_slot: fromLocalStamp(b.chosen) }); if (error) throw error }
        else if (b && !b.chosen && (JSON.stringify(a?.slots) !== JSON.stringify(b.slots) || a?.mode !== b.mode)) {
          const { error } = await sb.rpc('chat_offer_interview', { p_acc: accId, p_slots: b.slots.map(fromLocalStamp), p_mode: b.mode }); if (error) throw error
        }
        setProblem(null)
      } catch (e) { setProblem(problemOf(e)) }
      await load()
    })()
  }, [accId, load])
  return [chat, save, problem, loaded]
}

/** my conversations (chat list, unread counts) */
export interface ChatSummary { accId: string; mySide: Side; lastAt: string | null; lastSide: Side | null; lastText: string; lastPhrase: string | null; otherTimes: string[] }
export function useChatSummaries(on: boolean): { list: ChatSummary[]; problem: SyncProblem; reload: () => void } {
  const [list, setList] = useState<ChatSummary[]>([])
  const [problem, setProblem] = useState<SyncProblem>(null)
  const load = useCallback(async () => {
    if (!on) return
    try {
      const sb = await getClient()
      const { data, error } = await sb.rpc('my_chats')
      if (error) throw error
      setList(((data ?? []) as { acceptance_id: string; my_side: string; last_at: string | null; last_side: string | null; last_body: string | null; last_phrase: string | null; other_times: string[] | null }[])
        .filter((r) => r.my_side === 'seeker' || r.my_side === 'employer')
        .map((r) => ({ accId: r.acceptance_id, mySide: r.my_side as Side, lastAt: r.last_at ? new Date(r.last_at).toISOString() : null, lastSide: r.last_side === 'employer' ? 'employer' : r.last_side === 'seeker' ? 'seeker' : null,
          lastText: r.last_body ?? '', lastPhrase: r.last_phrase, otherTimes: (r.other_times ?? []).map((x) => new Date(x).toISOString()) })))
      setProblem(null)
    } catch (e) { setProblem(problemOf(e)) }
  }, [on])
  useLive(on ? 'chats' : null, load, [{ table: 'chat_messages' }])
  return { list, problem, reload: () => void load() }
}

/* read markers: when I last opened each conversation, per account, on this device */
const READ_KEY = 'call.chatRead.v1', READ_EVT = 'call-chat-read'
const readAllMarks = (): Record<string, string> => { try { const v: unknown = JSON.parse(localStorage.getItem(READ_KEY) ?? '{}'); return isObj(v) ? (v as Record<string, string>) : {} } catch { return {} } }
export function markRead(uid: string, accId: string, at: string) {
  try { const all = readAllMarks(); const k = `${uid}:${accId}`; if ((all[k] ?? '') >= at) return; all[k] = at; localStorage.setItem(READ_KEY, JSON.stringify(all)); window.dispatchEvent(new Event(READ_EVT)) } catch { /* storage blocked */ }
}
export function useReadMarks(): Record<string, string> {
  const [m, setM] = useState(readAllMarks)
  useEffect(() => { const on = () => setM(readAllMarks()); window.addEventListener(READ_EVT, on); window.addEventListener('storage', on); return () => { window.removeEventListener(READ_EVT, on); window.removeEventListener('storage', on) } }, [])
  return m
}
export const unreadOf = (s: ChatSummary, uid: string, marks: Record<string, string>) => { const seen = marks[`${uid}:${s.accId}`] ?? ''; return s.otherTimes.filter((x) => x > seen).length }

/** booked interviews of all my conversations (calendar) */
export function useRemoteInterviews(on: boolean): { accId: string; at: string; mode: 'video' | 'onsite' }[] {
  const [list, setList] = useState<{ accId: string; at: string; mode: 'video' | 'onsite' }[]>([])
  useEffect(() => {
    if (!on) { setList([]); return }
    let alive = true
    void getClient().then(async (sb) => {
      const { data } = await sb.from('chat_interviews').select('acceptance_id, chosen, mode').not('chosen', 'is', null)
      if (alive && Array.isArray(data)) setList((data as { acceptance_id: string; chosen: string; mode: string }[]).map((r) => ({ accId: r.acceptance_id, at: toLocalStamp(r.chosen), mode: r.mode === 'onsite' ? 'onsite' : 'video' })))
    }).catch(() => undefined)
    return () => { alive = false }
  }, [on])
  return list
}

/* ======================= contracts ======================= */
/** one case's contract work in the database: data (null while loading), a version that moves on every change from anyone, save and clear */
export function useRemoteContract<T extends Record<string, unknown>>(caseId: string | null): { data: T | null; ver: number; save: (patch: Partial<T>) => void; clear: () => void; problem: SyncProblem } {
  const [data, setData] = useState<T | null>(null)
  const [ver, setVer] = useState(0)
  const [problem, setProblem] = useState<SyncProblem>(null)
  const last = useRef('')
  const load = useCallback(async () => {
    if (!caseId) return
    try {
      const sb = await getClient()
      const { data: row, error } = await sb.from('contracts').select('data, updated_at').eq('case_id', caseId).maybeSingle()
      if (error) throw error
      const d = (isObj(row?.data) ? row!.data : {}) as T, stamp = JSON.stringify(d)
      setProblem(null)
      if (stamp !== last.current) { last.current = stamp; setData(d); setVer((v) => v + 1) } else setData((x) => x ?? d)
    } catch (e) { setProblem(problemOf(e)); setData((x) => x ?? ({} as T)) }
  }, [caseId])
  useEffect(() => { setData(null); last.current = '' }, [caseId])
  useLive(caseId, load, [{ table: 'contracts', filter: `case_id=eq.${caseId}` }])
  const send = useCallback((patch: Record<string, unknown>, clear: boolean) => {
    if (!caseId) return
    void (async () => {
      try { const sb = await getClient(); const { error } = await sb.rpc('contract_save', { p_case: caseId, p_patch: patch, p_clear: clear }); if (error) throw error; setProblem(null) } catch (e) { setProblem(problemOf(e)) }
      await load()
    })()
  }, [caseId, load])
  return { data, ver, save: useCallback((p: Partial<T>) => send(p as Record<string, unknown>, false), [send]), clear: useCallback(() => send({}, true), [send]), problem }
}

/* ======================= job-seeker verification ======================= */
export interface SeekerRow { seeker_phone_country: string | null; seeker_phone4: string | null; seeker_phone_at: string | null; seeker_pp_last4: string | null; seeker_pp_nat: string | null; seeker_pp_expiry: string | null; seeker_pp_at: string | null }
const SV_EVT = 'call-seeker-verify-remote'
export function useRemoteSeekerRow(uid: string | null): { row: SeekerRow | null; save: (patch: Partial<SeekerRow>) => Promise<SyncProblem>; problem: SyncProblem } {
  const [row, setRow] = useState<SeekerRow | null>(null)
  const [problem, setProblem] = useState<SyncProblem>(null)
  const load = useCallback(async () => {
    if (!uid) return
    try {
      const sb = await getClient()
      const { data, error } = await sb.from('profiles').select('seeker_phone_country, seeker_phone4, seeker_phone_at, seeker_pp_last4, seeker_pp_nat, seeker_pp_expiry, seeker_pp_at').eq('id', uid).maybeSingle()
      if (error) throw error
      setRow((data ?? null) as SeekerRow | null); setProblem(null)
    } catch (e) { setProblem(problemOf(e)) }
  }, [uid])
  useEffect(() => { void load(); const on = () => void load(); window.addEventListener(SV_EVT, on); return () => window.removeEventListener(SV_EVT, on) }, [load])
  const save = useCallback(async (patch: Partial<SeekerRow>): Promise<SyncProblem> => {
    if (!uid) return 'network'
    try { const sb = await getClient(); const { error } = await sb.from('profiles').update(patch).eq('id', uid); if (error) throw error; window.dispatchEvent(new Event(SV_EVT)); return null }
    catch (e) { const p = problemOf(e); setProblem(p); return p }
  }, [uid])
  return { row, save, problem }
}
/** "verified" of the people who applied to my posts (the team: everyone) — one shared request, refreshed every minute */
let badgeCache: { at: number; map: Record<string, boolean> } | null = null, badgeLoad: Promise<void> | null = null
const BADGE_EVT = 'call-badges'
async function loadBadges() {
  try {
    const sb = await getClient()
    const { data, error } = await sb.rpc('seeker_badges')
    if (error) throw error
    badgeCache = { at: Date.now(), map: Object.fromEntries(((data ?? []) as { seeker_id: string; verified: boolean }[]).map((r) => [r.seeker_id, !!r.verified])) }
  } catch { badgeCache = { at: Date.now(), map: badgeCache?.map ?? {} } }
  window.dispatchEvent(new Event(BADGE_EVT))
}
export function useSeekerBadges(on: boolean): Record<string, boolean> {
  const [, setN] = useState(0)
  useEffect(() => {
    if (!on) return
    const bump = () => setN((n) => n + 1)
    window.addEventListener(BADGE_EVT, bump)
    if (!badgeCache || Date.now() - badgeCache.at > 60_000) badgeLoad ??= loadBadges().finally(() => { badgeLoad = null })
    return () => window.removeEventListener(BADGE_EVT, bump)
  }, [on])
  return badgeCache?.map ?? {}
}

/* ======================= aftercare ======================= */
/** one worker's aftercare for one case ('nocase' = complaints not tied to a case) */
export function useRemoteAftercare<T extends object>(seekerId: string | null, key: string, empty: () => T, clean: (v: unknown) => T): [T, (next: T) => void, SyncProblem] {
  const [a, setA] = useState<T>(empty)
  const [problem, setProblem] = useState<SyncProblem>(null)
  const id = seekerId ? `${seekerId}:${key}` : null
  const load = useCallback(async () => {
    if (!seekerId) return
    try {
      const sb = await getClient()
      const { data, error } = await sb.from('aftercare').select('data').eq('seeker_id', seekerId).eq('case_key', key).maybeSingle()
      if (error) throw error
      setA(clean(data?.data)); setProblem(null)
    } catch (e) { setProblem(problemOf(e)) }
  }, [seekerId, key, clean])
  useEffect(() => { setA(empty()) }, [id, empty])
  useLive(id, load, [])
  const save = useCallback((next: T) => {
    if (!seekerId) return
    setA(next)
    void (async () => {
      try { const sb = await getClient(); const { error } = await sb.rpc('aftercare_save', { p_seeker: seekerId, p_key: key, p_data: next }); if (error) throw error; setProblem(null) } catch (e) { setProblem(problemOf(e)) }
      await load()
    })()
  }, [seekerId, key, load])
  return [a, save, problem]
}
/** the anonymous reviews of one employer */
export function useRemoteReviews(employerUid: string | null): EmployerReview[] {
  const [rs, setRs] = useState<EmployerReview[]>([])
  useEffect(() => {
    if (!employerUid) { setRs([]); return }
    let alive = true
    void getClient().then(async (sb) => {
      const { data } = await sb.rpc('employer_reviews_of', { p_employer: employerUid })
      if (alive && Array.isArray(data)) setRs((data as { stars: number; good: string[]; bad: string[]; at: string }[]).map((r) => ({ employerId: employerUid, at: new Date(r.at).toISOString(), stars: r.stars, good: r.good ?? [], bad: r.bad ?? [] })))
    }).catch(() => undefined)
    return () => { alive = false }
  }, [employerUid])
  return rs
}
