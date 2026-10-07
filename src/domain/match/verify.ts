// Employer verification (owner, Oct 2026): a company registration number, checked for its form and check digit at once; an
// administrator (the employment agency's role in the prototype) then approves it. Company numbers are not personal data.
// Pure: no React, no storage.
import type { Country } from './types'

/** Thai juristic person number: 13 digits; the last is a check digit (same scheme as the 13-digit identification number) */
export function isThaiJuristicNo(v: string): boolean {
  if (!/^\d{13}$/.test(v)) return false
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(v[i]) * (13 - i)
  return (11 - (sum % 11)) % 10 === Number(v[12])
}
/** Chinese unified social credit code (统一社会信用代码): 18 characters from 31 symbols (no I, O, Z, S, V); the last is a check character */
const USCC = '0123456789ABCDEFGHJKLMNPQRTUWXY'
const USCC_W = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
export function isChinaCreditCode(v: string): boolean {
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(v)) return false
  let sum = 0
  for (let i = 0; i < 17; i++) sum += USCC.indexOf(v[i]) * USCC_W[i]
  const c = 31 - (sum % 31)
  return USCC[c === 31 ? 0 : c] === v[17]
}
/** spaces and dashes typed for readability are ignored; letters are upper-cased */
export const cleanRegNo = (v: string) => v.replace(/[\s-]/g, '').toUpperCase()
export const isRegNo = (country: Country, v: string) => (country === 'TH' ? isThaiJuristicNo(v) : isChinaCreditCode(v))
/**
 * An employer who is a private person (owner, Oct 2026, option ก): a mobile number that can receive a code by SMS — Thai
 * 06/08/09 + 8 digits, Chinese 1[3-9] + 9 digits; "+66 …" / "+86 …", spaces, dashes and brackets are accepted. Only the last
 * 4 digits are ever sent or stored (the administrator sees "••••1234"); identity-card numbers are never asked for.
 */
export function cleanPhone(country: Country, v: string): string {
  const s = v.replace(/[\s\-().]/g, '')
  if (country === 'TH') return s.startsWith('+66') ? '0' + s.slice(3) : s.startsWith('0066') ? '0' + s.slice(4) : s
  return s.startsWith('+86') ? s.slice(3) : s.startsWith('0086') ? s.slice(4) : s
}
export const isMobile = (country: Country, v: string) => (country === 'TH' ? /^0[689]\d{8}$/ : /^1[3-9]\d{9}$/).test(v)
export const phoneLast4 = (v: string) => v.slice(-4)
/** the one-time code (in the prototype it is shown on the screen instead of being sent by SMS) */
export function oneTimeCode(): string {
  const a = new Uint32Array(1)
  globalThis.crypto.getRandomValues(a)
  return String(a[0] % 1_000_000).padStart(6, '0')
}
/** test helpers: complete a number with its check digit / character */
export function withThaiCheck(first12: string): string { let sum = 0; for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i); return first12 + String((11 - (sum % 11)) % 10) }
export function withChinaCheck(first17: string): string { let sum = 0; for (let i = 0; i < 17; i++) sum += USCC.indexOf(first17[i]) * USCC_W[i]; const c = 31 - (sum % 31); return first17 + USCC[c === 31 ? 0 : c] }
