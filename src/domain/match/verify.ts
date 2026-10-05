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
/** test helpers: complete a number with its check digit / character */
export function withThaiCheck(first12: string): string { let sum = 0; for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (13 - i); return first12 + String((11 - (sum % 11)) % 10) }
export function withChinaCheck(first17: string): string { let sum = 0; for (let i = 0; i < 17; i++) sum += USCC.indexOf(first17[i]) * USCC_W[i]; const c = 31 - (sum % 31); return first17 + USCC[c === 31 ? 0 : c] }
