// Entry-UX fix: "Start using C.A.L.L." → /choose-role → Worker (/jobs), Employer (/employer) or the existing business planning (map → interview).
// Static rendering (react-dom/server) checks what is shown; real clicks and focus were checked manually in a browser.
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { StoreProvider, go } from './store'
import { PersonaProvider } from './persona'
import { JobBoardProvider } from './jobboardData'
import { JOBBOARD_KEY, type KV } from './domain/jobboard/persist'
import { PERSONAS, resolveEntry, type Persona } from './domain/jobboard/personas'
import { messages, type MsgKey } from './locales/index'
import { entry } from './locales/entry'
import { ChooseRolePage } from './pages/choose'
import { Landing } from './pages/intake'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string>) => esc(tr(k, v, 'th'))
const mem = (): KV & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) }, removeItem: (k) => { m.delete(k) } } }
const html = (node: ReactNode, storage: KV | null = null) => renderToStaticMarkup(<LanguageProvider><StoreProvider><PersonaProvider><JobBoardProvider storage={storage}>{node}</JobBoardProvider></PersonaProvider></StoreProvider></LanguageProvider>)
const ROUTES = new Set([...src('./App.tsx').slice(src('./App.tsx').indexOf('const pages')).matchAll(/(?:^|[\s{,])'?([\w-]+)'?: </g)].map((m) => m[1]).concat(''))

describe('entry flow: Lobby → /choose-role', () => {
  it('the Lobby\'s primary CTA is a link to /choose-role, a registered route', () => {
    expect(ROUTES.has('choose-role')).toBe(true)
    expect(src('./App.tsx')).toMatch(/'choose-role': <ChooseRolePage \/>/)
    expect(html(<Landing />)).toMatch(new RegExp(`<a href="/choose-role" class="btn-primary[^"]*">${T('hero.cta')}`))
    expect(src('./pages/intake.tsx')).not.toMatch(/onClick=\{beginNew\}>\{t\('hero\.cta'\)/) // the CTA no longer jumps straight into the map/interview
  })
  it('the choice page shows the question, the Worker and Employer options first, then business planning', () => {
    const page = html(<ChooseRolePage />)
    const order = ['choose.title', 'choose.employment', 'jb.lobby.worker.t', 'jb.lobby.employer.t', 'choose.business.h', 'choose.business.t'] as const
    const at = order.map((k) => page.indexOf(T(k)))
    expect(at.every((i) => i > -1), JSON.stringify(at)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(page).toContain(T('jb.lobby.worker.d', { name: 'Ploy' }))
    expect(page).toContain(T('jb.lobby.employer.d', { name: 'Example Precision Parts' }))
    expect(page).toContain(T('choose.simBadge'))
    expect(page).toContain(T('jb.notice.short'))
    expect(page).toContain(T('persona.note'))
    expect(page).toContain(T('choose.business.d'))
    expect(page).toContain('<h1')
    expect(page).toContain('href="/"') // way back to the Lobby
  })
  it('the simulated reviewer (Admin) is not a public choice', () => {
    const page = html(<ChooseRolePage />)
    for (const l of ['th', 'zh', 'en'] as const) expect(page).not.toContain(esc(tr('persona.role.admin', undefined, l)))
    expect(src('./pages/choose.tsx')).not.toMatch(/kind: 'admin'|'admin:/)
    expect(resolveEntry('admin')).toBeNull()
  })
})

describe('entry flow: persona selection and destinations', () => {
  it('Worker → the first seeded worker and /jobs; Employer → the first seeded employer and /employer', () => {
    expect(resolveEntry('worker')).toEqual({ key: 'worker:wkr_0001', route: 'jobs' })
    expect(resolveEntry('employer')).toEqual({ key: 'employer:org_0001', route: 'employer' })
    for (const r of ['jobs', 'employer']) expect(ROUTES.has(r)).toBe(true)
  })
  it('without a matching persona there is no destination, so nothing navigates into a mismatched role', () => {
    const employerOnly = PERSONAS.filter((p) => p.kind !== 'worker')
    expect(resolveEntry('worker', employerOnly)).toBeNull()
    expect(resolveEntry('employer', [])).toBeNull()
    const mislabelled = [{ ...PERSONAS.find((p) => p.kind === 'employer')!, kind: 'worker' } as Persona]
    expect(resolveEntry('worker', mislabelled)).toBeNull() // the actor must really be a worker
    for (const bad of ['visitor', 'admin', '', null, undefined, 'jobs']) expect(resolveEntry(bad)).toBeNull()
    // enter() returns false before selecting or navigating when there is no destination; the page then shows a localized error
    const p = src('./persona.tsx')
    expect(p).toMatch(/const e = resolveEntry\(kind\)\s*if \(!e\) return false[^\n]*\n\s*dispatch\(\{ type: 'select', key: e\.key \}\); go\(e\.route\)/)
    expect(src('./pages/choose.tsx')).toMatch(/onClick=\{\(\) => setFailed\(!enter\(c\.kind\)\)\}/)
    expect(src('./pages/choose.tsx')).toMatch(/failed && <Warn tone="danger">\{t\('choose\.error'\)\}/)
  })
  it('the business-planning choice uses the existing flow unchanged (beginNew → map /start → interview)', () => {
    expect(src('./pages/choose.tsx')).toMatch(/onClick=\{\(\) => \{ reset\(\); beginNew\(\) \}\}/) // clears the simulated persona, then the existing flow
    expect(src('./store.tsx')).toMatch(/beginNew: \(\) => \{\s*if \(mode === 'demo'\) \{ setMode\('real'\); setS\(load\('real'\)\) \}\s*go\('start'\)/)
    expect(src('./store.tsx')).toMatch(/setS\(base\); go\('interview'\)/)
    for (const r of ['start', 'interview', 'direction', 'profile', 'plan', 'navigator', 'employee', 'documents', 'sources', 'admin']) expect(ROUTES.has(r), r).toBe(true)
  })
  const g = globalThis as { window?: unknown }
  afterEach(() => { delete g.window })
  it('navigating to the choice page and its destinations pushes those exact URLs', () => {
    const pushed: string[] = []
    const loc = { pathname: '/', search: '' }
    g.window = { location: loc, history: { pushState: (_: unknown, __: string, u: string) => { pushed.push(u); loc.pathname = u } }, dispatchEvent: () => true, scrollTo: () => {} }
    go('choose-role'); go(resolveEntry('worker')!.route); go('choose-role'); go(resolveEntry('employer')!.route)
    expect(pushed).toEqual(['/choose-role', '/jobs', '/choose-role', '/employer'])
  })
  it('opening or rendering the choice page writes no job-board data and touches no repository', () => {
    const kv = mem()
    html(<ChooseRolePage />, kv)
    expect(kv.m.has(JOBBOARD_KEY)).toBe(false)
    expect(src('./pages/choose.tsx')).not.toMatch(/useJobBoard|submitApplication|createJob|mutate|repo\b/)
  })
})

describe('entry flow: localization', () => {
  it('every entry message has Thai, Simplified Chinese and English, and is used', () => {
    const s = src('./pages/choose.tsx')
    for (const [k, [th, zh, en]] of Object.entries(entry)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as MsgKey], k).toBe(entry[k as keyof typeof entry])
      expect(s, `unused ${k}`).toContain(`'${k}'`)
    }
    for (const k of [...s.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1])) expect(k in messages, k).toBe(true)
    for (const kind of ['worker', 'employer']) for (const x of ['t', 'd']) expect(`jb.lobby.${kind}.${x}` in messages).toBe(true)
  })
})
