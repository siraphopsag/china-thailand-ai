// v2 model (owner, Nov 2026): fixed legal rules on posts, the contract check, the C.A.L.L. case team, arrival confirmed by both
// sides, document scans kept on the device, and the help page with the report pack.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, parseState } from './domain/match/logic'
import { applyCaseAction, arrivalAlert, arrivalPending, newCase, parseCase, type Case } from './domain/match/cases'
import { checkContract, draftFromPost, riskyDraft, termsProblem, MAX_DEDUCT_PCT } from './domain/match/contract'
import { lawRules, precheck } from './domain/match/precheck'
import { minMonthlyWage, wageWarning, TH_DAYS_PER_MONTH } from './domain/match/minwage'
import { AGENCIES, EVIDENCE, PROBLEMS, officeSearch, packText } from './domain/match/reportPack'
import { rowToCase } from './domain/match/remote'
import { contractForAi, contractSystem, contractUser } from './ai/spec'
import { seedState } from './domain/match/seed'
import { TH_MIN_DAILY, CN_MIN_MONTHLY } from './data/minwage'
import { HELPLINES } from './data/helplines'
import { ME, type MatchState } from './domain/match/types'
import { v2 } from './locales/v2'
import { messages } from './locales/index'
import { ContractPage, SAMPLE_POST } from './pages/contract'
import { SosPage } from './pages/sos'
import { CasePage } from './pages/case'
import { LawRulesBox } from './pages/hire'
import { CaseDemoPage, demoCase, DEMO_DEPARTED_DAYS_AGO } from './pages/case-demo'
import { sideItems, MORE_KEYS } from './components/sidenav'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-11-22T08:00:00.000Z')
const iso = (t: number) => new Date(t).toISOString()
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const T = (k: keyof typeof v2, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
function html(node: ReactNode, st: MatchState, search = ''): string {
  const g = globalThis as { document?: unknown; window?: unknown }
  const hadD = 'document' in g, prevD = g.document, hadW = 'window' in g, prevW = g.window
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  if (search) g.window = { location: { search } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (hadD) g.document = prevD; else delete g.document; if (search) { if (hadW) g.window = prevW; else delete g.window } }
}

describe('A. minimum wage and jobs closed to foreigners', () => {
  const bkk = Object.keys(TH_MIN_DAILY)[0], cn = Object.keys(CN_MIN_MONTHLY)[0]
  it('a province floor is the lowest daily rate × 30 in Thailand and the lowest monthly tier in China', () => {
    if (bkk) expect(minMonthlyWage('TH', bkk)?.monthly).toBe(TH_MIN_DAILY[bkk] * TH_DAYS_PER_MONTH)
    if (cn) expect(minMonthlyWage('CN', cn)?.monthly).toBe(CN_MIN_MONTHLY[cn])
    expect(minMonthlyWage('TH', 'TH-XX')).toBeNull()
  })
  it('the official tables: all 77 Thai provinces (337–400 baht a day) and 31 Chinese ones; Heilongjiang changes on 1 Dec 2026', () => {
    expect(Object.keys(TH_MIN_DAILY)).toHaveLength(77); expect(Object.keys(CN_MIN_MONTHLY)).toHaveLength(31)
    expect(Math.min(...Object.values(TH_MIN_DAILY))).toBe(337); expect(Math.max(...Object.values(TH_MIN_DAILY))).toBe(400)
    expect(minMonthlyWage('TH', 'TH-10')?.monthly).toBe(12000) // Bangkok 400 × 30
    expect(minMonthlyWage('TH', 'TH-96')?.monthly).toBe(10110) // Narathiwat 337 × 30
    expect(minMonthlyWage('CN', 'CN-SH')?.monthly).toBe(2740)
    expect(minMonthlyWage('CN', 'CN-HL', '2026-11-30')?.monthly).toBe(1910); expect(minMonthlyWage('CN', 'CN-HL', '2026-12-01')?.monthly).toBe(2050)
  })
  it('below the floor blocks a permanent job, only warns for an internship; another currency is not compared', () => {
    if (!bkk) return
    const floor = minMonthlyWage('TH', bkk)!.monthly
    const base = { place: { country: 'TH' as const, province: bkk }, minYears: 0, position: 'Clerk', details: '' }
    expect(lawRules({ ...base, employment: 'permanent', salary: { min: floor - 1, max: floor, currency: 'THB' } })[0]).toMatchObject({ rule: 'belowMinWage', block: true })
    expect(lawRules({ ...base, employment: 'internship', salary: { min: floor - 1, max: floor, currency: 'THB' } })[0]).toMatchObject({ rule: 'belowMinWage', block: false })
    expect(wageWarning(base.place, { min: 100, max: 100, currency: 'CNY' })).toBeNull()
    expect(wageWarning(base.place, { min: floor, max: floor * 5, currency: 'THB' }, 0)?.warning).toBe('veryHighPay')
    expect(wageWarning(base.place, { min: floor, max: floor * 5, currency: 'THB' }, 3)).toBeNull() // skilled work may pay far more
  })
  it('a job closed to foreigners in Thailand now says why (and still stays inside Thailand)', () => {
    const r = lawRules({ place: { country: 'TH', province: 'TH-83' }, salary: null, minYears: 0, employment: 'permanent', position: 'Tour guide', details: '' })
    expect(r).toEqual([{ rule: 'closedJob', block: false }])
    expect(precheck({ place: { country: 'TH', province: 'TH-83' }, company: 'Sample Co', position: 'Tour guide', industry: 'hospitality', skills: ['hospitality_management'], minYears: 0, details: 'Guide groups of visitors around the island.', headcount: 1, employment: 'permanent', salary: null, startDate: '2026-12-15', languages: [{ lang: 'zh', level: 'professional' }], education: 'none', benefits: [] }, iso(NOW)).laws.map((l) => l.rule)).toContain('closedJob')
  })
  it('the legal-rules box names the floor, the daily rate and the notification', () => {
    const min = minMonthlyWage('TH', 'TH-10')!
    const box = html(<LawRulesBox laws={[{ rule: 'belowMinWage', block: true, min }, { rule: 'closedJob', block: false }]} />, seedState(NOW))
    expect(box).toContain(T('wg.belowMin.block', { min: '12,000', cur: 'THB' })); expect(box).toContain(T('wg.daily', { daily: 400 }))
    expect(box).toContain(esc(min.source)); expect(box).toContain(T('wg.law.closedJob'))
  })
  it('the post check shows the legal rules with or without the AI and a blocking rule hides "Continue"', () => {
    const h = src('./pages/hire.tsx')
    expect(h).toContain('{!orbOn && check.laws.length > 0 && <LawRulesBox laws={check.laws} />}')
    expect(h).toContain('!check.laws.some((l) => l.block)')
  })
})

describe('B. contract check', () => {
  const post = { country: SAMPLE_POST.country, province: SAMPLE_POST.province, salary: SAMPLE_POST.salary }
  it('a draft that copies the post has no findings; the sample with problems fires every rule with Chinese law', () => {
    expect(checkContract(draftFromPost(post), post)).toEqual([])
    const f = checkContract(riskyDraft(post), post)
    expect(f.map((x) => x.flag).sort()).toEqual(['deposit', 'heavyDeductions', 'noWeeklyDayOff', 'passportKept', 'payBelowPost'])
    expect(f.find((x) => x.flag === 'passportKept')?.laws).toEqual(['c2.law.cnLcl9'])
    expect(f.find((x) => x.flag === 'payBelowPost')?.vars).toMatchObject({ pay: 4000, promised: 6000 })
  })
  it('the same problems in Thailand name Thai law', () => {
    const th = { country: 'TH' as const, province: 'TH-10', salary: { min: 20000, max: 25000, currency: 'THB' as const } }
    const f = checkContract({ ...draftFromPost(th), keepsPassport: true, deposit: 1000, daysOff: 0, deductPct: MAX_DEDUCT_PCT + 1 }, th)
    expect(Object.fromEntries(f.map((x) => [x.flag, x.laws[0]]))).toEqual({ passportKept: 'c2.law.thTip', deposit: 'c2.law.thLpa10', noWeeklyDayOff: 'c2.law.thLpa28', heavyDeductions: 'c2.law.thLpa76' })
  })
  it('impossible numbers are refused before checking', () => {
    expect(termsProblem({ ...draftFromPost(post), deductPct: 120 })).toBe('deduct')
    expect(termsProblem({ ...draftFromPost(post), pay: 1.5 })).toBe('pay')
  })
  it('the AI contract check: the draft is cleaned before sending, uses the post-check allowance and the same result shape', () => {
    expect(contractForAi({ country: 'XX', clauses: ['a'] })).toBeNull()
    expect(contractForAi({ country: 'CN', clauses: [] })).toBeNull()
    const c = contractForAi({ country: 'CN', province: 'CN-GD', position: 'QC', postSalary: { min: 6000, max: 6000, currency: 'CNY' }, clauses: ['x'.repeat(900), 3], token: 'secret' })
    expect(c?.clauses).toEqual(['x'.repeat(400)]); expect(JSON.stringify(c)).not.toContain('secret')
    expect(contractSystem('th')).toContain('LEGAL RECORDS'); expect(contractUser(c!)).toMatch(/^<contract>/)
    const api = src('../api/ai.ts')
    expect(api).toContain("take(token, kind === 'contract' ? 'check' : kind === 'translate' ? 'ask' : kind)")
    expect(api).toContain("const result = kind === 'ask' ? cleanAnswer(out.raw) : kind === 'translate' ? cleanTranslation(out.raw) : cleanCheck(out.raw)")
    expect(src('./pages/contract.tsx')).toContain("canAi = status === 'signedIn' && online !== false")
  })
  it('the page shows the sample, the Thai–Chinese draft and is reachable from the case', () => {
    const page = html(<ContractPage />, { ...seedState(NOW), role: 'seeker' })
    expect(page).toContain(T('c2.title')); expect(page).toContain(T('c2.risky')); expect(page).toContain('lang="zh-CN"')
    expect(src('./App.tsx')).toContain('contract: <ContractPage />')
    expect(src("./pages/case.tsx")).toContain("to={contractTo ?? `contract?case=${c.id}`}")
  })
})

describe('C. case team and arrival confirmed by both sides', () => {
  const departed = (): Case => {
    const c = newCase('c1', { id: 'a1', postId: 'p1', seekerId: ME }, iso(NOW - 30 * DAY_MS), true)
    const steps = { ...c.steps, accepted: iso(NOW - 29 * DAY_MS), documents: iso(NOW - 20 * DAY_MS), tests: iso(NOW - 15 * DAY_MS), training: iso(NOW - 10 * DAY_MS), permit: iso(NOW - 8 * DAY_MS), departure: iso(NOW - 5 * DAY_MS) }
    return { ...c, steps, departureDate: '2026-11-17' }
  }
  it('the worker confirms once after the departure; the employer still closes the 9th step', () => {
    const c = departed()
    expect(arrivalPending(c)).toBe('both')
    const a = applyCaseAction(c, { kind: 'seekerArrived' }, iso(NOW), '2026-11-22')
    expect(a.ok && a.value.seekerArrived).toBe(iso(NOW))
    if (!a.ok) return
    expect(applyCaseAction(a.value, { kind: 'seekerArrived' }, iso(NOW), '2026-11-22').ok).toBe(false)
    expect(arrivalPending(a.value)).toBe('employer')
    const b = applyCaseAction(a.value, { kind: 'arrived' }, iso(NOW), '2026-11-22')
    expect(b.ok && arrivalPending(b.value)).toBe(null)
    expect(applyCaseAction(newCase('c2', { id: 'a2', postId: 'p1', seekerId: ME }, iso(NOW), true), { kind: 'seekerArrived' }, iso(NOW), '2026-11-22').ok).toBe(false)
  })
  it('the alert starts more than 2 days after the departure day', () => {
    const c = departed()
    expect(arrivalAlert(c, '2026-11-19')).toBeNull()
    expect(arrivalAlert(c, '2026-11-20')).toBe('both')
  })
  it('stored and database cases keep the worker\'s confirmation only after the departure', () => {
    const c = { ...departed(), seekerArrived: iso(NOW) }
    expect(parseCase(JSON.parse(JSON.stringify(c)))?.seekerArrived).toBe(iso(NOW))
    expect(parseCase({ ...newCase('c3', { id: 'a3', postId: 'p1', seekerId: ME }, iso(NOW), true), seekerArrived: iso(NOW) })).toBeNull()
    const row = { id: 'c1', acceptance_id: 'a1', post_id: 'p1', seeker_id: 'u1', steps: c.steps, docs: {}, tests: {}, permit: {}, trainings: [], departure_date: c.departureDate, note: null, created_at: c.createdAt, seeker_arrived_at: iso(NOW) }
    expect(rowToCase(row, 'u1').seekerArrived).toBe(iso(NOW))
    const seed = seedState(NOW), s1 = seed.cases[0]
    const done = { ...s1, steps: { ...s1.steps, training: iso(NOW - 3 * DAY_MS), permit: iso(NOW - 2 * DAY_MS), departure: iso(NOW - DAY_MS) }, seekerArrived: iso(NOW) }
    expect(parseState(JSON.parse(JSON.stringify({ ...seed, cases: [done] })))?.cases[0]?.seekerArrived).toBe(iso(NOW))
  })
  it('SQL 0013 lets only the case\'s own worker confirm, once, after the departure', () => {
    const s = src('../supabase/migrations/0013_arrival_both_sides.sql')
    expect(s).toContain('alter table public.cases add column if not exists seeker_arrived_at timestamptz;')
    expect(s).toContain("if c.seeker_id is distinct from auth.uid() then raise exception 'not_allowed'")
    expect(s).toContain("if c.steps ->> 'departure' is null or c.seeker_arrived_at is not null then raise exception 'bad_state'")
    expect(src('./matchData.tsx')).toContain("sb.rpc('case_seeker_arrived', { p_id: caseId })")
  })
  it('the case texts speak of the C.A.L.L. case team, not an employment agency', () => {
    for (const k of ['m.cs.s.submitted', 'm.cs.legal', 'm.cs.ag.title', 'm.st.forwarded', 'm.how.4'] as const) {
      expect(tr(k, undefined, 'en')).toContain('C.A.L.L.')
      expect(tr(k, undefined, 'en')).not.toMatch(/employment agency/i)
    }
    const page = html(<CasePage />, { ...seedState(NOW), role: 'seeker' }, '?id=case-s1')
    expect(page).toContain(T('att.h')) // the worker can attach scans while the case runs
  })
})

describe('D. help page and report pack', () => {
  it('every problem has evidence and an agency in both countries; office searches use Amap in China', () => {
    for (const p of PROBLEMS) { expect(EVIDENCE[p].length).toBeGreaterThan(1); expect(AGENCIES[p].TH.length).toBeGreaterThan(0); expect(AGENCIES[p].CN.length).toBeGreaterThan(0) }
    expect(officeSearch('CN', 'Guangdong', 'Labour inspection')).toMatch(/^https:\/\/uri\.amap\.com\/search\?keyword=/)
    expect(officeSearch('TH', 'Bangkok', 'Labour office')).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//)
  })
  it('the pack text lists the problem, the ticked evidence and the agencies, and says it was not sent', () => {
    const t = (k: string, v?: Record<string, string | number>) => tr(k as never, v, 'en')
    const text = packText({ problem: 'passport', country: 'TH', province: 'TH-10', note: 'Kept by the supervisor', evidence: ['passportCopy'], when: '22 Nov 2026' }, t, 'Bangkok')
    expect(text).toContain('[x] ' + t('rp.ev.passportCopy')); expect(text).toContain('[ ] ' + t('rp.ev.witness'))
    expect(text).toContain(t('rp.ag.thPolice')); expect(text).toContain('Kept by the supervisor'); expect(text).toContain(t('rp.pack.foot'))
  })
  it('hotlines are tel: links; no quick exit for now (owner, 23 Nov 2026: it looked like the site crashing); the floating button shows for job seekers only', () => {
    for (const c of ['TH', 'CN'] as const) for (const l of HELPLINES[c]) { expect(l.tel).toMatch(/^\+?[0-9-]+$/); expect(l.key in messages).toBe(true) }
    const page = html(<SosPage />, { ...seedState(NOW), role: 'seeker' })
    expect(page).not.toContain(T('hp.exit')); expect(page).toContain(T('rp.h'))
    expect(src('./App.tsx')).toContain("{st.role === 'seeker' && route !== 'sos' && <SosButton />}")
    expect(src('./pages/sos.tsx')).not.toContain('location.replace(')
  })
})

describe('E. texts', () => {
  it('every v2 message has Thai, Chinese and English, in the right scripts, and no key clashes with another file', () => {
    const others = Object.keys(messages).length
    for (const [k, [th, zh, en]] of Object.entries(v2)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as keyof typeof messages], k).toEqual([th, zh, en])
    }
    expect(others).toBeGreaterThan(Object.keys(v2).length)
  })
})

describe('F. the new systems are easy to find (owner, Nov 2026)', () => {
  it('the menu lists the contract check and the help page for every role; on phones they sit under More', () => {
    for (const r of [null, 'seeker', 'employer'] as const) {
      const items = sideItems(r, false)
      expect(items.find((i) => i.key === 'm.nav.contract')?.to).toBe('contract')
      expect(items.find((i) => i.key === 'm.nav.sos')?.to).toBe('sos')
    }
    expect(MORE_KEYS).toContain('m.nav.contract'); expect(MORE_KEYS).toContain('m.nav.sos')
  })
  it('the demo case route is registered', () => {
    expect(src('./App.tsx')).toContain("'case-demo': <CaseDemoPage />")
  })
  it('the demo case has left 3 days ago, nobody has confirmed, so the alert shows; both confirmations clear it', () => {
    const c = demoCase(NOW), today = new Date(NOW).toISOString().slice(0, 10)
    expect(DEMO_DEPARTED_DAYS_AGO).toBeGreaterThan(2)
    expect(arrivalPending(c)).toBe('both'); expect(arrivalAlert(c, today)).toBe('both')
    const at = new Date(NOW).toISOString()
    const a = applyCaseAction(c, { kind: 'seekerArrived' }, at, today); expect(a.ok).toBe(true)
    const b = a.ok ? applyCaseAction(a.value, { kind: 'arrived' }, at, today) : a; expect(b.ok).toBe(true)
    if (b.ok) { expect(arrivalPending(b.value)).toBeNull(); expect(arrivalAlert(b.value, today)).toBeNull() }
    expect(parseCase(c)).not.toBeNull()
  })
  it('the demo page needs no account: the note, the side switcher, the arrival box and the attachments', () => {
    const page = html(<CaseDemoPage />, seedState(NOW))
    for (const k of ['dm.title', 'dm.note', 'dm.as.seeker', 'dm.as.employer', 'dm.reset', 'ar.h', 'ar.seeker.yes', 'att.h', 'ar.alert.h'] as const) expect(page, k).toContain(T(k))
  })
})
