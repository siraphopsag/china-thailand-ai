// Owner's matching model (Oct 2026): pins (5 a week, a month each), employer posts, the five-level release, applications and the
// reservation queue, simulated forwarding, the board, admin gate,
// and the reviewed shell (side menu, log-in, Lobby, two-role page). Static rendering only; clicks and the map were checked manually.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, HOUR_MS, activePins, addPin, applyTo, cancel, clampFuture, decide, forward, inbox, isFull, makePost, parseState, pinQuota, poolOf, postState, removePin, renewPost, withoutExpired } from './domain/match/logic'
import { matchLevel, reachFor, scheduleOf, stageAt } from './domain/match/release'
import { dbProblem } from './domain/match/remote'
import { seedState } from './domain/match/seed'
import { ME, MY_EMPLOYER, type Industry, type MatchState, type Pin, type Seeker, type Skill } from './domain/match/types'
import { messages, type MsgKey } from './locales/index'
import { match } from './locales/match'
import { Landing } from './pages/home'
import { ChooseRolePage } from './pages/choose'
import { BackofficePage, NotificationsPage, SeekPage, SoonNote } from './pages/match'
import { BoardPage } from './pages/board'
import { TILT, layoutFlags, leanPoint } from './components/geomap'
import type { GeoCode } from './geo'
import { BackButton, Header } from './components/shell'
import { SideNav, sideItems } from './components/sidenav'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
function html(node: ReactNode, st?: MatchState): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st ?? seedState(NOW)}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
const NOW = Date.parse('2026-10-03T08:00:00.000Z')
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
/** the post details added in Oct 2026, filled with valid sample values */
const EXTRA = { headcount: 1, employment: 'permanent' as const, salary: null, startDate: at(1).slice(0, 10), languages: [{ lang: 'zh' as const, level: 'basic' as const }], education: 'none' as const, benefits: [] }
const seeker = (pins: Seeker['pins']): Seeker => ({ id: ME, name: 'you', origin: { country: 'TH', province: 'TH-10' }, pins, synthetic: true })
const withMe = (pins: Pin[]): MatchState => ({ ...seedState(NOW), me: seeker(pins), credits: [] })
const ROUTES = new Set([...src('./App.tsx').slice(src('./App.tsx').indexOf('const pages')).matchAll(/(?:^|[\s{,])'?([\w-]+)'?: </g)].map((m) => m[1]).concat(''))

describe('pins (owner, Oct 2026: 5 per weekly cycle, each lasts a month)', () => {
  const place = { country: 'CN' as const, province: 'CN-SH' }
  /** add a pin the way the site does: the pin and one use of the allowance */
  const pinIn = (st: MatchState, p: string, when: string, industry: Industry = 'manufacturing') => {
    const r = addPin(st, { place: { country: p.slice(0, 2) as 'TH' | 'CN', province: p }, industry, skills: ['quality_control'] }, 'p' + p.toLowerCase() + when.slice(0, 13).replace(/\D/g, ''), when)
    return r.ok ? { ok: true as const, st: { ...st, me: r.value, credits: [...st.credits, { kind: 'pin' as const, at: when }] } } : { ok: false as const, problem: r.problem }
  }
  it('5 pins per cycle; the cycle starts with the first pin; 7 days later 5 more (all at once)', () => {
    let st = withMe([])
    for (const p of ['CN-SH', 'CN-GD', 'CN-JS', 'TH-10', 'TH-50']) { const r = pinIn(st, p, at(0)); expect(r.ok, p).toBe(true); if (r.ok) st = r.st }
    const sixth = pinIn(st, 'CN-ZJ', at(1)); expect(sixth.ok ? 'ok' : sixth.problem).toBe('limit')
    expect(pinQuota(st, NOW)).toEqual({ used: 5, limit: 5, left: 0, resetAt: NOW + 7 * DAY_MS })
    const later = pinIn(st, 'CN-ZJ', at(7)); expect(later.ok).toBe(true) // a new cycle
    // removing a pin does not give the use back
    expect(pinQuota({ ...st, me: removePin(st.me, st.me.pins[0].id) }, NOW).left).toBe(0)
  })
  it('one pin per province and field at a time; a real province of the chosen country; at least one skill', () => {
    const fresh = withMe([])
    const bad = [
      addPin(fresh, { place: { country: 'CN', province: 'TH-10' }, industry: 'manufacturing', skills: ['quality_control'] }, 'x', at(0)),
      addPin(fresh, { place: { country: 'CN', province: 'CN-XX' }, industry: 'manufacturing', skills: ['quality_control'] }, 'x', at(0)),
      addPin(fresh, { place, industry: 'manufacturing', skills: [] }, 'x', at(0)),
    ].map((r) => (r.ok ? 'ok' : r.problem))
    expect(bad).toEqual(['place', 'place', 'skills'])
    const once = pinIn(fresh, 'CN-SH', at(0))
    if (!once.ok) throw new Error('pin')
    const same = pinIn(once.st, 'CN-SH', at(0)); expect(same.ok ? 'ok' : same.problem).toBe('duplicate')
    expect(pinIn(once.st, 'CN-SH', at(0), 'hospitality').ok).toBe(true) // the same province for another field
  })
  it('a pin lasts a month, then it no longer counts (and the same place can be pinned again)', () => {
    const st = withMe([{ id: 'old', ...place, industry: 'manufacturing', skills: ['quality_control'], at: at(-31) }])
    expect(activePins(st.me, NOW)).toEqual([])
    expect(pinIn(st, 'CN-SH', at(0)).ok).toBe(true)
  })
  it('the same country may be both origin and destination (work at home)', () => {
    expect(addPin(withMe([]), { place: { country: 'TH', province: 'TH-10' }, industry: 'technology', skills: ['data_analysis'] }, 'h', at(0)).ok).toBe(true)
  })
})

describe('the release in five levels (owner, Oct 2026)', () => {
  const made = makePost({ ...EXTRA, place: { country: 'CN', province: 'CN-SH' }, company: 'Sample Co', position: 'QC Engineer', industry: 'manufacturing', skills: ['quality_control'], minYears: 1, details: '' }, 'post-x', 'employer:me', at(0))
  if (!made.ok) throw new Error('post')
  const P = { ...made.value, verified: true } // a verified employer: all five levels (unverified posts stop at level 2)
  const pin = (id: string, province: string, industry: Industry, skills: Skill[], when: number): Pin => ({ id, country: province.slice(0, 2) as 'TH' | 'CN', province, industry, skills, at: new Date(when).toISOString() })
  const H = HOUR_MS
  const a = pin('a', 'CN-SH', 'manufacturing', ['quality_control'], NOW - 3 * DAY_MS) // level 1, first hourly group
  const a2 = pin('a2', 'CN-SH', 'technology', ['quality_control'], NOW - 3 * DAY_MS + 0.5 * H) // same hour → same group
  const b = pin('b', 'CN-SH', 'manufacturing', ['quality_control'], NOW - 2 * DAY_MS) // level 1, second group
  const c = pin('c', 'CN-GD', 'manufacturing', ['quality_control'], NOW - DAY_MS) // level 2: same field, another province
  const d = pin('d', 'CN-SH', 'food_service', ['culinary_arts'], NOW - DAY_MS) // level 3: same province, another field
  const e = pin('e', 'CN-ZJ', 'technology', ['software_engineering'], NOW - DAY_MS) // level 4: same country
  const f = pin('f', 'TH-10', 'manufacturing', ['quality_control'], NOW - DAY_MS) // level 5: another country
  const pool = [a, a2, b, c, d, e, f]
  it('each pin qualifies for one level: province + field → field → province → country → international', () => {
    expect([a, b, c, d, e, f].map((p) => matchLevel(P, [p], NOW))).toEqual([1, 1, 2, 3, 4, 5])
    expect(matchLevel(P, [e, c], NOW)).toBe(2) // the best of my pins
  })
  it('level 1 opens to hourly groups, earliest pins first; earlier groups keep it; 24 h after the last group level 2 starts', () => {
    const s = scheduleOf(P, pool, NOW)
    expect(s.groups.length).toBe(2)
    expect(s.end1).toBe(NOW + H + 24 * H); expect(s.end2).toBe(s.end1 + 24 * H); expect(s.end3).toBe(s.end2 + 24 * H)
    expect(s.end4).toBe(NOW + 30 * DAY_MS); expect(s.expiresAt).toBe(NOW + 182 * DAY_MS); expect(s.warnAt).toBe(s.expiresAt - 7 * DAY_MS)
    expect(reachFor(P, [a], pool, NOW).visible).toBe(true)
    expect(reachFor(P, [a2], pool, NOW).visible).toBe(true)
    expect(reachFor(P, [b], pool, NOW)).toMatchObject({ visible: false, opensAt: NOW + H })
    expect(reachFor(P, [b], pool, NOW + H).visible).toBe(true)
    expect(reachFor(P, [a], pool, NOW + H).visible).toBe(true)
  })
  it('then level 2 (24 h), level 3 (24 h), level 4 until a month, level 5 (international) until 6 months — then it is gone', () => {
    const s = scheduleOf(P, pool, NOW)
    const seen = (p: Pin, t: number) => reachFor(P, [p], pool, t).visible
    expect([seen(c, s.end1 - 1), seen(c, s.end1)]).toEqual([false, true])
    expect([seen(d, s.end2 - 1), seen(d, s.end2)]).toEqual([false, true])
    expect([seen(e, s.end3 - 1), seen(e, s.end3)]).toEqual([false, true])
    expect([seen(f, s.end4 - 1), seen(f, s.end4)]).toEqual([false, true])
    expect([stageAt(s, NOW), stageAt(s, s.end1), stageAt(s, s.end2), stageAt(s, s.end3), stageAt(s, s.end4), stageAt(s, s.expiresAt)]).toEqual([1, 2, 3, 4, 5, 'expired'])
    expect(seen(a, s.expiresAt)).toBe(false)
    expect(withoutExpired({ ...seedState(NOW), posts: [P] }, s.expiresAt).posts).toEqual([])
  })
  it('no matching pin → straight to level 2; a pin made after the 24 rounds waits for level 2', () => {
    expect(scheduleOf(P, [c, d, e], NOW).end1).toBe(NOW)
    const late = pin('late', 'CN-SH', 'manufacturing', ['quality_control'], NOW + 25 * H)
    const s = scheduleOf(P, [...pool, late], NOW + 26 * H)
    expect(s.groups.length).toBe(2)
    expect(reachFor(P, [late], [...pool, late], NOW + 25.5 * H).visible).toBe(true) // level 2 started at NOW + 25 h
    expect(reachFor(P, [late], [...pool, late], NOW + 25 * H - 1).visible).toBe(false)
  })
  it('renewing starts again at level 1 with a fresh 6 months, and uses the weekly allowance', () => {
    const st = { ...seedState(NOW), posts: [{ ...P, createdAt: at(-40), releasedAt: at(-40) }] }
    const r = renewPost(st, P.id, at(0))
    expect(r.ok && stageAt(scheduleOf(r.value, pool, NOW), NOW)).toBe(1)
    expect(r.ok && r.value.createdAt).toBe(at(-40))
    const full = { ...st, credits: [0, 1, 2].map((i) => ({ kind: 'post' as const, at: at(-i) })) }
    const q = renewPost(full, P.id, at(0)); expect(q.ok ? 'ok' : q.problem).toBe('quota')
  })
})

describe('applications, reservations and the queue (owner, Oct 2026)', () => {
  // a post over a month old: level 5, so everyone may apply
  const base = (): MatchState => {
    const st = seedState(NOW)
    st.posts = [{ ...st.posts[2], headcount: 1 }]
    st.acceptances = []
    return st
  }
  const form = { intro: 'Hello, I can start next month.', availableFrom: at(30).slice(0, 10) }
  it('the first applicant takes the place; once full, the next one reserves; only once each', () => {
    let st = base()
    const pool = poolOf(st)
    const mine = applyTo(st, pool, 'post-s3', ME, form, 'acc-me', at(0))
    expect(mine.ok && mine.value.status).toBe('accepted')
    if (mine.ok) st = { ...st, acceptances: [mine.value] }
    const next = applyTo(st, pool, 'post-s3', 'seeker-a', form, 'acc-a', at(0.1))
    expect(next.ok && next.value.status).toBe('reserved')
    const again = applyTo(st, pool, 'post-s3', ME, form, 'acc-x', at(0.2)); expect(again.ok ? 'ok' : again.problem).toBe('already')
    expect(isFull(st.acceptances, st.posts[0])).toBe(true)
  })
  it('the introduction refuses contact details; the start day is from today, within two years', () => {
    const st = base(), pool = poolOf(st)
    const r = (i: Partial<typeof form>) => { const x = applyTo(st, pool, 'post-s3', ME, { ...form, ...i }, 'a', at(0)); return x.ok ? 'ok' : x.problem }
    expect([r({ intro: 'call 081 234 5678' }), r({ intro: 'x'.repeat(301) }), r({ availableFrom: at(-2).slice(0, 10) }), r({ availableFrom: at(800).slice(0, 10) })]).toEqual(['contact', 'intro', 'available', 'available'])
  })
  it('declining frees the place for the earliest reservation; withdrawing does the same; a decision is final', () => {
    const acc = (id: string, seekerId: string, status: 'accepted' | 'reserved', d: number) => ({ id, postId: 'post-s3', seekerId, at: at(d), status, intro: '', availableFrom: null })
    const st = { ...base(), acceptances: [acc('a1', 'seeker-a', 'accepted', 0), acc('a2', 'seeker-b', 'reserved', 0.2), acc('a3', ME, 'reserved', 0.1)] }
    const d = decide(st, 'a1', false, at(1)); if (!d.ok) throw new Error('decide')
    expect(d.value.find((x) => x.id === 'a1')).toMatchObject({ status: 'rejected', decidedAt: at(1) })
    expect(d.value.find((x) => x.id === 'a3')).toMatchObject({ status: 'accepted', promotedAt: at(1) }) // reserved earlier than a2
    expect(d.value.find((x) => x.id === 'a2')!.status).toBe('reserved')
    const twice = decide({ ...st, acceptances: d.value }, 'a1', true, at(2)); expect(twice.ok ? 'ok' : twice.problem).toBe('state')
    const w = cancel({ ...st, acceptances: d.value }, 'a3', at(2)); if (!w.ok) throw new Error('cancel')
    expect(w.value.find((x) => x.id === 'a2')).toMatchObject({ status: 'accepted', promotedAt: at(2) })
    expect(postState(w.value, st.posts[0])).toBe('waiting')
  })
  it('only a confirmed case is forwarded (simulated); my own post is not open to me', () => {
    const a = { id: 'a', postId: 'post-s3', seekerId: ME, at: at(0), status: 'accepted' as const, intro: '', availableFrom: null }
    expect(forward(a, at(1))).toBe(a)
    expect(forward({ ...a, status: 'confirmed' }, at(1))).toMatchObject({ status: 'forwarded', forwardedAt: at(1) })
    const st = base(); st.posts[0] = { ...st.posts[0], employerId: MY_EMPLOYER }
    const own = applyTo(st, poolOf(st), 'post-s3', ME, form, 'x', at(0)); expect(own.ok ? 'ok' : own.problem).toBe('notOpen')
    expect(src('./domain/match/logic.ts') + src('./matchData.tsx')).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/)
  })
  it('posts refuse contact details and missing fields', () => {
    const base = { ...EXTRA, place: { country: 'CN' as const, province: 'CN-SH' }, company: 'Sample Co', position: 'Chef', industry: 'food_service' as const, skills: ['culinary_arts' as const], minYears: 1, details: '' }
    const r = [makePost({ ...base, details: 'call 081 234 5678' }, 'a', 'employer:me', at(0)), makePost({ ...base, company: 'x' }, 'a', 'employer:me', at(0)), makePost({ ...base, skills: [] }, 'a', 'employer:me', at(0)), makePost({ ...base, minYears: 99 }, 'a', 'employer:me', at(0))]
    expect(r.map((x) => (x.ok ? 'ok' : x.problem))).toEqual(['contact', 'company', 'skills', 'years'])
  })
})

describe('stored data is validated', () => {
  it('the seed is valid; data saved before the five levels is upgraded; tampered items are dropped one by one (the rest stays)', () => {
    const st = seedState(NOW)
    expect(parseState(JSON.parse(JSON.stringify(st)))).not.toBeNull()
    // version 1: days on the clock, no release time, no introductions, no allowance log
    const v1 = JSON.parse(JSON.stringify(st)) as Record<string, unknown> & MatchState
    const old = { ...v1, version: 1, dayOffset: 2, posts: v1.posts.map(({ releasedAt: _r, ...p }) => p), acceptances: v1.acceptances.map(({ intro: _i, availableFrom: _f, ...a }) => a) } as Record<string, unknown>
    delete old.clockHours; delete old.credits
    const up = parseState(old)
    expect(up && [up.version, up.clockHours, up.posts[0].releasedAt === up.posts[0].createdAt, up.acceptances[0].intro]).toEqual([2, 48, true, ''])
    const bad = (f: (s: MatchState) => void) => { const s = JSON.parse(JSON.stringify(st)) as MatchState; f(s); return parseState(s)! }
    expect(bad((s) => { s.seekers[0].pins = Array.from({ length: 70 }, (_, i) => ({ ...s.seekers[0].pins[0], id: 'x' + i, at: at(-i) })) }).seekers[0].pins.length).toBe(60) // the newest 60 are kept
    expect(bad((s) => { s.posts[0].province = 'CN-XX' }).posts.map((p) => p.id)).not.toContain('post-s1')
    expect(bad((s) => { s.posts[0].province = 'CN-XX' }).acceptances.map((a) => a.id)).toEqual(['acc-me']) // its application goes with it
    expect(bad((s) => { s.acceptances.push({ id: 'a', postId: 'nope', seekerId: ME, at: at(0), status: 'accepted', intro: '', availableFrom: null }) }).acceptances.map((a) => a.id)).toEqual(['acc-s1', 'acc-me'])
    expect(bad((s) => { s.acceptances.push({ ...s.acceptances[0], id: 'twice' }) }).acceptances.map((a) => a.id)).toEqual(['acc-s1', 'acc-me'])
    expect(bad((s) => { s.acceptances[0].intro = 'mail me hr@example.com' }).acceptances.map((a) => a.id)).toEqual(['acc-me'])
    expect(bad((s) => { s.clockHours = -1 }).clockHours).toBe(0)
    expect(bad((s) => { s.posts[0].releasedAt = at(-400) }).posts.map((p) => p.id)).not.toContain('post-s1') // released before it was posted
    expect(bad((s) => { s.posts[0].details = 'mail me hr@example.com' }).posts.map((p) => p.id)).not.toContain('post-s1')
    expect(parseState({ ...JSON.parse(JSON.stringify(st)), me: { id: 'someone' } })).toBeNull() // a broken frame starts over
    // a start date picked near the far end while editing no longer breaks the reload
    expect(bad((s) => { s.posts[0].startDate = at(735).slice(0, 10) }).posts.map((p) => p.id)).toContain('post-s1')
  })
})

describe('board bug hunt (Oct 2026)', () => {
  it('adding a pin drops my expired pins, so a long-used demo never grows past what can be stored', () => {
    const old = Array.from({ length: 31 }, (_, i): Pin => ({ id: `o${i}`, country: 'TH', province: 'TH-10', industry: 'technology', skills: ['data_analysis'], at: at(-40 - i) }))
    const r = addPin(withMe(old), { place: { country: 'CN', province: 'CN-SH' }, industry: 'manufacturing', skills: ['quality_control'] }, 'new', at(0))
    expect(r.ok && r.value.pins.map((p) => p.id)).toEqual(['new'])
  })
  it('the bell counts exactly what the notifications page lists', () => {
    const st = seedState(NOW); st.role = 'seeker' // no pins yet: the page says "pin first", so the bell says nothing
    expect(inbox(st, poolOf(st), NOW, () => 0).count).toBe(0)
    st.me = seeker([{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(-5) }])
    const box = inbox(st, poolOf(st), NOW, () => 0)
    expect(box.offers.map((p) => p.id).sort()).toEqual(['post-s2']); expect(box.count).toBe(1) // post-s3 is the sample case's post: already applied
    expect(src('./components/sidenav.tsx')).toContain('return inbox(st, pool, now, (id) => counts[id]?.reserved ?? 0).count')
    expect(src('./pages/match.tsx')).toContain('const box = inbox(st, pool, now, (id) => counts[id]?.reserved ?? 0)')
    const emp = seedState(NOW); emp.role = 'employer'; emp.posts = emp.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER } : p))
    expect(inbox(emp, poolOf(emp), NOW, (id) => (id === 'post-s1' ? 2 : 0))).toMatchObject({ count: 2 }) // one applicant waiting + reservations on that post
  })
  it('"Back to real time" moves anything made while the clock ran ahead to now, so nothing vanishes', () => {
    const st = withMe([{ id: 'f', country: 'CN', province: 'CN-SH', industry: 'manufacturing', skills: ['quality_control'], at: at(20) }])
    const back = clampFuture({ ...st, clockHours: 480, credits: [{ kind: 'pin', at: at(20) }] }, NOW)
    expect(back.clockHours).toBe(0); expect(back.me.pins[0].at).toBe(at(0)); expect(back.credits[0].at).toBe(at(0))
    expect(activePins(back.me, NOW).length).toBe(1)
  })
  it('wanting fewer people than already hold a place is refused (site and database); wanting more moves the queue up in the demo too', () => {
    const m = src('./matchData.tsx')
    expect(m).toContain("if (input.headcount < (counts[id]?.held ?? holding(st.acceptances, id))) return { ok: false, problem: 'belowHeld' } as const")
    expect(m).toContain('acceptances: promote(s.acceptances, value, at())')
    expect(src('../supabase/migrations/0003_board.sql')).toContain("raise exception 'below_held'")
    expect(tr('m.err.belowHeld', undefined, 'th')).toContain('ลดจำนวน')
  })
  it('signed in, limits follow real time (the database does too); the demo clock only moves levels and ages, and says so', () => {
    const m = src('./matchData.tsx')
    expect(m).toContain("const limitNow = mode === 'remote' ? Date.now() : now")
    expect(m).toContain('if (!canPost(st, limitNow))')
    expect(src('./pages/board.tsx')).toContain('pinQuota(st, limitNow) : postQuota(st, limitNow)')
    expect(src('./pages/match.tsx')).toContain("{mode === 'remote' && <p className=\"text-xs text-muted\">{t('m.clock.noteRemote')}</p>}")
  })
  it('a job seeker\'s map counts only the posts their list can show', () => {
    expect(src('./pages/board.tsx')).toContain('const postsByProvince = items.map((x) => x.post).reduce')
  })
})

describe('map opening scene (owner, Oct 2026: poles with flags, a bare map in one colour)', () => {
  it('flag labels on short upright poles never overlap, even in a dense group, and keep clear of the button', () => {
    // a tight group like Laos – Thailand – Cambodia – Vietnam on a phone, plus neighbours
    const pts = ([['LA', 160, 240], ['TH', 150, 262], ['KH', 172, 272], ['VN', 185, 230], ['MM', 120, 236], ['MY', 150, 320], ['SG', 165, 332], ['CN', 220, 120]] as const)
      .map(([c, x, y]) => ({ c: c as GeoCode, x, y, width: 70 }))
    const out = layoutFlags(pts, 340, 420, 20, [{ l: 190, t: 360, r: 340, b: 420 }])
    const box = (q: (typeof out)[number]) => ({ l: q.left, t: q.top, r: q.left + q.width, b: q.top + 20 })
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const a = box(out[i]), b = box(out[j])
      expect(a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b, `${out[i].c} × ${out[j].c}`).toBe(false)
    }
    for (const q of out) { expect(q.pole).toBeGreaterThanOrEqual(15); expect(q.pole).toBeLessThanOrEqual(68); expect(q.left).toBeGreaterThanOrEqual(4); expect(q.left + q.width).toBeLessThanOrEqual(336) }
    expect(out.filter((q) => q.pole === 20).length).toBeGreaterThanOrEqual(3) // most poles stay short
  })
  it('the scene is a bare map in one colour (no country or capital names, no rings); poles are upright; labels fit their name', () => {
    const g = src('./components/geomap.tsx')
    expect(g).toContain("(!c ? 'g-dim' : intro ? 'g-uni' :")
    expect(g).toContain('{!country && !intro && ([\'TH\', \'CN\'] as const)')
    expect(g).toContain('{!intro && shownCapitals.map(')
    expect(g).toContain('{!intro && view.k < 3 && TINY.map(')
    expect(g).toContain('<line x1={l.x} y1={l.y} x2={l.x} y2={l.y - l.pole} className="g-pole" />')
    expect(g).not.toContain('width: labelW') // no fixed label width
    expect(src('./index.css')).toMatch(/\.map-flag \{[^}]*white-space: nowrap/)
    expect(src('./components/flags.ts')).toContain("from 'flag-icons/flags/4x3/sg.svg'")
  })
})

describe('renew and delete on the board (owner, Oct 2026: they seemed to do nothing)', () => {
  it('the post page and my posts ask in the site window (renew, delete, decline, withdraw) and show “saving”', () => {
    for (const p of ['./pages/post.tsx', './pages/hire.tsx', './pages/board.tsx']) expect(src(p), p).not.toContain('window.confirm')
    const post = src('./pages/post.tsx')
    expect(post).toContain("if (await ask(t('m.em.renew.confirm'), { yes: t('m.em.renew') })) void act(() => renew(p.id), t('m.em.renewed'))")
    expect(post).toContain('{askDialog}')
    expect(src('./pages/hire.tsx')).toContain("{renewing === x.id ? t('m.ask.busy') : t('m.em.renew')}")
  })
  it('a database that has not run 0003 yet says so (not “check your connection”)', () => {
    expect(dbProblem({ code: 'PGRST202', message: 'Could not find the function public.renew_post(p_id) in the schema cache' })).toBe('dbOld')
    expect(dbProblem({ code: '42P01', message: 'relation \"public.quota_events\" does not exist' })).toBe('dbOld')
    expect(dbProblem({ message: 'Failed to fetch' })).toBe('network')
    expect(tr('m.err.dbOld', undefined, 'th')).toContain('0003_board.sql')
  })
})

describe('the board (owner, Oct 2026)', () => {
  const real = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString()
  it('job seeker: the shop shelves (levels with stars, colour and name), search and filters, newest first, and my pins', () => {
    const st = seedState(); st.role = 'seeker'
    st.me = seeker([{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: real(-5) }])
    const page = html(<BoardPage />, st)
    for (const l of [1, 2, 3, 4, 5] as const) expect(page, `level ${l}`).toContain(T('m.lv.short', { n: l }))
    expect(page).toContain('role="search"'); expect(page).toContain(T('m.board.searchHint'))
    expect(page).toContain('Quality Control Engineer') // level 1 for my pin
    expect(page).toContain('Warehouse Coordinator') // level 5: over a month old, open to everyone
    expect(page).not.toContain('Front Office Manager') // Shanghai: not for me yet
    expect(page).toMatch(/class="chip rar rar-1"><span class="inline-flex" aria-hidden="true">(<svg[^>]*class="lucide[^"]*fill-current[^"]*"[^]*?<\/svg>){5}<\/span>/)
    expect(page).toContain(T('m.sort.new')); expect(page).toContain(T('m.board.myPins')); expect(page).toContain(T('m.pin.new'))
    expect(page).toContain(T('m.qb.pins', { n: 0, max: 5 }))
  })
  it('employer: my posts with the level each reached, places and reservations, and my weekly allowance', () => {
    const st = seedState(); st.role = 'employer'
    st.posts = st.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER } : p))
    st.credits = [{ kind: 'post', at: real(-1.2) }]
    const page = html(<BoardPage />, st)
    expect(page).toContain('Front Office Manager'); expect(page).toContain('Warehouse Coordinator') // other employers' posts too (owner, Oct 2026)
    expect(page).toContain(`>${T('m.bd.manage')}</a>`); expect(page).toContain(`>${T('m.bd.view')}</a>`) // mine → manage · others' → view
    expect(page).toContain(T('m.lv.reached', { l: T('m.lv.2') }))
    expect(page).toContain('<p class="text-base sm:text-lg font-bold">1/2</p>'); expect(page).toContain(T('m.bd.places')) // places taken on the card
    expect(page).toContain(T('m.qb.posts', { n: 1, max: 3 }))
  })
  it('the map shows counts only, also listed in text; menu has the board; posts link to their page', () => {
    expect(src('./components/geomap.tsx')).toContain('className="g-count"')
    expect(src('./pages/board.tsx')).toContain("t('m.board.top', { list: top.map(([p, n]) => `${N.prov(p)} ${n}`).join(' · ') })")
    expect(ROUTES.has('board')).toBe(true)
  })
})

describe('admin gate', () => {
  it('without an administrator account signed in, the back office stays closed (Google sign-in + database role, see auth.test)', () => {
    const page = html(<BackofficePage />)
    expect(page).toContain(T('m.adm.gate'))
    expect(page).not.toContain('Sample Riverside Hotels')
  })
})

describe('reviewed shell and pages', () => {
  it('header: C.A.L.L. mark that is not a link, language, theme, log in — no menu button (owner, Oct 2026), no top navigation, no role switcher', () => {
    const h = html(<Header route="" />)
    expect(h).not.toContain(`aria-label="${T('m.menu')}"`)
    expect(h).not.toContain('data-menu-button')
    expect(h).not.toContain(T('m.login')) // sign-in is hidden until the service is configured (see auth.test for the other states)
    expect(h).not.toContain('>PoC<')
    for (const k of ['nav.jobs', 'nav.employerArea', 'nav.bizPlanning'] as const) expect(h, k).not.toContain(T(k))
    expect(h).not.toMatch(/<a [^>]*href="\/"/) // the logo is no longer a link
  })
  it('menu order: home, my pins / my posts by role, board, notifications, calendar, prepare, settings, help, back office (admin only), profile last', () => {
    const keys = (r: 'seeker' | 'employer' | null, a: boolean) => sideItems(r, a).map((i) => i.key)
    expect(keys(null, false)).toEqual(['m.home', 'm.board', 'm.notif', 'm.cal', 'm.prepare', 'm.settings', 'm.help', 'm.member', 'm.profile'])
    expect(keys('seeker', false)).toEqual(['m.home', 'm.pins', 'm.board', 'm.notif', 'm.cal', 'm.prepare', 'm.settings', 'm.help', 'm.member', 'm.profile'])
    expect(keys('employer', true)).toEqual(['m.home', 'm.posts', 'm.board', 'm.notif', 'm.cal', 'm.prepare', 'm.settings', 'm.help', 'm.member', 'm.admin', 'm.an.nav', 'm.profile'])
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
    for (const r of ['choose-role', 'seek', 'hire', 'board', 'post', 'notifications', 'me', 'prepare', 'settings', 'help', 'backoffice']) expect(ROUTES.has(r), r).toBe(true)
    const st = seedState(NOW); st.role = 'seeker'
    st.me = seeker([{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(-5) }])
    st.acceptances.push({ id: 'acc-1', postId: 'post-s2', seekerId: ME, at: at(0), status: 'forwarded', forwardedAt: at(0), intro: '', availableFrom: null })
    const page = html(<NotificationsPage />, st)
    expect(page).toContain('href="https://www.doe.go.th/"'); expect(page).toContain('href="https://www.dsd.go.th/"')
    expect(page).toContain(T('m.agency.note')); expect(page).toContain(T('m.st.forwarded'))
  })
  it('every matching message has Thai, Simplified Chinese and English and is not overridden', () => {
    for (const [k, [th, zh, en]] of Object.entries(match)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as MsgKey], k).toBe(match[k as keyof typeof match])
    }
    const files = ['./pages/match.tsx', './components/sidenav.tsx', './pages/home.tsx', './pages/choose.tsx', './components/shell.tsx'].map(src).join('\n')
    for (const k of [...files.matchAll(/\bt\('(m\.[\w.]+)'/g)].map((m) => m[1])) expect(k in messages, k).toBe(true)
  })
})

describe('accessibility audit, round 1 (#1, #2, #7)', () => {
  const css = src('./index.css')
  it('#1 the start button shows a focus ring although its decorative ring clips its contents', () => {
    expect(css).toMatch(/\.cta-ring:has\(\.cta-core:focus-visible\)\s*\{[^}]*outline:\s*3px solid/)
    expect(css).toMatch(/\.cta-ring\s*\{[^}]*overflow:\s*hidden/) // the reason the ring, not the button, carries the outline
  })
  it('#2 (superseded by the always-visible menu, Oct 2026) no drawer over the page; the phone "More" list moves focus in, closes on Esc (focus back) and on a press outside', () => {
    const nav = src('./components/sidenav.tsx')
    expect(nav).not.toContain("setAttribute('inert'")
    expect(nav).toMatch(/moreList\.current\?\.querySelector<HTMLElement>\('a\[href\]'\)\?\.focus\(\)/)
    expect(nav).toContain("if (e.key === 'Escape') { setMoreOpen(false); moreBtn.current?.focus() }")
    expect(nav).toContain("document.addEventListener('pointerdown', away)")
    expect(nav).toContain('useEffect(() => { setMoreOpen(false) }, [route])')
    // nothing hides under the bottom capsule on phones
    expect(src('./App.tsx')).toContain('pb-24 md:pb-10') // room for the phone menu capsule (the interface is a step smaller on phones)
    expect(css).toMatch(/@media \(max-width: 767px\) \{ html \{ scroll-padding-bottom: 6rem \} \}/)
  })
  it('#7 focused controls scroll clear of the 64px sticky header', () => {
    expect(css).toMatch(/html\s*\{\s*scroll-padding-top:\s*5rem\s*\}/)
  })
})

describe('accessibility audit, rounds 2–3 (#3–#6, #8–#10)', () => {
  const css = src('./index.css')
  const seekerState = () => { const st = seedState(NOW); st.role = 'seeker'; st.me = seeker([]); return st }
  it('#3 #9 (menu capsule, Oct 2026) the current page sits on a solid indigo pill; icons only (owner), each with a name for screen readers', () => {
    const page = html(<SideNav route="seek" />, seekerState())
    const current = [...page.matchAll(/<a [^>]*aria-current="page"[^>]*>/g)].map((m) => m[0])
    expect(current.length).toBe(2) // the side capsule and the phone bar
    for (const a of current) { expect(a).toContain('href="/seek"'); expect(a).toContain('nav-on') }
    expect(css).toMatch(/\.nav-on, \.nav-on:hover \{ color: rgb\(var\(--onprimary\)\);[\s\S]*?linear-gradient\(180deg, rgb\(var\(--primary-hi\)\), rgb\(var\(--primary\)\)\)/)
    for (const k of ['m.home', 'm.notif', 'm.pins', 'm.board', 'm.prepare', 'm.settings', 'm.help', 'm.profile'] as const) expect(page, k).toContain(`aria-label="${T(k)}`) // the bell may add its count
    expect(page).not.toMatch(/<a [^>]*title=/)
    // computers and tablets: left capsule; phones: bottom capsule with 5 places + More
    expect(page).toContain('class="nav-pill nav-rail hidden md:flex fixed left-4 top-[calc(50%+2rem)]') // centred in the space under the header (Oct 2026: it went under the header on short screens)
    expect(page).toMatch(/class="nav-pill md:hidden fixed inset-x-3/)
    const bar = page.slice(page.indexOf('nav-pill md:hidden'))
    expect(bar.slice(0, bar.indexOf('aria-controls="nav-more"')).match(/<a /g)?.length).toBe(5)
    expect(bar).toContain(`aria-label="${T('m.more')}" aria-expanded="false" aria-controls="nav-more"`)
    expect(src('./App.tsx')).toContain('md:pl-24')
  })
  it('#4 (revised with the owner) the view moves with single taps: tapping a country or province frames it; zoom and back-to-view buttons; no arrow pad', () => {
    const geo = src('./components/geomap.tsx')
    expect(geo).not.toContain('m.pan')
    expect(geo).not.toContain('geo.resetView') // owner removed it (its icon looked like "my location"); choosing a place re-frames the view
    expect(geo).toMatch(/aria-label=\{t\('geo\.zoomIn'\)\}[\s\S]*aria-label=\{t\('geo\.zoomOut'\)\}/)
    expect(geo).toMatch(/onPickProvince\(d\.prov === province \? null : d\.prov\)/) // a tap picks (and frames) a province
    expect(geo).toMatch(/onPickCountry\(d\.code as GeoCode\)/)
  })
  it('#5 job titles on notifications and in the back office are headings', () => {
    const st = seedState(NOW); st.role = 'seeker'
    st.me = seeker([{ id: 'm1', country: 'CN', province: 'CN-JS', industry: 'manufacturing', skills: ['quality_control'], at: at(-5) }])
    expect(html(<NotificationsPage />, st)).toMatch(/<h3 class="[^"]*"><a href="\/post\?id=post-s2"[^>]*>Quality Control Engineer<\/a><\/h3>/)
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
    const hire = src('./pages/hire.tsx') // the employer form moved here (Oct 2026)
    expect(hire).toContain("aria-describedby={fe.describe('emp-company', 'emp-company-hint')}")
    expect(hire).toContain("contact: ['emp-details', 'emp-details']")
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

describe('liquid-glass menu capsule (owner, Oct 2026)', () => {
  const css = src('./index.css')
  const tok = (theme: 'light' | 'dark', name: string) => {
    const lightAt = css.search(/:root, :root\[data-theme='light'\] \{\s*--glass-tint/), darkAt = css.search(/:root\[data-theme='dark'\] \{\s*--glass-tint/)
    const block = theme === 'light' ? css.slice(lightAt, darkAt) : css.slice(darkAt)
    return block.match(new RegExp(`--${name}: ([\\d.]+) ([\\d.]+) ([\\d.]+)`))!.slice(1, 4).map(Number)
  }
  const pal = (theme: 'light' | 'dark', name: string) => {
    const i = theme === 'light' ? css.indexOf(":root, :root[data-theme='light'] {") : css.indexOf(":root[data-theme='dark'] {")
    return css.slice(i).match(new RegExp(`--${name}: ([\\d.]+) ([\\d.]+) ([\\d.]+)`))!.slice(1, 4).map(Number)
  }
  const L = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const cr = (a: number[], b: number[]) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  it('clear glass: strong blur, lit rim, specular highlight; the "More" list is glass too and lives outside the capsule', () => {
    expect(css).toMatch(/\.nav-pill, \.glass-pop \{ isolation: isolate;[\s\S]*?backdrop-filter: blur\(var\(--glass-blur\)\) saturate\(1\.8\)/)
    expect(css).toMatch(/\.nav-pill::before, \.glass-pop::before \{[^}]*radial-gradient/)
    const nav = src('./components/sidenav.tsx')
    expect(nav.indexOf('id="nav-more"')).toBeGreaterThan(nav.lastIndexOf('</nav>'))
  })
  it('the current-page drop stays ≥ 3:1 against the glass and the icon on it ≥ 3:1, in both themes; reduced transparency → solid', () => {
    for (const th of ['light', 'dark'] as const) {
      const glass = tok(th, 'glass-tint'), hi = tok(th, 'primary-hi'), base = pal(th, 'primary'), on = pal(th, 'onprimary')
      for (const c of [hi, base]) { expect(cr(c, glass), `${th} drop`).toBeGreaterThanOrEqual(3); expect(cr(on, c), `${th} icon`).toBeGreaterThanOrEqual(3) }
    }
    expect(css).toMatch(/@media \(prefers-reduced-transparency: reduce\) \{\s*\.nav-pill, \.glass-pop, \.glass-card \{ background: rgb\(var\(--surface\)\); backdrop-filter: none/)
  })
  it('Lobby: the 8 short-reading cards are glass over still coloured light; letters and numbers sit on indigo drops; forms stay solid', () => {
    const page = html(<Landing />)
    expect(page.match(/<li class="glass-card/g)?.length).toBe(8)
    expect(page.match(/class="glass-drop w-/g)?.length).toBe(8)
    expect(page).not.toContain('glass-orbs') // the box of light showed hard edges; the light now lives in the page background
    expect(css).toMatch(/radial-gradient\(42vw 38vh at 8% 55%, rgb\(var\(--glow-a\) \/ calc\(var\(--orb-a\) \* \.8\)\), transparent 72%\)/)
    // forms keep solid cards; their lists and empty states are glass
    const seek = html(<SeekPage />, { ...seedState(NOW), role: 'seeker', me: seeker([]) })
    expect(seek).toMatch(/<form class="card space-y-4"/); expect(src('./pages/match.tsx')).toContain('<div className="glass-card p-5 text-muted">') // the pin list (its own tab now)
  })
  it('glass on the other short-reading cards (roles, prepare, notifications, lists, profile, help, empty states); settings stays solid; footer band reaches both edges', () => {
    expect(html(<ChooseRolePage />).match(/<li class="glass-card role-card/g)?.length).toBe(2)
    const m = src('./pages/match.tsx')
    for (const s of ['className="glass-card p-5 flex gap-4 items-start h-full"', '<li key={a.id} className="glass-card p-4 space-y-2">', '<section className="glass-card p-5 space-y-3 text-sm">', '<div className="glass-card p-5 flex flex-col items-center'])
      expect(m, s).toContain(s)
    expect(m).toContain(`<section className="card space-y-4" aria-label={t('m.settings.look')}>`) // settings (two cards side by side)
    const app = src('./App.tsx')
    expect(app.indexOf('<footer')).toBeGreaterThan(app.indexOf('</main>'))
    expect(app).toMatch(/<\/div>\s*\{\/\* the footer band runs to both screen edges[\s\S]*?<footer className={`[^`]*md:pl-28/)
  })
  it('text on the glass cards stays ≥ 4.5:1 even over the strongest coloured light, and on the drops, in both themes', () => {
    const num = (th: 'light' | 'dark', name: string) => {
      const at = th === 'light' ? css.search(/:root, :root\[data-theme='light'\] \{ --glass-card-a1/) : css.search(/:root\[data-theme='dark'\] \{ --glass-card-a1/)
      return Number(css.slice(at).match(new RegExp(`--${name}: ([\\d.]+)`))![1])
    }
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v * t + b[i] * (1 - t))
    for (const th of ['light', 'dark'] as const) {
      const page = pal(th, 'page'), glass = tok(th, 'glass-tint'), orbA = num(th, 'orb-a'), cardA = num(th, 'glass-card-a2')
      for (const orb of [pal(th, 'glow-a'), pal(th, 'glow-b'), pal(th, 'primary')]) {
        const behind = mix(orb, page, orbA), bg = mix(glass, behind, cardA)
        for (const txt of ['ink', 'muted', 'primary', 'ok-fg']) expect(cr(pal(th, txt), bg), `${th} ${txt}`).toBeGreaterThanOrEqual(4.5)
      }
      const drop = mix([255, 255, 255], pal(th, 'primary'), 0.15)
      expect(cr(pal(th, 'onprimary'), drop), `${th} drop text`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('role page redesign (owner, Oct 2026)', () => {
  const css = src('./index.css')
  const pal = (theme: 'light' | 'dark', name: string) => {
    const i = theme === 'light' ? css.indexOf(":root, :root[data-theme='light'] {") : css.indexOf(":root[data-theme='dark'] {")
    const blockStart = css.slice(i)
    const m = blockStart.match(new RegExp(`--${name}: ([\\d.]+) ([\\d.]+) ([\\d.]+)`))
    return m!.slice(1, 4).map(Number)
  }
  const role = (theme: 'light' | 'dark', name: string) => {
    const at = theme === 'light' ? css.search(/:root, :root\[data-theme='light'\] \{ --seeker/) : css.search(/:root\[data-theme='dark'\] \{ --seeker/)
    return css.slice(at).match(new RegExp(`--${name}: ([\\d.]+) ([\\d.]+) ([\\d.]+)`))!.slice(1, 4).map(Number)
  }
  const L = (c: number[]) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  const cr = (a: number[], b: number[]) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v * t + b[i] * (1 - t))
  it('each card: role heading + description, 4 things you can do, a "Start as …" button that covers the card; note about changing later', () => {
    const page = html(<ChooseRolePage />)
    for (const r of ['employer', 'seeker'] as const) {
      expect(page).toContain(`<h2 id="role-${r}-t"`)
      for (const n of [1, 2, 3, 4]) expect(page, `${r} p${n}`).toContain(T(`m.role.${r}.p${n}` as MsgKey))
      expect(page).toMatch(new RegExp(`<button type="button" class="role-cta mt-auto" aria-describedby="role-${r}-d">${T(`m.role.start.${r}` as MsgKey)}`))
    }
    expect(page.split('<button').length - 1).toBe(2)
    expect(page).toContain(T('m.role.change'))
    expect(css).toMatch(/\.role-cta::after \{ content: ''; position: absolute; inset: 0/)
    expect(css).toMatch(/\.role-card:has\(\.role-cta:focus-visible\) \{ outline: 3px solid/)
  })
  it('role colours: text on the glass buttons ≥ 4.5:1 and ticks ≥ 3:1 against the glass, in both themes', () => {
    for (const th of ['light', 'dark'] as const) {
      const glassAt = th === 'light' ? css.search(/:root, :root\[data-theme='light'\] \{\s*--glass-tint/) : css.search(/:root\[data-theme='dark'\] \{\s*--glass-tint/)
      const glass = css.slice(glassAt).match(/--glass-tint: ([\d.]+) ([\d.]+) ([\d.]+)/)!.slice(1, 4).map(Number)
      for (const [c, on] of [[pal(th, 'primary'), pal(th, 'onprimary')], [role(th, 'seeker'), role(th, 'onseeker')]]) {
        expect(cr(on, mix([255, 255, 255], c, 0.15)), `${th} button text`).toBeGreaterThanOrEqual(4.5)
        expect(cr(c, glass), `${th} tick`).toBeGreaterThanOrEqual(3)
      }
    }
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
  it('Lobby cards: every "how it works" step has a short title + one short sentence; C/A/L/L sentences are short in all languages', () => {
    const page = html(<Landing />)
    for (const n of [1, 2, 3, 4]) {
      expect(page, `title ${n}`).toContain(`<span class="block font-semibold leading-snug">${T(`m.how.${n}.t` as MsgKey)}</span>`)
      expect(page, `text ${n}`).toContain(`<span class="block text-sm text-muted mt-1">${T(`m.how.${n}` as MsgKey)}</span>`)
    }
    for (const k of ['m.how.1', 'm.how.2', 'm.how.3', 'm.how.4', 'brand.cross', 'brand.asean', 'brand.language', 'brand.legal'] as const) {
      const [th, zh, en] = messages[k] as readonly string[]
      expect(th.length, k).toBeLessThanOrEqual(80); expect(zh.length, k).toBeLessThanOrEqual(30); expect(en.length, k).toBeLessThanOrEqual(75)
    }
    for (const n of [1, 2, 3, 4]) { const [th, , en] = messages[`m.how.${n}.t` as MsgKey] as readonly string[]; expect(th.length).toBeLessThanOrEqual(24); expect(en.split(' ').length).toBeLessThanOrEqual(4) }
  })
  it('skill chips in a row share one height; the menu capsule shows icons only, so no label can overflow in any language', () => {
    expect(src('./pages/match.tsx')).toContain('grid grid-cols-2 auto-rows-fr gap-2')
    expect(css).toMatch(/\.chip-check \{[^}]*height: 100%/)
    const nav = src('./components/sidenav.tsx'), cap = nav.slice(nav.indexOf('const iconLink'), nav.indexOf('const moreOn'))
    // no text label inside the capsule buttons — the only name is the hover/focus bubble, which floats outside the capsule (Oct 2026)
    expect(cap.replace('<span className="nav-tip" aria-hidden>{t(n.key as never)}</span>', '')).not.toMatch(/\{t\(n\.key as never\)\}<\//)
    expect(css).toMatch(/\.nav-tip \{ position: absolute; left: calc\(100% \+ \.75rem\)[^}]*white-space: nowrap/)
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
      const r = addPin(withMe([]), { place: { country: c, province: 'X' } as never, industry: 'technology', skills: ['data_analysis'] }, 'p', at(0))
      expect(r.ok ? 'ok' : r.problem, c).toBe('place')
    }
  })
  it('4 the country list has all 12 countries: open now (2) and a greyed "coming soon" group (10), no suffix on names', () => {
    const page = html(<SeekPage />, { ...seedState(NOW), role: 'seeker', me: seeker([]) })
    const sel = page.slice(page.indexOf('<button id="dest-prov-c"'), page.indexOf('<button id="dest-prov"'))
    expect(sel.match(/role="option"/g)?.length).toBe(12)
    expect(sel).toContain(`${T('m.countryOpen')}</span>`)
    expect(sel).toMatch(new RegExp(`<li role="presentation" class="list-group-muted"><div id="[^"]+" class="[^"]*text-muted"[^]*?${T('geo.soon')}</span>`)) // the planned group header, once
    expect(sel.split(T('geo.soon')).length - 1).toBe(1) // no "· coming soon" after each name (the field badge only appears once one is chosen)
    for (const c of ['TH', 'CN', 'VN', 'SG', 'TL']) expect(sel, c).toContain(`<span class="truncate">${T(`geo.c.${c}` as MsgKey)}</span>`)
    expect(sel.match(/role="option" aria-selected="false" class="[^"]*text-muted/g)?.length).toBe(10) // the 10 planned countries are grey
  })
  it('A the lists open below the field, closed by default, sized to ~7 country rows and 10 province rows (the rest scrolls)', () => {
    const page = html(<SeekPage />, { ...seedState(NOW), role: 'seeker', me: seeker([]) })
    expect(page).toMatch(/<button id="dest-prov-c" type="button" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="[^"]+" aria-labelledby="dest-prov-cl"/)
    expect(page).toMatch(/<ul id="[^"]+" role="listbox" aria-labelledby="dest-prov-cl" hidden="" style="max-height:(\d+)px"/)
    const heights = [...page.matchAll(/role="listbox" aria-labelledby="dest-prov-(c|p)l" hidden="" style="max-height:(\d+)px"/g)].map((m) => [m[1], Number(m[2])])
    expect(heights).toEqual([['c', 7 * 40 + 2 * 28 + 16 + 12], ['p', 10 * 40 + 12]]) // + one header note line
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
    expect(m).toContain("disabled={pq.left <= 0 || (!!dc && !isCountry(dc))}")
    expect(src('./pages/hire.tsx')).toContain('disabled={!isCountry(c) || !p}')
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
