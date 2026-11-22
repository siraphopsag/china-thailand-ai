// v2 model, part 2 (owner, Nov 2026): the full journey in the lobby and the whole middle system — passport lines checked against
// the record, the partner law firm's review, and signing on screen (bound to a fingerprint of the text) or on paper.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { checkDigit, identityCheck, makeMrz, parseMrz, MIN_WORK_AGE, type IdRecord } from './domain/match/mrz'
import { addSignature, reviewNotes, sha256, shortHash, signBlock, signStatus } from './domain/match/sign'
import { seedState } from './domain/match/seed'
import type { MatchState } from './domain/match/types'
import { v2b } from './locales/v2b'
import { messages } from './locales/index'
import { JOURNEY, Journey, Landing } from './pages/home'
import { ContractPage } from './pages/contract'
import { SAMPLE_MRZ, SAMPLE_RECORD, badSampleMrz } from './pages/contract-steps'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const NOW = Date.parse('2026-11-22T08:00:00.000Z')
const TODAY = '2026-11-22'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const T = (k: keyof typeof v2b, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
function html(node: ReactNode, st: MatchState = seedState(NOW)): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
const ICAO = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10'

describe('A. passport lines (ICAO 9303)', () => {
  it('check digits follow the 7-3-1 rule; the ICAO specimen reads cleanly', () => {
    expect(checkDigit('L898902C3')).toBe(6); expect(checkDigit('740812')).toBe(2); expect(checkDigit('120415')).toBe(9)
    const r = parseMrz(ICAO, TODAY)
    expect(r.ok && r.value).toMatchObject({ surname: 'ERIKSSON', given: 'ANNA MARIA', number: 'L898902C3', nationality: 'UTO', birth: '1974-08-12', expiry: '2012-04-15', sex: 'F', bad: [] })
  })
  it('a changed character is caught; wrong length, type and dates are refused', () => {
    const r = parseMrz(ICAO.replace('L898902C3', 'L898902C4'), TODAY)
    expect(r.ok && r.value.bad).toEqual(['number', 'final'])
    expect(parseMrz('P<THA', TODAY)).toEqual({ ok: false, problem: 'length' })
    expect(parseMrz('V' + ICAO.slice(1), TODAY)).toEqual({ ok: false, problem: 'type' })
  })
  it('makeMrz builds lines that read back with every check digit right', () => {
    const r = parseMrz(SAMPLE_MRZ, TODAY)
    expect(SAMPLE_MRZ.split('\n').map((l) => l.length)).toEqual([44, 44])
    expect(r.ok && r.value).toMatchObject({ surname: 'JAIDEE', given: 'SOMCHAI', number: 'AC1234567', nationality: 'THA', birth: '1996-05-20', bad: [] })
  })
})

describe('B. identity against the record', () => {
  const read = (s: string) => { const r = parseMrz(s, TODAY); if (!r.ok) throw new Error(r.problem); return r.value }
  it('the sample passes; the problem sample shows five issues, the high ones block signing', () => {
    expect(identityCheck(read(SAMPLE_MRZ), SAMPLE_RECORD, 'CN', TODAY)).toEqual([])
    const flags = identityCheck(read(badSampleMrz(TODAY)), SAMPLE_RECORD, 'CN', TODAY).map((f) => f.flag)
    expect(flags).toEqual(['checkDigit', 'expiresSoon', 'nameMismatch', 'birthMismatch', 'minor'])
  })
  it('the youngest working age is 15 in Thailand and 16 in China; an expired passport is high risk', () => {
    expect(MIN_WORK_AGE).toEqual({ TH: 15, CN: 16 })
    const kid = read(makeMrz({ surname: 'A', given: 'B', number: 'X1', nationality: 'CHN', birth: '2011-01-01', expiry: '2030-01-01', sex: 'F' }))
    const rec: IdRecord = { surname: 'A', given: 'B', birth: '2011-01-01', nationality: 'CHN' }
    expect(identityCheck(kid, rec, 'TH', TODAY).map((f) => f.flag)).toEqual(['minor'])
    expect(identityCheck(kid, rec, 'CN', TODAY)[0]).toMatchObject({ flag: 'belowWorkAge', severity: 'high', laws: ['id.law.cnLabour15'] })
    const old = read(makeMrz({ surname: 'A', given: 'B', number: 'X1', nationality: 'CHN', birth: '1990-01-01', expiry: '2026-01-01', sex: 'F' }))
    expect(identityCheck(old, { ...rec, birth: '1990-01-01' }, 'TH', TODAY)[0]).toMatchObject({ flag: 'expired', severity: 'high' })
  })
})

describe('C. review and signing', () => {
  it('the fingerprint is SHA-256 of the text; any change gives another one', async () => {
    expect(await sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha256('สัญญา ก')).not.toBe(await sha256('สัญญา ข'))
    expect(shortHash('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')).toBe('ba7816bf…f20015ad')
  })
  it('signing waits for the contract check, a clean contract and a clean identity', () => {
    expect(signBlock({ checked: false, contractHigh: 0, idChecked: false, idHigh: 0 })).toBe('notChecked')
    expect(signBlock({ checked: true, contractHigh: 2, idChecked: true, idHigh: 0 })).toBe('contractRisk')
    expect(signBlock({ checked: true, contractHigh: 0, idChecked: false, idHigh: 0 })).toBe('idNotChecked')
    expect(signBlock({ checked: true, contractHigh: 0, idChecked: true, idHigh: 1 })).toBe('idProblem')
    expect(signBlock({ checked: true, contractHigh: 0, idChecked: true, idHigh: 0 })).toBeNull()
  })
  it('both sides sign the same text; a changed text voids the signatures; each side signs once', () => {
    const sig = (n: string) => ({ at: '2026-11-22T08:00:00.000Z', name: n, img: 'data:image/png;base64,AAAA' })
    const one = addSignature(null, 'worker', sig('SOMCHAI JAIDEE'), 'h1')
    expect(signStatus(one, 'h1')).toBe('partial')
    expect(addSignature(one, 'worker', sig('again'), 'h1')).toBeNull()
    expect(addSignature(one, 'employer', { ...sig('x'), img: 'nope' }, 'h1')).toBeNull()
    const both = addSignature(one, 'employer', sig('Sample company'), 'h1')
    expect(signStatus(both, 'h1')).toBe('signed')
    expect(signStatus(both, 'h2')).toBe('changed')
    expect(signStatus({ mode: 'paper', hash: 'h1', paper: { name: 'signed.pdf', size: 1, at: 'x' } }, 'h1')).toBe('paperSigned')
  })
  it('the firm replies with one fix per open issue, or a clean bill', () => {
    expect(reviewNotes([{ text: 'a' }, { text: 'b' }], 'ok').map((n) => n.kind)).toEqual(['fix', 'fix'])
    expect(reviewNotes([], 'ok')).toEqual([{ kind: 'ok', text: 'ok' }])
  })
})

describe('D. pages', () => {
  it('the contract page shows the four steps of the middle system', () => {
    const page = html(<ContractPage />)
    for (const k of ['mid.check', 'mid.id', 'mid.review', 'mid.sign', 'mid.restart'] as const) expect(page, k).toContain(T(k))
  })
  it('the lobby tells one journey in three systems, every line is a link, every system names its laws', () => {
    const page = html(<Journey />)
    for (const s of JOURNEY) {
      for (const k of [`jr.${s.k}.k`, `jr.${s.k}.t`, `jr.${s.k}.p`, `jr.${s.k}.go`] as const) expect(page, k).toContain(T(k as never))
      for (const f of s.feats) expect(page).toContain(`href="/${f.to}"`)
      for (const l of s.laws) expect(page).toContain(T(l as never))
    }
    expect(page.match(/class="jr-feat /g)?.length).toBe(12)
    const lobby = html(<Landing />)
    expect(lobby).toContain(T('jr.h')); expect(lobby.indexOf(T('jr.h'))).toBeLessThan(lobby.indexOf(esc(tr('m.problems.h', undefined, 'th'))))
    expect(src('./index.css')).toContain('.jr-front { --jr: 245 158 11')
  })
  it('every new text has Thai, Chinese and English in the right scripts and no key clashes', () => {
    for (const [k, [th, zh, en]] of Object.entries(v2b)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(th, k).not.toMatch(/[一-鿿]/); expect(en, k).not.toMatch(/[฀-๿一-鿿]/)
      expect(messages[k as keyof typeof messages]).toEqual([th, zh, en])
    }
  })
})
