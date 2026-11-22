// v2 model, part 4 (owner, Nov 2026): the front system — anti-spam before posting, job-seeker verification, special posts from
// government agencies / verified companies / law firms, and chat with interview booking.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DUP_SIMILARITY, POSTS_PER_DAY, similarity, spamCheck } from './domain/match/spam'
import { HIDE_AFTER } from './domain/match/reports'
import { MAX_SLOTS, PHRASES, maskContact, newMessage, offerSlots, pickSlot } from './domain/match/chat'
import { EVENT_KINDS, KINDS_FOR } from './domain/match/calendar'
import type { PostInput } from './domain/match/logic'
import { seedState } from './domain/match/seed'
import type { MatchState } from './domain/match/types'
import { v2d } from './locales/v2d'
import { messages } from './locales/index'
import { MAX_SPONSORED, SPONSORED, SponsoredStrip, isPaid } from './pages/sponsored'
import { sampleVerified } from './pages/seeker-verify'
import { ChatPage } from './pages/chat'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-11-22T08:00:00.000Z')
const AT = new Date(NOW).toISOString()
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const T = (k: keyof typeof v2d, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
function html(node: ReactNode, st: MatchState = seedState(NOW), search = ''): string {
  const g = globalThis as { document?: unknown; window?: unknown }
  const hadD = 'document' in g, prevD = g.document, hadW = 'window' in g, prevW = g.window
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  if (search) g.window = { location: { search } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (hadD) g.document = prevD; else delete g.document; if (search) { if (hadW) g.window = prevW; else delete g.window } }
}
const input = (p: Partial<PostInput>): PostInput => ({ place: { country: 'TH', province: 'TH-10' }, company: 'Sample Co', position: 'Warehouse staff', industry: 'logistics', skills: [], minYears: 1,
  details: 'Pick and pack orders in a Bangkok warehouse, eight hours a day, five days a week, uniform provided.', headcount: 2, employment: 'permanent',
  salary: { min: 15000, max: 18000, currency: 'THB' }, startDate: null, languages: [], education: 'none', benefits: [], ...p } as PostInput)

describe('A. anti-spam before posting', () => {
  const mine = (n: number, hoursAgo = 1) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, position: `Role ${i}`, details: `Completely different job number ${i} with its own long description of the work`, createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString() }))
  it('a copy of a post on the board (or of my own) is stopped; spacing and punctuation do not hide it; editing the same post is fine', () => {
    const i = input({})
    expect(similarity(i.details, i.details.replace(/ /g, '  ').toUpperCase() + '!!')).toBe(1)
    const board = [{ id: 'b1', position: i.position, details: i.details }]
    expect(spamCheck(i, AT, [], board)).toMatchObject({ errors: ['dupPost'], dupOf: 'b1' })
    expect(spamCheck(i, AT, [{ ...board[0], createdAt: AT }], [], 'b1').errors).toEqual([])
    expect(DUP_SIMILARITY).toBe(0.8)
  })
  it('at most 5 new posts a day; posts older than a day do not count', () => {
    expect(POSTS_PER_DAY).toBe(5)
    expect(spamCheck(input({}), AT, mine(5), []).errors).toContain('dailyLimit')
    expect(spamCheck(input({}), AT, mine(5, 30), []).errors).not.toContain('dailyLimit')
  })
  it('casino, online gambling and scam-compound work cannot be posted; "easy money" lures get a warning', () => {
    expect(spamCheck(input({ details: 'Customer service for an online casino in Myanmar, free flights' }), AT, [], []).errors).toEqual(['scamWords'])
    expect(spamCheck(input({ details: '招聘客服，菠菜平台，包吃包住' }), AT, [], []).errors).toEqual(['scamWords'])
    expect(spamCheck(input({ details: 'ไม่ต้องมีประสบการณ์ รายได้สูง ทำงานแค่แชท รับเงินรายวัน' }), AT, [], []).lure).toBe(true)
    expect(spamCheck(input({}), AT, [], [])).toEqual({ errors: [], lure: false, dupOf: null })
  })
  it('reported posts are hidden after 3 people report them (unchanged rule, listed with the others); the hire page runs the check', () => {
    expect(HIDE_AFTER).toBe(3)
    expect(src('./pages/hire.tsx')).toContain('const sp = spamCheck(i, at,')
    for (const k of ['m.err.dupPost', 'm.err.dailyLimit', 'm.err.scamWords', 'm.chk.w.lure'] as const) expect(k in messages).toBe(true)
  })
})

describe('B. job-seeker verification and special posts', () => {
  it('sample job seekers get a fixed verified state; the profile keeps only last digits', () => {
    expect(sampleVerified('s-1')).toBe(sampleVerified('s-1'))
    const s = src('./pages/seeker-verify.tsx')
    expect(s).toContain('phone4: phoneLast4(cleanPhone(country, phone))'); expect(s).toContain('last4: parsed.value.number.slice(-4)')
    expect(src('./pages/match.tsx')).toContain("{st.role === 'seeker' && <SeekerVerifyCard />}")
    expect(src('./pages/case.tsx')).toContain('disabled={busy || blockAccept}')
  })
  it('at most three special posts, each labelled; paid ones say "Sponsored"; only sample organisations', () => {
    expect(SPONSORED.length).toBeLessThanOrEqual(MAX_SPONSORED)
    expect(SPONSORED.map((s) => [s.kind, isPaid(s.kind)])).toEqual([['gov', false], ['company', true], ['law', true]])
    const page = html(<SponsoredStrip />)
    expect(page).toContain(T('sp.h')); expect(page.split(T('sp.paid')).length - 1).toBe(2)
    for (const k of ['sp.gov.org', 'sp.co.org', 'sp.law.org'] as const) for (const lg of ['th', 'zh', 'en'] as const) expect(tr(k, undefined, lg)).toMatch(/ตัวอย่าง|示例|Sample/)
  })
})

describe('C. chat and interviews', () => {
  it('contact details are hidden; ordinary words and amounts are not', () => {
    expect(maskContact('Add my line id: shop123 or call 081-234-5678').text).toBe('Add my [•••] or call [•••]')
    expect(maskContact('微信 abc123x').text).toBe('[•••]'); expect(maskContact('mail me a@b.co').masked).toBe(true)
    expect(maskContact('We stand in line every day; the deadline is Monday; pay 12,000 baht')).toEqual({ text: 'We stand in line every day; the deadline is Monday; pay 12,000 baht', masked: false })
  })
  it('phrases belong to a side; empty and long texts are refused', () => {
    expect(newMessage({ msgs: [] }, 'employer', { phrase: 'askHousing' }, 'x', AT)).toEqual({ ok: false, problem: 'phrase' })
    expect(newMessage({ msgs: [] }, 'seeker', { text: '  ' }, 'x', AT)).toEqual({ ok: false, problem: 'empty' })
    expect(newMessage({ msgs: [] }, 'seeker', { text: 'x'.repeat(501) }, 'x', AT)).toEqual({ ok: false, problem: 'long' })
    for (const s of ['employer', 'seeker'] as const) for (const k of PHRASES[s]) for (const lg of ['th', 'zh'] as const) expect(tr(`ch.p.${k}.full` as never, undefined, lg).length).toBeGreaterThan(3)
  })
  it('the employer offers 1–3 later, different times; the worker picks one once; it shows in the calendar', () => {
    const now = '2026-11-22T15:00'
    expect(MAX_SLOTS).toBe(3)
    expect(offerSlots({ msgs: [] }, [], 'video', AT, now)).toEqual({ ok: false, problem: 'none' })
    expect(offerSlots({ msgs: [] }, ['2026-11-21T10:00'], 'video', AT, now)).toEqual({ ok: false, problem: 'past' })
    expect(offerSlots({ msgs: [] }, ['2026-11-25T10:00', '2026-11-25T10:00'], 'video', AT, now)).toEqual({ ok: false, problem: 'same' })
    const r = offerSlots({ msgs: [] }, ['2026-11-26T14:30', '2026-11-25T10:00'], 'onsite', AT, now)
    if (!r.ok) throw new Error('offer')
    expect(r.value.interview?.slots).toEqual(['2026-11-25T10:00', '2026-11-26T14:30'])
    const picked = pickSlot(r.value, '2026-11-25T10:00', AT)
    expect(picked?.interview?.chosen).toBe('2026-11-25T10:00'); expect(pickSlot(picked!, '2026-11-26T14:30', AT)).toBeNull()
    expect(EVENT_KINDS).toContain('interview'); expect(KINDS_FOR.seeker).toContain('interview'); expect(KINDS_FOR.employer).toContain('interview')
  })
  it('the demo chat opens without an account; a match that is not accepted stays closed', () => {
    expect(html(<ChatPage />, seedState(NOW), '?acc=acc-demo')).toContain(T('ch.safe'))
    expect(html(<ChatPage />, seedState(NOW), '?acc=nope')).toContain(T('ch.none'))
    expect(src('./App.tsx')).toContain('chat: <ChatPage />')
  })
})

describe('D. texts', () => {
  it('every new text has Thai, Chinese and English in the right scripts and no key clashes', () => {
    for (const [k, [th, zh, en]] of Object.entries(v2d)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(th, k).not.toMatch(/[一-鿿]/); expect(en, k).not.toMatch(/[฀-๿一-鿿]/)
      expect(messages[k as keyof typeof messages]).toEqual([th, zh, en])
    }
  })
})
