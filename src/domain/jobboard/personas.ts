/**
 * Simulated personas for the job-board PoC (pure; no React). The list is derived from SEED_PERSONAS, never duplicated.
 *
 * Choosing a persona is a demo convenience, not a login: it proves nothing about who the user is, and the client-side
 * policy it feeds is not a security boundary (see policy.ts).
 */
import { JOBBOARD_SEED, SEED_PERSONAS } from '../../data/seed/jobboard'
import type { Actor, ActorKind } from './types'

export type PersonaKey = string
export interface Persona { key: PersonaKey; actor: Actor; kind: ActorKind; /** invented name from the seed record, without the "(Synthetic)" suffix; '' for visitor and admin */ name: string }

/** Stable key for an actor: 'visitor', 'worker:wkr_0001', 'employer:org_0001', 'admin:adm_0001'. */
export function personaKey(a: Actor): PersonaKey {
  switch (a.kind) {
    case 'visitor': return 'visitor'
    case 'worker': return `worker:${a.workerId}`
    case 'employer': return `employer:${a.organizationId}`
    case 'admin': return `admin:${a.adminId}`
  }
}
/** Seed names end in "(Synthetic)"; the UI shows a localized "fictional" tag instead. */
export const stripSynthetic = (s: string) => s.replace(/\s*\(Synthetic\)$/, '')
const strip = stripSynthetic
function nameOf(a: Actor): string {
  if (a.kind === 'worker') return strip(JOBBOARD_SEED.workers.find((w) => w.id === a.workerId)?.displayName ?? '')
  if (a.kind === 'employer') return strip(JOBBOARD_SEED.organizations.find((o) => o.id === a.organizationId)?.name ?? '')
  return ''
}

export const PERSONAS: readonly Persona[] = SEED_PERSONAS.map(({ actor }) => ({ key: personaKey(actor), actor, kind: actor.kind, name: nameOf(actor) }))
export const DEFAULT_PERSONA_KEY: PersonaKey = 'visitor'
const DEFAULT = PERSONAS.find((p) => p.key === DEFAULT_PERSONA_KEY)!

/** The persona for a key, or null for anything unknown or malformed (never throws). */
export const resolvePersona = (key: unknown): Persona | null => (typeof key === 'string' ? PERSONAS.find((p) => p.key === key) ?? null : null)

export interface PersonaState { key: PersonaKey; /** true when the last selection was refused because the key was unknown */ invalid: boolean }
export type PersonaAction = { type: 'select'; key: unknown } | { type: 'reset' }
export const initialPersonaState = (key?: unknown): PersonaState => ({ key: resolvePersona(key)?.key ?? DEFAULT_PERSONA_KEY, invalid: false })
/** An unknown key keeps the current persona (and flags it), so a bad value can never select something unexpected. */
export function personaReducer(s: PersonaState, a: PersonaAction): PersonaState {
  if (a.type === 'reset') return { key: DEFAULT_PERSONA_KEY, invalid: false }
  const p = resolvePersona(a.key)
  return p ? { key: p.key, invalid: false } : { ...s, invalid: true }
}
export const currentPersona = (s: PersonaState): Persona => resolvePersona(s.key) ?? DEFAULT

/**
 * Lobby entry points: the default persona of a role and the page it opens. Only Worker and Employer have entries;
 * nothing ever switches to Admin implicitly. Entering selects a persona only — it never creates or submits an application.
 */
export const ENTRIES = { worker: 'jobs', employer: 'employer' } as const
export type EntryKind = keyof typeof ENTRIES
export function entryFor(kind: EntryKind): { key: PersonaKey; route: string } {
  const p = PERSONAS.find((x) => x.kind === kind)!
  return { key: p.key, route: ENTRIES[kind] }
}
/**
 * Safe version for entry buttons: the role's default persona and page, or null when no persona of exactly that role exists
 * (then the caller must not navigate). Only 'worker' and 'employer' are entry roles; anything else (e.g. 'admin') gives null.
 */
export function resolveEntry(kind: unknown, personas: readonly Persona[] = PERSONAS): { key: PersonaKey; route: string } | null {
  if (kind !== 'worker' && kind !== 'employer') return null
  const p = personas.find((x) => x.kind === kind && x.actor.kind === kind)
  return p ? { key: p.key, route: ENTRIES[kind] } : null
}
