// The employer's shop or company and the job seeker's work history (owner's blueprint, 27 Nov 2026). In the local demo they are kept
// in this browser; signed in, on the person's own profile (SQL 0019: profiles.business / profiles.work). Others read them only
// through employer_about (anyone signed in: it is the business' public description) and applicant_work (an employer, for people
// who applied to their posts; the team).
import { useCallback, useEffect, useState } from 'react'
import { getClient, useAuth } from './auth'
import { useMatch } from './matchData'
import { ME, MY_EMPLOYER } from './domain/match/types'
import { isUuid, type SyncProblem } from './shared'
import { cleanBusiness, cleanWork, emptyBusiness, emptyWork, type Business, type Work } from './domain/profileExtra'

const KEYS = { business: 'call.business.v1', work: 'call.work.v1' } as const
const EVT = 'call-profile-extra'
type Kind = keyof typeof KEYS
const read = (k: Kind): unknown => { try { return JSON.parse(localStorage.getItem(KEYS[k]) ?? 'null') } catch { return null } }
const write = (k: Kind, v: unknown) => { try { localStorage.setItem(KEYS[k], JSON.stringify(v)); window.dispatchEvent(new Event(EVT)) } catch { /* storage blocked */ } }
const dbOld = (e: unknown) => /PGRST20[245]|42P01|42883|42703|does not exist|schema cache/i.test(`${(e as { code?: string })?.code ?? ''} ${(e as Error)?.message ?? ''}`)
function useTick() {
  const [n, setN] = useState(0)
  useEffect(() => { const on = () => setN((x) => x + 1); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [])
  return n
}

/** my own business profile or work history, and how to save it */
function useMine<T>(k: Kind, clean: (v: unknown) => T): [T, (v: T) => Promise<SyncProblem>, SyncProblem] {
  const { mode } = useMatch()
  const { user } = useAuth()
  const uid = user?.id ?? null
  const remote = mode === 'remote' && isUuid(uid)
  const tick = useTick()
  const [row, setRow] = useState<T>(() => clean(null))
  const [problem, setProblem] = useState<SyncProblem>(null)
  useEffect(() => {
    if (!remote) return
    let alive = true
    void (async () => {
      try {
        const sb = await getClient()
        const { data, error } = await sb.from('profiles').select(k).eq('id', uid!).maybeSingle()
        if (error) throw error
        if (alive) { setRow(clean((data as Record<string, unknown> | null)?.[k])); setProblem(null) }
      } catch (e) { if (alive) setProblem(dbOld(e) ? 'dbOld' : 'network') }
    })()
    return () => { alive = false }
  }, [remote, uid, k, clean, tick])
  const save = useCallback(async (v: T): Promise<SyncProblem> => {
    if (!remote) { write(k, v); return null }
    try {
      const sb = await getClient()
      const { error } = await sb.from('profiles').update({ [k]: v }).eq('id', uid!)
      if (error) throw error
      setRow(v); window.dispatchEvent(new Event(EVT)); setProblem(null); return null
    } catch (e) { const p: SyncProblem = dbOld(e) ? 'dbOld' : 'network'; setProblem(p); return p }
  }, [remote, uid, k])
  return [remote ? row : clean(read(k)), save, remote ? problem : null]
}
export const useMyBusiness = () => useMine<Business>('business', cleanBusiness)
export const useMyWork = () => useMine<Work>('work', cleanWork)

/** someone else's profile through the database function that decides who may read it (my own in the local demo) */
function useOther<T>(id: string, mine: string, fn: string, arg: string, k: Kind, clean: (v: unknown) => T, empty: () => T): T {
  const { mode } = useMatch()
  const { user } = useAuth()
  const uid = id === mine ? user?.id ?? null : id
  const remote = mode === 'remote' && isUuid(uid)
  const tick = useTick()
  const [v, setV] = useState<T>(empty)
  useEffect(() => {
    if (!remote) return
    let alive = true
    void getClient().then(async (sb) => {
      const { data } = await sb.rpc(fn, { [arg]: uid })
      if (alive) setV(clean(data))
    }).catch(() => undefined)
    return () => { alive = false }
  }, [remote, uid, fn, arg, clean, tick])
  if (remote) return v
  return id === mine ? clean(read(k)) : empty()
}
export const useEmployerAbout = (employerId: string) => useOther<Business>(employerId, MY_EMPLOYER, 'employer_about', 'p_employer', 'business', cleanBusiness, emptyBusiness)
export const useApplicantWork = (seekerId: string) => useOther<Work>(seekerId, ME, 'applicant_work', 'p_seeker', 'work', cleanWork, emptyWork)
