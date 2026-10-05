// Bug hunt, Oct 2026 (owner: "I found a bug, find it yourself" — it was two-finger zoom on the phone map). Each fix found on the
// way has a check here: the role chosen before signing in, Back after signing in, focus on language change, the account menu while
// the service is briefly unreachable, a cancelled Google sign-in, the profile gate, editing a post whose start has passed, local days.
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthContext, rememberNext, takeNext, type AuthCtx } from './auth'
import { LoginButton } from './components/sidenav'
import { MePage } from './pages/match'
import { DAY_MS, localDay, makePost } from './domain/match/logic'
import type { MsgKey } from './locales/index'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
const ok = async () => 'ok' as const
const state = (o: Partial<AuthCtx>): AuthCtx => ({ status: 'signedOut', user: null, isAdmin: false, online: true, recovery: false,
  signInGoogle: ok, signInEmail: ok, signUp: ok, sendReset: ok, updatePassword: ok, signOut: async () => {}, deleteAccount: async () => true, ...o })
const html = (node: ReactNode, auth: AuthCtx) => {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthContext.Provider value={auth}><MatchProvider>{node}</MatchProvider></AuthContext.Provider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
/** a sessionStorage stand-in for the server-side test run */
function withSession() {
  const m = new Map<string, string>()
  ;(globalThis as { sessionStorage?: unknown }).sessionStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
afterEach(() => { delete (globalThis as { sessionStorage?: unknown }).sessionStorage })

describe('the bug the owner found: two-finger zoom on the phone map', () => {
  it('two fingers pinch to zoom around the point between them; lifting one keeps dragging; a pinch is never a tap', () => {
    const g = src('./components/geomap.tsx')
    expect(g).toContain('const touches = useRef(new Map<number, { x: number; y: number }>())')
    expect(g).toContain('zoomAt(n.dist / Math.max(1, p.dist), n.mx - (r?.left ?? 0), n.my - (r?.top ?? 0))')
    expect(g).toContain("if (down.current) down.current.moved = Infinity; return } // a pinch is never a tap")
    expect(g).toContain('down.current = rest ? { x: rest.x, y: rest.y, moved: Infinity } : null')
    expect(g).toContain('onPointerCancel={onCancel}')
    expect(g).toContain("style={{ touchAction: 'none' }}") // the browser's own zoom stays off, so the gesture reaches the map
  })
})

describe('sign-in and navigation', () => {
  it('a role chosen before signing in survives the sign-in page (it no longer has to be chosen twice)', () => {
    withSession()
    rememberNext('hire', 'employer') // "Start as employer" while signed out
    rememberNext('hire') // the sign-in page remembers where to go, without a role
    expect(takeNext()).toEqual({ next: 'hire', role: 'employer' })
    rememberNext('hire', 'employer'); rememberNext('board') // another destination: the old role is not carried over
    expect(takeNext()).toEqual({ next: 'board', role: null })
  })
  it('after signing in, the sign-in page is replaced in the history, so Back does not bounce on it', () => {
    expect(src('./store.tsx')).toContain("if (opts?.replace) window.history.replaceState({ d: appDepth() }, '', '/' + r)")
    const a = src('./pages/auth.tsx')
    expect(a).toContain("go(next, { replace: true })"); expect(a).toContain("go(next || 'choose-role', { replace: true })")
    expect(src('./matchData.tsx')).toContain(", { replace: true })")
  })
  it('changing the language does not move keyboard focus to the heading (only a new page does)', () => {
    const app = src('./App.tsx')
    expect(app).toContain('const moveFocus = shown.current !== route')
    expect(app).not.toContain('first.current')
  })
  it('signed in but the service briefly unreachable: the account menu (and log out) stays; the check is retried every 20 s', () => {
    const ann = { id: 'u1', email: 'ann@example.com', name: 'Ann Example', avatar: null }
    expect(html(<LoginButton />, state({ status: 'signedIn', user: ann, online: false }))).toContain('ann@example.com')
    expect(html(<LoginButton />, state({ online: false }))).toBe('')
    expect(src('./auth.tsx')).toContain('retry = window.setInterval(check, 20_000)')
  })
  it('back from Google without signing in (e.g. cancelled): the sign-in page says so', () => {
    const a = src('./auth.tsx')
    expect(a).toContain("if (q.has('error') || q.has('error_code')) { try { sessionStorage.setItem(ERR_KEY, '1')")
    expect(src('./pages/auth.tsx')).toContain("t(err ? errText(err) : 'm.lg.err.google')")
    expect(tr('m.lg.err.google', undefined, 'th')).toContain('Google')
  })
  it('a reset link opened on another device: the pages say to open it where it was asked for', () => {
    expect(tr('m.fp.sent', undefined, 'th')).toContain('เครื่องและเบราว์เซอร์เดียวกับที่กดขอ')
    expect(tr('m.rp.invalid', undefined, 'th')).toContain('เครื่องและเบราว์เซอร์เดียวกับที่กดขอ')
  })
  it('the profile page waits for sign-in instead of showing "no role"', () => {
    const h = html(<MePage />, state({}))
    expect(h).toContain(T('m.need.title')); expect(h).not.toContain(T('m.profile.change'))
  })
  it('"Edit" where I come from starts from the saved place (it was empty after a refresh)', () => {
    expect(src('./pages/match.tsx')).toContain('onClick={() => { setOc(st.me.origin?.country ?? null); setOp(st.me.origin?.province ?? null); setEditOrigin(true) }}')
  })
})

describe('posts and dates', () => {
  const at0 = '2026-10-01T03:00:00.000Z'
  const base = { place: { country: 'CN' as const, province: 'CN-SH' }, company: 'Sample Co', position: 'Chef', industry: 'food_service' as const, skills: ['culinary_arts' as const], minYears: 1, details: '',
    headcount: 1, employment: 'permanent' as const, salary: null, startDate: localDay(at0), languages: [{ lang: 'zh' as const, level: 'basic' as const }], education: 'none' as const, benefits: [] }
  it('editing a post whose start date has passed: the unchanged date is checked against the posting day, a new date against today', () => {
    const later = new Date(Date.parse(at0) + 20 * DAY_MS).toISOString()
    expect(makePost(base, 'p', 'employer:me', at0).ok).toBe(true) // kept as it was
    const moved = makePost(base, 'p', 'employer:me', later); expect(moved.ok ? 'ok' : moved.problem).toBe('startDate') // as a new date it is in the past
    expect(src('./matchData.tsx')).toContain('old.startDate && input.startDate === old.startDate ? old.createdAt : at()')
    expect(src('./pages/hire.tsx')).toContain('editing && editing.startDate && i.startDate === editing.startDate ? editing.createdAt')
  })
  it('date pickers and checks use the visitor\'s own calendar day, not UTC (before 7 am in Thailand "yesterday" was allowed)', () => {
    const d = new Date(2026, 9, 5, 6, 30) // 06:30 local time
    expect(localDay(d.toISOString())).toBe('2026-10-05')
    const r = makePost({ ...base, startDate: '2026-10-04' }, 'p', 'employer:me', d.toISOString())
    expect(r.ok ? 'ok' : r.problem).toBe('startDate')
    expect(src('./pages/hire.tsx')).toContain('const today = (now: number) => localDay(new Date(now).toISOString())')
  })
})
