// What the end system keeps per case (v2 model, owner Nov 2026): check-ins, the secret word, the employer review and complaints
// filed through C.A.L.L. Signed in, it is kept in the database for the worker and the C.A.L.L. team only, never the employer
// (shared.ts, SQL 0014; the review reaches posts only as an anonymous total). The local demo and the offline kit keep it in the
// browser (localStorage 'call.aftercare.v1'); "Start again" on the demo clears its entry.
import { useCallback, useEffect, useState } from 'react'
import type { CheckIn, Complaint, EmployerReview } from './domain/match/aftercare'
import { useAuth } from './auth'
import { useMatch } from './matchData'
import { ME, MY_EMPLOYER } from './domain/match/types'
import { isUuid, useRemoteAftercare, useRemoteReviews, type SyncProblem } from './shared'

export interface Aftercare { checkins: CheckIn[]; secret?: string; review?: EmployerReview; complaints: Complaint[] }
const KEY = 'call.aftercare.v1'
const EVT = 'call-aftercare'
const empty = (): Aftercare => ({ checkins: [], complaints: [] })
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readAll(): Record<string, Aftercare> {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return isObj(v) ? (v as Record<string, Aftercare>) : {} } catch { return {} }
}
export const loadAftercare = (id: string): Aftercare => cleanAftercare(readAll()[id])
export function cleanAftercare(v: unknown): Aftercare {
  if (!isObj(v)) return empty()
  return {
    checkins: Array.isArray(v.checkins) ? (v.checkins as CheckIn[]).filter((c) => isObj(c) && typeof c.day === 'number') : [],
    complaints: Array.isArray(v.complaints) ? (v.complaints as Complaint[]).filter((c) => isObj(c) && typeof c.id === 'string') : [],
    ...(typeof v.secret === 'string' ? { secret: v.secret } : {}),
    ...(isObj(v.review) && typeof v.review.stars === 'number' ? { review: v.review as unknown as EmployerReview } : {}),
  }
}
export function saveAftercare(id: string, a: Aftercare): void {
  try { const all = readAll(); all[id] = a; localStorage.setItem(KEY, JSON.stringify(all)); window.dispatchEvent(new Event(EVT)) } catch { /* storage blocked: this visit still works */ }
}
export function clearAftercare(id: string): void {
  try { const all = readAll(); delete all[id]; localStorage.setItem(KEY, JSON.stringify(all)); window.dispatchEvent(new Event(EVT)) } catch { /* ignore */ }
}
/** every review kept on this device for one employer (the anonymous total on posts) */
export function reviewsFor(employerId: string): EmployerReview[] {
  return Object.values(readAll()).flatMap((a) => (isObj(a) && isObj(a.review) && a.review.employerId === employerId ? [a.review as unknown as EmployerReview] : []))
}

/** one case's aftercare. seekerId: the case's worker (ME = me) — signed in, the record is theirs in the database, which the team can
 *  also open; 'demo' and the local demo stay on this device */
export function useAftercare(id: string, seekerId: string = ME): [Aftercare, (next: Aftercare) => void, SyncProblem] {
  const { mode } = useMatch()
  const { user } = useAuth()
  const owner = seekerId === ME ? user?.id ?? null : seekerId
  const remote = mode === 'remote' && !!owner && isUuid(owner) && (id === 'nocase' || isUuid(id))
  const local = useLocalAftercare(id)
  const [ra, rsave, problem] = useRemoteAftercare<Aftercare>(remote ? owner : null, id, empty, cleanAftercare)
  return remote ? [ra, rsave, problem] : [local[0], local[1], null]
}
function useLocalAftercare(id: string): [Aftercare, (next: Aftercare) => void] {
  const [a, setA] = useState(() => loadAftercare(id))
  useEffect(() => {
    setA(loadAftercare(id))
    const on = () => setA(loadAftercare(id))
    window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on)
  }, [id])
  const save = useCallback((next: Aftercare) => { setA(next); saveAftercare(id, next) }, [id])
  return [a, save]
}
/** the reviews behind an employer's anonymous total: from the database when signed in (MY_EMPLOYER = me), this device otherwise */
export function useReviews(employerId: string): EmployerReview[] {
  const { mode } = useMatch()
  const { user } = useAuth()
  const uid = employerId === MY_EMPLOYER ? user?.id ?? null : employerId
  const remote = mode === 'remote' && isUuid(uid)
  const local = useLocalReviews(employerId)
  const rs = useRemoteReviews(remote ? uid : null)
  return remote ? rs : local
}
function useLocalReviews(employerId: string): EmployerReview[] {
  const [rs, setRs] = useState(() => reviewsFor(employerId))
  useEffect(() => { setRs(reviewsFor(employerId)); const on = () => setRs(reviewsFor(employerId)); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [employerId])
  return rs
}
