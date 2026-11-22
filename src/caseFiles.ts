// Document scans the worker attaches to a case (v2 model, owner Nov 2026: "scan and upload into the tracker"). PDPA-minded: the
// file itself never leaves this device and is not saved anywhere — only its name, size and time are remembered here, so both
// the worker and the page know which documents are ready. The picture can be previewed until the tab is closed.
import type { Doc } from './domain/match/cases'

export interface CaseFile { name: string; size: number; type: string; at: string }
type Store = Record<string, Partial<Record<Doc, CaseFile>>>
const KEY = 'call.case.files.v1'
/** files bigger than this are refused (a phone photo or a short PDF fits) */
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

const read = (): Store => {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown; return typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Store : {} } catch { return {} }
}
const write = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode: kept for this visit only */ } }
/** previews of this visit (object URLs), never stored */
const previews = new Map<string, string>()
const pkey = (caseId: string, doc: Doc) => `${caseId}:${doc}`

export const caseFiles = (caseId: string): Partial<Record<Doc, CaseFile>> => read()[caseId] ?? {}
export function attachFile(caseId: string, doc: Doc, file: File, at: string): 'type' | 'size' | null {
  if (!FILE_TYPES.includes(file.type)) return 'type'
  if (file.size > MAX_FILE_BYTES) return 'size'
  const s = read()
  s[caseId] = { ...(s[caseId] ?? {}), [doc]: { name: file.name.slice(0, 120), size: file.size, type: file.type, at } }
  write(s)
  const old = previews.get(pkey(caseId, doc)); if (old) URL.revokeObjectURL(old)
  try { previews.set(pkey(caseId, doc), URL.createObjectURL(file)) } catch { /* no preview */ }
  return null
}
export function removeFile(caseId: string, doc: Doc) {
  const s = read(); if (s[caseId]) { delete s[caseId][doc]; write(s) }
  const old = previews.get(pkey(caseId, doc)); if (old) { URL.revokeObjectURL(old); previews.delete(pkey(caseId, doc)) }
}
export const previewOf = (caseId: string, doc: Doc) => previews.get(pkey(caseId, doc)) ?? null
