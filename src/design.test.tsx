// Design pass: employment-first home page, main navigation, business planning as a secondary area, refined job-board pages.
// Static rendering (react-dom/server) checks structure and content; layout, clicks and focus were checked manually in a browser.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { StoreProvider } from './store'
import { ThemeProvider } from './theme'
import { PersonaProvider } from './persona'
import { JobBoardProvider } from './jobboardData'
import { messages, type MsgKey } from './locales/index'
import { home } from './locales/home'
import { Landing } from './pages/intake'
import { JobDetail, OrgOverview } from './pages/jobboard'
import { ReviewWorkspace } from './pages/review'
import { BUSINESS_ROUTES, Header, MAIN_NAV, isBusinessRoute } from './components/shell'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
function html(node: ReactNode, persona?: string): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try {
    return renderToStaticMarkup(<ThemeProvider><LanguageProvider><StoreProvider><PersonaProvider initialKey={persona}><JobBoardProvider storage={null}>{node}</JobBoardProvider></PersonaProvider></StoreProvider></LanguageProvider></ThemeProvider>)
  } finally { if (had) g.document = prev; else delete g.document }
}
const ROUTES = new Set([...src('./App.tsx').slice(src('./App.tsx').indexOf('const pages')).matchAll(/(?:^|[\s{,])'?([\w-]+)'?: </g)].map((m) => m[1]).concat(''))
const at = (page: string, ...keys: MsgKey[]) => keys.map((k) => page.indexOf(T(k)))

describe('home page: employment first, business planning secondary', () => {
  const page = html(<Landing />)
  it('the hero says what C.A.L.L. is for and shows the prototype status, the main CTA and both role paths', () => {
    for (const k of ['home.eyebrow', 'home.h1a', 'home.h1b', 'home.sub', 'home.proto', 'home.paths', 'jb.lobby.worker.t', 'jb.lobby.employer.t', 'home.orBiz'] as const) expect(page, k).toContain(T(k))
    expect(page).toMatch(new RegExp(`<h1[^>]*>.*${T('home.h1a')}`))
    expect(page).not.toContain(T('hero.h1a')) // the old business-only headline is gone
    expect(page).not.toContain(T('hero.preview')) // the business "AI preview" illustration is gone
  })
  it('order: hero → C.A.L.L. pillars → 3 steps → business-planning tools (with its goal cards) last', () => {
    const pos = at(page, 'home.h1a', 'brand.stands', 'home.steps.h', 'home.biz.h', 'goal.th_cn.t')
    expect(pos.every((i) => i > -1), JSON.stringify(pos)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
  })
  it('the language and legal pillars link to the existing preparation pages', () => {
    expect(page).toMatch(new RegExp(`href="/language"[^>]*>${T('home.go.lang')}`))
    expect(page).toMatch(new RegExp(`href="/sources"[^>]*>${T('home.go.legal')}`))
  })
  it('role paths select a persona only; the business link clears the persona and opens the existing flow', () => {
    const s = src('./pages/intake.tsx')
    expect(s).toMatch(/onClick=\{\(\) => setFailed\(!enter\(kind\)\)\}/)
    expect(s).toMatch(/onClick=\{\(\) => \{ reset\(\); beginNew\(\) \}\}/)
    expect(s).not.toMatch(/useJobBoard|submitApplication|mutate\(/)
  })
})

describe('main navigation', () => {
  it('is employment first: jobs, employers, language & culture, legal info, then business planning — all registered routes', () => {
    expect(MAIN_NAV.map((n) => n.key)).toEqual(['nav.jobs', 'nav.employerArea', 'tabs.language', 'nav.legalInfo', 'nav.bizPlanning'])
    for (const n of MAIN_NAV) for (const p of [false, true]) expect(ROUTES.has(n.to(p)), n.to(p)).toBe(true)
    expect(MAIN_NAV[4].to(false)).toBe('start'); expect(MAIN_NAV[4].to(true)).toBe('dashboard')
  })
  it('business routes are exactly the business-planning tool; job-board, legal and home routes are not', () => {
    for (const r of ['start', 'direction', 'interview', 'profile', 'dashboard', 'analysis', 'ownership', 'nominee', 'employment', 'contract', 'navigator', 'employee', 'plan', 'roadmap', 'risk', 'documents']) expect(isBusinessRoute(r), r).toBe(true)
    for (const r of ['', 'choose-role', 'jobs', 'employer', 'review', 'sources', 'language', 'monitoring', 'admin', 'privacy', 'pricing']) expect(isBusinessRoute(r), r).toBe(false)
    for (const r of BUSINESS_ROUTES) expect(ROUTES.has(r), r).toBe(true)
  })
  it('the header always offers the menu, and shows the simulated persona only outside the business tool', () => {
    const jobs = html(<Header route="jobs" />), biz = html(<Header route="interview" />), lobby = html(<Header route="" />)
    for (const h of [jobs, biz, lobby]) { expect(h).toContain(`aria-label="${T('nav.menu')}"`); expect(h).toContain(T('nav.jobs')) }
    expect(jobs).toContain('>PoC<'); expect(lobby).toContain('>PoC<')
    expect(biz).not.toContain('>PoC<')
    expect(jobs).toMatch(new RegExp(`aria-current="page"[^>]*><svg[\\s\\S]*?</svg>${T('nav.jobs')}`))
  })
  it('the business bars (context, demo strip, tour, sub-navigation, bottom tabs) stay inside the business tool', () => {
    const s = src('./components/shell.tsx')
    expect(s).toMatch(/const biz = isBusinessRoute\(route\)\s*const hideCtx = !biz/)
    expect(s).toMatch(/const showTour = biz && /)
    expect(s).toMatch(/const demo = biz && mode === 'demo'/)
    expect(s).toMatch(/if \(!profile \|\| !isBusinessRoute\(route\)\) return null/)
    expect(s).toMatch(/\{sub && <BusinessSubNav route=\{route\} \/>\}/)
  })
})

describe('refined job-board pages', () => {
  it('job detail: title and location, organisation and status, requirements, skills, preparation links, then the simulated application', () => {
    const page = html(<JobDetail id="job_0001" />, 'worker:wkr_0002')
    const pos = at(page, 'jb.field.org', 'jb.req.h', 'jb.field.skills', 'jb.prep.h', 'jb.apply.h')
    expect(pos.every((i) => i > -1), JSON.stringify(pos)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(page).toContain('href="/language"'); expect(page).toContain('href="/sources"')
    expect(page).toContain(T('jb.prep.d'))
    expect(page).toContain(T('jb.notice.2'))
  })
  it('employer overview summarises its own posts and the applications to them', () => {
    const page = html(<OrgOverview />, 'employer:org_0001')
    expect(page).toContain(`aria-label="${T('jb.sum')}"`)
    // org_0001: one draft (job_0003), one waiting for review (job_0002), one open (job_0001), two applications (app_0001, app_0003)
    for (const [n, k] of [[1, 'jb.review.draft'], [1, 'jb.review.pending_review'], [1, 'jb.review.approved'], [2, 'jb.tab.review']] as const) expect(page, k).toContain(`>${n}</p><p class="text-sm text-muted">${T(k)}<`)
  })
  it('the review workspace summarises its queues', () => {
    const page = html(<ReviewWorkspace />, 'admin:adm_0001')
    expect(page).toContain(`>1</p><p class="text-sm text-muted">${T('rv.org.h')}<`)
    expect(page).toContain(`>1</p><p class="text-sm text-muted">${T('rv.job.h')}<`)
  })
})

describe('design pass: localization', () => {
  it('every home/navigation message has Thai, Simplified Chinese and English, is not overridden, and is used', () => {
    const used = ['./pages/intake.tsx', './components/shell.tsx'].map(src).join('\n')
    for (const [k, [th, zh, en]] of Object.entries(home)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as MsgKey], k).toBe(home[k as keyof typeof home])
      const step = /^home\.step\.\d$/.test(k) && used.includes('home.step.$')
      expect(used.includes(`'${k}'`) || step || used.includes('`home.step.${n}`'), `unused ${k}`).toBe(true)
    }
  })
})
