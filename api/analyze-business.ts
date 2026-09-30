// Vercel serverless function (Node runtime). Secrets, if any, are read from server-side env only.
import { orchestrate } from '../src/services/engines.js'
import type { Profile } from '../src/types/index.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
const FAIL = { error: 'ระบบไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' }

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    if (raw.length > 20_000) return json({ error: 'ข้อมูลยาวเกินไป กรุณาย่อคำถามให้สั้นลง' }, 413)
    const { question, profile } = JSON.parse(raw) as { question?: unknown; profile?: Profile | null }
    if (typeof question !== 'string' || question.trim().length < 4 || question.length > 500) return json({ error: 'กรุณาระบุคำถามให้ชัดเจน (4–500 ตัวอักษร)' }, 400)
    const p = profile && typeof profile === 'object' && Array.isArray(profile.holders) ? profile : null
    // Hook for a real LLM: call the provider here using process.env.AI_API_KEY (server-side only),
    // then run the result through the same safety/verification rules before returning.
    return json(orchestrate(question, p))
  } catch (e) {
    console.error('analyze-business failed', e) // technical detail stays in server logs
    return json(FAIL, 500)
  }
}
