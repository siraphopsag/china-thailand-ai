// The browser side of the real AI: sends the signed-in person's token to /api/ai (never an AI key — that stays on the server).
// No server (local dev, demo mode) or anything unexpected → { ok: false }, and the page falls back or explains.
import { getClient } from '../auth'
import type { PostInput } from '../domain/match/logic'
import type { AiAnswer, AiCheck, AiLang, AiReason, AiResponse } from './spec'

const REASONS: AiReason[] = ['off', 'signin', 'limit', 'site', 'busy', 'refused', 'bad', 'error']

async function call<T>(body: Record<string, unknown>): Promise<AiResponse<T>> {
  try {
    const { data } = await (await getClient()).auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, reason: 'signin' }
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 40_000)
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: ctl.signal })
      .finally(() => clearTimeout(timer))
    if (!(r.headers.get('content-type') ?? '').includes('application/json')) return { ok: false, reason: 'off' } // no function here (e.g. local dev)
    const v = (await r.json()) as { ok?: boolean; result?: T; left?: number | null; reason?: string }
    if (v.ok === true && v.result) return { ok: true, result: v.result, left: typeof v.left === 'number' ? v.left : null }
    return { ok: false, reason: REASONS.includes(v.reason as AiReason) ? (v.reason as AiReason) : 'error' }
  } catch {
    return { ok: false, reason: 'busy' }
  }
}
export const aiCheck = (post: PostInput, lang: AiLang) => call<AiCheck>({ kind: 'check', lang, post })
export const aiAsk = (question: string, lang: AiLang) => call<AiAnswer>({ kind: 'ask', lang, question })
