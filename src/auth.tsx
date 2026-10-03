import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

/*
 * Sign-in with Google through Supabase Auth (owner, Oct 2026). The browser only ever holds the public "anon" key; what each
 * person may read is enforced in the database (row level security, see supabase/migrations). Administrators are the accounts
 * whose profile row has role = 'admin' — set in the database by the owner, never from the browser.
 * When Supabase is not configured (no env vars) or cannot be reached, the rest of the site keeps working without sign-in.
 * The Supabase library is loaded only when configured, so the site stays light without it.
 */

export type AuthStatus = 'off' | 'loading' | 'signedOut' | 'signedIn'
export interface AuthUser { id: string; email: string; name: string; avatar: string | null }
interface Ctx {
  status: AuthStatus
  user: AuthUser | null
  isAdmin: boolean
  /** a sign-in or sign-out step failed (e.g. the service is paused): show "not available right now" */
  failed: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /** deletes the signed-in account and its profile (PDPA: right to erasure) */
  deleteAccount: () => Promise<boolean>
}

const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
/** only a real Supabase project URL and a key-shaped value turn sign-in on */
export const isConfigured = (url: unknown, key: unknown): url is string =>
  typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && typeof key === 'string' && key.length > 20

let clientP: Promise<SupabaseClient> | null = null
const getClient = () => (clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
  createClient(ENV_URL!, ENV_KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })))

/** name and picture as Google sends them; nothing else is read */
export function toUser(s: Session | null): AuthUser | null {
  const u = s?.user; if (!u) return null
  const m = (u.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
  const avatar = str(m.avatar_url) || str(m.picture)
  return { id: u.id, email: u.email ?? '', name: str(m.full_name) || str(m.name) || (u.email ?? '').split('@')[0], avatar: /^https:\/\//.test(avatar) ? avatar : null }
}

/** after the Google round trip the URL carries ?code=… (or an error); keep the address clean once it has been read */
const cleanUrl = () => {
  const q = new URLSearchParams(window.location.search)
  let changed = false
  for (const k of ['code', 'error', 'error_code', 'error_description', 'state']) if (q.has(k)) { q.delete(k); changed = true }
  const qs = q.toString()
  if (changed) window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
}

/** is the auth service up? (a paused free project does not answer) — 5 s at most */
async function reachable(): Promise<boolean> {
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 5000)
    const r = await fetch(`${ENV_URL}/auth/v1/health`, { headers: { apikey: ENV_KEY! }, signal: ctl.signal })
    clearTimeout(tm); return r.ok
  } catch { return false }
}

const C = createContext<Ctx | null>(null)
/** for tests: render any sign-in state without a network */
export const AuthContext = C
export type AuthCtx = Ctx

export function AuthProvider({ children, enabled = isConfigured(ENV_URL, ENV_KEY) }: { children: ReactNode; enabled?: boolean }) {
  const [status, setStatus] = useState<AuthStatus>(enabled ? 'loading' : 'off')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAdmin, setAdmin] = useState(false)
  const [failed, setFailed] = useState(false)
  const alive = useRef(true)

  // role comes from the user's own profile row (row level security lets a user read only their own row)
  const loadRole = useCallback(async (u: AuthUser | null) => {
    if (!u) { setAdmin(false); return }
    try {
      const sb = await getClient()
      const { data } = await sb.from('profiles').select('role').eq('id', u.id).maybeSingle()
      if (alive.current) setAdmin(data?.role === 'admin')
    } catch { if (alive.current) setAdmin(false) }
  }, [])

  useEffect(() => {
    alive.current = true
    if (!enabled) return
    let unsub: (() => void) | undefined
    getClient().then(async (sb) => {
      const apply = (s: Session | null) => { if (!alive.current) return; const u = toUser(s); setUser(u); setStatus(u ? 'signedIn' : 'signedOut'); void loadRole(u) }
      const { data } = await sb.auth.getSession()
      apply(data.session); cleanUrl()
      unsub = sb.auth.onAuthStateChange((_e, s) => apply(s)).data.subscription.unsubscribe
    }).catch(() => { if (alive.current) { setStatus('signedOut'); setFailed(true) } })
    return () => { alive.current = false; unsub?.() }
  }, [enabled, loadRole])

  const value = useMemo<Ctx>(() => ({
    status, user, isAdmin, failed,
    signIn: async () => {
      setFailed(false)
      if (!enabled || !(await reachable())) { setFailed(true); return }
      try {
        const sb = await getClient()
        const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } })
        if (error) setFailed(true)
      } catch { setFailed(true) }
    },
    signOut: async () => {
      // sign out everywhere; if the service cannot be reached, at least forget the session on this device
      try { const sb = await getClient(); const { error } = await sb.auth.signOut(); if (error) await sb.auth.signOut({ scope: 'local' }) } catch { try { const sb = await getClient(); await sb.auth.signOut({ scope: 'local' }) } catch { /* nothing stored */ } }
      setUser(null); setAdmin(false); setStatus(enabled ? 'signedOut' : 'off')
    },
    deleteAccount: async () => {
      try {
        const sb = await getClient()
        const { error } = await sb.rpc('delete_my_account')
        if (error) return false
        await sb.auth.signOut(); setUser(null); setAdmin(false); setStatus('signedOut'); return true
      } catch { return false }
    },
  }), [status, user, isAdmin, failed, enabled])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useAuth = () => { const c = useContext(C); if (!c) throw new Error('auth'); return c }
