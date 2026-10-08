// Vercel serverless function (Node runtime): the real AI (owner, Oct 2026 — "A + B"). The Anthropic key lives ONLY in the server's
// environment (ANTHROPIC_API_KEY, set by the owner in Vercel); the browser never sees it. Only signed-in people may use it, and each
// use is counted in the database first (ai_take, SQL 0009: per person per day, admins unlimited, and a cap for the whole site).
// Prompts, limits and cleaning are in src/ai/spec.ts (tested). Post text and questions are not logged.
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import {
  AI_LANGS, DEFAULT_MODEL, FLAG_CATEGORIES, MAX_QUESTION, SEVERITIES, askSystem, askUser, checkSystem, checkUser, cleanAnswer, cleanCheck, postForAi,
  type AiKind, type AiLang, type AiReason,
} from '../src/ai/spec.js'
import type { PostInput } from '../src/domain/match/logic.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
const fail = (reason: AiReason, status: number) => json({ ok: false, reason }, status)
const env = (k: string) => (process.env[k] ?? '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim()

const CheckSchema = z.object({
  verdict: z.enum(['ok', 'review', 'high_risk']),
  summary: z.string(),
  flags: z.array(z.object({
    category: z.enum(FLAG_CATEGORIES as [string, ...string[]]), severity: z.enum(SEVERITIES as [string, ...string[]]),
    quote: z.string(), explanation: z.string(), suggestion: z.string(), lawIds: z.array(z.string()),
  })),
})
const AskSchema = z.object({ answer: z.string(), lawIds: z.array(z.string()), grounding: z.enum(['grounded', 'partial', 'out_of_scope']), nextStep: z.string() })

/** count this use in the database as the signed-in person (their own token): false = not signed in; otherwise the verdict */
async function take(token: string, kind: AiKind): Promise<{ ok: boolean; reason?: 'limit' | 'site'; left: number | null } | false> {
  const url = env('VITE_SUPABASE_URL').replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), key = env('VITE_SUPABASE_ANON_KEY').replace(/\s+/g, '')
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) || !key) throw new Error('supabase env')
  const r = await fetch(`${url}/rest/v1/rpc/ai_take`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_kind: kind }),
  })
  if (r.status === 401 || r.status === 403) return false
  if (!r.ok) throw new Error(`ai_take ${r.status}`)
  const v = (await r.json()) as { ok?: boolean; reason?: string; left?: number | null }
  if (v.reason === 'signin') return false
  return { ok: v.ok === true, reason: v.reason === 'site' ? 'site' : v.reason === 'limit' ? 'limit' : undefined, left: typeof v.left === 'number' ? v.left : null }
}

export async function POST(request: Request) {
  try {
    // same-origin only
    const origin = request.headers.get('origin'), host = request.headers.get('host')
    if (origin && host && new URL(origin).host !== host) return fail('bad', 403)
    const raw = await request.text()
    if (raw.length > 20_000) return fail('bad', 413)
    let body: Record<string, unknown>
    try { body = JSON.parse(raw) } catch { return fail('bad', 400) }
    const kind = body?.kind === 'check' || body?.kind === 'ask' ? (body.kind as AiKind) : null
    const lang: AiLang = AI_LANGS.includes(body?.lang as AiLang) ? (body.lang as AiLang) : 'th'
    if (!kind) return fail('bad', 400)
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (kind === 'ask' && (question.length < 4 || question.length > MAX_QUESTION)) return fail('bad', 400)
    const post = kind === 'check' && body.post && typeof body.post === 'object' ? postForAi(body.post as PostInput) : null
    if (kind === 'check' && (!post || typeof post.position !== 'string')) return fail('bad', 400)

    const apiKey = env('ANTHROPIC_API_KEY')
    if (!apiKey) return fail('off', 503)
    const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return fail('signin', 401)
    const t = await take(token, kind)
    if (!t) return fail('signin', 401)
    if (!t.ok) return fail(t.reason ?? 'limit', 429)

    const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 })
    const model = env('AI_MODEL') || DEFAULT_MODEL
    const system = [{ type: 'text' as const, text: kind === 'check' ? checkSystem(lang) : askSystem(lang), cache_control: { type: 'ephemeral' as const } }]
    const content = kind === 'check' ? checkUser(post!) : askUser(question)
    const res = kind === 'check'
      ? await client.messages.parse({ model, max_tokens: 8000, system, output_config: { effort: 'medium', format: zodOutputFormat(CheckSchema) }, messages: [{ role: 'user', content }] })
      : await client.messages.parse({ model, max_tokens: 6000, system, output_config: { effort: 'low', format: zodOutputFormat(AskSchema) }, messages: [{ role: 'user', content }] })
    if (res.stop_reason === 'refusal') return fail('refused', 200)
    if (!res.parsed_output) return fail('bad', 502)
    const result = kind === 'check' ? cleanCheck(res.parsed_output) : cleanAnswer(res.parsed_output)
    return json({ ok: true, result, left: t.left })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503))) return fail('busy', 503)
    if (e instanceof Anthropic.APIConnectionError) return fail('busy', 503)
    console.error('ai failed', e instanceof Error ? e.name + ': ' + e.message : 'unknown') // no user text in the logs
    return fail('error', 500)
  }
}
