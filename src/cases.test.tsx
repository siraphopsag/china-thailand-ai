// The middle office (owner, Oct 2026): the nine-step case after a match, employer verification (Thai juristic number / Chinese
// unified social credit code), the level cap for unverified employers, and the terms of use. Static rendering only.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { DAY_MS, cancel, caseBlocksDelete, decide, inbox, openCaseFor, parseState, poolOf, requestVerify, withoutExpired } from './domain/match/logic'
import { CASE_STEPS, applyCaseAction, currentStep, newCase, stepsDone, submitCase, trainingsLeft, type Case, type CaseAction } from './domain/match/cases'
import { cleanRegNo, isChinaCreditCode, isRegNo, isThaiJuristicNo, withChinaCheck, withThaiCheck } from './domain/match/verify'
import { capStage, reachFor, scheduleOf } from './domain/match/release'
import { dbProblem, rowToCase } from './domain/match/remote'
import { seedState } from './domain/match/seed'
import { ME, MY_EMPLOYER, type MatchState } from './domain/match/types'
import { match } from './locales/match'
import { cases as caseMsgs } from './locales/cases'
import { CasePage } from './pages/case'
import { TermsPage } from './pages/terms'
import { MePage, NotificationsPage } from './pages/match'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-10-03T08:00:00.000Z')
const at = (days: number) => new Date(NOW + days * DAY_MS).toISOString()
const TODAY = at(0).slice(0, 10)
function html(node: ReactNode, st: MatchState, search = ''): string {
  const g = globalThis as { document?: unknown; window?: unknown }
  const hadD = 'document' in g, prevD = g.document, hadW = 'window' in g, prevW = g.window
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  if (search) g.window = { location: { search } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (hadD) g.document = prevD; else delete g.document; if (search) { if (hadW) g.window = prevW; else delete g.window } }
}
const T = (k: keyof typeof caseMsgs, v?: Record<string, string | number>) => tr(k, v, 'th').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

describe('company registration numbers', () => {
  it('Thai juristic person number: 13 digits with a check digit', () => {
    const ok = withThaiCheck('010555612345')
    expect(isThaiJuristicNo(ok)).toBe(true)
    expect(isThaiJuristicNo(ok.slice(0, 12) + String((Number(ok[12]) + 1) % 10))).toBe(false) // wrong check digit
    expect(isThaiJuristicNo(ok.slice(0, 12))).toBe(false)
    expect(isThaiJuristicNo(ok.replace('1', 'A'))).toBe(false)
    expect(isRegNo('TH', cleanRegNo(`${ok.slice(0, 1)}-${ok.slice(1, 5)}-${ok.slice(5)} `))).toBe(true) // dashes and spaces are ignored
  })
  it('Chinese unified social credit code: 18 characters (no I, O, Z, S, V) with a check character', () => {
    const ok = withChinaCheck('91310000MA1FL0000')
    expect(ok).toHaveLength(18)
    expect(isChinaCreditCode(ok)).toBe(true)
    expect(isRegNo('CN', cleanRegNo(ok.toLowerCase()))).toBe(true)
    const wrong = ok.slice(0, 17) + (ok[17] === '0' ? '1' : '0')
    expect(isChinaCreditCode(wrong)).toBe(false)
    expect(isChinaCreditCode(withChinaCheck('91310000MA1FL000I').replace(/.$/, '0'))).toBe(false) // I is not used
    expect(isRegNo('TH', ok)).toBe(false); expect(isRegNo('CN', withThaiCheck('010555612345'))).toBe(false)
  })
  it('a request is checked at once and waits for the agency', () => {
    const r = requestVerify('TH', withThaiCheck('010555612345'), at(0))
    expect(r.ok && r.value.status).toBe('pending')
    const bad = requestVerify('TH', '0105556123450', at(0)); expect(bad.ok ? 'ok' : bad.problem).toBe(isThaiJuristicNo('0105556123450') ? 'ok' : 'regNo')
    const cn = requestVerify('CN', '123', at(0)); expect(cn.ok ? 'ok' : cn.problem).toBe('regNo')
  })
})

describe('the nine steps of a case', () => {
  const acc = { id: 'a1', postId: 'p1', seekerId: ME }
  const step = (c: Case, a: CaseAction, day = 0) => { const r = applyCaseAction(c, a, at(day), TODAY); if (!r.ok) throw new Error(`${a.kind}: ${r.problem}`); return r.value }
  const problem = (c: Case, a: CaseAction) => { const r = applyCaseAction(c, a, at(0), TODAY); return r.ok ? 'ok' : r.problem }
  it('a verified employer hands the case over at once; an unverified one waits', () => {
    expect(newCase('c', acc, at(0), true).steps).toEqual({ opened: at(0), submitted: at(0) })
    const waiting = newCase('c', acc, at(0), false)
    expect(currentStep(waiting)).toBe('submitted')
    expect(problem(waiting, { kind: 'accept' })).toBe('state') // the agency cannot take it yet
    expect(currentStep(submitCase(waiting, at(1)))).toBe('accepted')
  })
  it('runs in order to the arrival; checklists complete their step by themselves', () => {
    let c = newCase('c', acc, at(0), true)
    expect(problem(c, { kind: 'doc', key: 'passport' })).toBe('state') // not before the agency accepts
    c = step(c, { kind: 'accept' })
    c = step(c, { kind: 'doc', key: 'passport' }); c = step(c, { kind: 'doc', key: 'health' })
    expect(currentStep(c)).toBe('documents')
    c = step(c, { kind: 'doc', key: 'contract' }, 1)
    expect(c.steps.documents).toBe(at(1))
    expect(problem(c, { kind: 'doc', key: 'passport' })).toBe('state') // a finished step cannot be changed
    c = step(c, { kind: 'test', key: 'language' }); c = step(c, { kind: 'test', key: 'skill' })
    expect(currentStep(c)).toBe('training')
    expect([c.trainings.map((x) => x.name), trainingsLeft(c)]).toEqual([['@orient', '@lang', '@law', '@safety'], 4])
    c = step(c, { kind: 'trainAdd', name: 'Forklift licence' })
    expect(problem(c, { kind: 'trainAdd', name: 'call 0812345678' })).toBe('contact')
    expect(problem(c, { kind: 'trainAdd', name: 'x' })).toBe('name')
    c = step(c, { kind: 'trainRemove', id: 'law' })
    for (const x of c.trainings.slice(0, -1)) c = step(c, { kind: 'train', id: x.id })
    expect([trainingsLeft(c), currentStep(c)]).toEqual([1, 'training'])
    c = step(c, { kind: 'train', id: c.trainings[c.trainings.length - 1].id })
    expect(currentStep(c)).toBe('permit')
    expect(problem(c, { kind: 'trainAdd', name: 'Late course' })).toBe('state') // the course list is closed once training is done
    c = step(c, { kind: 'permit', key: 'workPermit' }); c = step(c, { kind: 'permit', key: 'visa' })
    expect(problem(c, { kind: 'departOk' })).toBe('state') // a day first
    expect(problem(c, { kind: 'departure', date: at(-1).slice(0, 10) })).toBe('available') // not in the past
    c = step(c, { kind: 'departure', date: at(14).slice(0, 10) })
    c = step(c, { kind: 'departOk' })
    expect(currentStep(c)).toBe('arrived')
    c = step(c, { kind: 'note', text: 'Welcome on board' })
    expect(problem(c, { kind: 'note', text: 'mail hr@example.com' })).toBe('contact')
    c = step(c, { kind: 'arrived' })
    expect([currentStep(c), stepsDone(c), Object.keys(c.steps)]).toEqual([null, 9, [...CASE_STEPS]])
  })
  it('at least one course stays; removing the last open course finishes the training', () => {
    let c = newCase('c', acc, at(0), true)
    c = { ...c, trainings: [{ id: 'one', name: '@orient', done: false }] }
    expect(problem(c, { kind: 'trainRemove', id: 'one' })).toBe('state')
    c = { ...c, steps: { ...c.steps, accepted: at(0), documents: at(0), tests: at(0) }, trainings: [{ id: 'a', name: '@orient', done: true }, { id: 'b', name: '@lang', done: false }] }
    expect(currentStep(step(c, { kind: 'trainRemove', id: 'b' }))).toBe('permit')
  })
})

describe('cases in the app state', () => {
  const mine = (verified: boolean): MatchState => {
    const st = seedState(NOW)
    st.role = 'employer'
    st.employerVerify = verified ? { country: 'TH', regNo: withThaiCheck('010555612345'), status: 'verified', at: at(-1) } : null
    st.posts = st.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER, verified } : p))
    return st
  }
  it('confirming opens a case: handed over (forwarded) when I am verified, waiting otherwise', () => {
    for (const verified of [true, false]) {
      const st = mine(verified)
      const d = decide(st, 'acc-s1', true, at(0)); if (!d.ok) throw new Error('decide')
      const o = openCaseFor(st, d.value, 'acc-s1', 'case-new', at(0))
      const c = o.cases.find((x) => x.id === 'case-new')!
      expect([o.acceptances.find((a) => a.id === 'acc-s1')!.status, !!c.steps.submitted]).toEqual(verified ? ['forwarded', true] : ['confirmed', false])
      expect(openCaseFor({ ...st, cases: o.cases }, o.acceptances, 'acc-s1', 'again', at(0)).cases).toHaveLength(o.cases.length) // only one case per application
    }
  })
  it('the worker cannot withdraw and the employer cannot delete the post once the agency has the case', () => {
    const st = seedState(NOW)
    const r = cancel(st, 'acc-me', at(0)); expect(r.ok ? 'ok' : r.problem).toBe('caseStarted')
    expect(caseBlocksDelete(st, 'post-s3')).toBe(true)
    expect(caseBlocksDelete(st, 'post-s1')).toBe(false)
    // a running case keeps its post past the six months
    const later = Date.parse(st.posts.find((p) => p.id === 'post-s3')!.releasedAt) + 200 * DAY_MS
    expect(withoutExpired(st, later).posts.map((p) => p.id)).toContain('post-s3')
  })
  it('unverified employers stop at level 2, and seekers further away are not promised a time', () => {
    const st = seedState(NOW)
    const p = { ...st.posts.find((x) => x.id === 'post-s2')!, verified: false }
    expect([capStage(4, p), capStage(4, { verified: true }), capStage(1, p), capStage('expired', p)]).toEqual([2, 4, 1, 'expired'])
    const pool = poolOf(st), s = scheduleOf(p, pool, NOW)
    const far = { id: 'far', country: 'TH' as const, province: 'TH-10', industry: 'hospitality' as const, skills: ['hospitality_management' as const], at: at(0) }
    const r = reachFor(p, [far], pool, s.end4 + 1)
    expect([r.visible, r.opensAt]).toEqual([false, null])
    expect(reachFor({ ...p, verified: true }, [far], pool, s.end4 + 1).visible).toBe(true)
  })
  it('news: a step within three days rings the bell; an employer is reminded to confirm the arrival', () => {
    const st = seedState(NOW); st.role = 'seeker'
    expect(inbox(st, poolOf(st), NOW, () => 0)).toMatchObject({ count: 0 }) // the sample case moved 12 days ago
    const fresh = { ...st, cases: st.cases.map((c) => ({ ...c, steps: { ...c.steps, tests: at(-1) } })) }
    expect(inbox(fresh, poolOf(fresh), NOW, () => 0).caseNews).toHaveLength(1)
    const emp = seedState(NOW); emp.role = 'employer'
    emp.posts = emp.posts.map((p) => (p.id === 'post-s3' ? { ...p, employerId: MY_EMPLOYER } : p))
    const done = (c: Case) => ({ ...c, steps: Object.fromEntries(CASE_STEPS.slice(0, 8).map((s) => [s, at(-30)])) })
    emp.cases = emp.cases.map(done)
    expect(inbox(emp, poolOf(emp), NOW, () => 0).caseNews.map((c) => c.id)).toEqual(['case-s1'])
  })
  it('stored cases are checked: a gap in the steps or a contact in the note drops only that case', () => {
    const st = seedState(NOW)
    const keep = parseState(JSON.parse(JSON.stringify(st)))!
    expect([keep.cases.map((c) => c.id), keep.employerVerify]).toEqual([['case-s1'], null])
    const bad = (f: (s: MatchState) => void) => { const s = JSON.parse(JSON.stringify(st)) as MatchState; f(s); return parseState(s)! }
    expect(bad((s) => { delete s.cases[0].steps.accepted }).cases).toEqual([])
    expect(bad((s) => { s.cases[0].note = 'line id: abc, mail x@y.com' }).cases).toEqual([])
    expect(bad((s) => { s.cases[0].trainings = [] }).cases).toEqual([])
    expect(bad((s) => { (s as unknown as Record<string, unknown>).employerVerify = { country: 'TH', regNo: '1', status: 'verified', at: at(0) } }).employerVerify).toBeNull()
    expect(bad((s) => { s.employerVerify = { country: 'TH', regNo: withThaiCheck('010555612345'), status: 'pending', at: at(0) } }).employerVerify?.status).toBe('pending')
  })
  it('database rows and errors', () => {
    const c = rowToCase({ id: 'x', acceptance_id: 'a', post_id: 'p', seeker_id: 'u1', steps: { opened: at(0), submitted: at(0), junk: 'x' }, docs: { passport: true, other: true }, tests: {}, permit: null,
      trainings: [{ id: 'orient', name: '@orient', done: false }, { bad: 1 }], departure_date: null, note: null, created_at: at(0) }, 'u1')
    expect([c.seekerId, Object.keys(c.steps), c.docs, c.trainings.length, c.note]).toEqual([ME, ['opened', 'submitted'], { passport: true }, 1, ''])
    expect([dbProblem({ message: 'bad_reg_no' }), dbProblem({ message: 'case_started' }), dbProblem({ message: 'bad_state' })]).toEqual(['regNo', 'caseStarted', 'state'])
  })
})

describe('pages', () => {
  it('the case page: nine steps, what is left, the agency part labelled as a demo, and who really handles it', () => {
    const st = seedState(NOW); st.role = 'seeker'
    const h = html(<CasePage />, st, '?id=case-s1')
    for (const s of CASE_STEPS) expect(h).toContain(T(`m.cs.s.${s}` as keyof typeof caseMsgs))
    expect(h).toContain(T('m.cs.progress', { n: 5 }))
    expect(h).toContain(T('m.cs.left', { n: 2, t: 4 }))
    expect(h).toContain(T('m.cs.ag.demo'))
    expect(h).toContain(T('m.cs.legal.h')) // "who really handles it" is one of the case tabs
    expect(src('./pages/case.tsx')).toContain("{tab === 'legal' && (<>")
    expect(h).toContain(T('m.cs.noFee'))
    expect(h).toContain('aria-current="step"')
    expect(html(<CasePage />, st, '?id=nope')).toContain(T('m.cs.notFound'))
  })
  it('notifications list the case; the profile of an employer asks for verification', () => {
    const st = seedState(NOW); st.role = 'seeker'
    expect(html(<NotificationsPage />, st)).toContain('href="/case?id=case-s1"')
    const emp = seedState(NOW); emp.role = 'employer'
    const me = html(<MePage />, emp)
    expect(me).toContain(T('m.vf.title')); expect(me).toContain(T('m.vf.hint.TH'))
    emp.employerVerify = { country: 'CN', regNo: withChinaCheck('91310000MA1FL0000'), status: 'pending', at: at(0) }
    expect(html(<MePage />, emp)).toContain(T('m.vf.demoApprove')) // local demo: you can play the agency
  })
  it('terms of use: an information and matching board; licensed agencies send workers; no fees from workers', () => {
    const h = html(<TermsPage />, seedState(NOW))
    for (const k of ['m.tm.key', 'm.tm.2.t', 'm.tm.3.t'] as const) expect(h).toContain(T(k))
    expect(tr('m.tm.2.t', undefined, 'th')).toContain('พ.ศ. 2528')
    expect(tr('m.tm.3.t', undefined, 'th')).toContain('1694')
    const app = src('./App.tsx')
    expect(app).toContain('case: <CasePage />'); expect(app).toContain('terms: <TermsPage />'); expect(app).toContain('<NavLink to="terms"')
    expect(src('./pages/auth.tsx')).toContain('<NavLink to="terms"')
  })
  it('every new message has Thai, Chinese and English, and none repeats a key from match.ts', () => {
    for (const [k, v] of Object.entries(caseMsgs)) { expect(v.length, k).toBe(3); expect(v.every((x) => x.trim().length > 0), k).toBe(true) }
    expect(Object.keys(caseMsgs).filter((k) => k in match)).toEqual([])
    expect(src('./pages/case.tsx')).not.toMatch(/forwardCase|forward_case/)
  })
  it('the database file holds the case steps, the verification and the protections', () => {
    const sql = src('../supabase/migrations/0004_cases.sql')
    for (const s of ['create or replace function public.case_action', 'create or replace function public.verify_employer', "raise exception 'case_started'", "raise exception 'bad_reg_no'", 'enable row level security'])
      expect(sql, s).toContain(s)
  })
})
