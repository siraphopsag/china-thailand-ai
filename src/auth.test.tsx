// Accounts (owner, Oct 2026): e-mail + password and Google through Supabase, sign-in pages, pages that need an account,
// administrators from the database, the database rules, the mapping to the app's data, keep-alive and the security header.
// No network here: each sign-in state is rendered through AuthContext.
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
import { AuthContext, AuthProvider, authResult, tidyKey, tidyUrl, configProblem, isConfigured, toUser, type AuthCtx } from './auth'
import { LoginButton } from './components/sidenav'
import { BackofficePage, MePage, NotificationsPage, SeekPage } from './pages/match'
import { HirePage } from './pages/hire'
import { PostPage } from './pages/post'
import { ForgotPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/auth'
import { buildState, dbProblem, postToInput, postToRow, rowToPost, type PostRow } from './domain/match/remote'
import { MY_EMPLOYER, ME } from './domain/match/types'
import type { MsgKey } from './locales/index'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
const ok = async () => 'ok' as const
const state = (o: Partial<AuthCtx>): AuthCtx => ({ status: 'signedOut', user: null, isAdmin: false, online: true, recovery: false,
  signInGoogle: ok, signInEmail: ok, signUp: ok, sendReset: ok, updatePassword: ok, signOut: async () => {}, deleteAccount: async () => true, ...o })
const ann: AuthCtx['user'] = { id: 'u1', email: 'ann@example.com', name: 'Ann Example', avatar: null }
/** local = the demo data (MatchProvider initial); otherwise the data mode follows the sign-in state */
const html = (node: ReactNode, auth?: AuthCtx, local = true) => {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  const inner = local ? <MatchProvider initial={seedState()}>{node}</MatchProvider> : <MatchProvider>{node}</MatchProvider>
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider>{auth ? <AuthContext.Provider value={auth}>{inner}</AuthContext.Provider> : <AuthProvider enabled={false}>{inner}</AuthProvider>}</LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}

describe('configuration', () => {
  it('accounts turn on only with a real Supabase project URL and a key; otherwise the site runs its local demo', () => {
    expect(isConfigured('https://abcdefghijklmnop.supabase.co', 'x'.repeat(40))).toBe(true)
    for (const [u, k] of [[undefined, undefined], ['', ''], ['http://abcdefgh.supabase.co', 'x'.repeat(40)], ['https://evil.example.com', 'x'.repeat(40)], ['https://abc.supabase.co', 'short']]) expect(isConfigured(u, k), String(u)).toBe(false)
    expect(html(<LoginButton />)).toBe('') // not configured → no button
    expect(html(<LoginButton />, state({ online: false }))).toBe('') // unreachable → no button (demo mode)
  })
  it('values pasted with spaces, quotes, a trailing slash or a path still work; other sites never do', () => {
    const ok = 'https://abcdefghijklmnop.supabase.co'
    for (const u of [ok, ` ${ok} `, `${ok}/`, `"${ok}"`, `'${ok}/'\n`, `${ok}/rest/v1/`, 'https://ABCDEFGHIJKLMNOP.supabase.co']) expect(tidyUrl(u), u).toBe(ok)
    for (const u of ['http://abcdefghijklmnop.supabase.co', 'https://evil.example.com/x.supabase.co', 'https://abc.supabase.co.evil.com', 'https://abc.supabase.co:8443', 'https://u@abc.supabase.co']) expect(isConfigured(tidyUrl(u), 'x'.repeat(40)), u).toBe(false)
    expect(tidyKey(' "sb_publishable_abc\n def" ')).toBe('sb_publishable_abcdef')
    expect(tidyUrl(undefined)).toBeUndefined()
  })
  it('entered but unusable values are reported (not set at all is not a problem)', () => {
    expect(configProblem(undefined, undefined)).toBe(false); expect(configProblem('  ', '')).toBe(false)
    expect(configProblem('https://abcdefghijklmnop.supabase.co/', 'x'.repeat(40))).toBe(false)
    expect(configProblem('abcdefghijklmnop', 'x'.repeat(40))).toBe(true); expect(configProblem('https://abcdefghijklmnop.supabase.co', '')).toBe(true)
    expect(src('./App.tsx')).toContain("const bad = status === 'off' && CONFIG_PROBLEM")
  })
  it('the Supabase library is loaded only when configured; PKCE flow', () => {
    const a = src('./auth.tsx')
    expect(a).toContain("import('@supabase/supabase-js')")
    expect(a).not.toMatch(/^import \{[^}]*\} from '@supabase\/supabase-js'/m)
    expect(a).toContain("flowType: 'pkce'")
  })
  it('only the name, e-mail and an https picture link are taken from the account', () => {
    const s = { user: { id: 'u1', email: 'ann@example.com', user_metadata: { full_name: ' Ann Example ', avatar_url: 'javascript:alert(1)', phone: '0812345678' } } } as unknown as Session
    expect(toUser(s)).toEqual({ id: 'u1', email: 'ann@example.com', name: 'Ann Example', avatar: null })
    expect(toUser(null)).toBeNull()
  })
  it('Supabase errors become messages we wrote (never the raw text)', () => {
    expect(authResult(null)).toBe('ok')
    expect(authResult({ code: 'invalid_credentials', status: 400, message: 'x' })).toBe('invalid')
    expect(authResult({ code: 'user_already_exists', status: 422, message: 'x' })).toBe('exists')
    expect(authResult({ code: 'weak_password', status: 422, message: 'x' })).toBe('weak')
    expect(authResult({ code: 'over_email_send_rate_limit', status: 429, message: 'x' })).toBe('mailRate') // e-mails: wait about an hour
    expect(authResult({ code: 'over_request_rate_limit', status: 429, message: 'x' })).toBe('rate') // sign-in tries: about 5 minutes
    expect(authResult({ code: '', status: 429, message: 'x' })).toBe('rate')
    expect(authResult({ code: 'email_not_confirmed', status: 400, message: 'x' })).toBe('unconfirmed') // not shown as a wrong password
    expect(tr('m.lg.err.mailRate', undefined, 'th')).toContain('1 ชั่วโมง'); expect(tr('m.lg.err.rate', undefined, 'th')).toContain('5 นาที')
    expect(authResult({ code: '', status: 0, message: 'Failed to fetch' })).toBe('unavailable')
  })
})

describe('sign-in pages (after the owner\'s reference: e-mail, password with an eye, forgot, one button, or Google, sign up)', () => {
  it('login: fields with icons, show/hide password, forgot link, Google, link to sign up', () => {
    const h = html(<LoginPage />, state({}))
    expect(h).toContain(T('m.lg.title')); expect(h).toMatch(/<input[^>]*id="lg-email"[^>]*>/); expect(h).toMatch(/<input[^>]*type="email"/)
    expect(h).toMatch(/id="lg-pw"[^>]*type="password"/)
    expect(h).toContain(`aria-label="${T('m.lg.show')}"`); expect(h).toContain('aria-pressed="false"')
    expect(h).toContain('href="/forgot"'); expect(h).toContain('href="/register"'); expect(h).toContain(T('m.auth.google')); expect(h).toContain(T('m.auth.china'))
  })
  it('sign up: name, e-mail, password twice, what is kept + consent with the privacy link', () => {
    const h = html(<RegisterPage />, state({}))
    for (const id of ['rg-name', 'rg-email', 'rg-pw', 'rg-pw2', 'rg-agree']) expect(h, id).toContain(`id="${id}"`)
    expect(h).toContain(T('m.auth.d')); expect(h).toContain('href="/privacy"'); expect(h).toContain(T('m.rg.pwHint'))
    // Confirm email still on: no session comes back → say so and show the address (a typo can be spotted), instead of doing nothing
    expect(src('./auth.tsx')).toContain("return data.session ? 'ok' : 'checkMail'")
    expect(src('./pages/auth.tsx')).toContain("if (r === 'checkMail') setSentTo(email.trim())")
    expect(tr('m.rg.checkMail', { email: 'a@gmai.com' }, 'th')).toContain('a@gmai.com')
  })
  it('forgot password answers the same whether or not the e-mail has an account; reset needs the e-mail link', () => {
    expect(src('./pages/auth.tsx')).toContain("if (r === 'ok' || r === 'invalid' || r === 'unconfirmed' || r === 'email') setSent(true)")
    expect(html(<ResetPasswordPage />, state({}))).toContain(T('m.rp.invalid'))
    expect(html(<ResetPasswordPage />, state({ recovery: true }))).toContain('id="rp-pw"')
    expect(html(<ForgotPage />, state({}))).toContain('id="fp-email"')
  })
  it('when accounts cannot be reached the pages say so instead of showing a form that cannot work', () => {
    for (const P of [LoginPage, RegisterPage, ForgotPage]) { const h = html(<P />, state({ online: false })); expect(h).toContain(T('m.auth.fail')); expect(h).not.toContain('type="password"') }
  })
})

describe('pages that need an account', () => {
  it('signed out (accounts working): posting, pins, notifications and the post page ask to sign in and come back afterwards', () => {
    const so = state({})
    for (const [P, here] of [[HirePage, 'hire'], [SeekPage, 'seek'], [NotificationsPage, 'notifications']] as const) {
      const h = html(<P />, so, false)
      expect(h, here).toContain(T('m.need.title')); expect(h).toContain(`href="/login?next=${here}"`); expect(h).toContain(`href="/register?next=${here}"`)
    }
    expect(html(<PostPage />, so, false)).toContain(T('m.need.title'))
  })
  it('while the session is being checked, pages wait instead of showing "choose a role"', () => {
    const h = html(<HirePage />, state({ status: 'loading', online: null }), false)
    expect(h).toContain(T('c.loading' as MsgKey)); expect(h).not.toContain(T('m.profile.none'))
  })
  it('choosing a role while signed out goes to sign-in first and applies the role right after', () => {
    expect(src('./pages/choose.tsx')).toContain("if (mode === 'signedOut' || mode === 'loading') { rememberNext(r.to, r.role); go(`login?next=${r.to}`); return }")
    expect(src('./matchData.tsx')).toContain("if (n.role) { try { const sb = await getClient(); await sb.from('profiles').update({ user_type: n.role }).eq('id', userId)")
  })
  it('accounts unreachable → the site keeps working on demo data, with a notice on every page', () => {
    expect(src('./matchData.tsx')).toContain(": auth.status === 'off' || auth.online === false ? 'local'")
    expect(src('./App.tsx')).toContain("if (!bad && (status === 'off' || online !== false)) return null")
    expect(tr('m.demo.banner', undefined, 'th')).toContain('โหมดสาธิต')
  })
})

describe('header account control', () => {
  it('signed out: "Log in" is a link to the sign-in page', () => {
    expect(html(<LoginButton />, state({}))).toMatch(/<a href="\/login"[^>]*>.*เข้าสู่ระบบ/)
  })
  it('signed in: the picture/initial opens a menu with name, e-mail, profile and log out; back office only for administrators', () => {
    const u = html(<LoginButton />, state({ status: 'signedIn', user: ann }))
    expect(u).toContain(`aria-label="${T('m.auth.menu', { name: 'Ann Example' })}"`)
    expect(u).toContain('ann@example.com'); expect(u).toContain(T('m.logout')); expect(u).not.toContain('href="/backoffice"')
    expect(html(<LoginButton />, state({ status: 'signedIn', user: ann, isAdmin: true }))).toContain('href="/backoffice"')
  })
})

describe('administrators come from the database, not from the browser', () => {
  it('the back office opens only for an administrator account', () => {
    expect(html(<BackofficePage />, state({ status: 'signedIn', user: ann }))).toContain(T('m.adm.gate'))
    expect(html(<BackofficePage />, state({ status: 'signedIn', user: ann, isAdmin: true }))).not.toContain(T('m.adm.gate'))
  })
  it('the old prototype password is gone from the code', () => {
    for (const f of ['./matchData.tsx', './components/sidenav.tsx', './auth.tsx', './pages/match.tsx']) { const s = src(f); expect(s, f).not.toContain('AdminCALL'); expect(s, f).not.toContain('checkAdmin') }
  })
  it('profile: who is signed in and "delete my account"; nothing when accounts are not set up', () => {
    const p = html(<MePage />, state({ status: 'signedIn', user: ann }))
    expect(p).toContain(T('m.auth.account')); expect(p).toContain('Ann Example'); expect(p).toContain(T('m.auth.delete'))
    expect(html(<MePage />)).not.toContain('id="account-h"')
  })
})

describe('database rows ↔ the app\'s data (domain/match/remote.ts)', () => {
  const row: PostRow = { id: 'p1', employer_id: 'u1', is_sample: false, company: 'Shop', position: 'Cook', industry: 'food_service', skills: ['culinary_arts', 'bogus'], min_years: 1, details: '',
    headcount: 2, employment: 'contract', salary_min: 100, salary_max: 200, salary_currency: 'THB', start_date: '2026-11-01', languages: [{ lang: 'th', level: 'native' }, { lang: 'xx', level: 'native' }],
    education: 'none', benefits: ['meals', 'nope'], country: 'TH', province: 'TH-10', created_at: '2026-10-05T01:02:03Z' }
  it('my own posts get the same marker as in the demo; unknown values in stored rows are dropped', () => {
    const p = rowToPost(row, 'u1')
    expect(p.employerId).toBe(MY_EMPLOYER); expect(p.skills).toEqual(['culinary_arts']); expect(p.languages).toEqual([{ lang: 'th', level: 'native' }]); expect(p.benefits).toEqual(['meals'])
    expect(p.salary).toEqual({ min: 100, max: 200, currency: 'THB' })
    expect(rowToPost(row, 'someone-else').employerId).toBe('u1')
    expect(rowToPost({ ...row, employer_id: null, is_sample: true }, 'u1').employerId).toBe('sample:p1')
  })
  it('a post goes to the database without owner, dates or sample flag (the database sets those), and back into the form for editing', () => {
    const input = postToInput(rowToPost(row, 'u1'))
    const r = postToRow(input)
    expect(Object.keys(r)).not.toContain('employer_id'); expect(Object.keys(r)).not.toContain('created_at'); expect(Object.keys(r)).not.toContain('is_sample')
    expect(r).toMatchObject({ company: 'Shop', position: 'Cook', salary_min: 100, salary_currency: 'THB', country: 'TH', province: 'TH-10' })
  })
  it('the signed-in person\'s view: role, company, pins, acceptances (mine marked as "me"), and other seekers only for admins', () => {
    const st = buildState({ uid: 'u1', name: 'Ann', profile: { user_type: 'employer', company: 'Shop', origin_country: 'TH', origin_province: 'TH-50', member: true },
      posts: [row], pins: [], acceptances: [{ id: 'a1', post_id: 'p1', seeker_id: 'u2', seeker_name: 'Bo', status: 'accepted', created_at: '2026-10-05T02:00:00Z', forwarded_at: null }], clockHours: 0 })
    expect(st.role).toBe('employer'); expect(st.myCompany).toBe('Shop'); expect(st.member).toBe(true); expect(st.memberUntil).toBeNull(); expect(st.me.origin).toEqual({ country: 'TH', province: 'TH-50' })
    expect(st.acceptances[0]).toMatchObject({ seekerId: 'u2', seekerName: 'Bo', status: 'accepted' })
    expect(st.seekers).toEqual([])
    const mine = buildState({ uid: 'u2', name: 'Bo', profile: null, posts: [row], pins: [], acceptances: [{ id: 'a1', post_id: 'p1', seeker_id: 'u2', seeker_name: 'Bo', status: 'forwarded', created_at: '2026-10-05T02:00:00Z', forwarded_at: '2026-10-06T02:00:00Z' }], clockHours: 0 })
    expect(mine.acceptances[0]).toMatchObject({ seekerId: ME, status: 'forwarded' })
  })
  it('database refusals map to the app\'s messages', () => {
    expect(dbProblem({ message: 'quota' })).toBe('quota'); expect(dbProblem({ message: 'pin_limit' })).toBe('limit')
    expect(dbProblem({ code: '23505', message: 'duplicate key' })).toBe('already'); expect(dbProblem({ code: '23514', message: 'check' })).toBe('contact')
    expect(dbProblem(null)).toBe('network')
  })
})

describe('editing and deleting posts', () => {
  it('my posts have Edit and Delete; the post page too; admins delete any post from the back office', () => {
    const h = src('./pages/hire.tsx'), m = src('./pages/match.tsx')
    expect(h).toContain("onClick={() => startEdit(x)}"); expect(h).toContain("onClick={() => remove(x)}")
    expect(src('./pages/post.tsx')).toContain('<NavLink to={`hire?edit=${p.id}`}')
    expect(h).toContain("const r = editing ? await editPost(editing.id, pending) : await post(pending)")
    expect(h).toContain("if (!editing && !canPost(st, limitNow)) { setStage('package'); return }") // editing does not use the weekly allowance
    expect(m).toContain("const ok = await deletePost(p.id); setMsg(ok ? { tone: 'info', text: t('m.post.deleted') }") // back office: the post's side panel
    expect(src('./matchData.tsx')).toContain('const value = { ...r.value, createdAt: old.createdAt, releasedAt: old.releasedAt }') // the posting and release dates stay
  })
})

describe('database rules', () => {
  const sql1 = readFileSync(new URL('../supabase/migrations/0001_profiles.sql', import.meta.url), 'utf8')
  const sql2 = readFileSync(new URL('../supabase/migrations/0002_matching.sql', import.meta.url), 'utf8')
  it('profiles: row level security, own row, admins read all, only some columns editable from the site', () => {
    expect(sql1).toContain('alter table public.profiles enable row level security;')
    expect(sql1).toMatch(/create policy "read own profile" on public\.profiles\s+for select to authenticated\s+using \(id = auth\.uid\(\)\);/)
    expect(sql2).toContain('grant update (user_type, company, origin_country, origin_province, member) on public.profiles to authenticated;')
    expect(sql2).not.toMatch(/grant update \([^)]*role/)
  })
  it('posts, pins, acceptances: row level security on, owner-only writes, admin delete / forward, limits in the database', () => {
    for (const t of ['posts', 'pins', 'acceptances']) expect(sql2, t).toContain(`alter table public.${t} enable row level security;`)
    expect(sql2).toContain('for insert to authenticated with check (employer_id = auth.uid() and not is_sample)')
    expect(sql2).toContain('for delete to authenticated using (employer_id = auth.uid() or public.is_admin())')
    expect(sql2).toContain("raise exception 'quota'"); expect(sql2).toContain("raise exception 'pin_limit'")
    expect(sql2).toContain('unique (post_id, seeker_id)')
    expect(sql2).toMatch(/create policy "admins forward" on public\.acceptances\s+for update to authenticated using \(public\.is_admin\(\)\)/)
    expect(sql2).toContain('public.no_contact(details)')
  })
})

describe('keep-alive and security header', () => {
  it('the free project is pinged twice a day; no secrets → no-op', () => {
    const w = src('../.github/workflows/supabase-keepalive.yml')
    expect(w).toContain("cron: '23 1,13 * * *'"); expect(w).toContain('$SUPABASE_URL/rest/v1/rpc/ping'); expect(w).not.toMatch(/service_role/i); expect(w).toContain('nothing to ping.')
  })
  it('the browser may talk to Supabase and show Google profile pictures — nothing else is added', () => {
    const v = JSON.parse(src('../vercel.json')) as { headers: { headers: { key: string; value: string }[] }[] }
    const csp = v.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy')!.value
    expect(csp).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co;") // wss: who else is viewing a post (realtime); expect(csp).toContain("img-src 'self' data: https://*.googleusercontent.com;"); expect(csp).toContain("script-src 'self';")
  })
})
