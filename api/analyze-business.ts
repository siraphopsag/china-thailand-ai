// Vercel serverless function (Node runtime). Secrets, if any, are read from server-side env only.
import { orchestrate } from '../src/services/engines.js'
import { tr, isLang, type Lang } from '../src/i18n/core.js'
import { cleanProfile, isObj } from '../src/profileSchema.js'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } })

// Best-effort per-instance rate limit (serverless instances do not share memory). Use a shared store (e.g. KV) before connecting a paid LLM.
const LIMIT = 20, WINDOW_MS = 60_000
const hits = new Map<string, { n: number; reset: number }>()
function retryAfter(ip: string, now = Date.now()): number {
  if (hits.size > 500) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
  const h = hits.get(ip)
  if (!h || h.reset < now) { hits.set(ip, { n: 1, reset: now + WINDOW_MS }); return 0 }
  h.n++
  return h.n > LIMIT ? Math.ceil((h.reset - now) / 1000) : 0
}
export const __resetRateLimit = () => hits.clear() // for tests

export async function POST(request: Request) {
  let lang: Lang = 'th'
  try {
    // Same-origin only: reject browser requests coming from another site.
    const origin = request.headers.get('origin'), host = request.headers.get('host')
    if (origin && host && new URL(origin).host !== host) return json({ error: tr('err.origin', undefined, lang) }, 403)
    const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
    const wait = retryAfter(ip)
    if (wait) return json({ error: tr('err.rate', undefined, lang) }, 429, { 'Retry-After': String(wait) })

    const raw = await request.text()
    if (raw.length > 20_000) return json({ error: tr('err.qLong', undefined, lang) }, 413)
    let body: unknown
    try { body = JSON.parse(raw) } catch { return json({ error: tr('err.badRequest', undefined, lang) }, 400) }
    if (!isObj(body)) return json({ error: tr('err.badRequest', undefined, lang) }, 400)
    if (isLang(body.lang)) lang = body.lang
    const question = body.question
    if (typeof question !== 'string' || question.trim().length < 4 || question.length > 500) return json({ error: tr('err.qShort', undefined, lang) }, 400)
    let profile = null
    if (body.profile !== null && body.profile !== undefined) {
      profile = cleanProfile(body.profile)
      if (!profile) return json({ error: tr('err.badProfile', undefined, lang) }, 400)
    }
    // Hook for a real LLM: call the provider here using process.env.AI_API_KEY (server-side only), passing `lang` and ONLY the text of
    // human-verified records as context. The draft MUST then go through guardResponse(draft, liveLegal, { requireSources: true, lang }) —
    // it attaches server-built citations and withholds any answer with unknown sources or unsupported figures, articles or penalties.
    return json(orchestrate(question, profile, lang))
  } catch (e) {
    console.error('analyze-business failed', e) // technical detail stays in server logs
    return json({ error: tr('err.generic', undefined, lang) }, 500)
  }
}
