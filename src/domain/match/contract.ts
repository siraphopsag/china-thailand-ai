// Contract check (v2 model, owner Nov 2026: "middle system"). Before anyone signs, the draft employment contract is compared with
// the job post and with fixed legal rules: the pay must match what was advertised and must not be below the legal minimum, the
// employer may not keep the worker's passport or take a deposit, there must be a weekly day off, and deductions are limited.
// Each finding names the law of the country of work. RULES ONLY — the AI check (api/ai.ts, kind 'contract') adds wording issues on
// top when it is available; without it (offline demo, signed out) these rules still run. Not legal advice: a lawyer reviews real
// contracts. Pure: no React, no storage.
import type { Country, Currency, Post } from './types'
import { minMonthlyWage } from './minwage'

/** the clauses a basic contract fixes; every number is per month unless stated */
export interface ContractTerms {
  /** monthly pay written in the contract */
  pay: number
  currency: Currency
  /** working days off per week (the law requires at least one) */
  daysOff: number
  /** the employer keeps the worker's passport or identity card "for safe keeping" */
  keepsPassport: boolean
  /** a deposit or guarantee money the worker must pay (0 = none) */
  deposit: number
  /** share of the monthly pay the employer may deduct for housing, food, fines or "debts" (percent) */
  deductPct: number
}
export type ContractFlag = 'payBelowPost' | 'belowMinWage' | 'passportKept' | 'deposit' | 'noWeeklyDayOff' | 'heavyDeductions'
export interface ContractFinding {
  flag: ContractFlag
  severity: 'high' | 'medium'
  /** which clause of the draft it is about (1-based, see CLAUSES) */
  clause: number
  /** message keys of the laws of the country of work (locales: c2.law.*) */
  laws: string[]
  vars?: Record<string, string | number>
}
/** the clause order of the draft contract (shown numbered on the page) */
export const CLAUSES = ['parties', 'pay', 'hours', 'documents', 'deposit', 'deductions', 'law'] as const
const clauseNo = (k: (typeof CLAUSES)[number]) => CLAUSES.indexOf(k) + 1

/** the most a contract may deduct in a month before it is flagged (Thai Labour Protection Act s.76 caps deductions; one fifth) */
export const MAX_DEDUCT_PCT = 20

/** the laws behind each flag, by country of work. Only provisions checked on 21 Nov 2026 are named (see the plan's legal list). */
const LAWS: Record<ContractFlag, Record<Country, string[]>> = {
  payBelowPost: { CN: ['c2.law.cnLcl8'], TH: ['c2.law.postTerms'] },
  belowMinWage: { CN: ['c2.law.cnMinWage'], TH: ['c2.law.thMinWage'] },
  passportKept: { CN: ['c2.law.cnLcl9'], TH: ['c2.law.thTip'] },
  deposit: { CN: ['c2.law.cnLcl9'], TH: ['c2.law.thLpa10'] },
  noWeeklyDayOff: { CN: ['c2.law.cnLabour38'], TH: ['c2.law.thLpa28'] },
  heavyDeductions: { CN: ['c2.law.cnWagePay'], TH: ['c2.law.thLpa76'] },
}

/** the contract exactly as the post promised it (the starting point of every draft) */
export function draftFromPost(post: Pick<Post, 'salary'> & { country: Country }): ContractTerms {
  const currency = post.salary?.currency ?? (post.country === 'CN' ? 'CNY' : 'THB')
  return { pay: post.salary?.min ?? 0, currency, daysOff: 1, keepsPassport: false, deposit: 0, deductPct: 0 }
}
/** the training sample shown on the slides: the same post, but the contract pays less, keeps the passport, takes a deposit, gives
 *  no day off and deducts heavily — every rule fires once */
export function riskyDraft(post: Pick<Post, 'salary'> & { country: Country }): ContractTerms {
  const d = draftFromPost(post)
  return { ...d, pay: Math.round((d.pay || 6000) * 2 / 3), keepsPassport: true, deposit: 2000, daysOff: 0, deductPct: 35 }
}

/**
 * Compare a draft with its post and the law of the country of work. `province` picks the minimum wage; a salary in another
 * currency than the country's is not compared with the minimum (the post says what it means, the page shows a note).
 */
export function checkContract(terms: ContractTerms, post: Pick<Post, 'salary' | 'country' | 'province'>): ContractFinding[] {
  const out: ContractFinding[] = []
  const add = (flag: ContractFlag, severity: ContractFinding['severity'], clause: number, vars?: ContractFinding['vars']) =>
    out.push({ flag, severity, clause, laws: LAWS[flag][post.country], vars })
  const promised = post.salary && post.salary.currency === terms.currency ? post.salary.min : null
  if (promised !== null && terms.pay < promised) add('payBelowPost', 'high', clauseNo('pay'), { pay: terms.pay, promised, cur: terms.currency })
  const min = minMonthlyWage(post.country, post.province)
  const local = (post.country === 'CN' ? 'CNY' : 'THB') === terms.currency
  if (min && local && terms.pay > 0 && terms.pay < min.monthly) add('belowMinWage', 'high', clauseNo('pay'), { pay: terms.pay, min: min.monthly, cur: terms.currency })
  if (terms.keepsPassport) add('passportKept', 'high', clauseNo('documents'))
  if (terms.deposit > 0) add('deposit', 'high', clauseNo('deposit'), { amount: terms.deposit, cur: terms.currency })
  if (terms.daysOff < 1) add('noWeeklyDayOff', 'high', clauseNo('hours'))
  if (terms.deductPct > MAX_DEDUCT_PCT) add('heavyDeductions', 'medium', clauseNo('deductions'), { pct: terms.deductPct, max: MAX_DEDUCT_PCT })
  return out
}

/** sanity limits for the page's inputs (a draft outside them is not checked) */
export function termsProblem(t: ContractTerms): 'pay' | 'daysOff' | 'deposit' | 'deduct' | null {
  if (!Number.isInteger(t.pay) || t.pay < 0 || t.pay > 10_000_000) return 'pay'
  if (!Number.isInteger(t.daysOff) || t.daysOff < 0 || t.daysOff > 7) return 'daysOff'
  if (!Number.isInteger(t.deposit) || t.deposit < 0 || t.deposit > 10_000_000) return 'deposit'
  if (!Number.isInteger(t.deductPct) || t.deductPct < 0 || t.deductPct > 100) return 'deduct'
  return null
}
