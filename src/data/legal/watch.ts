import { createHash } from 'node:crypto'
import type { LegalEntry, Observation } from './types.js'

/** Node-only helpers for scripts/legal-watch.ts (kept out of the browser bundle: nothing in src/ imports this file except tests and scripts). */

/** Reduce an HTML/text page to its visible words so layout or script changes do not look like a change in the law. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ').trim()
}
export const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

export type Fetcher = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>

/** Fetch one official text and record what was seen. A failed fetch keeps the previous hash (it never invents or clears one). */
export async function observe(entry: LegalEntry, prev: Observation | undefined, fetcher: Fetcher, now = new Date(), timeoutMs = 20_000): Promise<Observation> {
  if (!entry.textUrl) return { at: now.toISOString(), ok: false, error: 'no textUrl' }
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetcher(entry.textUrl, { signal: ctl.signal, headers: { 'User-Agent': 'call-legal-watch/1.0 (C.A.L.L. - change detection for legal review)', Accept: 'text/html,text/plain,*/*' } })
    if (res.status < 200 || res.status >= 300) return { ...keep(prev), at: prev?.at ?? now.toISOString(), ok: false, status: res.status, error: `HTTP ${res.status}` }
    const text = normalizeText(await res.text())
    // A near-empty page (JavaScript shell, error page, bot wall) cannot prove anything about the law: do not hash it.
    if (text.length < 200) return { ...keep(prev), at: prev?.at ?? now.toISOString(), ok: false, status: res.status, error: 'page has almost no readable text (JS shell or blocked?)' }
    return { at: now.toISOString(), ok: true, status: res.status, hash: sha256(text), bytes: text.length }
  } catch (e) {
    return { ...keep(prev), at: prev?.at ?? now.toISOString(), ok: false, error: e instanceof Error ? e.message : String(e) }
  } finally { clearTimeout(timer) }
}
const keep = (p?: Observation) => (p?.hash ? { hash: p.hash, bytes: p.bytes } : {})

export type Change = 'new' | 'same' | 'changed' | 'failed' | 'not-monitored'
export const classify = (entry: LegalEntry, prev: Observation | undefined, next: Observation | undefined): Change =>
  !entry.watch || !entry.textUrl ? 'not-monitored' : !next?.ok ? 'failed' : !prev?.hash ? 'new' : prev.hash === next.hash ? 'same' : 'changed'

/** Deterministic source of observed.ts so a daily run that finds nothing new produces no diff. */
export function renderObserved(obs: Record<string, Observation>): string {
  const keys = Object.keys(obs).sort()
  const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(obs[k])},`).join('\n')
  return `import type { Observation } from './types.js'\n\n/** Written by \`npm run legal:watch\` (GitHub Actions, daily). Do not edit by hand. */\nexport const observed: Record<string, Observation> = {${keys.length ? '\n' + body + '\n' : ''}}\n`
}
