import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { go } from './store'
import { PERSONAS, currentPersona, initialPersonaState, personaReducer, resolveEntry, type EntryKind, type Persona } from './domain/jobboard/personas'
import type { Actor } from './domain/jobboard/types'

/**
 * Shared simulated persona for the job-board PoC. Kept in React state for the session only (not saved), so a reload
 * returns to Visitor and no persona choice is ever stored as if it were a permission. Not authentication.
 */
interface Ctx {
  actor: Actor
  persona: Persona
  personas: readonly Persona[]
  /** true when the last selection was refused (unknown key) */
  invalid: boolean
  /** select by persona key; unknown keys are ignored and return false */
  select: (key: unknown) => boolean
  reset: () => void
  /** Entry choice: select the role's default persona and open its page (never submits anything). false = no matching persona, nothing changed */
  enter: (kind: EntryKind) => boolean
}
const C = createContext<Ctx | null>(null)

export function PersonaProvider({ children, initialKey }: { children: ReactNode; initialKey?: string }) {
  const [s, dispatch] = useReducer(personaReducer, initialKey, initialPersonaState)
  const value = useMemo<Ctx>(() => {
    const persona = currentPersona(s)
    return {
      actor: persona.actor, persona, personas: PERSONAS, invalid: s.invalid,
      select: (key) => { dispatch({ type: 'select', key }); return PERSONAS.some((p) => p.key === key) },
      reset: () => dispatch({ type: 'reset' }),
      enter: (kind) => {
        const e = resolveEntry(kind)
        if (!e) return false // never open a role's page without that role's persona
        dispatch({ type: 'select', key: e.key }); go(e.route)
        return true
      },
    }
  }, [s])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const usePersona = () => { const c = useContext(C); if (!c) throw new Error('persona'); return c }
