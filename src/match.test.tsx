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
import { BackofficePage, NotificationsPage, SeekPage, SoonNote } from './pages/match'
import { TILT, leanPoint } from './components/geomap'
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
    expect(geo).toMatch(/onPickCountry\(d\.code as GeoCode\)/)
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
    expect(page).toMatch(/<button id="dest-prov" type="button" role="combobox"[^>]*aria-required="true"/)
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
  it('the map opens framed on Thailand + China, seen through an oblique camera — without edge haze (owner, Oct 2026)', () => {
    const geo = src('./components/geomap.tsx')
    expect(geo).toMatch(/x\.code === 'TH' \|\| x\.code === 'CN'/)
    expect(geo).not.toContain('map-haze')
    expect(src('./index.css')).not.toContain('map-haze')
    expect(geo).toContain('rotateX(${tilt}deg)')
  })
})

describe('languages look alike (owner, Oct 2026)', () => {
  const css = src('./index.css')
  it('each language has its own font family from the device; English no longer falls back to a Chinese font', () => {
    expect(css).toMatch(/html:lang\(th\) body, \[lang\|="th"\] \{ font-family: "Noto Sans Thai", "Leelawadee UI"/)
    expect(css).toMatch(/html:lang\(zh\) body, \[lang\|="zh"\] \{ font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei"/)
    const en = css.match(/html:lang\(en\) body, \[lang\|="en"\] \{ font-family: ([^}]*)\}/)?.[1] ?? ''
    expect(en.startsWith('"Segoe UI", system-ui')).toBe(true)
    expect(en).not.toContain('YaHei')
    expect(src('../index.html')).not.toMatch(/fonts\.googleapis|fonts\.gstatic/) // nothing downloaded
  })
  it('headings break evenly; the Lobby headline scales with the screen and is a little smaller in English', () => {
    expect(css).toMatch(/h1, h2, h3 \{ text-wrap: balance \}/)
    expect(css).toMatch(/\.hero-title \{ font-size: clamp\(/)
    expect(css).toMatch(/html:lang\(en\) \.hero-title \{ font-size: clamp\(/)
    expect(html(<Landing />)).toContain('class="hero-title mt-6 font-bold text-ink"')
  })
  it('on every screen only the current step pill shows its name (others keep it for screen readers)', () => {
    const page = html(<SeekPage />, { ...seedState(NOW), role: 'seeker', me: seeker([]) })
    // the origin is already set in this state, so step 2 is current
    expect(page).toContain('<span>' + T('m.seek.s2') + '</span>')
    expect(page).toContain('<span class="sr-only">' + T('m.seek.s1') + '</span>')
    expect(page).toContain('<span class="sr-only">' + T('m.seek.s3') + '</span>')
    expect(page).not.toContain('sm:not-sr-only')
  })
  it('skill chips in a row share one height; narrow-rail labels may wrap tidily', () => {
    expect(src('./pages/match.tsx')).toContain('grid grid-cols-2 auto-rows-fr gap-2')
    expect(css).toMatch(/\.chip-check \{[^}]*height: 100%/)
    expect(src('./components/sidenav.tsx')).toContain("'block w-full text-[11px] leading-tight tracking-tight break-words [hyphens:auto]'")
  })
})

describe('map review 2 (owner, Oct 2026): lean, upright labels, all ASEAN countries, capitals', () => {
  const geo = src('./components/geomap.tsx')
  const css = src('./index.css')
  it('1–2 the lean is smaller once a country is chosen, and the overview is zoomed a little closer', () => {
    expect(TILT.overview).toBe(28)
    expect(TILT.focused).toBe(14)
    expect(TILT.focused).toBeLessThan(TILT.overview)
    expect(geo).toContain('(country || province ? TILT.focused : TILT.overview)')
    expect(geo).toMatch(/viewForBox\(\[\[x0, y0\], \[x1, y1 \+ \(y1 - y0\) \* 0\.22\]\], w, h, 0\.94, 4\)/)
  })
  it('3 upright layer: no text is drawn on the leaning plane; labels use the same projection as the CSS lean', () => {
    const plane = geo.slice(geo.indexOf('className="map-tilt map-stage"'), geo.indexOf('</svg>'))
    expect(plane).not.toContain('<text')
    expect(geo).toMatch(/<svg width=\{w\} height=\{h\} viewBox=\{`0 0 \$\{w\} \$\{h\}`\} className="absolute inset-0 pointer-events-none" aria-hidden>/)
    // the projection: identity without lean, the pivot stays put, the far (upper) side shrinks and is foreshortened
    expect(leanPoint(123, 45, 800, 500, 0)).toEqual([123, 45])
    const [ox, oy] = leanPoint(400, 310, 800, 500, 28)
    expect(ox).toBeCloseTo(400); expect(oy).toBeCloseTo(310)
    const far = leanPoint(200, 60, 800, 500, 28)
    expect(far[0]).toBeGreaterThan(200 - (400 - 200) * 0.2) // pulled towards the centre line
    expect(far[1]).toBeGreaterThan(60) // the far edge appears lower than on the flat map
  })
  it('5 every ASEAN country can be tapped; only Thailand and China ever reach saved data', () => {
    expect(geo).toContain('else if (d.code && d.code in GEO) onPickCountry(d.code as GeoCode)')
    for (const c of ['VN', 'SG', 'TL']) {
      const r = addPin(seeker([]), { place: { country: c, province: 'X' } as never, industry: 'technology', skills: ['data_analysis'] }, 'p', at(0))
      expect(r.ok ? 'ok' : r.problem, c).toBe('place')
    }
  })
  it('4 the country list has all 12 countries: open now (2) and a greyed "coming soon" group (10), no suffix on names', () => {
    const page = html(<SeekPage />, { ...seedState(NOW), role: 'seeker', me: seeker([]) })
    const sel = page.slice(page.indexOf('<button id="dest-prov-c"'), page.indexOf('<button id="dest-prov"'))
    expect(sel.match(/role="option"/g)?.length).toBe(12)
    expect(sel).toContain(`>${T('m.countryOpen')}</div>`)
    expect(sel).toMatch(new RegExp(`class="[^"]*text-muted"[^>]*>${T('geo.soon')}</div>`)) // the group header, once
    expect(sel.split(T('geo.soon')).length - 1).toBe(1) // no "· coming soon" after each name
    for (const c of ['TH', 'CN', 'VN', 'SG', 'TL']) expect(sel, c).toContain(`<span class="truncate">${T(`geo.c.${c}` as MsgKey)}</span>`)
    expect(sel.match(/role="option" aria-selected="false" class="[^"]*text-muted/g)?.length).toBe(10) // the 10 planned countries are grey
  })
  it('A the lists open below the field, closed by default, sized to ~7 country rows and 10 province rows (the rest scrolls)', () => {
    const page = html(<SeekPage />, { ...seedState(NOW), role: 'seeker', me: seeker([]) })
    expect(page).toMatch(/<button id="dest-prov-c" type="button" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="[^"]+" aria-labelledby="dest-prov-cl"/)
    expect(page).toMatch(/<ul id="[^"]+" role="listbox" aria-labelledby="dest-prov-cl" hidden="" style="max-height:(\d+)px"/)
    const heights = [...page.matchAll(/role="listbox" aria-labelledby="dest-prov-(c|p)l" hidden="" style="max-height:(\d+)px"/g)].map((m) => [m[1], Number(m[2])])
    expect(heights).toEqual([['c', 7 * 40 + 2 * 28 + 8], ['p', 10 * 40 + 8]])
    const ls = src('./components/listselect.tsx')
    expect(ls).toContain('top-full mt-1.5') // below the field, never over it
    for (const k of ["'ArrowDown'", "'ArrowUp'", "'Home'", "'End'", "'PageDown'", "'Escape'", "'Enter'"]) expect(ls, k).toContain(k)
    expect(ls).toContain("document.addEventListener('pointerdown', away)") // a press outside closes
  })
  it('5 choosing a planned country shows a coming-soon note with its capital', () => {
    const note = html(<SoonNote country="VN" />)
    expect(note).toContain('role="status"')
    expect(note).toContain(T('geo.c.VN' as MsgKey)); expect(note).toContain(T('geo.soon')); expect(note).toContain(T('geo.city.Hanoi' as MsgKey))
    expect(note).toContain(T('geo.soon.now'))
    const m = src('./pages/match.tsx')
    expect(m).toContain('disabled={!open}') // no provinces for a planned country
    expect(m).toContain('disabled={!!oc && !isCountry(oc)} onClick={confirmOrigin}')
    expect(m).toContain("disabled={st.me.pins.length >= MAX_PINS || (!!dc && !isCountry(dc))}")
    expect(m).toContain('disabled={!isCountry(c) || !p}')
  })
  it('7–9 capitals: Bangkok and Beijing on the overview, otherwise the chosen country; names in 3 languages', () => {
    expect(geo).toContain("(country ? [capitalOf(country)] : [capitalOf('TH'), capitalOf('CN')])")
    expect(geo).toContain('className="g-capital"')
    for (const c of ['Bangkok', 'Beijing', 'Hanoi', 'Naypyidaw', 'Vientiane', 'Singapore', 'PhnomPenh', 'KualaLumpur', 'Jakarta', 'Manila', 'BandarSeriBegawan', 'Dili'])
      expect(`geo.city.${c}` in messages, c).toBe(true)
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
