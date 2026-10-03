// Owner's matching model (Oct 2026): pins (≤5), employer posts, the 3-step release, accepting, simulated forwarding, admin gate,
// and the reviewed shell (side menu, log-in, Lobby, two-role page). Static rendering only; clicks and the map were checked manually.
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
import { MatchProvider, checkAdmin } from './matchData'
import { DAY_MS, accept, addPin, forward, isVisibleTo, makePost, offersFor, parseState, reachTier, tierOf } from './domain/match/logic'
import { seedState } from './domain/match/seed'
import { ME, type MatchState, type Seeker } from './domain/match/types'
import { messages, type MsgKey } from './locales/index'
import { match } from './locales/match'
import { Landing } from './pages/intake'
import { ChooseRolePage } from './pages/choose'
import { BackofficePage, NotificationsPage, SeekPage } from './pages/match'
import { BackButton, Header } from './components/shell'
import { SideNav, sideItems } from './components/sidenav'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
function html(node: ReactNode, st?: MatchState): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><StoreProvider><PersonaProvider><JobBoardProvider storage={null}><MatchProvider initial={st ?? seedState(NOW)}>{node}</MatchProvider></JobBoardProvider></PersonaProvider></StoreProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
const NOW = Date.parse('2026-10-03T08:00:00.000Z')
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
const seeker = (pins: Seeker['pins']): Seeker => ({ id: ME, name: 'you', origin: { country: 'TH', province: 'TH-10' }, pins, synthetic: true })
const ROUTES = new Set([...src('./App.tsx').slice(src('./App.tsx').indexOf('const pages')).matchAll(/(?:^|[\s{,])'?([\w-]+)'?: </g)].map((m) => m[1]).concat(''))

describe('pins', () => {
  const place = { country: 'CN' as const, province: 'CN-SH' }
  it('up to 5 pins, no duplicate area, a real province of the chosen country, at least one skill', () => {
    let s = seeker([])
    for (const p of ['CN-SH', 'CN-GD', 'CN-JS', 'TH-10', 'TH-50']) { const r = addPin(s, { place: { country: p.slice(0, 2) as 'TH' | 'CN', province: p }, industry: 'manufacturing', skills: ['quality_control'] }, 'p' + p.toLowerCase(), at(0)); expect(r.ok, p).toBe(true); if (r.ok) s = r.value }
    const sixth = addPin(s, { place: { country: 'CN', province: 'CN-ZJ' }, industry: 'manufacturing', skills: ['quality_control'] }, 'p6', at(0))
    expect(sixth.ok ? 'ok' : sixth.problem).toBe('limit')
    const fresh = seeker([])
    const bad = [
      addPin(fresh, { place: { country: 'CN', province: 'TH-10' }, industry: 'manufacturing', skills: ['quality_control'] }, 'x', at(0)),
      addPin(fresh, { place: { country: 'CN', province: 'CN-XX' }, industry: 'manufacturing', skills: ['quality_control'] }, 'x', at(0)),
      addPin(fresh, { place, industry: 'manufacturing', skills: [] }, 'x', at(0)),
    ].map((r) => (r.ok ? 'ok' : r.problem))
    expect(bad).toEqual(['place', 'place', 'skills'])
    const once = addPin(fresh, { place, industry: 'hospitality', skills: ['hospitality_management'] }, 'a', at(0))
    const twice = once.ok ? addPin(once.value, { place, industry: 'technology', skills: ['data_analysis'] }, 'b', at(0)) : once
    expect(twice.ok ? 'ok' : twice.problem).toBe('duplicate')
  })
  it('the same country may be both origin and destination (work at home)', () => {
    expect(addPin(seeker([]), { place: { country: 'TH', province: 'TH-10' }, industry: 'technology', skills: ['data_analysis'] }, 'h', at(0)).ok).toBe(true)
  })
})

describe('the step-by-step release', () => {
  const post = makePost({ place: { country: 'CN', province: 'CN-SH' }, company: 'Sample Co', position: 'QC Engineer', industry: 'manufacturing', skills: ['quality_control'], minYears: 1, details: '' }, 'post-x', 'employer:me', at(0))
  if (!post.ok) throw new Error('post')
  const P = post.value
  const area = seeker([{ id: 'a', country: 'CN', province: 'CN-SH', industry: 'manufacturing', skills: ['quality_control'], at: at(0) }])
  const areaOther = seeker([{ id: 'b', country: 'CN', province: 'CN-SH', industry: 'hospitality', skills: ['culinary_arts'], at: at(0) }])
  const country = seeker([{ id: 'c', country: 'CN', province: 'CN-GD', industry: 'manufacturing', skills: ['quality_control'], at: at(0) }])
  const elsewhere = seeker([{ id: 'd', country: 'TH', province: 'TH-10', industry: 'manufacturing', skills: ['quality_control'], at: at(0) }])
  it('who is reached at which step: same area + field → same area → whole country → never', () => {
    expect([area, areaOther, country, elsewhere].map((s) => reachTier(P, s))).toEqual([1, 2, 3, null])
  })
  it('the step grows by one each day without an acceptance (day 0 → 1, day 1 → 2, day 2+ → 3)', () => {
    expect([0, 0.9, 1, 1.9, 2, 5].map((d) => tierOf(P, NOW + d * DAY_MS))).toEqual([1, 1, 2, 2, 3, 3])
    expect(isVisibleTo(P, areaOther, NOW, [])).toBe(false)
    expect(isVisibleTo(P, areaOther, NOW + DAY_MS, [])).toBe(true)
    expect(isVisibleTo(P, country, NOW + DAY_MS, [])).toBe(false)
    expect(isVisibleTo(P, country, NOW + 2 * DAY_MS, [])).toBe(true)
    expect(isVisibleTo(P, elsewhere, NOW + 9 * DAY_MS, [])).toBe(false)
  })
  it('an acceptance stops the escalation at the step it reached', () => {
    const acc = [{ id: 'acc', postId: P.id, seekerId: 'seeker-a', at: at(0.5), status: 'accepted' as const }]
    expect(tierOf(P, NOW + 5 * DAY_MS, acc)).toBe(1)
  })
})

describe('accepting and forwarding (simulated)', () => {
  it('a seeker can accept only a post that has reached them, once; forwarding only changes the status', () => {
    const st = seedState(NOW)
    st.me = seeker([{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(0) }])
    expect(offersFor(st, st.me, NOW).map((p) => p.id)).toEqual(['post-s2'])
    const ok = accept(st, 'post-s2', ME, 'acc-1', at(0))
    expect(ok.ok).toBe(true)
    const notYet = accept(st, 'post-s1', ME, 'acc-2', at(0)) // Shanghai post: not pinned
    expect(notYet.ok ? 'ok' : notYet.problem).toBe('notOpen')
    if (ok.ok) {
      st.acceptances.push(ok.value)
      const again = accept(st, 'post-s2', ME, 'acc-3', at(0))
      expect(again.ok ? 'ok' : again.problem).toBe('already')
      expect(forward(ok.value, at(1))).toEqual({ ...ok.value, status: 'forwarded', forwardedAt: at(1) })
    }
    expect(src('./domain/match/logic.ts') + src('./matchData.tsx')).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/)
  })
  it('posts refuse contact details and missing fields', () => {
    const base = { place: { country: 'CN' as const, province: 'CN-SH' }, company: 'Sample Co', position: 'Chef', industry: 'food_service' as const, skills: ['culinary_arts' as const], minYears: 1, details: '' }
    const r = [makePost({ ...base, details: 'call 081 234 5678' }, 'a', 'employer:me', at(0)), makePost({ ...base, company: 'x' }, 'a', 'employer:me', at(0)), makePost({ ...base, skills: [] }, 'a', 'employer:me', at(0)), makePost({ ...base, minYears: 99 }, 'a', 'employer:me', at(0))]
    expect(r.map((x) => (x.ok ? 'ok' : x.problem))).toEqual(['contact', 'company', 'skills', 'years'])
  })
})

describe('stored data is validated', () => {
  it('the seed is valid; tampered data is rejected', () => {
    const st = seedState(NOW)
    expect(parseState(JSON.parse(JSON.stringify(st)))).not.toBeNull()
    const bad = (f: (s: MatchState) => void) => { const s = JSON.parse(JSON.stringify(st)) as MatchState; f(s); return parseState(s) }
    expect(bad((s) => { s.seekers[0].pins = Array.from({ length: 6 }, (_, i) => ({ ...s.seekers[0].pins[0], id: 'x' + i })) })).toBeNull()
    expect(bad((s) => { s.posts[0].province = 'CN-XX' })).toBeNull()
    expect(bad((s) => { s.acceptances.push({ id: 'a', postId: 'nope', seekerId: ME, at: at(0), status: 'accepted' }) })).toBeNull()
    expect(bad((s) => { (s as { dayOffset: number }).dayOffset = -1 })).toBeNull()
    expect(bad((s) => { s.posts[0].details = 'mail me hr@example.com' })).toBeNull()
  })
})

describe('admin gate (prototype)', () => {
  it('only the owner-provided test credentials open the back office', () => {
    expect(checkAdmin('AdminCALL', 'AdminCALL101')).toBe(true)
    expect(checkAdmin(' AdminCALL ', 'AdminCALL101')).toBe(true)
    for (const [i, p] of [['AdminCALL', 'admincall101'], ['admin', 'AdminCALL101'], ['', '']]) expect(checkAdmin(i, p)).toBe(false)
    const page = html(<BackofficePage />)
    expect(page).toContain(T('m.adm.gate'))
    expect(page).not.toContain('Sample Riverside Hotels')
  })
})

describe('reviewed shell and pages', () => {
  it('header: menu button, C.A.L.L. mark that is not a link, language, theme, log in — no top navigation, no role switcher', () => {
    const h = html(<Header route="" />)
    expect(h).toContain(`aria-label="${T('m.menu')}"`)
    expect(h).toContain(T('m.login'))
    expect(h).not.toContain('>PoC<')
    for (const k of ['nav.jobs', 'nav.employerArea', 'nav.bizPlanning'] as const) expect(h, k).not.toContain(T(k))
    expect(h).not.toMatch(/<a [^>]*href="\/"/) // the logo is no longer a link
  })
  it('side menu: home, profile, notifications, my pins / my posts by role, prepare, settings, help, and back office only for the admin', () => {
    const keys = (r: 'seeker' | 'employer' | null, a: boolean) => sideItems(r, a).map((i) => i.key)
    expect(keys(null, false)).toEqual(['m.home', 'm.profile', 'm.notif', 'm.prepare', 'm.settings', 'm.help'])
    expect(keys('seeker', false)).toContain('m.pins'); expect(keys('seeker', false)).not.toContain('m.posts')
    expect(keys('employer', false)).toContain('m.posts')
    expect(keys('employer', true).slice(-1)).toEqual(['m.admin'])
    for (const r of [null, 'seeker', 'employer'] as const) for (const i of sideItems(r, true)) expect(ROUTES.has(i.to), i.to).toBe(true)
    expect(src('./components/sidenav.tsx')).not.toMatch(/to: '(start|interview|dashboard|plan|documents|jobs|employer|review)'/)
  })
  it('Lobby: centred start button to /choose-role, what C.A.L.L. solves and how it works — nothing else added', () => {
    const page = html(<Landing />)
    expect(page).toMatch(new RegExp(`<a href="/choose-role" class="cta-core[^"]*">${T('hero.cta')}`))
    for (const k of ['m.hero.h1a', 'm.hero.h1b', 'm.problems.h', 'm.how.h', 'm.how.1', 'm.how.4', 'm.proto'] as const) expect(page, k).toContain(T(k))
    for (const k of ['home.paths', 'home.steps.h', 'home.biz.h', 'goal.th_cn.t'] as const) expect(page, k).not.toContain(T(k))
  })
  it('role page: two choices, employer then job seeker, with the owner\'s wording; no admin, no business planning', () => {
    const page = html(<ChooseRolePage />)
    const pos = ['m.role.title', 'm.role.sub', 'm.role.employer', 'm.role.employer.d', 'm.role.seeker', 'm.role.seeker.d'].map((k) => page.indexOf(T(k as MsgKey)))
    expect(pos.every((i) => i > -1)).toBe(true); expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(page.split('<button').length - 1).toBe(2)
    expect(page).toContain('(Employer)'); expect(page).toContain('(Job Seeker)')
    expect(page).not.toContain(T('choose.business.t'))
  })
  it('new routes are registered; agency links are the official sites and say nothing was sent', () => {
    for (const r of ['choose-role', 'seek', 'hire', 'notifications', 'me', 'prepare', 'settings', 'help', 'backoffice']) expect(ROUTES.has(r), r).toBe(true)
    const st = seedState(NOW); st.role = 'seeker'
    st.me = seeker([{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(0) }])
    st.acceptances.push({ id: 'acc-1', postId: 'post-s2', seekerId: ME, at: new Date().toISOString(), status: 'forwarded', forwardedAt: new Date().toISOString() })
    const page = html(<NotificationsPage />, st)
    expect(page).toContain('href="https://www.doe.go.th/"'); expect(page).toContain('href="https://www.dsd.go.th/"')
    expect(page).toContain(T('m.agency.note')); expect(page).toContain(T('m.st.forwarded'))
  })
  it('every matching message has Thai, Simplified Chinese and English and is not overridden', () => {
    for (const [k, [th, zh, en]] of Object.entries(match)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as MsgKey], k).toBe(match[k as keyof typeof match])
    }
    const files = ['./pages/match.tsx', './components/sidenav.tsx', './pages/intake.tsx', './pages/choose.tsx', './components/shell.tsx'].map(src).join('\n')
    for (const k of [...files.matchAll(/\bt\('(m\.[\w.]+)'/g)].map((m) => m[1])) expect(k in messages, k).toBe(true)
  })
})

describe('accessibility audit, round 1 (#1, #2, #7)', () => {
  const css = src('./index.css')
  it('#1 the start button shows a focus ring although its decorative ring clips its contents', () => {
    expect(css).toMatch(/\.cta-ring:has\(\.cta-core:focus-visible\)\s*\{[^}]*outline:\s*3px solid/)
    expect(css).toMatch(/\.cta-ring\s*\{[^}]*overflow:\s*hidden/) // the reason the ring, not the button, carries the outline
  })
  it('#2 the small-screen drawer is modal: the page behind is inert, focus moves in and returns to the menu button', () => {
    const nav = src('./components/sidenav.tsx')
    expect(src('./App.tsx')).toContain('id="page-body"')
    expect(nav).toMatch(/getElementById\('page-body'\)[\s\S]*setAttribute\('inert', ''\)/)
    expect(nav).toContain("removeAttribute('inert')")
    expect(nav).toMatch(/drawer\.current\?\.querySelector<HTMLElement>\('a\[href\]'\)\?\.focus\(\)/)
    expect(nav).toContain("querySelector<HTMLElement>('[data-menu-button]')?.focus()")
    expect(nav).toContain("matchMedia('(min-width: 1024px)')") // the large-screen rail never makes the page inert
    expect(html(<Header route="" />)).toContain('data-menu-button')
  })
  it('#7 focused controls scroll clear of the 64px sticky header', () => {
    expect(css).toMatch(/html\s*\{\s*scroll-padding-top:\s*5rem\s*\}/)
  })
})

describe('accessibility audit, rounds 2–3 (#3–#6, #8–#10)', () => {
  const css = src('./index.css')
  const seekerState = () => { const st = seedState(NOW); st.role = 'seeker'; st.me = seeker([]); return st }
  it('#3 #9 the side rail marks the current page with a solid bar and always shows its labels', () => {
    const page = html(<SideNav route="seek" open={false} onClose={() => {}} />, seekerState())
    const current = page.match(/<a [^>]*aria-current="page"[^>]*>([\s\S]*?)<\/a>/)
    expect(current?.[0]).toContain('href="/seek"')
    expect(current?.[1]).toContain('w-1 rounded-r-full bg-primary')
    for (const k of ['m.home', 'm.profile', 'm.notif', 'm.pins', 'm.prepare', 'm.settings', 'm.help'] as const) expect(page, k).toContain(`>${T(k)}</span>`)
    expect(page).not.toMatch(/<a [^>]*title=/) // no hover-only names
    expect(src('./App.tsx')).toContain('lg:pl-20')
  })
  it('#4 (revised with the owner) the view moves with single taps: tapping a country or province frames it; zoom and back-to-view buttons; no arrow pad', () => {
    const geo = src('./components/geomap.tsx')
    expect(geo).not.toContain('m.pan')
    expect(geo).toContain("onClick={() => flyTo(target)} aria-label={t('geo.resetView')}")
    expect(geo).toMatch(/aria-label=\{t\('geo\.zoomIn'\)\}[\s\S]*aria-label=\{t\('geo\.zoomOut'\)\}/)
    expect(geo).toMatch(/onPickProvince\(d\.prov === province \? null : d\.prov\)/) // a tap picks (and frames) a province
    expect(geo).toMatch(/onPickCountry\(d\.code\)/)
  })
  it('#5 job titles on notifications and in the back office are headings', () => {
    const st = seedState(NOW); st.role = 'seeker'
    st.me = seeker([{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(0) }])
    expect(html(<NotificationsPage />, st)).toMatch(/<h2 class="[^"]*">Quality Control Engineer<\/h2>/)
    expect(src('./pages/match.tsx')).toMatch(/<h3 className="font-semibold">\{p\.position\} · \{p\.company\}/)
  })
  it('#6 #8 the pin form marks required fields, offers tick chips and ties errors to their field', () => {
    const page = html(<SeekPage />, { ...seekerState(), me: seeker([]) })
    expect(page).toContain(`(${T('m.req')})`)
    expect(page).toMatch(/<select id="dest-prov"[^>]*aria-required="true"/)
    expect(page).toContain('id="dest-prov-c"') // focus target when no country is chosen yet
    expect(page.match(/class="chip-check"/g)?.length).toBe(12)
    expect(page).toMatch(/<input id="seek-skills-0" type="checkbox" class="sr-only"/)
    const m = src('./pages/match.tsx')
    expect(m).toMatch(/useEffect\(\(\) => \{ if \(err\) document\.getElementById\(err\.focus\)\?\.focus\(\) \}, \[err\]\)/)
    expect(m).toContain("aria-describedby={fe.describe('emp-company', 'emp-company-hint')}")
    expect(m).toContain("contact: ['emp-details', 'emp-details']")
    expect(css).toMatch(/\.chip-check:has\(input:focus-visible\)\s*\{\s*outline:\s*3px solid/)
    expect(css).toMatch(/\.chip-check:has\(input:checked\) \.chip-box svg\s*\{\s*opacity:\s*1/)
  })
  it('#10 pins have a thicker outline', () => {
    expect(css).toMatch(/\.g-pin \{[^}]*stroke-width: 2\.5/)
  })
})

describe('design pass (owner review, Oct 2026)', () => {
  const css = src('./index.css')
  it('the map opens framed on Thailand + China, seen through an oblique camera with haze', () => {
    const geo = src('./components/geomap.tsx')
    expect(geo).toMatch(/x\.code === 'TH' \|\| x\.code === 'CN'/)
    expect(geo).toContain('<div className="map-haze" aria-hidden />')
    expect(css).toMatch(/\.map-tilt \{[^}]*rotateX\(3\d+deg\)/)
  })
  it('every page except the Lobby has a Back button that stays inside the site', () => {
    const shell = src('./components/shell.tsx'), store = src('./store.tsx')
    expect(src('./App.tsx')).toContain('<BackButton route={route} />')
    expect(shell).toMatch(/if \(!route\) return null/)
    expect(shell).toContain("onClick={() => goBack(PARENT[route] ?? '')}")
    expect(store).toContain("pushState({ d: appDepth() + 1 }, '', '/' + r)")
    expect(store).toMatch(/goBack = \(parent: string\) => \{ if \(appDepth\(\) > 0\) window\.history\.back\(\); else go\(parent\) \}/)
    expect(html(<BackButton route="seek" />)).toContain(T('m.back'))
    expect(html(<BackButton route="" />)).toBe('')
  })
  it('empty pages offer the next step', () => {
    const st = seedState(NOW); st.role = 'seeker'; st.me = seeker([])
    expect(html(<NotificationsPage />, st)).toMatch(/<a href="\/seek" class="btn-primary">/)
  })
  it('surfaces have depth: elevation tokens in both themes, raised cards and buttons', () => {
    for (const k of ['--elev-hi', '--elev-1', '--elev-2', '--elev-3']) expect(css.split(k + ':').length - 1, k).toBe(2)
    expect(css).toMatch(/\.card \{[^}]*box-shadow: var\(--elev-hi\), var\(--elev-2\)/)
    expect(css).toMatch(/body \{[\s\S]*?background-attachment: fixed/)
  })
  it('pins keep their thicker outline in the new palette', () => {
    expect(css).toMatch(/\.g-pin-post \{[^}]*stroke-width: 2\.5/)
  })
})
