// Report pack (v2 model, owner Nov 2026: the "end system"). After the job starts, a worker with a problem picks what happened; the
// pack lists the evidence to keep for that kind of case, which agency handles it in the country of work, and the office to go
// to (the province's office of that agency, found on a map search — no invented addresses). The pack is built on the worker's
// device; nothing is sent to anyone. Pure: no React, no storage.
import type { Country } from './types'

export const PROBLEMS = ['unpaid', 'passport', 'forced', 'violence', 'fee', 'other'] as const
export type ProblemKind = (typeof PROBLEMS)[number]
/** evidence worth keeping, by problem (locale keys rp.ev.*) */
export const EVIDENCE: Record<ProblemKind, string[]> = {
  unpaid: ['contract', 'payslips', 'hours', 'messages', 'bank'],
  passport: ['passportCopy', 'whoKeeps', 'messages', 'witness'],
  forced: ['location', 'messages', 'whoKeeps', 'witness', 'photos'],
  violence: ['medical', 'photos', 'witness', 'messages'],
  fee: ['receipts', 'messages', 'ad', 'bank'],
  other: ['contract', 'messages', 'photos'],
}
/** the agency for each problem in each country of work (locale keys rp.ag.*), most relevant first */
export const AGENCIES: Record<ProblemKind, Record<Country, string[]>> = {
  unpaid: { TH: ['thLabourProtection'], CN: ['cnLabourInspection'] },
  passport: { TH: ['thPolice', 'thLabourProtection'], CN: ['cnPolice', 'cnLabourInspection'] },
  forced: { TH: ['thPolice', 'thAntiTrafficking'], CN: ['cnPolice'] },
  violence: { TH: ['thPolice'], CN: ['cnPolice'] },
  fee: { TH: ['thEmployment', 'thPolice'], CN: ['cnPolice', 'cnLabourInspection'] },
  other: { TH: ['thLabourProtection'], CN: ['cnLabourInspection'] },
}
/** the problems where life or freedom may be at risk: the page puts the emergency numbers first */
export const URGENT: readonly ProblemKind[] = ['forced', 'violence']

/** the agency searched around a point (owner's blueprint, 27 Nov 2026: "agencies near where it happened"): AMap in China, Google
 *  Maps elsewhere. Opened by the person; the app sends nothing. */
export function officeNear(country: Country, agencyName: string, at: { lat: number; lng: number }) {
  return country === 'CN'
    ? `https://uri.amap.com/search?keyword=${encodeURIComponent(agencyName)}&center=${at.lng},${at.lat}`
    : `https://www.google.com/maps/search/${encodeURIComponent(agencyName)}/@${at.lat},${at.lng},14z`
}
/** an OpenStreetMap view of about 2 km around a point with a marker (free, no key; shown in a frame) */
export function osmEmbed(at: { lat: number; lng: number }, km = 2) {
  const dLat = km / 111, dLng = km / (111 * Math.max(0.2, Math.cos((at.lat * Math.PI) / 180)))
  const f = (n: number) => n.toFixed(5)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${f(at.lng - dLng)}%2C${f(at.lat - dLat)}%2C${f(at.lng + dLng)}%2C${f(at.lat + dLat)}&layer=mapnik&marker=${f(at.lat)}%2C${f(at.lng)}`
}
/** the office search for a province: the agency's office in that province, opened in a map search (Amap in China) */
export function officeSearch(country: Country, provinceName: string, agencyName: string) {
  const q = `${agencyName} ${provinceName}`
  return country === 'CN'
    ? `https://uri.amap.com/search?keyword=${encodeURIComponent(q)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export interface PackInput {
  /** the shared location and a map link to it (owner’s blueprint, 27 Nov 2026) */
  loc?: { lat: number; lng: number; link: string } | null
  problem: ProblemKind; country: Country; province: string; note: string; evidence: string[]; when: string }
/** the pack as plain text (for "Save as text"); `t` is the page's translator so the pack is in the reader's language */
export function packText(p: PackInput, t: (k: string, v?: Record<string, string | number>) => string, provinceName: string): string {
  const lines = [
    t('rp.pack.title'), '',
    `${t('rp.pack.problem')}: ${t(`rp.p.${p.problem}`)}`,
    `${t('rp.pack.when')}: ${p.when}`,
    `${t('rp.pack.where')}: ${provinceName}${p.loc ? ` · ${p.loc.lat}, ${p.loc.lng} (${p.loc.link})` : ''}`,
    '', `${t('rp.pack.evidence')}:`,
    ...EVIDENCE[p.problem].map((e) => `[${p.evidence.includes(e) ? 'x' : ' '}] ${t(`rp.ev.${e}`)}`),
    '', `${t('rp.pack.agency')}:`,
    ...AGENCIES[p.problem][p.country].map((a) => `- ${t(`rp.ag.${a}`)}`),
  ]
  if (p.note.trim()) lines.push('', `${t('rp.pack.note')}:`, p.note.trim())
  lines.push('', t('rp.pack.foot'))
  return lines.join('\n')
}
