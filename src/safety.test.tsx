// Staying safe (owner, Oct 2026): reporting suspicious posts (once per post, not one's own, 10 a day; three people hide a post
// until an administrator decides), the "spot a fake job" page and the warnings where the risk is highest. Static rendering only.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, clampFuture, inbox, offersFor, parseState, poolOf } from './domain/match/logic'
import { REPORTS_PER_DAY, groupReports, parseReports, reportPost, reportedIds, type Report } from './domain/match/reports'
import { buildState, dbProblem, reportQueue, rowToPost, type PostRow, type ReportRow } from './domain/match/remote'
import { seedState } from './domain/match/seed'
import { ME, MY_EMPLOYER, type MatchState, type Seeker } from './domain/match/types'
import { safety } from './locales/safety'
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
import { SafetyPage } from './pages/safety'
import { PostPage } from './pages/post'
import { CasePage } from './pages/case'
import { PreparePage } from './pages/match'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-10-03T08:00:00.000Z')
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
const T = (k: keyof typeof safety, v?: Record<string, string | number>) => tr(k, v, 'th').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function html(node: ReactNode, st: MatchState, search = ''): string {
  const g = globalThis as { document?: unknown; window?: unknown }
  const hadD = 'document' in g, prevD = g.document, hadW = 'window' in g, prevW = g.window
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  if (search) g.window = { location: { search } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (hadD) g.document = prevD; else delete g.document; if (search) { if (hadW) g.window = prevW; else delete g.window } }
}
/** a job seeker with a pin that reaches the sample posts in Jiangsu */
const seekerState = (): MatchState => {
  const st = seedState(NOW); st.role = 'seeker'
  st.me = { id: ME, name: 'you', origin: { country: 'TH', province: 'TH-10' }, pins: [{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(-5) }], synthetic: true } satisfies Seeker
  return st
}

describe('reporting a post', () => {
  it('once per post, never my own, a short optional note', () => {
    const st = seedState(NOW)
    const r = reportPost(st, 'post-s2', 'fee', '  asked for 5000 baht  ', 'r1', at(0))
    expect(r.ok && [r.value.note, r.value.reason]).toEqual(['asked for 5000 baht', 'fee'])
    if (!r.ok) throw new Error('report')
    const again = reportPost({ ...st, reports: [r.value] }, 'post-s2', 'false', '', 'r2', at(0)); expect(again.ok ? 'ok' : again.problem).toBe('reported')
    const mine = { ...st, posts: st.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER } : p)) }
    const own = reportPost(mine, 'post-s1', 'fee', '', 'r3', at(0)); expect(own.ok ? 'ok' : own.problem).toBe('state')
    const long = reportPost(st, 'post-s1', 'other', 'x'.repeat(201), 'r4', at(0)); expect(long.ok ? 'ok' : long.problem).toBe('reportNote')
    const gone = reportPost(st, 'nope', 'fee', '', 'r5', at(0)); expect(gone.ok ? 'ok' : gone.problem).toBe('unknown')
    const odd = reportPost(st, 'post-s1', 'spam' as never, '', 'r6', at(0)); expect(odd.ok ? 'ok' : odd.problem).toBe('state')
  })
  it('10 reports a day at most; the next day counts again', () => {
    const st = seedState(NOW)
    const ten: Report[] = Array.from({ length: REPORTS_PER_DAY }, (_, i) => ({ id: `r${i}`, postId: `x${i}`, reason: 'other', note: '', at: at(-0.5) }))
    const r = reportPost({ ...st, reports: ten }, 'post-s1', 'fee', '', 'n', at(0)); expect(r.ok ? 'ok' : r.problem).toBe('reportLimit')
    expect(reportPost({ ...st, reports: ten }, 'post-s1', 'fee', '', 'n', at(0.6)).ok).toBe(true)
  })
  it('a post I reported leaves my offers and my board (unless I applied to it)', () => {
    const st = seekerState()
    expect(offersFor(st, poolOf(st), NOW).map((p) => p.id)).toContain('post-s2')
    const after = { ...st, reports: [{ id: 'r', postId: 'post-s2', reason: 'fee' as const, note: '', at: at(0) }] }
    expect(offersFor(after, poolOf(after), NOW).map((p) => p.id)).not.toContain('post-s2')
    expect(inbox(after, poolOf(after), NOW, () => 0).count).toBe(inbox(st, poolOf(st), NOW, () => 0).count - 1)
    expect([...reportedIds(after)]).toEqual(['post-s2'])
    expect(src('./pages/board.tsx')).toContain('(!reported.has(p.id) || mineApplied.has(p.id))')
  })
  it('stored reports are checked; "back to real time" moves them too', () => {
    const ok = { id: 'r', postId: 'post-s2', reason: 'fee', note: '', at: at(0) }
    expect(parseReports([ok, { ...ok, id: 'twice' }, { ...ok, id: 'b', postId: 'gone' }, { ...ok, id: 'c', reason: 'spam' }, { ...ok, id: 'd', note: 'x'.repeat(201) }, 'junk'], new Set(['post-s2']))).toEqual([ok])
    const st = seedState(NOW)
    expect(parseState(JSON.parse(JSON.stringify({ ...st, reports: [ok] })))!.reports).toEqual([ok])
    const { reports: _r, ...old } = JSON.parse(JSON.stringify(st)) as MatchState
    expect(parseState(old)!.reports).toEqual([]) // saved before reporting existed
    expect(clampFuture({ ...st, reports: [{ ...ok, reason: 'fee', at: at(3) }] }, NOW).reports[0].at).toBe(at(0))
  })
})

describe('the database side', () => {
  const row = (r: Partial<ReportRow>): ReportRow => ({ id: 'x', post_id: 'p1', reporter_id: 'u2', reason: 'fee', note: null, status: 'open', created_at: at(0), ...r })
  it('the administrator\'s queue: open reports grouped by post, most reported first', () => {
    const q = reportQueue([row({ id: '1' }), row({ id: '2', reason: 'false', note: 'fake company' }), row({ id: '3', post_id: 'p2', created_at: at(-1) }), row({ id: '4', status: 'dismissed' }), row({ id: '5', reason: 'spam' })])
    expect(q.map((g) => [g.postId, g.count])).toEqual([['p1', 2], ['p2', 1]])
    expect([q[0].reasons, q[0].notes]).toEqual([{ fee: 1, false: 1 }, ['fake company']])
    expect(groupReports([]).length).toBe(0)
  })
  it('only my own reports reach my state; hidden posts and suspension are carried over; errors read clearly', () => {
    const st = buildState({ uid: 'u1', name: 'Me', profile: { user_type: 'employer', company: 'Co', origin_country: null, origin_province: null, member: false, suspended: true }, posts: [], pins: [], acceptances: [], clockHours: 0,
      reports: [row({ reporter_id: 'u1', id: 'mine' }), row({ reporter_id: 'u9', id: 'theirs' })] })
    expect([st.reports.map((r) => r.id), st.suspended]).toEqual([['mine'], true])
    const base: PostRow = { id: 'p', employer_id: 'u1', is_sample: false, company: 'Co', position: 'Cook', industry: 'food_service', skills: ['culinary_arts'], min_years: 0, details: '', headcount: 1, employment: null, salary_min: null, salary_max: null, salary_currency: null,
      start_date: null, languages: [], education: 'none', benefits: [], country: 'TH', province: 'TH-10', created_at: at(0) } as unknown as PostRow
    expect([rowToPost({ ...base, hidden: true }, 'u1').hidden, rowToPost(base, 'u1').hidden]).toEqual([true, undefined])
    expect([dbProblem({ message: 'report_limit' }), dbProblem({ message: 'suspended' })]).toEqual(['reportLimit', 'suspended'])
  })
  it('the database file: one report per person, 10 a day, three hide a post, only administrators decide, suspension blocks posting and renewing', () => {
    const sql = src('../supabase/migrations/0005_reports.sql')
    for (const s of ['unique (post_id, reporter_id)', "raise exception 'report_limit'", 'count(distinct reporter_id)', '>= 3', 'create or replace function public.moderate_post',
      "if not public.is_admin() then raise exception 'not_admin'", "raise exception 'suspended'", 'and not hidden', 'revoke update, delete on public.reports'])
      expect(sql, s).toContain(s)
    expect(src('./matchData.tsx')).toContain("sb.rpc('moderate_post', { p_post: postId, p_action: action })")
  })
})

describe('pages', () => {
  it('"How to spot a job scam": warning signs, what to do, 1694 and the official website; listed under Prepare', () => {
    const h = html(<SafetyPage />, seedState(NOW))
    for (const k of ['m.sc.key', 'm.sc.f1.t', 'm.sc.f2.t', 'm.sc.f4.t', 'm.sc.d3', 'm.sc.emp.t'] as const) expect(h, k).toContain(T(k))
    expect(h).toContain('href="tel:1694"'); expect(h).toContain('href="https://www.doe.go.th/"')
    expect(html(<PreparePage />, seedState(NOW))).toContain('href="/safety"')
    expect(src('./App.tsx')).toContain('safety: <SafetyPage />')
  })
  it('the post page: a free-to-apply warning, and a report link (not on my own post)', () => {
    const st = seekerState()
    const h = html(<PostPage />, st, '?id=post-s2')
    expect(h).toContain(T('m.sc.note.apply')); expect(h).toContain(`${T('m.rpt.button')}</button>`)
    const reported = html(<PostPage />, { ...st, reports: [{ id: 'r', postId: 'post-s2', reason: 'fee', note: '', at: at(0) }] }, '?id=post-s2')
    expect(reported).toContain(T('m.rpt.already')); expect(reported).not.toContain(`${T('m.rpt.button')}</button>`)
    const emp = seedState(NOW); emp.role = 'employer'
    emp.posts = emp.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER, hidden: true } : p))
    const own = html(<PostPage />, emp, '?id=post-s1')
    expect(own).not.toContain(`${T('m.rpt.button')}</button>`); expect(own).toContain(T('m.rpt.hiddenOwner'))
  })
  it('the case page warns the worker at the documents step', () => {
    const st = seedState(NOW); st.role = 'seeker'
    st.cases = st.cases.map((c) => ({ ...c, steps: { opened: c.steps.opened, submitted: c.steps.submitted, accepted: c.steps.accepted }, docs: {}, tests: {} }))
    expect(html(<CasePage />, st, '?id=case-s1')).toContain(T('m.sc.note.documents'))
    expect(html(<CasePage />, seedState(NOW), '?id=case-s1')).not.toContain(T('m.sc.note.documents')) // the sample is at training
  })
  it('every new message has three languages and no key is taken from another file', () => {
    for (const [k, v] of Object.entries(safety)) { expect(v.length, k).toBe(3); expect(v.every((x) => x.trim().length > 0), k).toBe(true) }
    const others = { ...brand, ...common, ...data, ...entry, ...geo, ...home, ...jobboard, ...journey, ...legal, ...match, ...pages, ...plan, ...provinces, ...ux, ...cases }
    expect(Object.keys(safety).filter((k) => k in others)).toEqual([])
  })
})
