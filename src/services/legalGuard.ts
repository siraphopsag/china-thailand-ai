import type { AIResponse, Grounding } from '../types/index.js'
import type { Citation } from '../data/legal/types.js'
import { liveLegal, localText, type LegalView } from '../data/legal/trust.js'
import { tr, type Lang } from '../i18n/core.js'

/**
 * Hallucination guard for legal answers. Two jobs:
 *  1. decide when the app must NOT answer (questions asking for exact penalties, figures, periods, article numbers);
 *  2. post-check any answer (template today, an LLM later): sources must exist, and no amount / article number /
 *     penalty / deadline may appear unless it is literally contained in a human-verified source the answer cites.
 * Both are pattern heuristics, deliberately conservative: a false alarm costs a generic reply, a miss would cost a wrong legal claim.
 */

/** Questions that ask for an exact legal detail. The app has no human-verified text to answer these from. */
const SPECIFIC: RegExp[] = [
  /\b(penalt(?:y|ies)|fines?|imprison\w*|jail|sentenc\w*|severance|notice period|minimum (?:wage|salary|capital)|overtime (?:rate|pay)|probation\w* (?:period|length)|how (?:much|many|long)|what percent\w*|which (?:article|section)|(?:article|section)\s*\d+)\b/i,
  /(โทษ|ค่าปรับ|จำคุก|กี่(?:วัน|เดือน|ปี|บาท|เปอร์เซ็นต์|%)|เท่าไร|เท่าใด|ค่าจ้างขั้นต่ำ|ค่าชดเชย|ค่าธรรมเนียม|มาตรา(?:ไหน|ใด|\s*\d+))/,
  /(罚款|罚金|处罚|判刑|有期徒刑|多少|几年|几个月|几天|最低工资|经济补偿|赔偿金|试用期.{0,4}(?:多久|多长)|第\s*\d+\s*条|费用|比例是)/,
]
export const asksSpecificDetail = (q: string) => SPECIFIC.some((r) => r.test(q))

/** Things an answer must not state unless a verified source literally contains them. */
const CLAIMS: RegExp[] = [
  /(?:มาตรา|section|sec\.|article|art\.)\s*\d+[\w/-]*/gi,
  /第\s*[0-9０-９一二三四五六七八九十百零]+\s*条/g,
  /\d[\d,.]*\s*(?:บาท|baht|thb|฿|元|人民币|rmb|cny|yuan|usd|ดอลลาร์)/gi,
  /(?:฿|¥|\$)\s*\d[\d,.]*/g,
  /(?:imprisonment|prison|jail|fines? of|penalt(?:y|ies) of|จำคุก|ค่าปรับ|โทษปรับ|罚款|罚金|有期徒刑|拘留)/gi,
  /(?:within|at least|at most|ภายใน|ไม่เกิน|ไม่น้อยกว่า|不超过|不少于|至少)\s*\d+/gi,
]
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
/** Claims found in `text` that do not literally appear in `allowed` (the text of the verified sources the answer cites). */
export function findUnsupportedClaims(text: string, allowed: string): string[] {
  const ok = norm(allowed)
  const out = new Set<string>()
  for (const re of CLAIMS) for (const m of text.match(re) ?? []) if (!ok.includes(norm(m))) out.add(m.trim())
  return [...out]
}

export function groundingOf(cs: Citation[]): Grounding | undefined {
  if (!cs.length) return undefined
  const v = cs.filter((c) => c.trust === 'VERIFIED').length
  return v === cs.length ? 'VERIFIED' : v ? 'PARTIAL' : 'UNVERIFIED'
}

/** The "we cannot answer this from verified sources" reply. Never contains figures, penalties or articles. */
export function insufficientResponse(modules: string[], citations: Citation[], why: 'detail' | 'guard', guarded?: string[]): AIResponse {
  return {
    kind: 'insufficient', modules: modules.length ? modules : ['Legal Analysis AI'], risk: 'NEEDS_REVIEW',
    answer: tr(why === 'guard' ? 'orch.guard.a' : 'orch.insuf.a'), reason: tr(why === 'guard' ? 'orch.guard.r' : 'orch.insuf.r'), next: tr('orch.insuf.n'),
    sources: citations.map((c) => c.id), citations, grounding: 'NONE', ...(guarded?.length ? { guarded } : {}),
  }
}

/** Answer a specific-detail question only by quoting a human-verified record verbatim; otherwise refuse to guess. */
export function answerSpecific(ids: string[], modules: string[], legal: LegalView = liveLegal): AIResponse {
  const cites = ids.map((id) => legal.cite(id)).filter((c): c is Citation => !!c)
  const verified = cites.filter((c) => c.trust === 'VERIFIED' && localText(c.id, 'rule'))
  if (!verified.length) return insufficientResponse(modules, cites, 'detail')
  const v = verified[0]
  return { modules: modules.length ? modules : ['Legal Analysis AI'], risk: 'NEEDS_REVIEW', answer: localText(v.id, 'rule'), reason: tr('orch.quote.r'), next: tr('orch.insuf.n'), sources: [v.id], citations: [v], grounding: 'VERIFIED' }
}

/**
 * Final gate for every answer. Attaches server-built citations and the grounding level; replaces the answer with the
 * safe reply when it cites unknown sources (with requireSources) or states unsupported figures/articles/penalties.
 * A future LLM must be wired through this function (see api/analyze-business.ts).
 */
export function guardResponse(resp: AIResponse, legal: LegalView = liveLegal, opts: { requireSources?: boolean; lang?: Lang } = {}): AIResponse {
  const known = resp.sources.filter((id) => legal.has(id))
  const unknown = resp.sources.filter((id) => !legal.has(id))
  const citations = known.map((id) => legal.cite(id, opts.lang)).filter((c): c is Citation => !!c)
  const flags = unknown.map((id) => `unknown-source:${id}`)
  if (resp.kind === 'insufficient') return { ...resp, sources: known, citations, grounding: 'NONE', ...(flags.length ? { guarded: [...(resp.guarded ?? []), ...flags] } : {}) }
  if (opts.requireSources && !citations.length) return insufficientResponse(resp.modules, [], 'guard', [...flags, 'no-source'])
  const allowed = citations.filter((c) => c.trust === 'VERIFIED').map((c) => legal.text(c.id)).join('\n')
  const bad = findUnsupportedClaims([resp.answer, resp.reason, resp.next].join('\n'), allowed)
  if (bad.length) return insufficientResponse(resp.modules, citations, 'guard', [...flags, ...bad.map((b) => `unsupported-claim:${b}`)])
  return { ...resp, sources: known, citations, grounding: groundingOf(citations), ...(flags.length ? { guarded: flags } : {}) }
}
