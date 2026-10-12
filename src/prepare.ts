// The "Prepare" hub (owner, Oct 2026: people skipped it, it looked like a filing cabinet): which of its 4 tools this visitor has
// opened (a checklist kept in this browser only), and a question typed on the hub carried to the AI page. The question goes
// through sessionStorage, never the address, so it does not end up in the browser history or server logs.
export const PREP = ['ask', 'safety', 'language', 'sources'] as const
export type PrepKey = (typeof PREP)[number]
const SEEN_KEY = 'call.prepare.seen', ASK_KEY = 'call.ask.prefill'
const isPrep = (v: unknown): v is PrepKey => typeof v === 'string' && (PREP as readonly string[]).includes(v)

export function prepSeen(): Set<PrepKey> {
  try { const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]'); return new Set(Array.isArray(v) ? v.filter(isPrep) : []) } catch { return new Set() }
}
/** called on every route change: opening one of the 4 pages ticks it off */
export function markPrepSeen(route: string) {
  if (!isPrep(route)) return
  try { const s = prepSeen(); if (s.has(route)) return; s.add(route); localStorage.setItem(SEEN_KEY, JSON.stringify([...s])) } catch { /* storage blocked */ }
}
export function setAskPrefill(q: string) { try { sessionStorage.setItem(ASK_KEY, q.slice(0, 600)) } catch { /* storage blocked */ } }
/** read once: the AI page starts with this question in its box (not sent — the visitor presses send) */
export function takeAskPrefill(): string {
  try { const q = sessionStorage.getItem(ASK_KEY) ?? ''; sessionStorage.removeItem(ASK_KEY); return q } catch { return '' }
}
/** the term shown as "word of the day": the same all day, a different one tomorrow */
export const dayPick = (n: number, now: number) => Math.floor((now - new Date(now).getTimezoneOffset() * 60_000) / 86_400_000) % n
