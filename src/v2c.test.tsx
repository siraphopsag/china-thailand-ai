// v2 model, part 3 (owner, Nov 2026): the end system — check-ins on day 1/7/30 with a secret help word, the anonymous employer
// review, and complaints that C.A.L.L. checks before passing them on (urgent ones at once).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import {
  CHECKIN_DAYS, CHECKIN_GRACE, actComplaint, canReview, checkinFlags, checkinStates, credLevel, credibility, dueDay, fileComplaint, hasSecret, reviewProblem, reviewSummary, teamAlerts,
  type CheckIn,
} from './domain/match/aftercare'
import { seedState } from './domain/match/seed'
import type { MatchState } from './domain/match/types'
import { v2c } from './locales/v2c'
import { messages } from './locales/index'
import { AftercarePanel } from './pages/aftercare'
import { demoCase } from './pages/case-demo'
import { SosPage } from './pages/sos'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-11-22T08:00:00.000Z')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const T = (k: keyof typeof v2c, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
function html(node: ReactNode, st: MatchState = seedState(NOW)): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
const ci = (day: 1 | 7 | 30, p: Partial<CheckIn> = {}): CheckIn => ({ day, at: '2026-11-22T09:00:00.000Z', paid: 'yes', passport: 'me', hours: 'ok', safe: 'yes', note: '', ...p })

describe('A. check-ins', () => {
  const arr = '2026-11-22'
  it('day 1 is the arrival day; each check-in is open for its day plus the grace, then missed', () => {
    expect(dueDay(arr, 1)).toBe(arr); expect(dueDay(arr, 7)).toBe('2026-11-28'); expect(dueDay(arr, 30)).toBe('2026-12-21')
    expect(CHECKIN_GRACE).toBe(2)
    expect(CHECKIN_DAYS).toEqual([1, 3, 7, 15, 30]) // owner’s blueprint, 27 Nov 2026: 24 h, 3, 7, 15, 30 days
    expect([dueDay(arr, 3), dueDay(arr, 15)]).toEqual(['2026-11-24', '2026-12-06'])
    // review, 27 Nov 2026: a worker who arrived before the five check-ins began keeps the three (no false "missed" alerts)
    expect(checkinStates(arr, [], arr).map((s) => s.state)).toEqual(['open', 'upcoming', 'upcoming'])
    expect(checkinStates(arr, [ci(1)], '2026-12-01').map((s) => s.state)).toEqual(['done', 'missed', 'upcoming'])
    const arr2 = '2026-11-28'
    expect(checkinStates(arr2, [], arr2).map((s) => s.state)).toEqual(['open', 'upcoming', 'upcoming', 'upcoming', 'upcoming'])
    expect(checkinStates(arr2, [ci(1)], '2026-12-07').map((s) => s.state)).toEqual(['done', 'missed', 'missed', 'upcoming', 'upcoming'])
    expect(checkinStates(arr2, [ci(1)], '2026-12-06').map((s) => s.state)).toEqual(['done', 'missed', 'open', 'upcoming', 'upcoming'])
  })
  it('answers that need the team: unpaid (not yet is fine on day 1), passport, hours, unsafe and the secret word', () => {
    expect(checkinFlags(ci(1, { paid: 'notYet' }))).toEqual([])
    expect(checkinFlags(ci(30, { paid: 'notYet' }))).toEqual(['unpaid'])
    expect(checkinFlags(ci(7, { paid: 'no', passport: 'employer', hours: 'over', safe: 'no', silent: true }))).toEqual(['unpaid', 'passport', 'hours', 'unsafe', 'silent'])
    expect(hasSecret('work is fine, I miss MANGO', 'mango')).toBe(true)
    expect(hasSecret('anything', 'ab')).toBe(false); expect(hasSecret('anything', undefined)).toBe(false)
  })
  it('team alerts put the secret word and "unsafe" first, then missed check-ins', () => {
    const a = teamAlerts(arr, [ci(1, { paid: 'no' }), ci(30, { safe: 'no', silent: true })], '2026-12-21')
    expect(a.map((x) => (x.kind === 'flag' ? x.flag : `missed-${x.day}`))).toEqual(['silent', 'unsafe', 'unpaid', 'missed-7'])
    const b = teamAlerts('2026-11-28', [ci(1, { paid: 'no' }), ci(30, { safe: 'no', silent: true })], '2026-12-27')
    expect(b.map((x) => (x.kind === 'flag' ? x.flag : `missed-${x.day}`))).toEqual(['silent', 'unsafe', 'unpaid', 'missed-3', 'missed-7', 'missed-15'])
  })
})

describe('B. employer review', () => {
  it('opens after the day-30 check-in; stars 1–5 and fixed points only; the total is anonymous', () => {
    expect(canReview([ci(1), ci(7)])).toBe(false); expect(canReview([ci(30)])).toBe(true)
    expect(reviewProblem({ stars: 0, good: [], bad: [] })).toBe('stars')
    expect(reviewProblem({ stars: 4, good: ['paidOnTime'], bad: ['free text'] })).toBe('points')
    const s = reviewSummary([{ employerId: 'e', at: 'x', stars: 2, good: [], bad: ['latePay'] }, { employerId: 'e', at: 'y', stars: 5, good: ['respect'], bad: ['latePay'] }])
    expect(s).toEqual({ n: 2, avg: 3.5, good: ['respect'], bad: ['latePay'] })
    expect(JSON.stringify(s)).not.toContain('"at"')
    expect(reviewSummary([])).toBeNull()
  })
})

describe('C. complaints through C.A.L.L.', () => {
  const base = { id: 'c1', caseId: 'k', country: 'CN' as const, province: 'CN-GD', note: '', at: '2026-11-22T09:00:00.000Z' }
  it('credibility adds up evidence, detail, the case record, arrival and a matching check-in answer', () => {
    expect(credibility({ problem: 'unpaid', evidence: [], note: '', hasCase: false, arrived: false, flags: [] })).toEqual({ score: 0, reasons: [] })
    const full = credibility({ problem: 'unpaid', evidence: ['contract', 'payslips', 'bank', 'hours'], note: 'x'.repeat(40), hasCase: true, arrived: true, flags: ['unpaid'] })
    expect(full).toEqual({ score: 100, reasons: ['evidence', 'detail', 'case', 'arrived', 'checkin'] })
    expect([credLevel(75), credLevel(40), credLevel(10)]).toEqual(['strong', 'medium', 'weak'])
  })
  it('an ordinary complaint is checked first: ask for more, the worker adds evidence, then it is passed on and taken', () => {
    let c = fileComplaint({ ...base, problem: 'fee', evidence: [], hasCase: false, arrived: false, flags: [] })
    expect(c).toMatchObject({ status: 'checking', urgent: false, score: 0, agency: 'cnPolice' })
    c = actComplaint(c, { kind: 'askMore' }, 't1')!; expect(c.status).toBe('needMore')
    expect(actComplaint(c, { kind: 'forward' }, 't2')).toBeNull()
    c = actComplaint(c, { kind: 'addEvidence', evidence: ['receipts', 'messages'], note: 'Paid a fee to an agent', flags: [], hasCase: true, arrived: true }, 't3')!
    expect(c).toMatchObject({ status: 'checking', score: 55 })
    c = actComplaint(c, { kind: 'forward' }, 't4')!; c = actComplaint(c, { kind: 'acknowledge' }, 't5')!
    expect(c.history.map((h) => h.status)).toEqual(['checking', 'needMore', 'checking', 'forwarded', 'acknowledged'])
  })
  it('life or freedom at risk, an "unsafe" answer or the secret word: passed on at once without the check', () => {
    expect(fileComplaint({ ...base, problem: 'forced', evidence: [], hasCase: false, arrived: false, flags: [] })).toMatchObject({ urgent: true, status: 'forwarded' })
    expect(fileComplaint({ ...base, problem: 'unpaid', evidence: [], hasCase: true, arrived: true, flags: ['silent'] })).toMatchObject({ urgent: true, status: 'forwarded' })
  })
})

describe('D. pages', () => {
  const arrived = { ...demoCase(NOW), seekerArrived: '2026-11-22T08:00:00.000Z' }
  it('the worker sees the timeline, the open check-in and the secret word; the employer sees none of it', () => {
    const w = html(<AftercarePanel c={arrived} caseKey="t-1" employerId="e" country="CN" province="CN-GD" today="2026-11-22" view="seeker" team={false} atNow="2026-11-22T09:00:00.000Z" />)
    for (const k of ['ac.h', 'ac.day.1', 'ac.q.paid', 'ac.q.safe', 'ac.secret.h', 'cr.h'] as const) expect(w, k).toContain(T(k))
    expect(w).not.toContain(T('ac.team.h'))
    const e = html(<AftercarePanel c={arrived} caseKey="t-1" employerId="e" country="CN" province="CN-GD" today="2026-11-22" view="employer" team={false} atNow="2026-11-22T09:00:00.000Z" />)
    expect(e).toContain(T('ac.employer.note'))
    for (const k of ['ac.q.paid', 'ac.secret.h', 'ac.day.7', 'ac.st.missed'] as const) expect(e, k).not.toContain(T(k))
  })
  it('nothing shows before arrival; the help page offers both paths; the demo has day buttons', () => {
    expect(html(<AftercarePanel c={demoCase(NOW)} caseKey="t-2" employerId="e" country="CN" province="CN-GD" today="2026-11-22" view="seeker" team atNow="x" />)).toBe('')
    expect(src('./pages/sos.tsx')).toContain("t('cr.path.self')"); expect(src('./pages/sos.tsx')).toContain("t('cr.path.call')")
    expect(html(<SosPage />)).toContain(T('rp.h' as never) || '')
    expect(src('./pages/case-demo.tsx')).toContain("([null, 3, 7, 10, 15, 30] as const)")
    expect(src('./pages/post.tsx')).toContain('<EmployerRating employerId={p.employerId} compact />')
  })
  it('every new text has Thai, Chinese and English in the right scripts and no key clashes', () => {
    for (const [k, [th, zh, en]] of Object.entries(v2c)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(th, k).not.toMatch(/[一-鿿]/); expect(en, k).not.toMatch(/[฀-๿一-鿿]/)
      expect(messages[k as keyof typeof messages]).toEqual([th, zh, en])
    }
  })
})
