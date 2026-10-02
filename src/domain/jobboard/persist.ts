/**
 * Browser persistence for the job-board PoC: wraps the repository so that every SUCCESSFUL mutation saves the synthetic snapshot
 * under one namespaced key. Failed operations save nothing. Stored data is validated on load (loadSnapshot → parseSnapshot) and
 * never trusted: anything invalid is discarded and the deterministic seed is used. Only this key is ever written or removed;
 * persona choice, other C.A.L.L. data and anything personal are never stored here.
 *
 * localStorage is user-editable, so this is persistence for a demo, not protection of any kind.
 */
import { createMemoryRepo, loadSnapshot, type JobBoardRepo } from './repo'

export const JOBBOARD_KEY = 'call.jobboard.poc.v1'
export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

/** window.localStorage when it exists and is usable; null otherwise (tests, builds, blocked storage). Call it lazily, never at import time. */
export function browserStorage(): KV | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null } catch { return null }
}

/** how the data was obtained at start: no saved data, saved data restored, or saved data rejected and replaced by the seed */
export type LoadStatus = 'seed' | 'restored' | 'recovered'
export interface PersistentRepo { repo: JobBoardRepo; status: LoadStatus; /** restore the seed and remove the saved job-board data (only this key) */ reset(): void }

const MUTATIONS = ['createJob', 'updateJob', 'submitJob', 'closeJob', 'requestVerification', 'reviewOrganization', 'reviewJob', 'updateWorker', 'submitApplication', 'transitionApplication'] as const satisfies readonly (keyof JobBoardRepo)[]

export function createPersistentRepo(storage: KV | null, opts: { now?: () => string } = {}): PersistentRepo {
  let text: string | null = null
  try { text = storage?.getItem(JOBBOARD_KEY) ?? null } catch { text = null }
  const loaded = loadSnapshot(text)
  const status: LoadStatus = text === null ? 'seed' : loaded.restored ? 'restored' : 'recovered'
  if (status === 'recovered') { try { storage?.removeItem(JOBBOARD_KEY) } catch { /* ignore */ } } // drop the rejected data so it is not re-read
  const inner = createMemoryRepo(loaded.snapshot, opts)
  const save = () => { try { storage?.setItem(JOBBOARD_KEY, JSON.stringify(inner.snapshot())) } catch { /* storage full or blocked: keep working in memory */ } }

  const repo = { ...inner } as JobBoardRepo
  for (const m of MUTATIONS) {
    const fn = inner[m] as (...a: unknown[]) => { ok: boolean }
    ;(repo as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => { const r = fn(...args); if (r.ok) save(); return r }
  }
  repo.reset = () => { inner.reset(); try { storage?.removeItem(JOBBOARD_KEY) } catch { /* ignore */ } }
  return { repo, status, reset: repo.reset }
}
