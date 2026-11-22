// What the middle system remembers per case on this device (v2 model, owner Nov 2026): the contract terms being worked on, the
// identity record and passport lines, the partner review and the signatures. Prototype only: kept in the browser
// (localStorage 'call.contract.v1'), read back item by item, and cleared with "start again". Nothing is sent anywhere.
import type { ContractTerms } from './domain/match/contract'
import type { IdRecord } from './domain/match/mrz'
import type { Review, SignState } from './domain/match/sign'

export interface ContractSave {
  terms?: ContractTerms
  checked?: boolean
  record?: IdRecord
  mrz?: string
  review?: Review
  sign?: SignState
}
const KEY = 'call.contract.v1'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readAll(): Record<string, ContractSave> {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return isObj(v) ? (v as Record<string, ContractSave>) : {} } catch { return {} }
}
export function loadContract(id: string): ContractSave {
  const v = readAll()[id]
  if (!isObj(v)) return {}
  const out: ContractSave = {}
  if (isObj(v.terms) && typeof v.terms.pay === 'number' && typeof v.terms.daysOff === 'number') out.terms = v.terms as unknown as ContractTerms
  if (typeof v.checked === 'boolean') out.checked = v.checked
  if (isObj(v.record) && typeof v.record.surname === 'string') out.record = v.record as unknown as IdRecord
  if (typeof v.mrz === 'string' && v.mrz.length <= 120) out.mrz = v.mrz
  if (isObj(v.review) && typeof v.review.status === 'string' && Array.isArray(v.review.notes)) out.review = v.review as unknown as Review
  if (isObj(v.sign) && typeof v.sign.hash === 'string') out.sign = v.sign as unknown as SignState
  return out
}
export function saveContract(id: string, patch: Partial<ContractSave>): void {
  try { const all = readAll(); all[id] = { ...(isObj(all[id]) ? all[id] : {}), ...patch }; localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* storage full or blocked: the page still works for this visit */ }
}
export function clearContract(id: string): void {
  try { const all = readAll(); delete all[id]; localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* ignore */ }
}
