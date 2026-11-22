// What the end system keeps per case on this device (v2 model, owner Nov 2026): check-ins, the secret word, the employer review and
// complaints filed through C.A.L.L. Prototype only: kept in the browser (localStorage 'call.aftercare.v1'); in the real service these
// would live with the C.A.L.L. team, never with the employer. "Start again" on the demo clears its entry.
import { useCallback, useEffect, useState } from 'react'
import type { CheckIn, Complaint, EmployerReview } from './domain/match/aftercare'

export interface Aftercare { checkins: CheckIn[]; secret?: string; review?: EmployerReview; complaints: Complaint[] }
const KEY = 'call.aftercare.v1'
const EVT = 'call-aftercare'
const empty = (): Aftercare => ({ checkins: [], complaints: [] })
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readAll(): Record<string, Aftercare> {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return isObj(v) ? (v as Record<string, Aftercare>) : {} } catch { return {} }
}
export function loadAftercare(id: string): Aftercare {
  const v = readAll()[id]
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

/** one case's aftercare, kept in step with other parts of the page that change it */
export function useAftercare(id: string): [Aftercare, (next: Aftercare) => void] {
  const [a, setA] = useState(() => loadAftercare(id))
  useEffect(() => {
    setA(loadAftercare(id))
    const on = () => setA(loadAftercare(id))
    window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on)
  }, [id])
  const save = useCallback((next: Aftercare) => { setA(next); saveAftercare(id, next) }, [id])
  return [a, save]
}
export function useReviews(employerId: string): EmployerReview[] {
  const [rs, setRs] = useState(() => reviewsFor(employerId))
  useEffect(() => { setRs(reviewsFor(employerId)); const on = () => setRs(reviewsFor(employerId)); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [employerId])
  return rs
}
