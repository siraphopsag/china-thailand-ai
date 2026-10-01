import { describe, expect, it } from 'vitest'
import { classify, normalizeText, observe, renderObserved, sha256, type Fetcher } from './watch'
import { buildReview, renderReviews, reviewProblems } from './review'
import type { LegalEntry, Observation } from './types'

const entry: LegalEntry = { id: 'cn-labor', country: 'CN', area: 'employment', agencyUrl: 'https://a.example/', textUrl: 'https://law.example.gov.cn/x', watch: true }
const WORDS = 'Article one of the law states the general rule for written labour contracts and their minimum content. '.repeat(5)
const page = (body: string, head = '') => `<html><head>${head}<style>.x{color:red}</style><script>var t=${Math.random()}</script></head><body><!-- ${Math.random()} --><div>${body}</div></body></html>`
const ok = (body: string, status = 200): Fetcher => async () => ({ status, text: async () => body })
const NOW = new Date('2026-10-01T00:00:00Z')

describe('change monitor', () => {
  it('ignores markup, scripts, styles and comments: only visible words count', () => {
    expect(sha256(normalizeText(page(WORDS)))).toBe(sha256(normalizeText(page(WORDS, '<meta name="x" content="1">'))))
    expect(normalizeText('<p>a&nbsp;&nbsp;b</p>\n\n<p>c &amp; d</p>')).toBe('a b c & d')
  })
  it('records a hash for a readable page, and a different hash when the words change', async () => {
    const a = await observe(entry, undefined, ok(page(WORDS)), NOW)
    const b = await observe(entry, a, ok(page(WORDS + ' A new paragraph was added to the law.')), NOW)
    expect(a.ok).toBe(true); expect(a.hash).toMatch(/^[0-9a-f]{64}$/); expect(b.hash).not.toBe(a.hash)
    expect(classify(entry, undefined, a)).toBe('new'); expect(classify(entry, a, a)).toBe('same'); expect(classify(entry, a, b)).toBe('changed')
  })
  it('a failed fetch never erases or invents a hash (HTTP error, network error, timeout, JS shell)', async () => {
    const prev: Observation = { at: '2026-09-01T00:00:00Z', ok: true, hash: 'f'.repeat(64), bytes: 500 }
    const cases: Fetcher[] = [ok('x', 503), async () => { throw new Error('ECONNRESET') }, ok('<html><body><div id="app"></div></body></html>'), ok('Access denied')]
    for (const f of cases) { const o = await observe(entry, prev, f, NOW); expect(o.ok).toBe(false); expect(o.hash).toBe(prev.hash); expect(classify(entry, prev, o)).toBe('failed') }
    expect((await observe(entry, undefined, ok('x', 404), NOW)).hash).toBeUndefined()
  })
  it('times out a hanging server', async () => {
    const hang: Fetcher = (_u, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))))
    const o = await observe(entry, undefined, hang, NOW, 20)
    expect(o.ok).toBe(false); expect(o.error).toMatch(/abort/)
  })
  it('entries without a link, or with watch off, are "not-monitored" — never silently reported as unchanged', () => {
    expect(classify({ ...entry, textUrl: undefined }, undefined, undefined)).toBe('not-monitored')
    expect(classify({ ...entry, watch: false }, undefined, undefined)).toBe('not-monitored')
  })
  it('writes observed.ts deterministically (sorted keys, empty when nothing is monitored)', () => {
    const o = (h: string): Observation => ({ at: NOW.toISOString(), ok: true, hash: h })
    const src = renderObserved({ b: o('2'), a: o('1') })
    expect(src.indexOf('"a"')).toBeLessThan(src.indexOf('"b"')); expect(src).toBe(renderObserved({ a: o('1'), b: o('2') }))
    expect(renderObserved({})).toContain('= {}')
  })
})

describe('human review recording', () => {
  const obs: Observation = { at: NOW.toISOString(), ok: true, hash: 'e'.repeat(64) }
  const input = { reviewer: 'Somchai Jaidee, labour lawyer' }
  it('refuses to record a review without everything it must be tied to', () => {
    expect(reviewProblems(entry, input, obs)).toEqual([])
    expect(reviewProblems(undefined, input, obs)).toEqual(['unknown record id'])
    expect(reviewProblems({ ...entry, gap: true }, input, obs).join()).toMatch(/coverage gap/)
    expect(reviewProblems({ ...entry, textUrl: undefined }, input, obs).join()).toMatch(/textUrl/)
    expect(reviewProblems({ ...entry, watch: false }, input, obs).join()).toMatch(/watch: true/)
    expect(reviewProblems(entry, input, undefined).join()).toMatch(/legal:watch/)
    expect(reviewProblems(entry, { reviewer: 'claude' }, obs).join()).toMatch(/--by/)
    expect(reviewProblems(entry, { ...input, effectiveDate: '1 Jan 2008' }, obs).join()).toMatch(/YYYY-MM-DD/)
  })
  it('binds the sign-off to the summary text and the version of the official text', () => {
    const r = buildReview(entry, { ...input, provisions: ['Art. 10'], effectiveDate: '2008-01-01' }, obs, 'abc123abc123ab', '2026-10-01')
    expect(r).toMatchObject({ id: 'cn-labor', reviewer: input.reviewer, reviewedAt: '2026-10-01', contentHash: 'abc123abc123ab', sourceHash: obs.hash, provisions: ['Art. 10'], effectiveDate: '2008-01-01' })
  })
  it('renders reviews.ts without changing other reviews', () => {
    expect(renderReviews([])).toContain('= []')
    const a = buildReview(entry, input, obs, 'h1h1h1h1h1h1h1', '2026-10-01')
    expect(renderReviews([{ ...a, id: 'z' }, a])).toMatch(/"id":"cn-labor"[\s\S]*"id":"z"/)
  })
})
