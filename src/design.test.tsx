// Design upgrade (owner, Oct 2026, from a reference video): A accent colours, B the board as cards with a details panel,
// C the calendar, D admin analytics, E shell polish. Static rendering only; the charts and panels were also opened in a browser.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider, ACCENTS } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, parseState } from './domain/match/logic'
import { applyCaseAction, newCase, type Case } from './domain/match/cases'
import { calendarEvents, monthGrid, toIcs } from './domain/match/calendar'
import { caseStages, change, heatWeeks, niceMax, parseDaily, periods, toCsv, total } from './domain/match/analytics'
import { rowToCase } from './domain/match/remote'
import { seedState } from './domain/match/seed'
import { ME, MY_EMPLOYER, type MatchState } from './domain/match/types'
import { design } from './locales/design'
import { brand } from './locales/brand'
import { common } from './locales/common'
import { data } from './locales/data'
import { entry } from './locales/entry'
import { geo } from './locales/geo'
import { home } from './locales/home'
import { jobboard } from './locales/jobboard'
import { journey } from './locales/journey'
import { legal } from './locales/legal'
import { match } from './locales/match'
import { pages } from './locales/pages'
import { plan } from './locales/plan'
import { provinces } from './locales/provinces'
import { ux } from './locales/ux'
import { cases } from './locales/cases'
import { safety } from './locales/safety'
import { SettingsPage } from './pages/match'
import { BoardPage } from './pages/board'
import { CalendarPage } from './pages/calendar'
import { CasePage } from './pages/case'
import { AnalyticsPage, sampleDaily } from './pages/analytics'
import { Header } from './components/shell'
import { SideNav } from './components/sidenav'
import { PagedList } from './components/pager'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const css = src('./index.css')
const NOW = Date.parse('2026-10-03T08:00:00.000Z')
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
const ymd = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const TODAY = ymd(NOW)
const T = (k: keyof typeof design, v?: Record<string, string | number>) => tr(k, v, 'th').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function html(node: ReactNode, st: MatchState, search = ''): string {
  const g = globalThis as { document?: unknown; window?: unknown }
  const hadD = 'document' in g, prevD = g.document, hadW = 'window' in g, prevW = g.window
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {}, lang: 'th' } }
  if (search) g.window = { location: { search } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (hadD) g.document = prevD; else delete g.document; if (search) { if (hadW) g.window = prevW; else delete g.window } }
}
const lum = ([r, g, b]: number[]) => { const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const cr = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
/** every block with this selector, merged in order (later ones win, as in the browser) */
const blocks = (sel: string) => { let out: Record<string, number[]> = {}, at = css.indexOf(sel); expect(at, sel).toBeGreaterThan(-1); while (at >= 0) { const b = css.slice(at, css.indexOf('}', at)); out = { ...out, ...Object.fromEntries([...b.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+)/g)].map((m) => [m[1], [+m[2], +m[3], +m[4]]])) }; at = css.indexOf(sel, at + sel.length) } return out }
const block = (sel: string) => { const i = css.indexOf(sel); expect(i, sel).toBeGreaterThan(-1); const b = css.slice(i, css.indexOf('}', i)); return Object.fromEntries([...b.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+)/g)].map((m) => [m[1], [+m[2], +m[3], +m[4]]])) as Record<string, number[]> }

describe('A. accent colours', () => {
  it('four extra accents, each with its own light and dark steps, all keeping text ≥ 4.5:1', () => {
    expect(ACCENTS).toEqual(['indigo', 'forest', 'ocean', 'plum', 'ember'])
    const page = [243, 244, 247], surface = [255, 255, 255], s3 = [236, 238, 242], dSurface = [21, 22, 28], dS3 = [38, 40, 49]
    for (const a of ACCENTS.slice(1)) {
      const l = block(`:root:not([data-theme='dark'])[data-accent='${a}']`), d = block(`:root[data-theme='dark'][data-accent='${a}']`)
      for (const [x, y, what] of [[l.primary, l.onprimary, 'button text'], [l.primary, page, 'link on page'], [l.primary, surface, 'link on card'], [l.primary, s3, 'link on grey'], [l.brandfg, l.brand, 'selected chip'],
        [d.primary, d.onprimary, 'dark button text'], [d.primary, dSurface, 'dark link'], [d.primary, dS3, 'dark link on grey'], [d.brandfg, d.brand, 'dark selected chip']] as const)
        expect(cr(x, y), `${a}: ${what}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('restored before the first paint; Settings offers the colours (name + swatch) and the first day of the week', () => {
    const init = src('../public/theme-init.js')
    expect(init).toContain("localStorage.getItem('cnth-accent')"); expect(init).toContain("setAttribute('data-accent', accent)")
    const h = html(<SettingsPage />, seedState(NOW))
    for (const a of ACCENTS) { expect(h).toContain(`swatch-${a}`); expect(h).toContain(T(`m.accent.${a}` as keyof typeof design)) }
    expect(h).toContain(T('m.settings.week.sun')); expect(h).toContain(T('m.settings.week.mon'))
    expect(css).toMatch(/\.swatch-ember \{ background:/)
  })
})

describe('B. the board as cards', () => {
  const seeker = (): MatchState => {
    const st = seedState(NOW); st.role = 'seeker'
    st.me = { id: ME, name: 'you', origin: { country: 'TH', province: 'TH-10' }, pins: [{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(-5) }], synthetic: true }
    return st
  }
  it('after the reference: main button by the title, pill filters with the count, centred cards with two actions and a fill bar, a card/map switch', () => {
    const h = html(<BoardPage />, seeker())
    expect(h).toMatch(/<h1 class="h1">[^<]*<\/h1>.*class="btn-primary !rounded-full"/s)
    expect(h).toContain('bd-card p-3.5 sm:p-5 fit:p-4 flex flex-row sm:flex-col items-start sm:items-center'); // on its side on phones, centred from 640 px expect(h).toContain('rar-avatar'); expect(h).toContain('class="fill-bar mt-1"')
    expect(h).toContain(`>${T('m.bd.details')}</button>`); expect(h).toContain(T('m.bd.apply'))
    expect(h).toContain(T('m.bd.view.cards')); expect(h).toContain(T('m.bd.view.map'))
    expect(h).not.toContain('id="bd-map"') // the map shows when you switch to it
    expect(h).toContain(`aria-controls="bd-more"`) // more filters fold away
    expect(h).toContain(T('m.sample.badge')) // sample posts say so
    const emp = seedState(NOW); emp.role = 'employer'
    expect(html(<BoardPage />, emp)).toContain(T('m.bd.scope.mine')) // employers: all posts, or only mine
  })
  it('the details panel is a native modal dialog that slides in (and is a bottom sheet on phones); the header search fills the board search', () => {
    const d = src('./components/drawer.tsx')
    expect(d).toContain('d.showModal()'); expect(d).toContain("aria-labelledby={titleId}")
    expect(css).toMatch(/\.drawer-panel \{ position: fixed; margin: 0; inset: 0 0 0 auto/)
    expect(css).toMatch(/@media \(max-width: 639px\) \{\s*\.drawer-panel \{ inset: auto 0 0 0/)
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .drawer-panel[open] { animation: none } }')
    expect(html(<BoardPage />, seeker(), '?q=Quality')).toContain('value="Quality"')
  })
})

describe('C. the calendar', () => {
  const acc = { id: 'a1', postId: 'p1', seekerId: ME }
  const ok = (c: Case, a: Parameters<typeof applyCaseAction>[1]) => { const r = applyCaseAction(c, a, at(0), TODAY); if (!r.ok) throw new Error(r.problem); return r.value }
  const bad = (c: Case, a: Parameters<typeof applyCaseAction>[1]) => { const r = applyCaseAction(c, a, at(0), TODAY); return r.ok ? 'ok' : r.problem }
  it('the agency sets and clears appointment days, from today on, while the case is with it', () => {
    let c = newCase('c', acc, at(0), true)
    c = ok(c, { kind: 'date', key: 'start', date: ymd(NOW + 40 * DAY_MS) })
    c = ok(c, { kind: 'trainDate', id: 'orient', date: ymd(NOW + 3 * DAY_MS) })
    expect([c.dates.start, c.trainings[0].date]).toEqual([ymd(NOW + 40 * DAY_MS), ymd(NOW + 3 * DAY_MS)])
    expect(ok(c, { kind: 'date', key: 'start', date: null }).dates).toEqual({})
    expect(bad(c, { kind: 'date', key: 'start', date: ymd(NOW - 2 * DAY_MS) })).toBe('available')
    expect(bad(c, { kind: 'trainDate', id: 'nope', date: ymd(NOW + DAY_MS) })).toBe('state')
    expect(bad(newCase('w', acc, at(0), false), { kind: 'date', key: 'start', date: ymd(NOW + DAY_MS) })).toBe('state') // not with the agency yet
  })
  it('cases saved before appointments existed still load; database rows carry them', () => {
    const st = seedState(NOW)
    const old = JSON.parse(JSON.stringify(st)) as MatchState
    delete (old.cases[0] as Partial<Case>).dates
    expect(parseState(old)!.cases[0].dates).toEqual({})
    const bad = JSON.parse(JSON.stringify(st)) as MatchState; (bad.cases[0].dates as Record<string, string>).party = TODAY
    expect(parseState(bad)!.cases).toEqual([])
    const r = rowToCase({ id: 'x', acceptance_id: 'a', post_id: 'p', seeker_id: 'u', steps: { opened: at(0) }, docs: {}, tests: {}, permit: {}, trainings: [{ id: 'orient', name: '@orient', done: false, date: TODAY }], departure_date: null, note: null, created_at: at(0), dates: { start: TODAY, junk: 'x', skill: 'soon' } }, 'u')
    expect([r.dates, r.trainings[0].date]).toEqual([{ start: TODAY }, TODAY])
  })
  it('each side sees its own appointments; employers also see when their posts end', () => {
    const st = seedState(NOW); st.role = 'seeker'
    const mine = calendarEvents(st, false)
    expect(mine.map((e) => e.kind)).toEqual(['training', 'training', 'start'])
    expect(mine.every((e) => e.caseId === 'case-s1')).toBe(true)
    const emp = seedState(NOW); emp.role = 'employer'
    emp.posts = emp.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER } : p))
    expect(calendarEvents(emp, false).map((e) => e.kind)).toEqual(['expiry']) // not the seeker's case
    expect(calendarEvents(emp, true).filter((e) => e.caseId).length).toBe(3) // the agency sees every case
    const done = { ...st, cases: st.cases.map((c) => ({ ...c, steps: { ...c.steps, training: at(0), permit: at(0), departure: at(0), arrived: at(0) } })) }
    expect(calendarEvents(done, false)).toEqual([]) // a finished case leaves the calendar
  })
  it('month grids start on Sunday or Monday; the .ics file is valid all-day events', () => {
    const sun = monthGrid(2026, 9, 0), mon = monthGrid(2026, 9, 1) // October 2026 starts on a Thursday
    expect([sun[0][0], sun[0][4], mon[0][0], mon[0][3]]).toEqual(['2026-09-27', '2026-10-01', '2026-09-28', '2026-10-01'])
    expect(sun.every((w) => w.length === 7)).toBe(true); expect(sun.flat()).toContain('2026-10-31')
    const ics = toIcs([{ id: 'c:start', day: '2026-12-31', title: 'Start, day; one' }], new Date('2026-10-03T08:00:00Z'))
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101')
    expect(ics).toContain('SUMMARY:Start\\, day\\; one'); expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true); expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('the calendar page and the case page show the appointments; the agency can set them on the case', () => {
    const st = seedState(NOW); st.role = 'seeker'
    const cal = html(<CalendarPage />, st)
    expect(cal).toContain('role="grid"'); expect(cal).toContain(T('m.cal.upcoming')); expect(cal).toContain('cal-training'); expect(cal).toContain(T('m.cal.ics'))
    const cs = html(<CasePage />, st, '?id=case-s1')
    expect(cs).toContain(T('m.cs.appt')) // a tab beside the checklists
    expect(src('./pages/case.tsx')).toContain("{tab === 'appt' && <Appointments c={c} />}")
    expect(cs).toContain(T('m.cs.ag.tab.dates')) // the agency part (local demo) has an appointments tab with the date fields
    expect(src('./App.tsx')).toContain('calendar: <CalendarPage />')
  })
})

describe('D. admin analytics', () => {
  it('daily totals: tolerant parsing, the period against the one before, round axis tops', () => {
    const rows = parseDaily([{ day: '2026-10-02T00:00:00', visits: '5', signups: 1, posts: -3, applications: 2.6, cases: null, reports: 0 }, { day: 'bad' }, { day: '2026-10-01', visits: 3 }])
    expect(rows.map((r) => [r.day, r.visits, r.posts, r.applications, r.cases])).toEqual([['2026-10-01', 3, 0, 0, 0], ['2026-10-02', 5, 0, 3, 0]])
    const { cur, prev } = periods(rows, 1)
    expect([total(cur, 'visits'), total(prev, 'visits'), change(5, 3), change(0, 0), change(4, 0)]).toEqual([5, 3, 66.7, 0, null])
    expect([niceMax(3), niceMax(7), niceMax(12), niceMax(230)]).toEqual([4, 10, 20, 250])
  })
  it('activity grid, cases by stage and the CSV hold totals only', () => {
    const rows = sampleDaily(TODAY, 140)
    const weeks = heatWeeks(rows, 20, 1, TODAY)
    expect([weeks.length, weeks.every((w) => w.length === 7)]).toEqual([20, true])
    expect(weeks[19].some((d) => d.day === TODAY && d.n >= 0)).toBe(true)
    expect(weeks.flat().filter((d) => d.day > TODAY).every((d) => d.n === -1)).toBe(true) // future days are left empty
    expect(caseStages(seedState(NOW).cases)).toEqual({ waiting: 0, agency: 0, prep: 1, travel: 0, done: 0 })
    const csv = toCsv(rows.slice(-2))
    expect(csv.split('\n')[0]).toBe('day,visits,signups,posts,applications,cases,reports')
    expect(csv.trim().split('\n').length).toBe(3)
  })
  it('the page (local demo): labelled sample numbers, key numbers, a chart with a table view, cases by stage, the activity grid', () => {
    const h = html(<AnalyticsPage />, seedState(NOW))
    expect(h).toContain(T('m.an.sample'))
    for (const k of ['m.an.m.visits', 'm.an.m.signups', 'm.an.m.applications', 'm.an.m.cases', 'm.an.table', 'm.an.cases', 'm.an.activity', 'm.an.privacy'] as const) expect(h, k).toContain(T(k))
    expect(h).toContain('class="viz-line"'); expect(h).toContain('viz-c3'); expect(h).toContain('viz-heat')
    expect(h).toContain('tabindex="0"') // the chart takes the arrow keys
  })
  it('the database: anonymous visits, totals for administrators only, appointment days on cases', () => {
    const sql = src('../supabase/migrations/0006_calendar_analytics.sql')
    for (const s of ['add column if not exists dates jsonb', "elsif p_action in ('date', 'train_date') then", 'create table if not exists public.daily_visits', 'grant execute on function public.track_visit() to anon, authenticated',
      "if not public.is_admin() then raise exception 'not_admin'", "revoke insert, update, delete on public.daily_visits from anon, authenticated", "at time zone 'Asia/Bangkok'", 'dates = c.dates'])
      expect(sql, s).toContain(s)
    expect(sql).not.toMatch(/ip_address|user_agent|visitor_id/)
    const v = src('./visit.ts')
    expect(v).toContain("sb.rpc('track_visit')"); expect(v).toContain("localStorage.getItem(KEY) === day")
  })
})

describe('round 2 (owner, Oct 2026)', () => {
  it('the back office is in tabs (arrow keys move between them) with compact rows; job titles stay headings', () => {
    const m = src('./pages/match.tsx')
    expect(m).toContain(`role="tablist" aria-label={t('m.adm.tabs')} onKeyDown={keys}`)
    expect(m).toContain(`[{ k: 'overview', icon: 'overview' }, { k: 'verify', icon: 'shield' }, { k: 'reports', icon: 'alert' }, { k: 'cases', icon: 'plane' }, { k: 'posts', icon: 'posts' }, { k: 'sim', icon: 'sim' }]`) // + simulated data (owner, Oct 2026)
    expect(m).toContain('role="tabpanel"'); expect(m).toContain("tabIndex={tab === k ? 0 : -1}")
  })
  it('the activity grid keeps a small fixed size instead of stretching across the page', () => {
    const c = src('./components/charts.tsx')
    expect(c).toContain('<svg width={width} height={height}'); expect(c).toContain('const s = 11, g = 3, lw = 34')
    expect(css).toContain('.viz-tick-sm { font-size: 10px }')
  })
  it('after signing up with e-mail confirmation on, the message says to open your own inbox and press the link', () => {
    expect(tr('m.rg.checkMail', { email: 'a@b.co' }, 'th')).toContain('เปิดกล่องอีเมลส่วนตัวของคุณ')
    expect(tr('m.rg.checkMail', { email: 'a@b.co' }, 'th')).not.toContain('สร้างบัญชีแล้ว')
  })
})

describe('round 3 (owner, Oct 2026): fit the computer screen, compact phones, stronger colours, pick the Google account', () => {
  it('Google sign-in always shows the account chooser', () => {
    expect(src('./auth.tsx')).toContain("queryParams: { prompt: 'select_account' }")
  })
  it('the accent tints the page, cards, lines and glass too — muted text and control borders stay readable on every tinted surface', () => {
    for (const a of ACCENTS) {
      const l = blocks(a === 'indigo' ? `:root:not([data-theme='dark']):not([data-accent])` : `:root:not([data-theme='dark'])[data-accent='${a}']`)
      const d = blocks(a === 'indigo' ? `:root[data-theme='dark']:not([data-accent])` : `:root[data-theme='dark'][data-accent='${a}']`)
      for (const k of ['page', 'surface3', 'line', 'glass-tint', 'control-line', 'glow-a', 'glow-b']) { expect(l[k], `${a} light ${k}`).toBeDefined(); expect(d[k], `${a} dark ${k}`).toBeDefined() }
      for (const s of ['page', 'surface2', 'surface3'] as const) {
        expect(cr([84, 90, 104], l[s]), `${a} light muted/${s}`).toBeGreaterThanOrEqual(4.5)
        expect(cr(l['control-line'], l[s]), `${a} light control/${s}`).toBeGreaterThanOrEqual(3)
      }
      for (const s of ['page', 'surface', 'surface2', 'surface3'] as const) {
        expect(cr([160, 164, 178], d[s]), `${a} dark muted/${s}`).toBeGreaterThanOrEqual(4.5)
        expect(cr(d['control-line'], d[s]), `${a} dark control/${s}`).toBeGreaterThanOrEqual(3)
      }
    }
  })
  it('app pages take exactly the screen on computers (1024 px wide, 600 px tall); long lists page instead of scrolling', () => {
    expect(src('../tailwind.config.js')).toContain(`screens: { fit: { raw: '(min-width: 1024px) and (min-height: 600px)' } }`)
    expect(css).toContain(':root { --app-h: calc(100dvh - 6rem - 1px) }')
    const m = src('./pages/match.tsx')
    expect(m).toContain('fit:flex fit:flex-col fit:gap-3 fit:h-[var(--app-h)]')
    for (const [file, mark] of [['./pages/board.tsx', 'fit body="flex flex-col gap-3"'], ['./pages/calendar.tsx', ' fit>'], ['./pages/case.tsx', 'fit body="flex flex-col gap-3"'], ['./pages/analytics.tsx', 'fit body="flex flex-col gap-3"'], ['./pages/hire.tsx', ' fit>'], ['./pages/post.tsx', 'fit body="flex flex-col gap-3"']] as const)
      expect(src(file), file).toContain(mark)
    expect(m).toContain('fit body="flex flex-col gap-3"') // the back office
    const p = src('./components/pager.tsx')
    expect(p).toContain("export const FIT_QUERY = '(min-width: 1024px) and (min-height: 600px)'"); expect(p).toContain('export function PagedList')
    // the footer only on the Lobby and reading pages; "Back" moves into the header on computers
    expect(src('./App.tsx')).toContain(`const READING = ['', 'privacy', 'terms', 'sources', 'language', 'safety', 'help']`)
    expect(src('./components/shell.tsx')).toContain('<BackButton route={_.route} compact />')
  })
  it('sign-in pages are wide on computers (brand panel + form, register fields in two columns)', () => {
    const a = src('./pages/auth.tsx')
    expect(a).toContain('lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'); expect(a).toContain('<div className="grid lg:grid-cols-2 gap-4">')
  })
  it('phones: one step smaller (15 px body), smaller cards and buttons, board cards on their side, pills that scroll sideways', () => {
    expect(css).toContain('@media (max-width: 639px) { html { font-size: 15px }')
    expect(css).toMatch(/\.card \{ @apply border border-line rounded-2xl p-4 sm:p-5/)
    expect(css).toMatch(/\.btn \{ @apply [^}]*min-h-\[40px\]/)
    expect(src('./pages/board.tsx')).toContain("const SEG_SCROLL = 'flex sm:inline-flex flex-nowrap")
  })
  it('nothing runs off a short screen: the capsule sits under the header and shrinks, dialogs scroll inside, board cards drop secondary lines', () => {
    expect(css).toContain('.nav-rail { max-height: calc(100dvh - 5.5rem) }')
    expect(css).toMatch(/@media \(max-height: 760px\) \{ \.nav-rail \.mn-item\.w-12 \{ width: 2\.5rem; height: 2\.5rem \}/)
    expect(css).toContain('.modal-panel { max-height: calc(100dvh - 2rem); overflow-y: auto }')
    expect(css).toContain('@media (min-width: 1024px) and (max-height: 760px) { .bd-card .bd-opt { display: none }')
    // where a part cannot fit it scrolls inside instead of being cut off
    expect(src('./pages/match.tsx')).toContain("body ?? 'space-y-4 fit:space-y-3 fit:overflow-y-auto'")
    expect(src('./components/pager.tsx')).toContain('fit:flex-1 fit:min-h-0 fit:overflow-y-auto')
  })
  it('a paged list shows everything when the screen does not fit (phones, tests)', () => {
    const h = html(<PagedList items={[1, 2, 3]} rowH={60} keyOf={(n) => String(n)} render={(n) => <span>item {n}</span>} />, seedState(NOW))
    expect(h.match(/item \d/g)?.length).toBe(3); expect(h).not.toContain(T('m.pg.prev'))
  })
})

describe('E. shell polish', () => {
  it('the capsule names each icon on hover or focus and sets the general places apart; the header has a board search and the current role', () => {
    const nav = html(<SideNav route="board" />, seedState(NOW))
    expect(nav).toContain('class="nav-tip"'); expect(nav).toContain('nav-split')
    const st = seedState(NOW); st.role = 'employer'
    const head = html(<Header route="board" />, st)
    expect(head).toContain('role="search"'); expect(head).toContain(T('m.hd.searchHint')); expect(head).toContain('href="/choose-role"')
  })
  it('every new message has three languages and no key repeats another file', () => {
    for (const [k, v] of Object.entries(design)) { expect(v.length, k).toBe(3); expect(v.every((x) => x.trim().length > 0), k).toBe(true) }
    const others = { ...brand, ...common, ...data, ...entry, ...geo, ...home, ...jobboard, ...journey, ...legal, ...match, ...pages, ...plan, ...provinces, ...ux, ...cases, ...safety }
    expect(Object.keys(design).filter((k) => k in others)).toEqual([])
  })
})
