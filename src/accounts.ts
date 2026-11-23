// Switch accounts like Gmail (owner, 23 Nov 2026: "I test with several accounts, employer and worker, and have to type the e-mail
// every time"). Every account signed in on this browser is remembered here with its sign-in (the same session Supabase already
// keeps for the current account — never a password). Switching puts the chosen account's session where Supabase keeps its own and
// reloads the page, so every screen starts clean for that account. "Log out" ends the session on the server and forgets the
// account; "Remove from this device" only forgets it. Shared computers: the account menu says to log out every account.
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface SavedAccount {
  id: string; email: string; name: string; demo: boolean
  /** the role last seen for this account (employer / job seeker), to tell the accounts apart in the list */
  role: 'seeker' | 'employer' | null
  /** the Supabase session as Supabase stores it */
  session: Session
  /** last time it was used on this device */
  at: string
}
const KEY = 'call.accounts.v1', EVT = 'call-accounts'
/** at most this many remembered accounts (the oldest drops off) */
export const MAX_ACCOUNTS = 8
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** where Supabase keeps the current session: sb-<project ref>-auth-token (its default key) */
export const supabaseKey = (url: string | undefined) => {
  try { return url ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : null } catch { return null }
}

export function readAccounts(): SavedAccount[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((a): a is SavedAccount => isObj(a) && typeof a.id === 'string' && isObj(a.session) && typeof (a.session as Record<string, unknown>).refresh_token === 'string') : []
  } catch { return [] }
}
function write(list: SavedAccount[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ACCOUNTS))); window.dispatchEvent(new Event(EVT)) } catch { /* storage blocked: switching is not available */ }
}
/** the list after this account signed in or its session was renewed (newest first) */
export function withAccount(list: SavedAccount[], a: Omit<SavedAccount, 'role' | 'at'> & { role?: SavedAccount['role'] }, at: string): SavedAccount[] {
  const old = list.find((x) => x.id === a.id)
  const next: SavedAccount = { ...a, role: a.role ?? old?.role ?? null, at }
  return [next, ...list.filter((x) => x.id !== a.id)].slice(0, MAX_ACCOUNTS)
}
export function rememberAccount(a: Omit<SavedAccount, 'role' | 'at'>) { write(withAccount(readAccounts(), a, new Date().toISOString())) }
/** keep the name and role shown in the list up to date (the role is known once the profile has loaded) */
export function updateAccount(id: string, patch: Partial<Pick<SavedAccount, 'name' | 'role'>>) {
  const list = readAccounts(), a = list.find((x) => x.id === id)
  if (a && Object.entries(patch).some(([k, v]) => v !== undefined && a[k as keyof SavedAccount] !== v)) write(list.map((x) => (x.id === id ? { ...x, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } : x)))
}
export function forgetAccount(id: string) { write(readAccounts().filter((x) => x.id !== id)) }
export function forgetAllAccounts() { write([]) }

/** make the chosen account the current one and reload (false: not remembered or storage blocked) */
export function switchTo(id: string, url: string | undefined): boolean {
  const a = readAccounts().find((x) => x.id === id), key = supabaseKey(url)
  if (!a || !key) return false
  try { localStorage.setItem(key, JSON.stringify(a.session)); sessionStorage.setItem(SWITCHING, id) } catch { return false }
  window.location.assign('/')
  return true
}
const SWITCHING = 'call.accounts.switching'
/** after a switch: the account that was chosen (read once). If it came back signed out, its sign-in had ended (e.g. logged out
 *  on another device): it is forgotten, so the list does not offer it again. */
export function afterSwitch(signedIn: boolean) {
  try { const id = sessionStorage.getItem(SWITCHING); sessionStorage.removeItem(SWITCHING); if (id && !signedIn) forgetAccount(id) } catch { /* storage blocked */ }
}
/** sign in one more account: the current one stays remembered (its session is not ended), the page opens the sign-in form */
export function addAnother(url: string | undefined): boolean {
  const key = supabaseKey(url)
  if (!key) return false
  try { localStorage.removeItem(key) } catch { return false }
  window.location.assign('/login')
  return true
}

export function useAccounts(): SavedAccount[] {
  const [list, setList] = useState(readAccounts)
  useEffect(() => { const on = () => setList(readAccounts()); window.addEventListener(EVT, on); window.addEventListener('storage', on); return () => { window.removeEventListener(EVT, on); window.removeEventListener('storage', on) } }, [])
  return list
}
