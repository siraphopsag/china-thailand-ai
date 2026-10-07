import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js'

/*
 * Accounts through Supabase Auth (owner, Oct 2026): e-mail + password (works everywhere, also in mainland China) and Google.
 * The browser only ever holds the public "anon" key; what each person may read or change is enforced in the database (row level
 * security, see supabase/migrations). Administrators are the accounts whose profile row has role = 'admin' — set in the database
 * by the owner, never from the browser.
 * Not configured (no env vars) → the site runs in its local demo mode without accounts. Configured but unreachable (e.g. the
 * free project is paused) → `online` is false and the site falls back to the local demo mode with a notice.
 * The Supabase library is loaded only when configured, so the site stays light without it.
 */

export type AuthStatus = 'off' | 'loading' | 'signedOut' | 'signedIn'
export interface AuthUser { id: string; email: string; name: string; avatar: string | null }
/** what an account action came back with; anything but 'ok' is shown as a message */
export type AuthResult = 'ok' | 'checkMail' | 'invalid' | 'unconfirmed' | 'exists' | 'weak' | 'email' | 'rate' | 'mailRate' | 'unavailable' | 'error'
interface Ctx {
  status: AuthStatus
  user: AuthUser | null
  isAdmin: boolean
  /** null while checking, false when the service cannot be reached (→ local demo mode) */
  online: boolean | null
  /** the visitor arrived from a "reset password" e-mail and may now set a new password */
  recovery: boolean
  signInGoogle: () => Promise<AuthResult>
  signInEmail: (email: string, password: string) => Promise<AuthResult>
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>
  sendReset: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  /** deletes the signed-in account and everything tied to it (PDPA: right to erasure) */
  deleteAccount: () => Promise<boolean>
}

/** values pasted into Vercel may carry spaces, quotes, a trailing slash or a path (e.g. /rest/v1): keep only the project address */
const unquote = (v: string) => v.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim()
export function tidyUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = unquote(v)
  try { const u = new URL(s); return u.protocol === 'https:' && !u.port && !u.username && /^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) ? `https://${u.hostname}` : s } catch { return s }
}
export const tidyKey = (v: unknown) => (typeof v === 'string' ? unquote(v).replace(/\s+/g, '') : undefined)
/** only a real Supabase project URL and a key-shaped value turn accounts on */
export const isConfigured = (url: unknown, key: unknown): url is string =>
  typeof url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && typeof key === 'string' && key.length > 20
/** values were entered but are not usable: the site says so instead of silently running the demo (the values are never shown) */
export const configProblem = (rawUrl: unknown, rawKey: unknown) =>
  Boolean((typeof rawUrl === 'string' && rawUrl.trim()) || (typeof rawKey === 'string' && rawKey.trim())) && !isConfigured(tidyUrl(rawUrl), tidyKey(rawKey))
const RAW_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const RAW_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const ENV_URL = tidyUrl(RAW_URL)
const ENV_KEY = tidyKey(RAW_KEY)
export const CONFIG_PROBLEM = configProblem(RAW_URL, RAW_KEY)

let clientP: Promise<SupabaseClient> | null = null
/** the shared Supabase client (loaded on first use); the data layer uses the same one, so it carries the signed-in session */
export const getClient = () => (clientP ??= import('@supabase/supabase-js').then(({ createClient }) =>
  createClient(ENV_URL!, ENV_KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })))

/** name and picture as Google / the sign-up form give them; nothing else is read */
export function toUser(s: Session | null): AuthUser | null {
  const u = s?.user; if (!u) return null
  const m = (u.user_metadata ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '')
  const avatar = str(m.avatar_url) || str(m.picture)
  return { id: u.id, email: u.email ?? '', name: str(m.full_name) || str(m.name) || (u.email ?? '').split('@')[0], avatar: /^https:\/\//.test(avatar) ? avatar : null }
}

/** Supabase error → a message we can show (never the raw text) */
export function authResult(e: Pick<AuthError, 'code' | 'status' | 'message'> | null | undefined): AuthResult {
  if (!e) return 'ok'
  const c = e.code ?? ''
  if (c === 'invalid_credentials') return 'invalid'
  if (c === 'email_not_confirmed') return 'unconfirmed'
  if (c === 'user_already_exists' || c === 'email_exists') return 'exists'
  if (c === 'weak_password') return 'weak'
  if (c === 'email_address_invalid' || c === 'validation_failed') return 'email'
  // too many e-mails sent (sign-up confirmations, password resets) vs too many sign-in tries: different waits
  if (c === 'over_email_send_rate_limit') return 'mailRate'
  if (c.includes('rate_limit') || e.status === 429) return 'rate'
  if (!e.status || e.status >= 500) return 'unavailable'
  return 'error'
}

/** after a sign-in round trip the URL carries ?code=… (or an error); keep the address clean once it has been read */
const cleanUrl = () => {
  const q = new URLSearchParams(window.location.search)
  if (q.has('error') || q.has('error_code')) { try { sessionStorage.setItem(ERR_KEY, '1'); sessionStorage.removeItem(NEXT_KEY) } catch { /* storage blocked */ } }
  let changed = false
  for (const k of ['code', 'error', 'error_code', 'error_description', 'state', 'type']) if (q.has(k)) { q.delete(k); changed = true }
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

/* where to go (and which role to set) once signed in — kept across the Google round trip */
const NEXT_KEY = 'call.auth.next'
/** without a role, a role already chosen for the same page is kept (choose a role → sign-in page → sign in) */
export function rememberNext(next: string, role?: 'seeker' | 'employer') {
  try {
    let keep: string | null = null
    if (!role) { const old = JSON.parse(sessionStorage.getItem(NEXT_KEY) ?? 'null') as { next?: unknown; role?: unknown } | null; if (old && old.next === next && (old.role === 'seeker' || old.role === 'employer')) keep = old.role }
    sessionStorage.setItem(NEXT_KEY, JSON.stringify({ next, role: role ?? keep }))
  } catch { /* storage blocked */ }
}
/** a Google sign-in that came back with an error (e.g. the person cancelled) — read once by the sign-in page */
const ERR_KEY = 'call.auth.error'
export function takeAuthError(): boolean { try { const v = sessionStorage.getItem(ERR_KEY); sessionStorage.removeItem(ERR_KEY); return v === '1' } catch { return false } }
export function takeNext(): { next: string; role: 'seeker' | 'employer' | null } | null {
  try {
    const raw = sessionStorage.getItem(NEXT_KEY); sessionStorage.removeItem(NEXT_KEY); if (!raw) return null
    const v = JSON.parse(raw) as { next?: unknown; role?: unknown }
    const next = typeof v.next === 'string' && /^[a-z-]*(\?[\w=&-]*)?$/.test(v.next) ? v.next : '' // in-site routes only
    const role = v.role === 'seeker' || v.role === 'employer' ? v.role : null
    return { next, role }
  } catch { return null }
}

const C = createContext<Ctx | null>(null)
/** for tests: render any sign-in state without a network */
export const AuthContext = C
export type AuthCtx = Ctx

export function AuthProvider({ children, enabled = isConfigured(ENV_URL, ENV_KEY) }: { children: ReactNode; enabled?: boolean }) {
  const [status, setStatus] = useState<AuthStatus>(enabled ? 'loading' : 'off')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAdmin, setAdmin] = useState(false)
  const [online, setOnline] = useState<boolean | null>(enabled ? null : false)
  const [recovery, setRecovery] = useState(false)
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
    // one slow answer must not keep the whole visit in demo mode: while unreachable, try again every 20 s
    let retry: number | undefined
    const check = () => void reachable().then((up) => {
      if (!alive.current) return
      setOnline(up)
      if (up) { if (retry) window.clearInterval(retry); retry = undefined } else if (!retry) retry = window.setInterval(check, 20_000)
    })
    check()
    getClient().then(async (sb) => {
      const apply = (s: Session | null) => { if (!alive.current) return; const u = toUser(s); setUser(u); setStatus(u ? 'signedIn' : 'signedOut'); void loadRole(u) }
      unsub = sb.auth.onAuthStateChange((e, s) => { if (e === 'PASSWORD_RECOVERY') setRecovery(true); apply(s) }).data.subscription.unsubscribe
      const { data } = await sb.auth.getSession()
      apply(data.session); cleanUrl()
    }).catch(() => { if (alive.current) { setStatus('signedOut'); setOnline(false) } })
    return () => { alive.current = false; unsub?.(); if (retry) window.clearInterval(retry) }
  }, [enabled, loadRole])

  const guard = useCallback(async (run: (sb: SupabaseClient) => Promise<AuthResult>): Promise<AuthResult> => {
    if (!enabled) return 'unavailable'
    try { return await run(await getClient()) } catch { return 'unavailable' }
  }, [enabled])

  const value = useMemo<Ctx>(() => ({
    status, user, isAdmin, online, recovery,
    signInGoogle: () => guard(async (sb) => {
      if (!(await reachable())) return 'unavailable'
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname, queryParams: { prompt: 'select_account' } } }) // always let people pick the Google account (owner, Oct 2026)
      return authResult(error)
    }),
    signInEmail: (email, password) => guard(async (sb) => authResult((await sb.auth.signInWithPassword({ email: email.trim(), password })).error)),
    signUp: (name, email, password) => guard(async (sb) => {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } })
      if (error) return authResult(error)
      // with "Confirm email" off a session comes back at once; an empty identity list means the address is already registered
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return 'exists'
      // "Confirm email" still on in Supabase: the account exists but needs the link in the e-mail before it can sign in
      return data.session ? 'ok' : 'checkMail'
    }),
    sendReset: (email) => guard(async (sb) => authResult((await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` })).error)),
    updatePassword: (password) => guard(async (sb) => { const r = authResult((await sb.auth.updateUser({ password })).error); if (r === 'ok') setRecovery(false); return r }),
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
        await sb.auth.signOut({ scope: 'local' }); setUser(null); setAdmin(false); setStatus('signedOut'); return true
      } catch { return false }
    },
  }), [status, user, isAdmin, online, recovery, enabled, guard])
  return <C.Provider value={value}>{children}</C.Provider>
}
export const useAuth = () => { const c = useContext(C); if (!c) throw new Error('auth'); return c }
