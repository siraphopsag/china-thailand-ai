// Vercel serverless function (Node runtime): the real AI (owner, Oct 2026 — "A + B"). The AI key lives ONLY in the server's
// environment, set by the owner in Vercel; the browser never sees it.
//  · GEMINI_API_KEY — Google AI Studio's free tier (owner: no paid services; a key made without billing can never be charged —
//    over the free quota Google just says no and the page falls back to the basic check). Model: GEMINI_MODEL or the default list.
//  · ANTHROPIC_API_KEY — Claude, used instead when set (paid; kept for later). Model: AI_MODEL or claude-haiku-5-5.
// Only signed-in people may use it, and each use is counted in the database first (ai_take, SQL 0009). Prompts, limits and cleaning
// are in src/ai/spec.ts (tested). Post text and questions are not logged.
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import {
  AI_LANGS, DEFAULT_MODEL, FLAG_CATEGORIES, GEMINI_MODELS, MAX_QUESTION, SEVERITIES, askSystem, askUser, checkSystem, checkUser, cleanAnswer, cleanCheck, cleanHistory, postForAi,
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
  // owner, Oct 2026: the title and details in the three languages, and whether the job is closed to foreigners in Thailand
  translations: z.object({ th: z.object({ position: z.string(), details: z.string() }), zh: z.object({ position: z.string(), details: z.string() }), en: z.object({ position: z.string(), details: z.string() }) }),
  closedToForeigners: z.boolean(),
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

/** detail = what each attempt got (model and status, no user text) — shown to administrators only, to find problems */
type Outcome = ({ raw: unknown } | { reason: AiReason; status: number }) & { detail?: string }
const BLOCKED = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']

/** Gemini (free tier): JSON mode, the shape is described in the system prompt; cleanCheck / cleanAnswer then keep only valid parts */
async function gemini(apiKey: string, system: string, content: string): Promise<Outcome> {
  const models = [...new Set([env('GEMINI_MODEL'), ...GEMINI_MODELS].filter(Boolean))]
  const tried: string[] = [], started = Date.now()
  let busy = false
  for (const model of models) {
    const budget = 50_000 - (Date.now() - started) // the function may run 60 s (vercel.json)
    if (budget < 8_000) { tried.push('time'); break }
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), Math.min(budget, 30_000))
    let r: Response
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', signal: ctl.signal, headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: content }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
      })
    } catch (e) { tried.push(`${model}:${e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network'}`); busy = true; continue } finally { clearTimeout(timer) }
    if (!r.ok) {
      // each model has its own free quota: a model that is not offered (404), out of quota (429) or busy (5xx) → try the next one
      const g = await r.json().catch(() => null) as { error?: { status?: string; message?: string } } | null
      tried.push(`${model}:${r.status}${g?.error?.status ? ' ' + g.error.status : ''}${g?.error?.message ? ' — ' + g.error.message.slice(0, 160) : ''}`)
      if (r.status === 404 || r.status === 429 || r.status >= 500) { busy ||= r.status !== 404; continue }
      console.error('gemini', tried[tried.length - 1]); return { reason: 'error', status: 500, detail: tried.join(' | ') }
    }
    const v = (await r.json()) as { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] }
    const c = v.candidates?.[0]
    if (v.promptFeedback?.blockReason || BLOCKED.includes(c?.finishReason ?? '')) return { reason: 'refused', status: 200, detail: `${model}:${v.promptFeedback?.blockReason ?? c?.finishReason}` }
    const text = (c?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('').trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
    try { const raw: unknown = JSON.parse(text); if (raw && typeof raw === 'object') return { raw, detail: model } } catch { /* below */ }
    return { reason: 'bad', status: 502, detail: `${model}:not-json` }
  }
  console.error('gemini: no answer', tried.join(' | '))
  return busy ? { reason: 'busy', status: 503, detail: tried.join(' | ') } : { reason: 'error', status: 500, detail: tried.join(' | ') }
}

/** Claude (paid, when ANTHROPIC_API_KEY is set): structured output */
async function claude(apiKey: string, kind: AiKind, system: string, content: string): Promise<Outcome> {
  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 })
  const model = env('AI_MODEL') || DEFAULT_MODEL
  const sys = [{ type: 'text' as const, text: system, cache_control: { type: 'ephemeral' as const } }]
  try {
    const res = kind === 'check'
      ? await client.messages.parse({ model, max_tokens: 8000, system: sys, output_config: { effort: 'medium', format: zodOutputFormat(CheckSchema) }, messages: [{ role: 'user', content }] })
      : await client.messages.parse({ model, max_tokens: 6000, system: sys, output_config: { effort: 'low', format: zodOutputFormat(AskSchema) }, messages: [{ role: 'user', content }] })
    if (res.stop_reason === 'refusal') return { reason: 'refused', status: 200 }
    return res.parsed_output ? { raw: res.parsed_output } : { reason: 'bad', status: 502 }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIConnectionError || (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503))) return { reason: 'busy', status: 503 }
    throw e
  }
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

    const claudeKey = env('ANTHROPIC_API_KEY'), geminiKey = env('GEMINI_API_KEY')
    if (!claudeKey && !geminiKey) return fail('off', 503)
    const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return fail('signin', 401)
    const t = await take(token, kind)
    if (!t) return fail('signin', 401)
    if (!t.ok) return fail(t.reason ?? 'limit', 429)

    const system = kind === 'check' ? checkSystem(lang) : askSystem(lang)
    const content = kind === 'check' ? checkUser(post!) : askUser(question, cleanHistory(body.history))
    const out = claudeKey ? await claude(claudeKey, kind, system, content) : await gemini(geminiKey, system, content)
    const admin = t.left === null // administrators see what went wrong (model + status; never a key or user text)
    if ('reason' in out) return json({ ok: false, reason: out.reason, ...(admin && out.detail ? { detail: out.detail } : {}) }, out.status)
    const result = kind === 'check' ? cleanCheck(out.raw) : cleanAnswer(out.raw)
    if (kind === 'ask' && !(result as ReturnType<typeof cleanAnswer>).answer) return fail('bad', 502)
    return json({ ok: true, result, left: t.left, ...(admin && out.detail ? { detail: out.detail } : {}) })
  } catch (e) {
    console.error('ai failed', e instanceof Error ? e.name + ': ' + e.message : 'unknown') // no user text in the logs
    return fail('error', 500)
  }
}
