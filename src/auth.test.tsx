// Google sign-in through Supabase (owner, Oct 2026): states of the header button, the admin gate, the database rules,
// the keep-alive and the security header. No network here: each state is rendered through AuthContext.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Session } from '@supabase/supabase-js'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { seedState } from './domain/match/seed'
import { AuthContext, AuthProvider, isConfigured, toUser, type AuthCtx } from './auth'
import { LoginButton } from './components/sidenav'
import { BackofficePage, MePage } from './pages/match'
import type { MsgKey } from './locales/index'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
const noop = async () => {}
const state = (o: Partial<AuthCtx>): AuthCtx => ({ status: 'signedOut', user: null, isAdmin: false, failed: false, signIn: noop, signOut: noop, deleteAccount: async () => true, ...o })
const ann: AuthCtx['user'] = { id: 'u1', email: 'ann@example.com', name: 'Ann Example', avatar: null }
const html = (node: ReactNode, auth?: AuthCtx) => {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  const inner = <MatchProvider initial={seedState()}>{node}</MatchProvider>
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider>{auth ? <AuthContext.Provider value={auth}>{inner}</AuthContext.Provider> : <AuthProvider enabled={false}>{inner}</AuthProvider>}</LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}

describe('configuration', () => {
  it('sign-in turns on only with a real Supabase project URL and a key; otherwise the site works without it', () => {
    expect(isConfigured('https://abcdefghijklmnop.supabase.co', 'x'.repeat(40))).toBe(true)
    for (const [u, k] of [[undefined, undefined], ['', ''], ['http://abcdefgh.supabase.co', 'x'.repeat(40)], ['https://evil.example.com', 'x'.repeat(40)], ['https://abc.supabase.co', 'short']]) expect(isConfigured(u, k), String(u)).toBe(false)
    expect(html(<LoginButton />)).toBe('') // not configured → no button at all
  })
  it('the Supabase library is loaded only when sign-in is configured (keeps the site light)', () => {
    const a = src('./auth.tsx')
    expect(a).toContain("import('@supabase/supabase-js')")
    expect(a).not.toMatch(/^import \{[^}]*\} from '@supabase\/supabase-js'/m) // types only, never a static import of the code
    expect(a).toContain("flowType: 'pkce'")
  })
  it('only the name, e-mail and an https picture link are taken from Google', () => {
    const s = { user: { id: 'u1', email: 'ann@example.com', user_metadata: { full_name: ' Ann Example ', avatar_url: 'javascript:alert(1)', phone: '0812345678' } } } as unknown as Session
    expect(toUser(s)).toEqual({ id: 'u1', email: 'ann@example.com', name: 'Ann Example', avatar: null })
    expect(toUser({ user: { id: 'u2', email: 'bo@example.com', user_metadata: { picture: 'https://lh3.googleusercontent.com/a/x' } } } as unknown as Session))
      .toEqual({ id: 'u2', email: 'bo@example.com', name: 'bo', avatar: 'https://lh3.googleusercontent.com/a/x' })
    expect(toUser(null)).toBeNull()
  })
})

describe('header account control', () => {
  it('signed out: "Log in" opens a notice of what is kept (PDPA), with the privacy link and the China caveat', () => {
    const h = html(<LoginButton />, state({}))
    expect(h).toContain(T('m.login'))
    expect(src('./components/sidenav.tsx')).toMatch(/<h2 id=\{id\} className="h2">\{t\('m\.auth\.google'\)\}<\/h2>\s*<p className="text-sm">\{t\('m\.auth\.d'\)\}<\/p>/)
    for (const k of ['m.auth.d', 'm.auth.china', 'm.auth.privacy', 'm.auth.fail'] as const) expect(src('./components/sidenav.tsx'), k).toContain(`t('${k}')`)
    expect(tr('m.auth.d', undefined, 'th')).toMatch(/ชื่อ.*อีเมล.*รูปโปรไฟล์/)
  })
  it('loading: a quiet placeholder of the same size (no jump when the session comes back)', () => {
    expect(html(<LoginButton />, state({ status: 'loading' }))).toContain('h-10 w-10 rounded-full')
  })
  it('signed in: the picture/initial opens a menu with name, e-mail, profile and log out; back office only for administrators', () => {
    const u = html(<LoginButton />, state({ status: 'signedIn', user: ann }))
    expect(u).toContain(`aria-label="${T('m.auth.menu', { name: 'Ann Example' })}"`)
    expect(u).toContain('ann@example.com'); expect(u).toContain(T('m.logout')); expect(u).toContain('href="/me"')
    expect(u).not.toContain('href="/backoffice"')
    const a = html(<LoginButton />, state({ status: 'signedIn', user: ann, isAdmin: true }))
    expect(a).toContain('href="/backoffice"'); expect(a).toContain(T('m.auth.admin'))
  })
})

describe('administrators come from the database, not from the browser', () => {
  it('the back office opens only for an administrator account', () => {
    expect(html(<BackofficePage />, state({ status: 'signedIn', user: ann }))).toContain(T('m.adm.gate'))
    expect(html(<BackofficePage />, state({ status: 'signedIn', user: ann, isAdmin: true }))).not.toContain(T('m.adm.gate'))
  })
  it('the old prototype password is gone from the code', () => {
    for (const f of ['./matchData.tsx', './components/sidenav.tsx', './auth.tsx', './pages/match.tsx']) { const s = src(f); expect(s, f).not.toContain('AdminCALL'); expect(s, f).not.toContain('password') }
  })
  it('profile: who is signed in and "delete my account"; nothing when sign-in is not set up', () => {
    const p = html(<MePage />, state({ status: 'signedIn', user: ann }))
    expect(p).toContain(T('m.auth.account')); expect(p).toContain('Ann Example'); expect(p).toContain(T('m.auth.delete'))
    expect(html(<MePage />)).not.toContain('id="account-h"')
  })
})

describe('database rules (supabase/migrations/0001_profiles.sql)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0001_profiles.sql', import.meta.url), 'utf8')
  it('row level security on; a person reads only their own row; administrators read all; nobody writes from the website', () => {
    expect(sql).toContain('alter table public.profiles enable row level security;')
    expect(sql).toMatch(/create policy "read own profile" on public\.profiles\s+for select to authenticated\s+using \(id = auth\.uid\(\)\);/)
    expect(sql).toMatch(/create policy "admins read all profiles" on public\.profiles\s+for select to authenticated\s+using \(public\.is_admin\(\)\);/)
    expect(sql).not.toMatch(/create policy[^;]*for (insert|update|delete|all)/i)
    expect(sql).toContain("role text not null default 'user' check (role in ('user', 'admin'))")
  })
  it('security-definer functions pin their search path; account deletion is for signed-in people only; the ping reveals nothing', () => {
    for (const m of sql.matchAll(/create or replace function public\.(\w+)\(\)[^$]*?security definer\s+set search_path = ''/g)) expect(['is_admin', 'handle_user_sign_in', 'delete_my_account']).toContain(m[1])
    expect((sql.match(/^security definer$/gm) || []).length).toBe(3)
    expect(sql).toContain('revoke all on function public.delete_my_account() from public, anon;')
    expect(sql).toMatch(/create or replace function public\.ping\(\)\s+returns timestamptz[^$]*\$\$\s+select now\(\);\s+\$\$;/)
  })
})

describe('keep-alive and security header', () => {
  it('the free project is pinged twice a day so it does not pause while the judges review; no secrets → no-op', () => {
    const w = src('../.github/workflows/supabase-keepalive.yml')
    expect(w).toContain("cron: '23 1,13 * * *'")
    expect(w).toContain('$SUPABASE_URL/rest/v1/rpc/ping')
    expect(w).toContain('secrets.SUPABASE_ANON_KEY'); expect(w).not.toMatch(/service_role/i)
    expect(w).toContain('nothing to ping.')
    expect(w).toContain('permissions: {}')
  })
  it('the browser may talk to Supabase and show Google profile pictures — nothing else is added', () => {
    const v = JSON.parse(src('../vercel.json')) as { headers: { headers: { key: string; value: string }[] }[] }
    const csp = v.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')!.value
    expect(csp).toContain("connect-src 'self' https://*.supabase.co;")
    expect(csp).toContain("img-src 'self' data: https://*.googleusercontent.com;")
    expect(csp).toContain("script-src 'self';")
  })
})
