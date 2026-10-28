// Posts the AI rates high risk are held for review (owner, Oct 2026): saved, hidden from job seekers, and waiting in the
// administrator's queue until they are released (SQL 0012). The same in the local demo.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider, useMatch } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, applyTo, makePost, parseState, poolOf, releaseHeld, sampleApplicant, type PostInput } from './domain/match/logic'
import { groupReports, withHeld } from './domain/match/reports'
import { postToRow, rowToPost, type PostRow } from './domain/match/remote'
import { seedState } from './domain/match/seed'
import { ME, MY_EMPLOYER, type MatchState, type Post } from './domain/match/types'
import type { MsgKey } from './locales/index'
import { ai } from './locales/ai'
import { HirePage, HoldNotice } from './pages/hire'
import { BackofficePage } from './pages/match'
import { PostPage } from './pages/post'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey) => esc(tr(k, undefined, 'th'))
// pages run on the real clock (MatchProvider), so the states here are made from it
const NOW = Date.now()
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
function html(node: ReactNode, st: MatchState, search = ''): string {
  const g = globalThis as { document?: unknown; window?: unknown }
  const hadD = 'document' in g, prevD = g.document, hadW = 'window' in g, prevW = g.window
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  if (search) g.window = { location: { search } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (hadD) g.document = prevD; else delete g.document; if (search) { if (hadW) g.window = prevW; else delete g.window } }
}
const input: PostInput = {
  place: { country: 'CN', province: 'CN-JS' }, company: 'Sample Parts', position: 'Line worker', industry: 'manufacturing', skills: ['quality_control'], minYears: 0,
  details: 'Pay the 990 baht registration fee before your first shift.', headcount: 2, employment: 'contract', salary: null, startDate: at(10).slice(0, 10),
  languages: [{ lang: 'zh', level: 'basic' }], education: 'none', benefits: [],
}
/** my employer state with one post the AI held */
const heldState = (): MatchState => {
  const st = seedState(NOW); st.role = 'employer'
  const r = makePost({ ...input, held: true }, 'post-held', MY_EMPLOYER, at(0)); if (!r.ok) throw new Error(r.problem)
  st.posts = [r.value, ...st.posts]
  return st
}
const sql = () => src('../supabase/migrations/0012_ai_hold.sql')
/** the body of one function as created in a migration file */
const fn = (file: string, name: string) => { const s = src(file), i = s.indexOf(`create or replace function public.${name}(`); return s.slice(i, s.indexOf('$$;', s.indexOf('$$', i) + 2)) }

describe('the database file (0012)', () => {
  it('runs after 0011, is safe to run again, and adds held next to hidden (default false)', () => {
    const s = sql()
    expect(s.split('\n')[0]).toMatch(/Run once in Supabase → SQL Editor after\s*$/); expect(s).toContain('0011_demo_accounts.sql. Safe to run again.')
    expect(s).toContain('alter table public.posts add column if not exists held boolean not null default false;')
    expect(s).not.toMatch(/drop (table|column)|delete from public\.posts where (?!id = p_post)/)
  })
  it('a post that arrives held is hidden from the start; nothing else arrives hidden; simulated posts are never held', () => {
    const f = fn('../supabase/migrations/0012_ai_hold.sql', 'check_post')
    expect(f).toContain('new.held := coalesce(new.held, false) and not new.is_sample;')
    expect(f).toContain('new.hidden := new.held;')
    expect(f).not.toContain('new.hidden := false;')
    // the hold is decided before an administrator's own post is turned into simulated data
    expect(f.indexOf('new.held := coalesce')).toBeLessThan(f.indexOf('new.is_sample := true'))
  })
  it('the employer cannot release a hold: outside moderation held only goes from false to true, and holding hides the post', () => {
    const f = fn('../supabase/migrations/0012_ai_hold.sql', 'check_post')
    const upd = f.slice(f.indexOf("if coalesce(current_setting('call.moderating', true), '') <> 'on' then"))
    expect(upd).toContain('new.held := old.held or coalesce(new.held, false);')
    expect(upd).toContain('new.hidden := old.hidden or (new.held and not old.held);')
    // everything else is the 0008 function unchanged
    const old = fn('../supabase/migrations/0008_simulated_data.sql', 'check_post')
    const strip = (s: string) => s.split('\n').filter((l) => !/held|^\s*--|^\s*end if;$|<> 'on' then\s*$/.test(l) && !l.includes("new.hidden := false") && !l.includes('new.hidden := old.hidden')).join('\n')
    expect(strip(f)).toBe(strip(old))
  })
  it('"No problem" releases a hold; remove and suspend are as in 0005', () => {
    const f = fn('../supabase/migrations/0012_ai_hold.sql', 'moderate_post'), old = fn('../supabase/migrations/0005_reports.sql', 'moderate_post')
    expect(f).toContain('update public.posts set hidden = false, held = false where id = p_post;')
    expect(f.replace('hidden = false, held = false', 'hidden = false')).toBe(old)
    expect(sql()).toContain('grant execute on function public.moderate_post(uuid, text) to authenticated;')
    expect(f).toContain("if not public.is_admin() then raise exception 'not_admin'")
  })
  it('administrators already read hidden posts, and a hidden post takes no applications (0005)', () => {
    const r = src('../supabase/migrations/0005_reports.sql')
    expect(r).toMatch(/and not hidden\)\s*or employer_id = auth\.uid\(\) or public\.is_admin\(\)/)
    expect(r).toContain("if exists (select 1 from public.posts where id = new.post_id and hidden) then raise exception 'not_open'")
    for (const f of ['0006', '0007', '0008', '0009', '0010', '0011'].map((n) => src(`../supabase/migrations/${n}_${{ '0006': 'calendar_analytics', '0007': 'person_verify', '0008': 'simulated_data', '0009': 'ai_usage', '0010': 'post_options', '0011': 'demo_accounts' }[n]}.sql`)))
      expect(f).not.toContain('"signed-in people read posts"') // no later file narrowed the policy
  })
  it('websites that never send held keep working: a post that is not held is written exactly as before', () => {
    expect('held' in postToRow(input)).toBe(false)
    expect(postToRow({ ...input, held: true }).held).toBe(true)
    const row = { id: 'x', employer_id: 'u', is_sample: false, company: 'C', position: 'P', industry: 'technology', skills: [], min_years: 0, details: '', headcount: 1, employment: 'permanent',
      salary_min: null, salary_max: null, salary_currency: null, start_date: null, languages: [], education: 'none', benefits: [], country: 'TH', province: 'TH-10', created_at: at(0) } as PostRow
    expect(rowToPost(row, 'u').held).toBeUndefined() // a database before 0012 has no held column
    expect(rowToPost({ ...row, held: true, hidden: true }, 'u')).toMatchObject({ held: true, hidden: true })
  })
})

describe('the hold in the local demo (the same rules)', () => {
  it('a held post is hidden, takes no applications (not even from the sample job seekers), and is kept on reload', () => {
    const st = heldState(), p = st.posts[0]
    expect([p.held, p.hidden]).toEqual([true, true])
    expect(makePost(input, 'x', MY_EMPLOYER, at(0)).ok && (makePost(input, 'x', MY_EMPLOYER, at(0)) as { value: Post }).value.held).toBeUndefined()
    const other = { ...st, posts: st.posts.map((x) => (x.id === 'post-held' ? { ...x, employerId: 'employer:sample-9' } : x)) }
    other.me = { ...other.me, pins: [{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(-1) }] }
    const a = applyTo(other, poolOf(other), 'post-held', ME, { intro: '', availableFrom: at(10).slice(0, 10) }, 'a1', at(0))
    expect(a.ok ? 'ok' : a.problem).toBe('notOpen')
    const s = sampleApplicant(st, 'post-held', 'a2', at(0)); expect(s.ok ? 'ok' : s.problem).toBe('notOpen')
    const back = parseState(JSON.parse(JSON.stringify(st)))!
    expect(back.posts.find((x) => x.id === 'post-held')).toMatchObject({ held: true, hidden: true })
    // only my own posts can be held in the demo, and held always means hidden
    const forged = JSON.parse(JSON.stringify(seedState(NOW))); forged.posts[0].held = true; forged.posts[0].hidden = true
    expect(parseState(forged)!.posts[0].held).toBeUndefined()
    // editing keeps the hold (and an edit the AI rates high risk holds the post), as the database does
    expect(src('./matchData.tsx')).toContain('makePost({ ...input, held: input.held || old.held }, id, MY_EMPLOYER,')
  })
  it('"No problem" shows the post again', () => {
    const st = releaseHeld(heldState(), 'post-held')
    const p = st.posts.find((x) => x.id === 'post-held')!
    expect([p.held, p.hidden]).toEqual([undefined, undefined])
    expect(sampleApplicant(st, 'post-held', 'a3', at(0)).ok).toBe(true)
  })
  it('the queue: held posts first (longest waiting first), then the reports; a held post that was also reported is listed once', () => {
    const reports = groupReports([{ postId: 'p9', reason: 'fee', note: '', at: at(-1) }, { postId: 'h2', reason: 'false', note: 'fake', at: at(-1) }])
    const q = withHeld(reports, [{ id: 'h2', held: true, createdAt: at(-1) }, { id: 'h1', held: true, createdAt: at(-2) }, { id: 'ok', createdAt: at(-3) }])
    expect(q.map((g) => [g.postId, g.count, !!g.held])).toEqual([['h1', 0, true], ['h2', 1, true], ['p9', 1, false]])
    expect(withHeld([], [])).toEqual([])
    expect(src('./matchData.tsx')).toContain('reports: withHeld(local ? [] : reportQueue(reportRows), local || admin ? st.posts : [])')
  })
})

describe('on screen', () => {
  it('every new message exists in Thai, Chinese and English; the old "I have checked" tick is gone', () => {
    for (const k of ['ai.hold.notice', 'ai.hold.yes', 'm.hold.chip', 'm.hold.owner', 'm.hold.done', 'm.hold.doneText', 'm.adm.held', 'm.adm.heldNote', 'm.adm.release'] as const)
      expect(tr(k, undefined, 'th') && tr(k, undefined, 'zh') && tr(k, undefined, 'en'), k).toBeTruthy()
    expect('ai.chk.ack' in ai).toBe(false)
    expect(tr('ai.hold.notice', undefined, 'en')).toContain('nobody can see it until an administrator has checked it')
  })
  it('high risk: a notice instead of the tick, Continue is never blocked, the post is saved held; the basic rules never hold', () => {
    expect(html(<HoldNotice />, seedState(NOW))).toContain(T('ai.hold.notice'))
    const h = src('./pages/hire.tsx')
    expect(h).not.toContain('ai.chk.ack'); expect(h).not.toContain('setAck')
    expect(h).toContain("const held = aiOk?.result.verdict === 'high_risk'") // aiOk: an AI answer that was shown — the rule fallback leaves it null
    expect(h.match(/\{held && <HoldNotice \/>\}/g)?.length).toBe(2) // the check and "Post this job?"
    expect(h).toContain("...(held ? { held: true } : {})")
    expect(h).toContain(`<button type="button" className="btn-primary" onClick={() => setStage('confirm')}>`)
    expect(h).toContain("{held ? t('ai.hold.yes') : t(editing ? 'm.edit.cf.yes' : 'm.cf.yes')}")
    expect(h).toContain("{posted.held ? t('m.hold.done') : t(editing ? 'm.edit.done' : 'm.dn.title')}")
  })
  it('my posts mark it "awaiting review" (no renewing); its page says why nobody sees it', () => {
    const st = heldState()
    const mine = html(<HirePage />, st, '?tab=mine')
    expect(mine).toContain(T('m.hold.chip'))
    expect(mine.split(T('m.hold.chip')).length - 1).toBe(1) // only the held post
    const page = html(<PostPage />, st, '?id=post-held')
    expect(page).toContain(T('m.hold.owner')); expect(page).not.toContain(T('m.rpt.hiddenOwner')); expect(page).not.toContain(T('m.em.renew'))
  })
  it('the back office: held posts wait with the reported ones, labelled, with release · remove · suspend', () => {
    function Probe() { const { reports } = useMatch(); return <>{reports.map((g) => `${g.postId}:${g.held ? 'held' : ''}`).join(',')}</> }
    expect(html(<Probe />, heldState())).toBe('post-held:held')
    expect(html(<Probe />, seedState(NOW))).toBe('')
    const page = html(<BackofficePage />, heldState()) // the demo build without accounts shows the back office
    expect(page).toMatch(/id="adm-tab-reports"[^]*?>1<\/span><\/button>/)
    expect(page).toContain(T('m.adm.attn.reports'))
    const m = src('./pages/match.tsx')
    expect(m).toContain("{g.held && <span className=\"chip bg-danger-bg text-danger-fg border-danger-line\"><Icon name=\"ai\" size={12} />{t('m.adm.held')}</span>}")
    expect(m).toContain("{g.held && <p className=\"text-xs text-muted\">{t('m.adm.heldNote')}</p>}")
    expect(m).toContain("{t(g.held ? 'm.adm.release' : 'm.adm.dismiss')}")
    for (const a of ["decideR(g.postId, 'dismiss')", "decideR(g.postId, 'remove')", "decideR(g.postId, 'suspend')"]) expect(m).toContain(a)
    expect(src('./matchData.tsx')).toContain("if (!p?.held || action === 'suspend') return fail('state')") // the demo has no accounts to suspend
  })
})
