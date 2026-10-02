import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { browserStorage, createPersistentRepo, type KV, type LoadStatus } from './domain/jobboard/persist'
import type { JobBoardRepo, Result } from './domain/jobboard/repo'

/**
 * One shared job-board repository for the whole app (/jobs and /employer), created once on first render (never at import time)
 * and saved to browser storage after successful changes. Components read through `repo` with their persona's actor and call
 * `mutate` for changes, which re-renders readers. Client-side demo only: not a backend and not a security boundary.
 */
interface Ctx {
  repo: JobBoardRepo
  /** increases after every successful change or reset; use it as a dependency when reading */
  version: number
  /** run one repository mutation; readers refresh only when it succeeded */
  mutate: <T>(fn: (repo: JobBoardRepo) => Result<T>) => Result<T>
  /** saved data was invalid and was replaced by the seed (shown once until dismissed) */
  recovered: boolean
  dismissRecovered: () => void
  /** restore the seed and remove only the saved job-board data */
  resetData: () => void
}
const C = createContext<Ctx | null>(null)

export function JobBoardProvider({ children, storage }: { children: ReactNode; storage?: KV | null }) {
  const [pr] = useState(() => createPersistentRepo(storage === undefined ? browserStorage() : storage))
  const [version, setVersion] = useState(0)
  const [status, setStatus] = useState<LoadStatus>(pr.status)
  const mutate = useCallback(<T,>(fn: (repo: JobBoardRepo) => Result<T>) => { const r = fn(pr.repo); if (r.ok) setVersion((v) => v + 1); return r }, [pr])
  const value = useMemo<Ctx>(() => ({
    repo: pr.repo, version, mutate, recovered: status === 'recovered',
    dismissRecovered: () => setStatus('restored'),
    resetData: () => { pr.reset(); setStatus('seed'); setVersion((v) => v + 1) },
  }), [pr, version, mutate, status])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useJobBoard = () => { const c = useContext(C); if (!c) throw new Error('jobboard'); return c }
