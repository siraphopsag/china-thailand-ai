// Owner's feedback round after friends tried the site (Oct 2026): 1 the verified tick after the employer's name, 2 solid menus,
// 3–4 the board's top row and the map as a job-market view, 5 fewer effects for older phones, 6 verifying an employer who is a
// private person (option ก). Static rendering and pure rules here; the SQL (0007) was run on a real Postgres (PGlite) and the
// pages were opened in a browser.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, parseState, requestPersonVerify, requestVerify } from './domain/match/logic'
import { capStage, levelCap, reachFor } from './domain/match/release'
import { balanceOf, marketOf, type PinGroup } from './domain/match/market'
import { cleanPhone, isMobile, oneTimeCode, withThaiCheck } from './domain/match/verify'
import { rowToPost, statsToGroups, verifyOf, type PostRow } from './domain/match/remote'
import { seedState } from './domain/match/seed'
import { MY_EMPLOYER, type MatchState, type Post } from './domain/match/types'
import { messages, type MsgKey } from './locales'
import { market } from './locales/market'
import { MePage, SettingsPage } from './pages/match'
import { BoardPage } from './pages/board'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const css = src('./index.css')
const NOW = Date.parse('2026-10-08T08:00:00.000Z')
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
const T = (k: MsgKey, v?: Record<string, string | number>) => tr(k, v, 'th').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function html(node: ReactNode, st: MatchState): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}

describe('1. the verified tick after the employer\'s name', () => {
  it('a blue seal for a company, a person-tick for a private person, a warning for neither — no more "Verified" chip', () => {
    const st = seedState(NOW); st.role = 'employer'
    st.posts = st.posts.map((p) => (p.id === 'post-s3' ? { ...p, verifiedAs: 'person' as const } : p))
    const page = html(<BoardPage />, st)
    expect(page).toContain(`role="img" aria-label="${T('m.vf.tick.company')}"`) // Sample Riverside Hotels
    expect(page).toContain(`role="img" aria-label="${T('m.vf.tick.person')}"`) // Sample Eastern Logistics, now a private person
    expect(page).toContain(T('m.vf.unverified')) // Example Precision Parts
    expect(page).not.toContain('ยืนยันตัวตนแล้ว') // the chip friends misread is gone
    expect(T('m.vf.unverified')).toBe('นายจ้างยังไม่ยืนยันตัวตน')
    expect(css).toMatch(/\.vf-company svg \{ fill: currentColor; stroke: rgb\(var\(--surface\)\) \}/)
  })
  it('"places taken" reads as people wanted first, then taken (friends read "0 taken, verified" as "0 verified employees")', () => {
    expect(tr('m.cnt.held', { n: 0, max: 3 }, 'th')).toBe('ต้องการ 3 คน · รับแล้ว 0')
    expect(tr('m.bd.places', undefined, 'th')).toBe('รับแล้ว / ต้องการ')
  })
})

describe('2. menus over the page are solid', () => {
  it('the account menu and the phone "More" list use .glass-pop, which is now opaque', () => {
    expect(css).toContain('.glass-pop { background: linear-gradient(180deg, rgb(var(--surface)), rgb(var(--surface2))); backdrop-filter: none; -webkit-backdrop-filter: none }')
    // it comes after the shared glass rule, so it wins
    expect(css.indexOf('.glass-pop { background: linear-gradient(180deg, rgb(var(--surface))')).toBeGreaterThan(css.indexOf('.nav-pill, .glass-pop { isolation: isolate;'))
    expect(src('./components/sidenav.tsx')).toContain('id="account-menu" hidden={!menu} className="glass-pop')
  })
})

describe('3–4. the board: a small allowance chip, the card/map switch before the main button, the map as a market view', () => {
  it('the top row: chip → switch → main button; the long allowance bar is gone', () => {
    const b = src('./pages/board.tsx')
    const chip = b.indexOf('<QuotaChip q={q}'), sw = b.indexOf("aria-label={t('m.bd.viewAs')}"), main = b.indexOf("<NavLink to={seeker ? 'seek' : 'hire'} className=\"btn-primary !rounded-full\">")
    expect(chip).toBeGreaterThan(-1); expect(sw).toBeGreaterThan(chip); expect(main).toBeGreaterThan(sw)
    expect(b).not.toContain('<QuotaBar')
    const st = seedState(NOW); st.role = 'employer'
    st.posts = st.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER } : p))
    st.acceptances = [{ id: 'a1', postId: 'post-s1', seekerId: 'seeker:x', at: at(-1), status: 'accepted', intro: 'Hello there', availableFrom: null }]
    const page = html(<BoardPage />, st)
    expect(page).toContain(T('m.qb.chip.post', { n: 0, max: 3 }))
    expect(page).toContain('href="/hire?tab=mine"'); expect(page).toContain(T('m.bd.waitingChip', { n: 1 })) // straight to my posts
  })
  it('the map view hides the levels, search and filters, and puts the map left (as on the pin page) with the market right', () => {
    const b = src('./pages/board.tsx')
    const cardsOnly = b.slice(b.indexOf('{cards && (<>'), b.indexOf('{!cards && ('))
    for (const s of ["aria-label={t('m.board.levels')}", 'role="search"', 'id="bd-more"']) expect(cardsOnly, s).toContain(s)
    const mapView = b.slice(b.indexOf('{!cards && ('))
    expect(mapView).toContain('<MapLayout map={'); expect(mapView).toContain('<GeoMap className={MAP_SIZE}'); expect(mapView).toContain('<MarketPanel m={mk}')
  })
  it('market numbers: totals, the 5 busiest provinces, rising and most wanted fields, demand against supply — by country or a province', () => {
    const base = seedState(NOW).posts[0]
    const post = (id: string, employerId: string, country: 'TH' | 'CN', province: string, industry: Post['industry'], headcount: number): Post => ({ ...base, id, employerId, country, province, industry, headcount })
    const posts = [post('a', 'employer:e1', 'TH', 'TH-10', 'hospitality', 3), post('b', 'employer:e2', 'TH', 'TH-10', 'logistics', 1), post('c', 'employer:e1', 'CN', 'CN-SH', 'manufacturing', 2)]
    const pins: PinGroup[] = [
      { country: 'TH', province: 'TH-10', industry: 'hospitality', at: at(-2), n: 4 }, { country: 'TH', province: 'TH-50', industry: 'hospitality', at: at(-10), n: 2 },
      { country: 'CN', province: 'CN-SH', industry: 'manufacturing', at: at(-1), n: 1 }, { country: 'CN', province: 'CN-JS', industry: 'logistics', at: at(-3), n: 6 }]
    const m = marketOf(posts, pins, 'all', null, NOW)
    expect(m.totals).toEqual({ posts: 3, places: 6, employers: 2, pins: 13 })
    expect(m.top.map((r) => `${r.province}:${r.pins}/${r.employers}`)).toEqual(['CN-JS:6/0', 'TH-10:4/2', 'CN-SH:1/1', 'TH-50:2/0'])
    expect(m.rising[0]).toEqual({ industry: 'hospitality', n: 6, last7: 4, prev7: 2 })
    expect(m.wanted).toEqual([{ industry: 'hospitality', n: 3 }, { industry: 'manufacturing', n: 2 }, { industry: 'logistics', n: 1 }])
    expect(Object.fromEntries(m.balance.map((r) => [r.industry, r.state]))).toEqual({ hospitality: 'jobs', logistics: 'jobs', manufacturing: 'people' })
    expect(marketOf(posts, pins, 'TH', null, NOW).totals).toEqual({ posts: 2, places: 4, employers: 2, pins: 6 })
    const bkk = marketOf(posts, pins, 'TH', 'TH-10', NOW)
    expect(bkk.totals).toEqual({ posts: 2, places: 4, employers: 2, pins: 4 }); expect(bkk.top).toHaveLength(1)
    expect(marketOf(posts, pins, 'all', null, NOW, 2).top).toHaveLength(2)
    expect([balanceOf(3, 2), balanceOf(4, 2), balanceOf(2, 4), balanceOf(0, 0)]).toEqual(['even', 'people', 'jobs', 'even'])
  })
  it('the database counts arrive as groups with their number; nothing about who', () => {
    expect(statsToGroups([{ country: 'TH', province: 'TH-10', industry: 'hospitality', skills: [], hour: at(-1), n: 3 }, { country: 'XX', province: 'X', industry: 'hospitality', skills: [], hour: at(-1), n: 9 }]))
      .toEqual([{ country: 'TH', province: 'TH-10', industry: 'hospitality', at: at(-1), n: 3 }])
    expect(src('./pages/market.tsx')).toContain("t('m.mk.privacy')")
  })
})

describe('5. fewer effects for older phones', () => {
  it('on by itself for a low-end device (before the first paint), or chosen in Settings; the map turns flat', () => {
    const init = src('../public/theme-init.js')
    expect(init).toContain("if (lite === 'on' || (lite !== 'off' && ((n && n <= 4) || (m && m <= 4)))) document.documentElement.setAttribute('data-lite', '')")
    expect(src('./components/geomap.tsx')).toContain('const tilt = useTween(lite ? 0 :')
    expect(css).toContain('[data-lite] *, [data-lite] *::before, [data-lite] *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important }')
    expect(css).toContain('[data-lite] .mn-glow, [data-lite] .cta-ring::before { display: none }')
    const st = seedState(NOW)
    const page = html(<SettingsPage />, st)
    expect(page).toContain(T('m.settings.lite')); expect(page).toContain(T('m.settings.lite.auto'))
    expect(page).toContain(T('m.settings.lite.now', { s: T('m.settings.lite.isOff') })) // a test machine counts as a full device
  })
})

describe('6. an employer who is a private person (option ก)', () => {
  it('a mobile number: Thai 06/08/09 + 8 digits, Chinese 1[3-9] + 9; country codes and spaces are fine', () => {
    expect(cleanPhone('TH', '+66 81-234-5678')).toBe('0812345678'); expect(isMobile('TH', '0812345678')).toBe(true)
    expect(isMobile('TH', '0212345678')).toBe(false) // a landline cannot receive the code
    expect(cleanPhone('CN', '+86 138 0013 8000')).toBe('13800138000'); expect(isMobile('CN', '13800138000')).toBe(true)
    expect(isMobile('CN', '12800138000')).toBe(false)
    expect(oneTimeCode()).toMatch(/^\d{6}$/)
  })
  it('only the last 4 digits go on — no full number, no identity-card number', () => {
    const r = requestPersonVerify('TH', '0812345678', at(0))
    expect(r.ok && r.value).toEqual({ kind: 'person', country: 'TH', regNo: '', phone4: '5678', status: 'pending', at: at(0) })
    expect(JSON.stringify(r)).not.toContain('081234')
    expect(requestPersonVerify('TH', '0212345678', at(0))).toEqual({ ok: false, problem: 'phone' })
    expect(requestVerify('TH', withThaiCheck('010555612345'), at(0)).ok && requestVerify('TH', withThaiCheck('010555612345'), at(0))).toMatchObject({ value: { kind: 'company' } })
    const sql = src('../supabase/migrations/0007_person_verify.sql')
    expect(sql).toContain("verify_phone4 text check (verify_phone4 ~ '^[0-9]{4}$')")
    expect(sql).not.toMatch(/id_card|citizen|national_id/i)
  })
  it('levels: a verified company 5, a verified private person 3, an employer not yet verified 2', () => {
    const post = { ...seedState(NOW).posts.find((p) => p.id === 'post-s3')! } // over a month old: level 5
    expect(levelCap({ verified: false })).toBe(2); expect(levelCap({ verified: true, verifiedAs: 'person' })).toBe(3); expect(levelCap({ verified: true })).toBe(5)
    expect(capStage(5, { ...post, verified: true, verifiedAs: 'person' })).toBe(3)
    expect(capStage(5, { ...post, verified: true, verifiedAs: 'company' })).toBe(5)
    const far = reachFor({ ...post, verified: true, verifiedAs: 'person' }, [], [], NOW) // no pins: level 5 for me
    expect(far.visible).toBe(false); expect(far.opensAt).toBeNull() // never opens beyond level 3
  })
  it('saved and loaded: the demo keeps a private person; the database row says how a post was verified', () => {
    const st = seedState(NOW); st.employerVerify = { kind: 'person', country: 'TH', regNo: '', phone4: '5678', status: 'pending', at: at(0) }
    expect(parseState(JSON.parse(JSON.stringify(st)))!.employerVerify).toEqual(st.employerVerify)
    const bad = JSON.parse(JSON.stringify(st)); bad.employerVerify.phone4 = '0812345678'
    expect(parseState(bad)!.employerVerify).toBeNull()
    const old = JSON.parse(JSON.stringify(st)); old.employerVerify = { country: 'TH', regNo: withThaiCheck('010555612345'), status: 'verified', at: at(0) }
    expect(parseState(old)!.employerVerify?.kind).toBe('company') // saved before Oct 2026
    expect(verifyOf({ user_type: 'employer', company: 'Cee', origin_country: null, origin_province: null, member: null, verify_kind: 'person', verify_country: 'CN', verify_phone4: '4321', verify_status: 'verified', verify_at: at(0) }))
      .toMatchObject({ kind: 'person', country: 'CN', phone4: '4321', status: 'verified' })
    const row = { id: 'p', employer_id: 'u2', is_sample: false, company: 'Cee', position: 'Cook', industry: 'food_service', skills: ['culinary_arts'], min_years: 0, details: '', headcount: 1, employment: 'permanent', salary_min: null, salary_max: null, salary_currency: null, start_date: null, languages: [], education: 'none', benefits: [], country: 'TH', province: 'TH-10', created_at: at(0), verified: true, verify_kind: 'person' } as PostRow
    expect(rowToPost(row, 'me').verifiedAs).toBe('person')
    expect(rowToPost({ ...row, verify_kind: null }, 'me').verifiedAs).toBe('company') // before 0007
    expect(rowToPost({ ...row, verified: false }, 'me').verifiedAs).toBeUndefined()
  })
  it('the verification card: company or private person; a private person shows only ••••1234', () => {
    const st = seedState(NOW); st.role = 'employer'
    const page = html(<MePage />, st)
    expect(page).toContain(T('m.vf.kind')); expect(page).toContain(T('m.vf.kind.company')); expect(page).toContain(T('m.vf.kind.person'))
    st.employerVerify = { kind: 'person', country: 'TH', regNo: '', phone4: '5678', status: 'verified', at: at(-1) }
    const done = html(<MePage />, st)
    expect(done).toContain(T('m.vf.verified.person')); expect(done).toContain(T('m.vf.asPerson', { d: '5678' })); expect(done).toContain(T('m.vf.toCompany'))
    const card = src('./pages/case.tsx')
    expect(card).toContain("t('m.vf.codeDemo', { c: sent.code })") // the prototype says plainly that no SMS is sent
    expect(card).toContain('const CODE_LIFE_MS = 5 * 60_000, CODE_TRIES = 5')
  })
})

describe('option ก: reach rings instead of stars (owner, Oct 2026)', () => {
  it('one colour for every ring, no "level" or "nobody has taken it" in the release wording', () => {
    expect(css).toContain('.rar-1, .rar-2, .rar-3, .rar-4, .rar-5 { --rar-bg: var(--reach-bg); --rar-fg: var(--reach-fg); --rar-line: var(--reach-line) }')
    expect(css).toContain('.rar-edge-1, .rar-edge-2, .rar-edge-3, .rar-edge-4, .rar-edge-5 { border-left: 4px solid rgb(var(--reach-line)) }')
    const release = Object.entries(messages).filter(([k]) => /^m\.(lv|board|how|em|pp|vf|clock|adm\.(sub|demoClock))\./.test(k) || k === 'm.board.levels').map(([, v]) => v.join(' ')).join('\n')
    expect(release).not.toContain('ระดับ'); expect(release).not.toContain('ยังไม่มีใครรับ'); expect(release).not.toMatch(/\blevels? \d/i)
    expect(tr('m.lv.reached', { l: tr('m.lv.to.4' as MsgKey, undefined, 'th') }, 'th')).toBe('เผยแพร่ถึง: ทั้งประเทศ')
  })
})

describe('messages', () => {
  it('every new message has Thai, Simplified Chinese and English, and none overrides an older one', () => {
    for (const [k, [th, zh, en]] of Object.entries(market)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as MsgKey], k).toBe(market[k as keyof typeof market])
    }
    const others = readdirSync(new URL('./locales/', import.meta.url)).filter((f) => f.endsWith('.ts') && f !== 'market.ts').map((f) => src(`./locales/${f}`)).join('\n')
    for (const k of Object.keys(market)) expect(others.includes(`'${k}':`), k).toBe(false)
    for (const f of ['./pages/board.tsx', './pages/market.tsx', './pages/case.tsx']) for (const k of [...src(f).matchAll(/\bt\('(m\.[\w.]+)'/g)].map((x) => x[1])) expect(k in messages, `${f}: ${k}`).toBe(true)
  })
})
