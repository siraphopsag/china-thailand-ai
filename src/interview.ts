// Pure interview logic (no React): questions, branching, and the mapping from answers to a business profile.
import type { Direction, Holder, Profile, Side } from './types'

export type A = Record<string, string | string[]>
export interface Q { id: string; cat: number; type: 'text' | 'choice' | 'multi' | 'number' | 'pct'; ns?: string; opts?: string[]; when?: (a: A) => boolean; help?: boolean; min?: number; core?: boolean }

const SIDE = ['origin', 'partner', 'shared', 'unknown']
export const send = (a: A) => (a.forms as string[] | undefined)?.includes('send') ?? false
export const hires = (a: A) => (a.forms as string[] | undefined)?.includes('hire') ?? false
export const wantsStaff = (a: A) => send(a) || hires(a) || a.hire === 'yes' || a.hire === 'unsure'
export const goods = (a: A) => ((a.forms as string[] | undefined)?.includes('goods') ?? false) || ['manufacturing', 'retail'].includes(String(a.btype ?? ''))
export const company = (a: A) => (a.forms as string[] | undefined)?.some((f) => f === 'company' || f === 'invest') ?? false

/** `core` questions are the quick start (3 questions). Everything after them can be answered later to make the result more accurate. */
export const QS: Q[] = [
  { id: 'name', cat: 0, type: 'text', help: true, core: true },
  { id: 'btype', cat: 0, type: 'choice', ns: 'btype', opts: ['manufacturing', 'retail', 'service', 'food', 'tech', 'other'], core: true },
  { id: 'btypeOther', cat: 0, type: 'text', help: true, when: (a) => a.btype === 'other', core: true },
  { id: 'forms', cat: 1, type: 'multi', ns: 'forms', opts: ['company', 'invest', 'goods', 'hire', 'send', 'partner', 'other'], core: true },
  { id: 'activity', cat: 0, type: 'text', help: true },
  { id: 'activityMore', cat: 0, type: 'text', when: (a) => { const n = String(a.activity ?? '').trim().length; return n > 0 && n < 20 } },
  { id: 'invest', cat: 1, type: 'choice', ns: 'invest', opts: ['lt10', '10to50', 'gt50', 'unknown'], when: company },
  { id: 'ownOrigin', cat: 2, type: 'pct', help: true, when: company },
  { id: 'funding', cat: 2, type: 'choice', ns: 'funding', opts: ['prop', 'origin', 'partner', 'unknown'], when: company },
  { id: 'realInvestor', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'operator', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'board', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'voting', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'economic', cat: 2, type: 'choice', ns: 'economic', opts: ['prop', 'funder', 'unknown'], when: (a) => company(a) && (a.funding === 'origin' || a.funding === 'partner') },
  { id: 'side', cat: 2, type: 'choice', ns: 'agr', opts: ['no', 'yes', 'unknown'], help: true, when: company },
  { id: 'hire', cat: 3, type: 'choice', ns: 'hire', opts: ['yes', 'no', 'unsure'], when: (a) => !send(a) && !hires(a) },
  { id: 'employees', cat: 3, type: 'number', min: 0, when: wantsStaff },
  { id: 'crossWorkers', cat: 3, type: 'choice', ns: 'cw', opts: ['yes', 'no'], when: (a) => !send(a) && wantsStaff(a) },
  { id: 'empEmployer', cat: 3, type: 'choice', ns: 'empEmployer', opts: ['origin', 'new', 'unsure'], when: send },
  { id: 'empNat', cat: 3, type: 'choice', ns: 'empNat', opts: ['TH', 'CN', 'multi'], when: send },
  { id: 'empDuration', cat: 3, type: 'choice', ns: 'empDuration', opts: ['le6', '6to12', '1to3', 'gt3', 'tbd'], when: send },
  { id: 'empSalary', cat: 3, type: 'text', help: true, when: send },
  { id: 'products', cat: 4, type: 'text' },
  { id: 'market', cat: 4, type: 'text' },
  { id: 'regulated', cat: 4, type: 'choice', ns: 'regulated', opts: ['none', 'food', 'electrical', 'other'], when: goods },
  { id: 'location', cat: 5, type: 'text' },
  { id: 'cross', cat: 6, type: 'multi', ns: 'cross', opts: ['import', 'export', 'fx', 'none'], when: goods },
]

export const visibleQs = (a: A) => QS.filter((q) => !q.when || q.when(a))
export const isAnswered = (a: A, q: Q) => { const v = a[q.id]; return Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '' }
export const coreDone = (a: A) => visibleQs(a).filter((q) => q.core).every((q) => isAnswered(a, q))
export const remaining = (a: A) => visibleQs(a).filter((q) => !isAnswered(a, q)).length
export const firstUnanswered = (a: A) => { const v = visibleQs(a); const i = v.findIndex((q) => !isAnswered(a, q)); return i < 0 ? Math.max(0, v.length - 1) : i }
/** Drop answers of questions that are no longer relevant (e.g. after going back and changing a choice). */
export const prune = (a: A): A => { const ids = new Set(visibleQs(a).map((q) => q.id)); return Object.fromEntries(Object.entries(a).filter(([k]) => ids.has(k))) as A }
/** Answers that define the ownership/control picture (used to keep manual what-if edits when nothing relevant changed). */
export const OWNERSHIP_KEYS = ['forms', 'ownOrigin', 'funding', 'realInvestor', 'operator', 'board', 'voting', 'economic', 'side']

const isSide = (v: unknown): v is 'origin' | 'partner' | 'shared' | 'unknown' => SIDE.includes(String(v))

/** Builds a profile from whatever has been answered so far. Missing ownership answers are treated as UNKNOWN, never as "fine". */
export function buildProfile(a: A, d: Direction): { profile: Profile; mode: string } {
  const comp = company(a)
  const unknownFacts: string[] = []
  if (comp && a.ownOrigin === undefined) unknownFacts.push('shares')
  const origin = comp ? Number(a.ownOrigin ?? 50) : 100
  const fund = comp ? String(a.funding ?? 'unknown') : 'prop'
  const fo = fund === 'origin' ? 100 : fund === 'partner' ? 0 : origin
  const ecoOrigin = a.economic === 'funder' ? (fo === 100 ? 80 : 20) : origin
  if (comp && fund === 'unknown') unknownFacts.push('funding')
  if (comp && a.economic === 'unknown') unknownFacts.push('economic')
  const ctl = (v: unknown, what: string) => { const s = isSide(v) ? v : 'unknown'; if (s === 'unknown' && comp) unknownFacts.push(what); return s === 'origin' ? 100 : s === 'partner' ? 0 : origin }
  const vo = ctl(a.voting, 'voting')
  const bo = ctl(a.board, 'board')
  const nat = (s: Side): 'TH' | 'CN' => (s === 'origin' ? (d === 'TH_CN' ? 'TH' : 'CN') : d === 'TH_CN' ? 'CN' : 'TH')
  const mk = (id: Side, pct: number, cap: number, eco: number, vot: number, brd: number): Holder => ({ id, nationality: nat(id), percent: pct, capital: cap, voting: vot, board: brd, economic: eco })
  const op = isSide(a.operator) ? a.operator : 'unknown'
  const s = send(a)
  const profile: Profile = {
    companyName: String(a.name ?? ''), direction: d, businessType: String(a.btype ?? 'other'), businessTypeOther: a.btype === 'other' ? String(a.btypeOther ?? '') : undefined,
    activity: [a.activity, a.activityMore].filter(Boolean).join(' — '), forms: (a.forms as string[] | undefined) ?? [], investmentRange: String(a.invest ?? ''),
    employees: Number(a.employees ?? 0), crossBorderWorkers: a.crossWorkers === 'yes' || s,
    holders: [mk('origin', origin, fo, ecoOrigin, vo, bo), mk('partner', 100 - origin, 100 - fo, 100 - ecoOrigin, 100 - vo, 100 - bo)],
    realInvestor: isSide(a.realInvestor) ? a.realInvestor : 'unknown', operator: op === 'shared' ? 'joint' : op,
    sideAgreement: a.side === 'yes' ? 'yes' : a.side === 'no' ? 'no' : 'unknown',
    products: String(a.products ?? ''), targetMarket: String(a.market ?? ''), regulatedGoods: String(a.regulated ?? ''), location: String(a.location ?? ''),
    crossBorder: ((a.cross as string[]) ?? []).filter((x) => x !== 'none'), unknownFacts,
  }
  const mode = !wantsStaff(a) ? '' : s ? (d === 'TH_CN' ? 'send_th_cn' : 'send_cn_th') : d === 'TH_CN' ? 'hire_cn' : 'hire_th'
  return { profile, mode }
}
