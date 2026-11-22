// Anti-spam before a post goes out (v2 model, owner Nov 2026: "stricter pre-post checks"). Four rules, on top of the existing
// fee/deposit wording warning and the minimum-wage rule:
//   1. the same post again — the text is almost the same as one of my posts, or as a post already on the board (copied scam ads);
//   2. too many new posts in a day from one employer;
//   3. words of the scam compounds and illegal gambling that recruit people across the border — the post cannot go out;
//      "easy money, no experience" lures — a warning;
//   4. reported by several people → hidden until the C.A.L.L. team checks (reports.ts HIDE_AFTER, database trigger 0005).
// Pure: no React, no storage.
import type { Post } from './types'
import type { PostInput, Problem } from './logic'
import { HIDE_AFTER } from './reports'

/** new posts one employer may publish in 24 hours (edits and renewals do not count) */
export const POSTS_PER_DAY = 5
/** two texts at or above this share of common letter-triples count as the same post */
export const DUP_SIMILARITY = 0.8
export { HIDE_AFTER }

/** work that is illegal where it is offered or typical of the scam compounds (Thailand and mainland China ban casinos and online
 *  gambling; "pig-butchering" and phone-fraud jobs) — Thai, Chinese and English */
const SCAM_WORK = /คาสิโน|บาคาร่า|พนันออนไลน์|เว็บพนัน|สล็อตออนไลน์|แก๊งคอลเซ็นเตอร์|หลอกลงทุน|博彩|菠菜|赌场|网赌|杀猪盘|电诈|跑分|\bcasino\b|\bbaccarat\b|\bonline gambling\b|\bpig[- ]butcher|\bscam compound/i
/** the lure of fake job ads: big money for no experience, paid daily, "just chat online" */
const LURE = /ไม่ต้องมีประสบการณ์.{0,20}(รายได้|เงินเดือน).{0,10}(สูง|ดี|หลักแสน)|รายได้หลักแสน|งานง่าย.{0,10}(ได้|รายได้).{0,6}(เงิน|ดี)|ทำงานแค่แชท|รับเงินรายวัน.{0,10}(สูง|หลักพัน)|高薪轻松|轻松赚钱|日结高薪|无需经验.{0,6}高薪|月入[过上]万|\beasy money\b|\bno experience\b.{0,30}\bhigh (pay|salary|income)\b|\bjust chat(ting)? online\b/i

/** letters and digits only, lower case: spacing and punctuation do not make a copy "different" */
const norm = (s: string) => s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
const triples = (s: string) => { const n = norm(s), out = new Set<string>(); for (let i = 0; i + 3 <= n.length; i++) out.add(n.slice(i, i + 3)); return out }
/** share of letter-triples two texts have in common (Jaccard, 0–1) */
export function similarity(a: string, b: string): number {
  const x = triples(a), y = triples(b)
  if (!x.size || !y.size) return norm(a) === norm(b) ? 1 : 0
  let common = 0; x.forEach((t) => { if (y.has(t)) common++ })
  return common / (x.size + y.size - common)
}
const textOf = (p: Pick<PostInput, 'position' | 'details'>) => `${p.position} ${p.details}`

export type SpamError = Extract<Problem, 'dupPost' | 'dailyLimit' | 'scamWords'>
export interface SpamCheck { errors: SpamError[]; lure: boolean; dupOf: string | null }
/**
 * `mine` = my posts (a post being edited is left out by its id), `board` = other posts people can see. A copy only counts when the
 * details are long enough to be distinctive (short texts look alike by chance).
 */
export function spamCheck(input: PostInput, at: string, mine: Pick<Post, 'id' | 'position' | 'details' | 'createdAt'>[], board: Pick<Post, 'id' | 'position' | 'details'>[], editingId?: string): SpamCheck {
  const errors: SpamError[] = []
  const words = [input.company, input.position, input.details].join(' ')
  if (SCAM_WORK.test(words)) errors.push('scamWords')
  const text = textOf(input)
  const others = [...mine, ...board].filter((p) => p.id !== editingId)
  const dup = norm(text).length >= 40 ? others.find((p) => similarity(text, textOf(p)) >= DUP_SIMILARITY) : undefined
  if (dup) errors.push('dupPost')
  const now = Date.parse(at)
  if (!editingId && mine.filter((p) => now - Date.parse(p.createdAt) < 86_400_000 && Date.parse(p.createdAt) <= now).length >= POSTS_PER_DAY) errors.push('dailyLimit')
  return { errors, lure: LURE.test(words), dupOf: dup?.id ?? null }
}
