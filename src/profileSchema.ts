// Pure validation helpers (no React, no DOM) — shared by the browser store and the serverless API.
import type { Holder, Profile, Side } from './types'

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const str = (v: unknown) => (typeof v === 'string' ? v : '')
export const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
export const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const prov = (v: unknown) => (typeof v === 'string' && /^(TH|CN)-[A-Z0-9]{2,3}$/.test(v) ? v : undefined)
export const pick = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d)

function cleanHolder(h: unknown, id: Side): Holder | null {
  if (!isObj(h)) return null
  return { id, nationality: h.nationality === 'CN' ? 'CN' : 'TH', percent: num(h.percent), capital: num(h.capital), voting: num(h.voting), board: num(h.board), economic: num(h.economic) }
}
/** Returns a safe Profile, or null if the input cannot be a business profile. */
export function cleanProfile(p: unknown): Profile | null {
  if (!isObj(p)) return null
  const hs = Array.isArray(p.holders) ? p.holders : []
  const o = cleanHolder(hs.find((h) => isObj(h) && h.id === 'origin'), 'origin')
  const pa = cleanHolder(hs.find((h) => isObj(h) && h.id === 'partner'), 'partner')
  if (!o || !pa) return null
  return {
    companyName: str(p.companyName).slice(0, 200), direction: p.direction === 'CN_TH' ? 'CN_TH' : 'TH_CN', businessType: str(p.businessType) || 'other',
    businessTypeOther: p.businessTypeOther ? str(p.businessTypeOther).slice(0, 200) : undefined, activity: str(p.activity).slice(0, 1000), forms: strs(p.forms).slice(0, 20),
    investmentRange: str(p.investmentRange), employees: Math.max(0, num(p.employees)), crossBorderWorkers: !!p.crossBorderWorkers, holders: [o, pa],
    realInvestor: pick(p.realInvestor, ['origin', 'partner', 'shared', 'unknown'], 'unknown'), operator: pick(p.operator, ['origin', 'partner', 'joint', 'unknown'], 'unknown'),
    sideAgreement: pick(p.sideAgreement, ['yes', 'no', 'unknown'], 'unknown'), products: str(p.products).slice(0, 500), regulatedGoods: str(p.regulatedGoods), location: str(p.location).slice(0, 200),
    crossBorder: strs(p.crossBorder).slice(0, 20), targetMarket: p.targetMarket ? str(p.targetMarket).slice(0, 300) : undefined, originProvince: prov(p.originProvince), destProvince: prov(p.destProvince), unknownFacts: strs(p.unknownFacts).slice(0, 20), isDemo: !!p.isDemo,
  }
}
