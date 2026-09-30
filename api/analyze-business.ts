// Vercel serverless function (Node runtime). Secrets, if any, are read from server-side env only.
import { orchestrate } from '../src/services/engines.js'
import { tr, isLang, type Lang } from '../src/i18n/core.js'
import type { Profile } from '../src/types/index.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  let lang: Lang = 'th'
  try {
    const raw = await request.text()
    if (raw.length > 20_000) return json({ error: tr('err.qLong', undefined, lang) }, 413)
    const body = JSON.parse(raw) as { question?: unknown; profile?: Profile | null; lang?: unknown }
    if (isLang(body.lang)) lang = body.lang
    const { question, profile } = body
    if (typeof question !== 'string' || question.trim().length < 4 || question.length > 500) return json({ error: tr('err.qShort', undefined, lang) }, 400)
    const p = profile && typeof profile === 'object' && Array.isArray(profile.holders) ? profile : null
    // Hook for a real LLM: call the provider here using process.env.AI_API_KEY (server-side only), passing `lang`,
    // then run the result through the same safety/verification rules before returning.
    return json(orchestrate(question, p, lang))
  } catch (e) {
    console.error('analyze-business failed', e) // technical detail stays in server logs
    return json({ error: tr('err.generic', undefined, lang) }, 500)
  }
}
