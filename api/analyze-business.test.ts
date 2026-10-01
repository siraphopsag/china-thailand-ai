import { beforeEach, describe, expect, it } from 'vitest'
import { POST, __resetRateLimit } from './analyze-business'

const call = (body: unknown, opts: { raw?: string; headers?: Record<string, string> } = {}) =>
  POST(new Request('http://app.example/api/analyze-business', { method: 'POST', headers: opts.headers, body: opts.raw ?? JSON.stringify(body) }))
const good = { question: 'A Thai company wants to send staff to work in China', profile: null, lang: 'en' }

describe('POST /api/analyze-business', () => {
  beforeEach(() => __resetRateLimit())

  it('answers a valid question in the requested language', async () => {
    const r = await call({ ...good, lang: 'zh', question: '泰国公司想派员工去中国工作' })
    expect(r.status).toBe(200)
    const j = await r.json()
    expect(j.answer).toMatch(/[一-鿿]/)
  })
  it('rejects malformed JSON, non-object bodies and bad questions with 400 (not 500)', async () => {
    expect((await call(null, { raw: '{bad' })).status).toBe(400)
    expect((await call(null, { raw: '"text"' })).status).toBe(400)
    expect((await call({ question: 'ab', lang: 'en' })).status).toBe(400)
    expect((await call({ question: 'a'.repeat(600) })).status).toBe(400)
  })
  it('rejects a malformed business profile with 400 and a localized message', async () => {
    const r = await call({ ...good, profile: { holders: [null], forms: 'company' } })
    expect(r.status).toBe(400)
    expect((await r.json()).error).toMatch(/profile/i)
  })
  it('accepts a valid profile', async () => {
    const h = (id: string) => ({ id, nationality: id === 'origin' ? 'TH' : 'CN', percent: 50, capital: 50, voting: 50, board: 50, economic: 50 })
    const r = await call({ ...good, question: 'check the shareholders structure', profile: { companyName: 'X', direction: 'TH_CN', businessType: 'other', forms: ['company'], holders: [h('origin'), h('partner')] } })
    expect(r.status).toBe(200)
  })
  it('rejects oversized bodies with 413', async () => { expect((await call(null, { raw: 'x'.repeat(21_000) })).status).toBe(413) })
  it('rejects cross-origin browser requests with 403', async () => {
    const r = await call(good, { headers: { origin: 'https://evil.example', host: 'app.example' } })
    expect(r.status).toBe(403)
    expect((await call(good, { headers: { origin: 'https://app.example', host: 'app.example' } })).status).toBe(200)
  })
  it('rate-limits a single client with 429 and Retry-After', async () => {
    let last: Response | undefined
    for (let i = 0; i < 25; i++) last = await call(good, { headers: { 'x-forwarded-for': '203.0.113.9' } })
    expect(last!.status).toBe(429)
    expect(Number(last!.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect((await call(good, { headers: { 'x-forwarded-for': '203.0.113.10' } })).status).toBe(200) // other clients unaffected
  })
  it('never leaks internals on an unexpected error', async () => {
    const r = await call({ ...good, profile: undefined })
    const text = await r.text()
    expect(text).not.toMatch(/at \w+|node_modules|stack/i)
  })
  it('every answer carries server-built citations with jurisdiction and trust; employment answers also name the laws with no content', async () => {
    const h = (id: string) => ({ id, nationality: id === 'origin' ? 'TH' : 'CN', percent: 50, capital: 50, voting: 50, board: 50, economic: 50 })
    const profile = { companyName: 'X', direction: 'TH_CN', businessType: 'other', forms: ['send'], holders: [h('origin'), h('partner')] }
    const j = await (await call({ ...good, profile, lang: 'en' })).json()
    expect(j.grounding).toBe('UNVERIFIED')
    expect(j.citations.length).toBeGreaterThan(0)
    for (const c of j.citations) expect(['TH', 'CN']).toContain(c.jurisdiction)
    expect(j.citations.some((c: { trust: string }) => c.trust === 'GAP')).toBe(true)
    expect(j.citations.filter((c: { trust: string }) => c.trust !== 'GAP').every((c: { trust: string }) => c.trust !== 'VERIFIED')).toBe(true)
  })
  it('asking for an exact penalty or figure gets the refusal, not a guess', async () => {
    for (const [lang, question] of [['en', 'What is the penalty for hiring without a work permit?'], ['th', 'โทษของการจ้างโดยไม่มีใบอนุญาตคืออะไร'], ['zh', '没有工作许可雇用外国人的处罚是什么']] as const) {
      const j = await (await call({ question, profile: null, lang })).json()
      expect(j.kind).toBe('insufficient'); expect(j.grounding).toBe('NONE'); expect(j.answer).not.toMatch(/[0-9]/)
    }
  })
})
