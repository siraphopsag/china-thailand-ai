// Identity check of the middle system (v2 model, owner Nov 2026: "check the data both ways — the contract against the post, and the
// identity document against what was registered"). The worker types or pastes the two machine-readable lines at the bottom of the
// passport photo page (MRZ, ICAO Doc 9303 part 4, "TD3": 2 lines × 44 characters). Every field there carries a check digit, so a
// mistyped or altered number shows at once; then name, date of birth and nationality are compared with the record, the passport
// must still be valid long enough for a visa, and the worker's age is checked against the child-labour rules of the country of work.
// Works offline, nothing leaves the device. Pure: no React, no storage.
import type { Country } from './types'

/** ICAO 9303 check digit: values 0–9, A=10 … Z=35, '<'=0; weights 7, 3, 1 repeating; sum mod 10 */
export function checkDigit(s: string): number {
  const w = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    const v = c >= '0' && c <= '9' ? c.charCodeAt(0) - 48 : c >= 'A' && c <= 'Z' ? c.charCodeAt(0) - 55 : 0
    sum += v * w[i % 3]
  }
  return sum % 10
}

export interface Mrz {
  surname: string; given: string; number: string; nationality: string; issuer: string
  /** YYYY-MM-DD */
  birth: string; expiry: string
  sex: 'M' | 'F' | 'X'
  /** which check digits failed (empty = all good) */
  bad: ('number' | 'birth' | 'expiry' | 'personal' | 'final')[]
}
export type MrzProblem = 'length' | 'type' | 'chars' | 'date'

/** "980314" → 1998-03-14; a birth year after this year's two digits is in the 1900s, an expiry is always in the 2000s */
function day6(s: string, kind: 'birth' | 'expiry', today: string): string | null {
  if (!/^\d{6}$/.test(s)) return null
  const yy = Number(s.slice(0, 2)), mm = s.slice(2, 4), dd = s.slice(4, 6)
  const nowYY = Number(today.slice(2, 4))
  const year = kind === 'expiry' ? 2000 + yy : yy > nowYY ? 1900 + yy : 2000 + yy
  const d = `${year}-${mm}-${dd}`
  const t = Date.parse(d + 'T00:00:00Z')
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d ? null : d
}

/** the two lines (any case, spaces ignored, one or two lines) → the fields, or why it cannot be read */
export function parseMrz(text: string, today = new Date().toISOString().slice(0, 10)): { ok: true; value: Mrz } | { ok: false; problem: MrzProblem } {
  const flat = text.toUpperCase().replace(/[^A-Z0-9<\n]/g, '').split('\n').filter(Boolean).join('')
  if (flat.length !== 88) return { ok: false, problem: 'length' }
  if (!/^[A-Z0-9<]+$/.test(flat)) return { ok: false, problem: 'chars' }
  const l1 = flat.slice(0, 44), l2 = flat.slice(44)
  if (l1[0] !== 'P') return { ok: false, problem: 'type' }
  const issuer = l1.slice(2, 5).replace(/</g, '')
  const [sur, giv = ''] = l1.slice(5).split('<<')
  const number = l2.slice(0, 9), nat = l2.slice(10, 13).replace(/</g, '')
  const birth = day6(l2.slice(13, 19), 'birth', today), expiry = day6(l2.slice(21, 27), 'expiry', today)
  if (!birth || !expiry) return { ok: false, problem: 'date' }
  const sexC = l2[20]
  const bad: Mrz['bad'] = []
  if (checkDigit(number) !== Number(l2[9])) bad.push('number')
  if (checkDigit(l2.slice(13, 19)) !== Number(l2[19])) bad.push('birth')
  if (checkDigit(l2.slice(21, 27)) !== Number(l2[27])) bad.push('expiry')
  if (l2[42] !== '<' && checkDigit(l2.slice(28, 42)) !== Number(l2[42])) bad.push('personal')
  if (checkDigit(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43)) !== Number(l2[43])) bad.push('final')
  return { ok: true, value: {
    surname: sur.replace(/</g, ' ').trim(), given: giv.replace(/</g, ' ').trim(), number: number.replace(/</g, ''), nationality: nat, issuer,
    birth, expiry, sex: sexC === 'M' || sexC === 'F' ? sexC : 'X', bad } }
}

/** builds the two lines with correct check digits (the samples and the tests) */
export function makeMrz(p: { surname: string; given: string; number: string; nationality: string; birth: string; expiry: string; sex: 'M' | 'F' }): string {
  const pad = (s: string, n: number) => (s + '<'.repeat(n)).slice(0, n)
  const name = (s: string) => s.toUpperCase().trim().replace(/\s+/g, '<')
  const l1 = pad(`P<${p.nationality}${name(p.surname)}<<${name(p.given)}`, 44)
  const ymd = (d: string) => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10)
  const no = pad(p.number, 9), b = ymd(p.birth), e = ymd(p.expiry), pers = '<'.repeat(14)
  const body = `${no}${checkDigit(no)}${p.nationality}${b}${checkDigit(b)}${p.sex}${e}${checkDigit(e)}${pers}<`
  const fin = checkDigit(body.slice(0, 10) + body.slice(13, 20) + body.slice(21, 43))
  return `${l1}\n${body}${fin}`
}

/** what the worker registered (the identity the contract will name) */
export interface IdRecord { surname: string; given: string; birth: string; nationality: string }
export type IdFlag = 'checkDigit' | 'expired' | 'expiresSoon' | 'nameMismatch' | 'birthMismatch' | 'nationalityMismatch' | 'belowWorkAge' | 'minor'
export interface IdFinding { flag: IdFlag; severity: 'high' | 'medium'; laws: string[]; vars?: Record<string, string | number> }

/** most visas ask for a passport that is still valid for at least this many months */
export const PASSPORT_MIN_MONTHS = 6
/** the youngest age anyone may be employed in the country of work: Thailand 15 (LPA s.44), China 16 (Labour Law Art. 15) */
export const MIN_WORK_AGE: Record<Country, number> = { TH: 15, CN: 16 }
const CHILD_LAWS: Record<Country, string[]> = { TH: ['id.law.thLpa44'], CN: ['id.law.cnLabour15'] }
/** 15/16 to 17: young workers with extra protection (Thailand LPA s.45, China Labour Law Art. 58) */
const MINOR_LAWS: Record<Country, string[]> = { TH: ['id.law.thLpa45'], CN: ['id.law.cnLabour58'] }

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '')
const ageOn = (birth: string, day: string) => { const [by, bm, bd] = birth.split('-').map(Number), [y, m, d] = day.split('-').map(Number); return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0) }
const addMonths = (day: string, n: number) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }

/** the passport lines against the record, on `today`, for work in `country` */
export function identityCheck(m: Mrz, rec: IdRecord, country: Country, today: string): IdFinding[] {
  const out: IdFinding[] = []
  if (m.bad.length) out.push({ flag: 'checkDigit', severity: 'high', laws: ['id.law.icao'], vars: { f: m.bad.join(', ') } })
  if (m.expiry <= today) out.push({ flag: 'expired', severity: 'high', laws: ['id.law.icao'] })
  else if (m.expiry < addMonths(today, PASSPORT_MIN_MONTHS)) out.push({ flag: 'expiresSoon', severity: 'medium', laws: [], vars: { d: m.expiry, n: PASSPORT_MIN_MONTHS } })
  if (norm(m.surname) !== norm(rec.surname) || norm(m.given) !== norm(rec.given)) out.push({ flag: 'nameMismatch', severity: 'high', laws: [], vars: { p: `${m.surname} ${m.given}`, r: `${rec.surname} ${rec.given}`.trim() } })
  if (rec.birth && m.birth !== rec.birth) out.push({ flag: 'birthMismatch', severity: 'high', laws: [], vars: { p: m.birth, r: rec.birth } })
  if (rec.nationality && m.nationality !== rec.nationality) out.push({ flag: 'nationalityMismatch', severity: 'high', laws: [], vars: { p: m.nationality, r: rec.nationality } })
  const age = ageOn(m.birth, today)
  if (age < MIN_WORK_AGE[country]) out.push({ flag: 'belowWorkAge', severity: 'high', laws: CHILD_LAWS[country], vars: { age, min: MIN_WORK_AGE[country] } })
  else if (age < 18) out.push({ flag: 'minor', severity: 'medium', laws: MINOR_LAWS[country], vars: { age } })
  return out
}
