// Simulated data (owner, Oct 2026): a yellow "ข้อมูลจำลอง" label on everything not made by a real user, the administrator's
// generator (the starter set: 32 posts + 50 pins), administrators without limits, and the lobby explanation. The SQL (0008) was
// run on a real Postgres (PGlite); the pages were opened in a browser.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, addPin, canPost, makePost, pinQuota, postQuota } from './domain/match/logic'
import { pinActive } from './domain/match/release'
import { marketOf } from './domain/match/market'
import { SIM_DEFAULTS, STARTER, provincesOf, seeded, simPinRow, simPins, simPostRow, simPosts } from './domain/match/simulate'
import { seedState } from './domain/match/seed'
import type { MatchState } from './domain/match/types'
import { messages, type MsgKey } from './locales'
import { BoardPage } from './pages/board'
import { Landing } from './pages/home'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-10-08T08:00:00.000Z')
const T = (k: MsgKey, v?: Record<string, string | number>) => tr(k, v, 'th').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function html(node: ReactNode, st: MatchState): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
const age = (iso: string) => (NOW - Date.parse(iso)) / DAY_MS

describe('the generator', () => {
  it('the starter set: 32 posts that pass every check of a real post, spread over countries, provinces, fields, people and time', () => {
    const posts = simPosts(STARTER.posts, SIM_DEFAULTS, NOW, seeded(7))
    expect(posts).toHaveLength(32)
    for (const p of posts) expect(makePost(p, 'x', 'y', p.createdAt).ok, `${p.company} · ${p.position}`).toBe(true)
    expect(new Set(posts.map((p) => p.place.country)).size).toBe(2)
    expect(new Set(posts.map((p) => p.place.province)).size).toBeGreaterThanOrEqual(10)
    expect(new Set(posts.map((p) => p.industry)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(posts.map((p) => p.headcount)).size).toBeGreaterThanOrEqual(5)
    const ages = posts.map((p) => age(p.createdAt))
    expect(Math.min(...ages)).toBeLessThan(2); expect(Math.max(...ages)).toBeGreaterThan(30); expect(Math.max(...ages)).toBeLessThanOrEqual(60.1)
    expect(posts.some((p) => p.verifiedAs === 'company') && posts.some((p) => p.verifiedAs === 'person') && posts.some((p) => !p.verified)).toBe(true) // ticks and warnings both show
    expect(posts.every((p) => !p.salary || (p.salary.currency === (p.place.country === 'TH' ? 'THB' : 'CNY')))).toBe(true)
  })
  it('the starter set: 50 pins, all still active (pins last 30 days), in both countries and many fields', () => {
    const pins = simPins(STARTER.pins, SIM_DEFAULTS, NOW, seeded(8))
    expect(pins).toHaveLength(50)
    expect(pins.every((p) => pinActive(p, NOW) && age(p.at) <= 29.05)).toBe(true)
    expect(new Set(pins.map((p) => p.country)).size).toBe(2)
    expect(new Set(pins.map((p) => p.industry)).size).toBeGreaterThanOrEqual(5)
    expect(pins.every((p) => provincesOf(p.country).includes(p.province) && p.skills.length >= 1)).toBe(true)
  })
  it('chosen details are kept: country, province, field, people wanted and how long ago', () => {
    const o = { country: 'TH' as const, province: 'TH-50', industry: 'finance' as const, headMin: 3, headMax: 5, daysMin: 10, daysMax: 20 }
    const posts = simPosts(15, o, NOW, seeded(9))
    expect(posts.every((p) => p.place.province === 'TH-50' && p.industry === 'finance' && p.headcount >= 3 && p.headcount <= 5 && age(p.createdAt) >= 10 && age(p.createdAt) <= 20.05)).toBe(true)
    const pins = simPins(10, { ...o, daysMin: 40, daysMax: 90 }, NOW, seeded(10))
    expect(pins.every((p) => p.province === 'TH-50' && p.industry === 'finance' && age(p.at) <= 29.05)).toBe(true) // pins never older than 29 days
  })
  it('rows for the database: the time, and whether and how the invented employer is verified', () => {
    const [p] = simPosts(1, { ...SIM_DEFAULTS, daysMin: 5, daysMax: 5 }, NOW, seeded(11))
    const row = simPostRow(p)
    expect(row.created_at).toBe(p.createdAt); expect(row.verified).toBe(p.verified); expect(row.verify_kind).toBe(p.verified ? p.verifiedAs ?? 'company' : null)
    expect(row).toMatchObject({ country: p.place.country, province: p.place.province, headcount: p.headcount })
    expect(simPinRow({ country: 'CN', province: 'CN-SH', industry: 'technology', skills: ['software_engineering'], at: 'x' })).toEqual({ country: 'CN', province: 'CN-SH', industry: 'technology', skills: ['software_engineering'], created_at: 'x' })
  })
})

describe('administrators post and pin without limits', () => {
  it('no weekly limit and no "one pin per place and field"', () => {
    const st = { ...seedState(NOW), unlimited: true, credits: Array.from({ length: 40 }, (_, i) => ({ kind: (i % 2 ? 'post' : 'pin') as 'post' | 'pin', at: new Date(NOW - i * 60_000).toISOString() })) }
    expect(Number.isFinite(postQuota(st, NOW).limit)).toBe(false); expect(canPost(st, NOW)).toBe(true); expect(pinQuota(st, NOW).left).toBe(Infinity)
    const first = addPin(st, { place: { country: 'TH', province: 'TH-10' }, industry: 'hospitality', skills: ['hospitality_management'] }, 'a1', new Date(NOW).toISOString())
    expect(first.ok).toBe(true)
    const twice = addPin({ ...st, me: first.ok ? first.value : st.me }, { place: { country: 'TH', province: 'TH-10' }, industry: 'hospitality', skills: ['hospitality_management'] }, 'a2', new Date(NOW).toISOString())
    expect(twice.ok).toBe(true)
    expect(canPost({ ...st, unlimited: false }, NOW)).toBe(false) // everyone else keeps 3 a week
  })
})

describe('the yellow label', () => {
  it('every simulated post carries "ข้อมูลจำลอง" in yellow; the full post and the application form say it in words', () => {
    expect(tr('m.sample.badge', undefined, 'th')).toBe('ข้อมูลจำลอง')
    const st = seedState(NOW); st.role = 'employer'
    const page = html(<BoardPage />, st)
    expect(page).toMatch(new RegExp(`<span class="chip bg-warn-bg text-warn-fg border-warn-line font-semibold [^"]*" title="${T('m.sample.d')}">`))
    expect(page.split(T('m.sample.badge')).length - 1).toBeGreaterThanOrEqual(3) // the three samples
    const post = src('./pages/post.tsx')
    expect(post).toContain('{p.sample && <div className="shrink-0"><SampleNote /></div>}'); expect(post).toContain('{p.sample && <SampleNote apply />}')
    expect(src('./pages/board.tsx')).toContain('{post.sample && <SampleNote />}')
  })
  it('the market view says how many of its numbers are simulated', () => {
    const base = seedState(NOW).posts[0]
    const m = marketOf([{ ...base, sample: true }, { ...base, id: 'real', sample: undefined }], [{ country: 'TH', province: 'TH-10', industry: 'hospitality', at: new Date(NOW).toISOString(), n: 5, sample: 3 }], 'all', null, NOW)
    expect(m.simulated).toEqual({ posts: 1, pins: 3 })
  })
})

describe('board layout (owner, Oct 2026): computers 4 × 2, phones one row each (option ก)', () => {
  it('computers: pages of 8 cards in 4 columns; phones: one row per post that scrolls on; the whole row opens the details', () => {
    const b = src('./pages/board.tsx')
    expect(b).toContain('const PAGE = { cols: 4, rows: 2 }')
    expect(b).toContain('const pg = usePaged(shown, fit ? PAGE.cols * PAGE.rows : Infinity)')
    expect(b).toContain('<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')
    expect(b).toContain("after:absolute after:inset-0 after:content-[''] sm:after:hidden")
    // the title is cut inside the button (a button is one box, so cutting the heading did nothing)
    // QA, Oct 2026: phones wrap the title (large text cut it to a few letters); tablets and computers still cut it
    expect(b).toContain('<span className="[overflow-wrap:anywhere] sm:line-clamp-2 fit:line-clamp-1">{post.position}</span></button>')
    // phones: the places on the right, the filters stay under the header, the sheet keeps its buttons at the bottom
    expect(b).toContain('<p className="sm:hidden shrink-0 text-right leading-tight" aria-hidden>')
    expect(b).toContain('className="sticky top-16 z-20 -mx-3 px-3 py-2 space-y-2 bg-page/95 border-b border-line sm:contents sm:space-y-0"')
    expect(b).toContain('sticky bottom-0 z-10 -mx-5 px-5 py-3 bg-surface2 border-t border-line sm:static')
    expect(b).not.toMatch(/max-(sm|md|lg):/) // not available with this Tailwind setup (a screen given as an object)
  })
})

describe('the lobby explains how it works', () => {
  it('six parts with the problem each answers, and what "simulated data" means', () => {
    const page = html(<Landing />, seedState(NOW))
    expect(page).toContain(T('m.sys.h'))
    for (const n of [1, 2, 3, 4, 5, 6]) { expect(page).toContain(T(`m.sys.${n}.p` as MsgKey)); expect(page).toContain(T(`m.sys.${n}` as MsgKey)) }
    expect(page).toContain(T('m.simwhat.h')); expect(page).toContain(T('m.simwhat'))
    expect(tr('m.proto', undefined, 'th')).not.toContain('ข้อมูลทั้งหมดเป็นตัวอย่าง') // real users post now
  })
})

describe('SQL 0008 and the tools', () => {
  it('only administrators generate or clear; pins without an owner come only from the generator', () => {
    const sql = src('../supabase/migrations/0008_simulated_data.sql')
    expect(sql.match(/if not public\.is_admin\(\) then raise exception 'not_admin'/g)?.length).toBe(2)
    expect(sql).toContain("if new.seeker_id is null then\n    if not new.is_sample then raise exception 'not_allowed'")
    expect(sql).toContain("check (seeker_id is not null or is_sample)")
    expect(sql).toContain("if exists (select 1 from public.profiles where id = new.employer_id and role = 'admin') then new.is_sample := true; end if;")
    const tools = src('./pages/simtools.tsx')
    expect(tools).toContain('void run(STARTER.posts, STARTER.pins, SIM_DEFAULTS)')
    expect(tools).toContain("await ask(t('m.sim.clear.confirm')") // clearing asks first
  })
  it('every message the new pages use exists in Thai, Chinese and English', () => {
    for (const f of ['./pages/simtools.tsx', './pages/home.tsx', './pages/market.tsx']) for (const k of [...src(f).matchAll(/\bt\('(m\.[\w.]+)'/g)].map((x) => x[1])) {
      const v = messages[k as MsgKey] as readonly string[] | undefined
      expect(v, `${f}: ${k}`).toBeDefined(); expect(v![1], k).toMatch(/[一-鿿]/)
    }
  })
})
