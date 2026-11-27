// The employer's review of the worker after 30 days (owner's blueprint, 27 Nov 2026: "close the job, both sides review"). In the
// local demo it is kept in this browser (localStorage 'call.workerReview.v1', by case); signed in, in the database (SQL 0018:
// worker_reviews, written only through worker_review_save by the employer of the case, read by the two people of the case and
// the team; later employers get only the anonymous total through worker_reviews_of).
import { useCallback, useEffect, useState } from 'react'
import { getClient, useAuth } from './auth'
import { useMatch } from './matchData'
import { ME } from './domain/match/types'
import { isUuid, type SyncProblem } from './shared'
import { WORKER_BAD, WORKER_GOOD, type WorkerReview } from './domain/match/aftercare'

const KEY = 'call.workerReview.v1', EVT = 'call-worker-review'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** only well-formed reviews (stored here or returned by the database) */
export function cleanWorkerReview(v: unknown): WorkerReview | undefined {
  if (!isObj(v) || typeof v.stars !== 'number' || v.stars < 1 || v.stars > 5 || typeof v.at !== 'string') return undefined
  const pick = (xs: unknown, all: readonly string[]) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === 'string' && all.includes(x)) : [])
  return { seekerId: typeof v.seekerId === 'string' ? v.seekerId : ME, at: v.at, stars: Math.round(v.stars), good: pick(v.good, WORKER_GOOD), bad: pick(v.bad, WORKER_BAD) }
}
function readAll(): Record<string, WorkerReview> {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return isObj(v) ? (v as Record<string, WorkerReview>) : {} } catch { return {} }
}
function useLocalTick() {
  const [n, setN] = useState(0)
  useEffect(() => { const on = () => setN((x) => x + 1); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [])
  return n
}
export function clearWorkerReview(caseKey: string) {
  try { const all = readAll(); delete all[caseKey]; localStorage.setItem(KEY, JSON.stringify(all)); window.dispatchEvent(new Event(EVT)) } catch { /* ignore */ }
}

/** the review given on one case, and how to give it */
export function useWorkerReview(caseKey: string): [WorkerReview | undefined, (r: WorkerReview) => void, SyncProblem] {
  const { mode } = useMatch()
  const remote = mode === 'remote' && isUuid(caseKey)
  const tick = useLocalTick()
  const [row, setRow] = useState<WorkerReview | undefined>(undefined)
  const [problem, setProblem] = useState<SyncProblem>(null)
  const load = useCallback(async () => {
    if (!remote) return
    try {
      const sb = await getClient()
      const { data, error } = await sb.from('worker_reviews').select('seeker_id, stars, good, bad, at').eq('case_id', caseKey).maybeSingle()
      if (error) throw error
      setRow(data ? cleanWorkerReview({ ...data, seekerId: (data as { seeker_id: string }).seeker_id }) : undefined); setProblem(null)
    } catch (e) { setProblem(/PGRST20[245]|42P01|42883|does not exist|schema cache/i.test(String((e as { code?: string; message?: string })?.code ?? '') + ' ' + String((e as Error)?.message ?? '')) ? 'dbOld' : 'network') }
  }, [remote, caseKey])
  useEffect(() => { void load() }, [load])
  const save = useCallback((r: WorkerReview) => {
    if (!remote) { try { const all = readAll(); all[caseKey] = r; localStorage.setItem(KEY, JSON.stringify(all)); window.dispatchEvent(new Event(EVT)) } catch { /* storage blocked */ } return }
    void (async () => {
      try {
        const sb = await getClient()
        const { error } = await sb.rpc('worker_review_save', { p_case: caseKey, p_stars: r.stars, p_good: r.good, p_bad: r.bad })
        if (error) throw error
        await load()
      } catch (e) { if (/bad_state/.test(String((e as Error)?.message ?? ''))) { setProblem('notYet' as SyncProblem); return } setProblem(/PGRST20[245]|42P01|42883|does not exist|schema cache/i.test(String((e as Error)?.message ?? '')) ? 'dbOld' : 'network') }
    })()
  }, [remote, caseKey, load])
  void tick
  return [remote ? row : cleanWorkerReview(readAll()[caseKey]), save, remote ? problem : null]
}

/** every review a worker has received: what later employers see as an anonymous total */
export function useWorkerReviews(seekerId: string): WorkerReview[] {
  const { mode } = useMatch()
  const { user } = useAuth()
  const uid = seekerId === ME ? user?.id ?? null : seekerId
  const remote = mode === 'remote' && isUuid(uid)
  const tick = useLocalTick()
  const [rs, setRs] = useState<WorkerReview[]>([])
  useEffect(() => {
    if (!remote) return
    let alive = true
    void getClient().then(async (sb) => {
      const { data } = await sb.rpc('worker_reviews_of', { p_seeker: uid })
      if (alive && Array.isArray(data)) setRs(data.map((r) => cleanWorkerReview({ ...r, seekerId }) as WorkerReview).filter(Boolean))
    }).catch(() => undefined)
    return () => { alive = false }
  }, [remote, uid, seekerId])
  void tick
  return remote ? rs : Object.values(readAll()).map(cleanWorkerReview).filter((r): r is WorkerReview => !!r && r.seekerId === seekerId)
}
