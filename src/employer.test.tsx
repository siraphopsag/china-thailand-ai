// Employer flow, Oct 2026 (owner): 7 more post details, simulated-AI pre-check, confirm → posted windows, post page,
// 3 free posts per rolling 7 days + membership package (planned price struck through, free now — no payment),
// and planned ("coming soon") countries made clearly not open yet.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, canPost, makePost, parseState, postLimit, postsThisWeek, type PostInput } from './domain/match/logic'
import { precheck } from './domain/match/precheck'
import { seedState } from './domain/match/seed'
import { MY_EMPLOYER, type MatchState, type Post } from './domain/match/types'
import type { MsgKey } from './locales/index'
import { PostFacts } from './pages/match'
import { PackageCard } from './pages/hire'
import { ListSelect } from './components/listselect'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
const NOW = Date.parse('2026-10-03T08:00:00.000Z')
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
function html(node: ReactNode, st?: MatchState): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st ?? seedState(NOW)}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
const good: PostInput = {
  place: { country: 'CN', province: 'CN-GD' }, company: 'Sample Kitchen', position: 'HR', industry: 'food_service', skills: ['culinary_arts'], minYears: 1,
  details: 'Kitchen work in a Thai restaurant, day shifts, Mandarin basics helpful.', headcount: 2, employment: 'contract',
  salary: { min: 6000, max: 8000, currency: 'CNY' }, startDate: at(10).slice(0, 10), languages: [{ lang: 'zh', level: 'basic' }, { lang: 'th', level: 'native' }], education: 'none', benefits: ['housing', 'meals'],
}
const fails = (patch: Partial<PostInput>) => { const r = makePost({ ...good, ...patch }, 'p', MY_EMPLOYER, at(0)); return r.ok ? 'ok' : r.problem }

describe('A. post details', () => {
  it('a complete post is accepted; "HR" is a valid position (2 characters)', () => {
    expect(fails({})).toBe('ok')
    expect(fails({ position: 'H' })).toBe('position')
  })
  it('each new detail is checked', () => {
    expect([fails({ headcount: 0 }), fails({ headcount: 100 }), fails({ headcount: 1.5 })]).toEqual(['headcount', 'headcount', 'headcount'])
    expect(fails({ employment: 'freelance' as never })).toBe('employment')
    expect(fails({ salary: { min: 9000, max: 8000, currency: 'CNY' } })).toBe('salary')
    expect(fails({ salary: { min: 1000, max: 2000, currency: 'USD' as never } })).toBe('salary')
    expect(fails({ salary: null })).toBe('ok') // salary is optional
    expect([fails({ startDate: at(-1).slice(0, 10) }), fails({ startDate: at(800).slice(0, 10) }), fails({ startDate: '2026-13-40' })]).toEqual(['startDate', 'startDate', 'startDate'])
    expect(fails({ startDate: at(0).slice(0, 10) })).toBe('ok') // today is fine
    expect(fails({ languages: [] })).toBe('languages')
    expect(fails({ languages: [{ lang: 'zh', level: 'basic' }, { lang: 'zh', level: 'native' }] })).toBe('languages')
    expect(fails({ education: 'phd' as never })).toBe('education')
    expect(fails({ benefits: ['housing', 'housing'] })).toBe('benefits')
  })
  it('posts saved before these details existed still load, read as "not stated"; tampered details are rejected', () => {
    const st = seedState(NOW)
    const old = JSON.parse(JSON.stringify(st)); delete old.member
    for (const p of old.posts) for (const k of ['headcount', 'employment', 'salary', 'startDate', 'languages', 'education', 'benefits']) delete p[k]
    const parsed = parseState(old)
    expect(parsed).not.toBeNull()
    expect(parsed!.member).toBe(false)
    expect(parsed!.posts[0]).toMatchObject({ headcount: null, employment: null, salary: null, startDate: null, languages: [], education: 'none', benefits: [] })
    const bad = JSON.parse(JSON.stringify(st)); bad.posts[0].headcount = 500
    expect(parseState(bad)).toBeNull()
    const bad2 = JSON.parse(JSON.stringify(st)); bad2.member = 'yes'
    expect(parseState(bad2)).toBeNull()
  })
  it('details show everywhere a post appears; missing ones say "not stated"', () => {
    const st = seedState(NOW)
    const facts = html(<PostFacts post={st.posts[0]} />)
    for (const s of [T('m.people', { n: 2 }), T('m.emp.type.permanent'), '9,000–12,000', T('m.cur.CNY'), T('jb.lang.zh' as MsgKey), T('jb.level.professional' as MsgKey), T('m.edu.bachelor' as MsgKey), T('m.ben.housing')]) expect(facts, s).toContain(s)
    const legacy: Post = { ...st.posts[0], headcount: null, employment: null, salary: null, startDate: null, languages: [], education: 'none', benefits: [] }
    expect(html(<PostFacts post={legacy} />).split(T('m.notStated')).length - 1).toBe(6)
    const m = src('./pages/match.tsx')
    expect(m.split('<PostFacts post={p} compact />').length - 1).toBe(2) // job seekers' notifications + back office
    expect(src('./pages/hire.tsx')).toContain('<PostFacts post={p} />') // the post page
  })
})

describe('B. pre-check (simulated AI)', () => {
  it('a clean post has nothing to report', () => { expect(precheck(good, at(0))).toEqual({ errors: [], warnings: [] }) })
  it('errors stop posting; warnings can be accepted', () => {
    expect(precheck({ ...good, details: 'call 081 234 5678 for more' }, at(0)).errors).toEqual(['contact'])
    expect(precheck({ ...good, salary: { min: 9, max: 1, currency: 'THB' } }, at(0)).errors).toEqual(['salary'])
    const w = (p: Partial<PostInput>) => precheck({ ...good, ...p }, at(0)).warnings
    expect(w({ salary: null })).toContain('noSalary')
    expect(w({ industry: 'finance', skills: ['culinary_arts'] })).toContain('skillMismatch')
    expect(w({ details: 'Kitchen job.' })).toContain('shortDetails')
    for (const d of ['เฉพาะผู้ชาย อายุไม่เกิน 30 ปี ทำงานครัว', '限男，35岁以下，厨房工作，有经验优先考虑', 'Male only, kitchen work with day shifts and training provided']) expect(w({ details: d }), d).toContain('discrimination')
    for (const d of ['ต้องโอนเงินค่ามัดจำก่อนเริ่มงานครัวในร้าน', '入职前需缴纳押金，厨房工作，包吃住提供培训', 'A deposit is required before starting kitchen work']) expect(w({ details: d }), d).toContain('scamRisk')
    expect(w({ headcount: 60 })).toContain('manyPeople')
    const pc = src('./domain/match/precheck.ts')
    expect(pc).toMatch(/SIMULATED/) // stands in for a future AI review
  })
  it('the page labels it "simulated AI" and does not claim a legal assessment', () => {
    const h = src('./pages/hire.tsx')
    expect(h).toContain("t('m.chk.sim')"); expect(h).toContain("t('m.chk.simNote')")
    expect(tr('m.chk.simNote', undefined, 'th')).toContain('ไม่ใช่การให้คำปรึกษาทางกฎหมาย')
  })
})

describe('C. confirm → posted', () => {
  it('flow: Check and post → (pre-check) → "Post this job?" → "Your post is live" with View the post / Post another', () => {
    const h = src('./pages/hire.tsx')
    expect(h).toMatch(/setStage\(r\.errors\.length \|\| r\.warnings\.length \? 'check' : 'confirm'\)/)
    expect(h).toContain("t('m.cf.title')"); expect(h).toContain("t('m.cf.yes')"); expect(h).toContain("t('m.cf.back')")
    expect(h).toContain("t('m.dn.title')")
    expect(h).toContain("go(`post?id=${pid}`)") // View the post → its page
    expect(h).toMatch(/const another = \(\) => \{[^}]*setForm\(false\); setC\(null\); setP\(null\)/) // Post another → back to choosing the country
    expect(src('./App.tsx')).toContain('post: <PostPage />')
    expect(src('./components/modal.tsx')).toContain('d.showModal()')
    expect(T('m.cf.title')).toBe('ต้องการโพสต์ประกาศนี้ใช่หรือไม่?'); expect(T('m.dn.title')).toBe('โพสต์ของคุณเรียบร้อยแล้ว')
  })
})

describe('D. weekly allowance and membership package', () => {
  const mine = (days: number, id: string): Post => ({ ...seedState(NOW).posts[1], id, employerId: MY_EMPLOYER, createdAt: at(days) })
  it('3 free posts per rolling 7 days (demo clock counts); posts older than 7 days no longer count', () => {
    const st = { ...seedState(NOW), posts: [mine(-1, 'a'), mine(-3, 'b'), mine(-6.5, 'c'), mine(-8, 'old')] }
    expect(postsThisWeek(st, NOW)).toBe(3)
    expect(postLimit(st)).toBe(3)
    expect(canPost(st, NOW)).toBe(false)
    expect(canPost(st, NOW + 0.6 * DAY_MS)).toBe(true) // a day later the oldest one has left the window
    expect(src('./matchData.tsx')).toContain("if (!canPost(st, now)) return { ok: false, problem: 'quota' } as const")
  })
  it('membership: 10 per 7 days; the window shows the planned price struck through and "free now"; no payment', () => {
    const st = { ...seedState(NOW), member: true, posts: [mine(-1, 'a'), mine(-3, 'b'), mine(-6.5, 'c')] }
    expect(postLimit(st)).toBe(10); expect(canPost(st, NOW)).toBe(true)
    const card = html(<PackageCard />)
    expect(card).toMatch(new RegExp(`<span class="price-was[^"]*"><span class="sr-only">${T('m.pk.priceSr')} </span>${T('m.pk.price')}</span>`))
    expect(card).toContain(T('m.pk.free')); expect(card).toContain(T('m.pk.note'))
    expect(src('./index.css')).toMatch(/\.price-was \{ text-decoration: line-through/)
    expect(src('./matchData.tsx')).toContain('subscribe: () => setSt((s) => ({ ...s, member: true }))')
  })
  it('wording: "3 free posts per week" replaces "no fees during the prototype"', () => {
    for (const k of ['m.role.employer.p4', 'm.emp.noPay'] as const) expect(T(k)).toBe('โพสต์ฟรี 3 ครั้งต่อสัปดาห์')
  })
})

describe('E. planned countries are clearly not open yet', () => {
  it('the planned group has a rule and band, a clock header and note, a clock after each name, and a badge in the field once chosen', () => {
    const groups = [{ label: 'open', dot: true, options: [{ value: 'TH', label: 'ไทย' }] }, { label: 'soon', note: 'not open yet', icon: 'clock' as const, itemIcon: 'clock' as const, badge: 'soon-badge', muted: true, options: [{ value: 'VN', label: 'เวียดนาม' }, { value: 'LA', label: 'ลาว' }] }]
    const none = html(<ListSelect id="x" labelId="xl" value={null} onChange={() => {}} groups={groups} placeholder="-" maxRows={5} />)
    expect(none).toContain('class="list-group-muted"'); expect(none).toContain('not open yet')
    expect(none).not.toContain('soon-badge')
    const chosen = html(<ListSelect id="x" labelId="xl" value="VN" onChange={() => {}} groups={groups} placeholder="-" maxRows={5} />)
    expect(chosen).toContain('soon-badge')
    expect(src('./index.css')).toMatch(/\.list-group-muted \{[^}]*border-top: 1px solid/)
    expect(src('./pages/match.tsx')).toContain("note: t('m.soonNote'), icon: 'clock', itemIcon: 'clock', badge: t('geo.soon'), muted: true")
  })
  it('on the map a chosen planned country rises in grey', () => {
    const geo = src('./components/geomap.tsx')
    expect(geo).toContain("top={GEO[focusShape.code!].status === 'active' ? 'g-top' : 'g-top-soon'}")
    expect(geo).toContain("c === country ? (GEO[c].status === 'active' ? 'g-footprint' : 'g-soon')")
    expect(src('./index.css')).toMatch(/\.g-top-soon \{ fill: rgb\(var\(--globe-soon\)\)/)
  })
})

describe('F. map pins and the next post (browser check, Oct 2026)', () => {
  it('employer post pins are amber with a white rim, not the indigo of the chosen country (it read as a dark blob)', () => {
    const css = src('./index.css')
    expect(css).toMatch(/\.g-pin-post \{ fill: rgb\(var\(--pin-post\)\); stroke: #fff/)
    const toks = [...css.matchAll(/--pin-post: (\d+ \d+ \d+);/g)].map((m) => m[1])
    const active = [...css.matchAll(/--globe-active: (\d+ \d+ \d+);/g)].map((m) => m[1])
    expect(toks).toHaveLength(2) // light and dark themes
    toks.forEach((c, i) => expect(c).not.toBe(active[i]))
  })
  it('a province name is lifted above a pin standing on the same spot', () => {
    expect(src('./components/geomap.tsx')).toContain('const up = pins.some((pn) => pn.province === provShape.code) ? 30 : 0')
  })
  it('"Post another" puts keyboard focus on the country field (the form it came from is gone)', () => {
    expect(src('./pages/hire.tsx')).toContain("requestAnimationFrame(() => document.getElementById('emp-prov-c')?.focus())")
  })
  it('the profile note no longer says there is "no membership" next to the membership status', () => {
    expect(tr('m.profile.note', undefined, 'th')).not.toContain('ระบบสมาชิก')
    expect(tr('m.profile.note', undefined, 'en')).toMatch(/membership\).*database/)
  })
})
