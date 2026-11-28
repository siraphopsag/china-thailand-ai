// Exchanging contact details once the case allows it (owner, 28 Nov 2026). Signed in: through the database functions of SQL 0026,
// which decide who may see what; in the local demo and the offline kit: in this browser, where either side can be tried.
import { useCallback, useEffect, useState } from 'react'
import { getClient } from './auth'
import type { SyncProblem } from './shared'
import type { Side } from './domain/match/chat'

export interface ShareState {
  side: Side
  /** the case's documents step is done (the team checked the contract and the documents) */
  unlocked: boolean
  mine: string | null
  meAt: string | null
  themAt: string | null
  /** the other side's contact: only when both have agreed */
  theirs: string | null
  /** a demo account whose other side is simulated: that side can agree on request */
  sim: boolean
}
export const CONTACT_MIN = 3, CONTACT_MAX = 80
/** what a person may give: 3–80 characters */
export const contactOk = (v: string) => { const s = v.trim(); return s.length >= CONTACT_MIN && s.length <= CONTACT_MAX }
const LOCAL = 'call.contact.v1'
type LocalRow = Partial<Record<Side, { c: string; at: string }>>
const readAll = (): Record<string, LocalRow> => { try { return JSON.parse(localStorage.getItem(LOCAL) ?? '{}') ?? {} } catch { return {} } }
const writeAll = (v: Record<string, LocalRow>) => { try { localStorage.setItem(LOCAL, JSON.stringify(v)) } catch { /* storage blocked */ } }
const other = (s: Side): Side => (s === 'seeker' ? 'employer' : 'seeker')
/** the state of one match on this device */
export function localState(acc: string, side: Side, unlocked: boolean): ShareState {
  const r = readAll()[acc] ?? {}
  const me = r[side], them = r[other(side)]
  return { side, unlocked, mine: me?.c ?? null, meAt: me?.at ?? null, themAt: them?.at ?? null, theirs: me && them ? them.c : null, sim: true }
}
export function localSet(acc: string, side: Side, contact: string | null, at: string) {
  const all = readAll(), row = { ...(all[acc] ?? {}) }
  if (contact) row[side] = { c: contact.trim(), at }; else delete row[side]
  writeAll({ ...all, [acc]: row })
}
const toState = (v: unknown): ShareState | null => {
  if (!v || typeof v !== 'object') return null
  const x = v as Record<string, unknown>, str = (k: string) => (typeof x[k] === 'string' ? (x[k] as string) : null)
  return { side: x.side === 'employer' ? 'employer' : 'seeker', unlocked: x.unlocked === true, mine: str('mine'), meAt: str('meAt'), themAt: str('themAt'), theirs: str('theirs'), sim: x.sim === true }
}
const problemOf = (e: unknown): SyncProblem => (/PGRST202|42883|does not exist|schema cache/i.test(`${(e as { code?: string })?.code ?? ''} ${(e as Error)?.message ?? ''}`) ? 'dbOld' : 'network')

/** the exchange of one match: remote (signed in) or on this device */
export function useContactShare(acc: string, side: Side, remote: boolean, unlockedHere: boolean, now: () => string) {
  const [st, setSt] = useState<ShareState | null>(null)
  const [problem, setProblem] = useState<SyncProblem | 'locked'>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!remote) { setSt(localState(acc, side, unlockedHere)); return }
    let alive = true
    void getClient().then(async (sb) => {
      const { data, error } = await sb.rpc('contact_share_state', { p_acc: acc })
      if (!alive) return
      if (error) { setProblem(problemOf(error)); return }
      setSt(toState(data)); setProblem(null)
    }).catch(() => alive && setProblem('network'))
    return () => { alive = false }
  }, [acc, side, remote, unlockedHere, tick])
  const call = useCallback(async (fn: string, args: Record<string, unknown>) => {
    try {
      const sb = await getClient()
      const { data, error } = await sb.rpc(fn, { p_acc: acc, ...args })
      if (error) { setProblem(/locked/.test(error.message) ? 'locked' : problemOf(error)); return false }
      setSt(toState(data)); setProblem(null); return true
    } catch { setProblem('network'); return false }
  }, [acc])
  const agree = useCallback(async (contact: string) => {
    if (!contactOk(contact)) return false
    if (!remote) { localSet(acc, side, contact, now()); setTick((x) => x + 1); return true }
    return call('contact_share_set', { p_contact: contact.trim() })
  }, [remote, acc, side, now, call])
  const withdraw = useCallback(async () => {
    if (!remote) { localSet(acc, side, null, now()); setTick((x) => x + 1); return true }
    return call('contact_share_withdraw', {})
  }, [remote, acc, side, now, call])
  /** demo: the simulated other side agrees with sample details */
  const simAgree = useCallback(async () => {
    if (!remote) { localSet(acc, other(side), side === 'seeker' ? 'LINE: sample-employer (ตัวอย่าง)' : 'WeChat: sample-worker (ตัวอย่าง)', now()); setTick((x) => x + 1); return true }
    return call('contact_share_demo', {})
  }, [remote, acc, side, now, call])
  return { state: st, problem, agree, withdraw, simAgree }
}
