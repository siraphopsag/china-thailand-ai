import { describe, expect, it } from 'vitest'
import { registry, getEntry } from './registry'
import { reviews } from './reviews'
import { observed } from './observed'
import { MAX_MONITOR_AGE_DAYS, MAX_REVIEW_AGE_DAYS, assess, assessWith, contentFingerprint, fingerprint, localText, makeLegalView, toVerification, trustSummary } from './trust'
import type { LegalEntry, LegalReview, Observation } from './types'

const NOW = new Date('2026-10-01T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()
const ymd = (n: number) => daysAgo(n).slice(0, 10)
const entry: LegalEntry = { id: 'cn-labor', country: 'CN', area: 'employment', agencyUrl: 'https://www.mohrss.gov.cn/', textUrl: 'https://law.example.gov.cn/labor-contract-law', watch: true }
const fp = contentFingerprint('cn-labor')
const obs: Observation = { at: daysAgo(1), ok: true, status: 200, hash: 'a'.repeat(64) }
const review: LegalReview = { id: 'cn-labor', reviewer: 'Somchai Jaidee, labour lawyer', reviewedAt: ymd(10), contentHash: fp, sourceHash: obs.hash }
const run = (o: { e?: LegalEntry | undefined; r?: Partial<LegalReview> | null; obs?: Observation | undefined; fp?: string } = {}) =>
  assessWith('e' in o ? o.e : entry, o.r === null ? undefined : { ...review, ...o.r }, 'obs' in o ? o.obs : obs, o.fp ?? fp, NOW)

describe('legal trust rule (fails closed: only a complete, current, unchanged human review is "verified")', () => {
  it('a complete review of an unchanged, monitored official text is VERIFIED', () => {
    const r = run()
    expect(r.trust).toBe('VERIFIED'); expect(r.reasons).toEqual([])
  })
  it('an unknown record is NO_RECORD and a coverage gap is GAP, even if someone attached a review to it', () => {
    expect(run({ e: undefined }).trust).toBe('NO_RECORD')
    expect(run({ e: { ...entry, gap: true } }).trust).toBe('GAP')
  })
  it('no human review means UNVERIFIED — nothing automatic can raise trust', () => {
    const r = run({ r: null })
    expect(r.trust).toBe('UNVERIFIED'); expect(r.reasons).toEqual(['no-review'])
  })
  it.each([
    ['empty reviewer', { reviewer: '' }], ['one-word reviewer', { reviewer: 'AI' }], ['date not a date', { reviewedAt: 'yesterday' }], ['impossible date', { reviewedAt: '2026-13-45' }],
    ['review dated in the future', { reviewedAt: '2027-01-01' }], ['review of another record', { id: 'th-labour' }], ['missing content hash', { contentHash: '' }],
  ])('an incomplete review (%s) is not accepted', (_n, patch) => {
    const r = run({ r: patch })
    expect(r.trust).toBe('UNVERIFIED'); expect(r.reasons).toEqual(['bad-review'])
  })
  it('a review is worthless without an official text to compare against (no link, or a non-https link)', () => {
    expect(run({ e: { ...entry, textUrl: undefined } }).reasons).toContain('no-text-url')
    expect(run({ e: { ...entry, textUrl: 'http://law.example.gov.cn/x' } }).trust).toBe('UNVERIFIED')
  })
  it('a monitored record needs a review tied to a version of the official text', () => {
    const r = run({ r: { sourceHash: undefined } })
    expect(r.trust).toBe('UNVERIFIED'); expect(r.reasons).toContain('no-source-hash')
  })
  it('editing the summary after the review turns the record CHANGED', () => {
    const r = run({ fp: fingerprint('someone edited the text') })
    expect(r.trust).toBe('CHANGED'); expect(r.reasons).toEqual(['summary-edited'])
  })
  it('a different official text than the reviewed one turns the record CHANGED', () => {
    const r = run({ obs: { ...obs, hash: 'b'.repeat(64) } })
    expect(r.trust).toBe('CHANGED'); expect(r.reasons).toEqual(['source-changed'])
    expect(run({ fp: 'x', obs: { ...obs, hash: 'b'.repeat(64) } }).reasons).toEqual(['summary-edited', 'source-changed'])
  })
  it(`a review older than ${MAX_REVIEW_AGE_DAYS} days is STALE (boundary: exactly ${MAX_REVIEW_AGE_DAYS} is still fine)`, () => {
    expect(run({ r: { reviewedAt: ymd(MAX_REVIEW_AGE_DAYS) } }).trust).toBe('VERIFIED')
    const r = run({ r: { reviewedAt: ymd(MAX_REVIEW_AGE_DAYS + 1) } })
    expect(r.trust).toBe('STALE'); expect(r.reasons).toEqual(['review-old'])
  })
  it(`a silent change monitor (nothing observed for ${MAX_MONITOR_AGE_DAYS}+ days, or never) makes a monitored record STALE`, () => {
    expect(run({ obs: { ...obs, at: daysAgo(MAX_MONITOR_AGE_DAYS + 1) } }).reasons).toEqual(['monitor-stale'])
    expect(run({ obs: undefined }).reasons).toEqual(['monitor-stale'])
    expect(run({ obs: { ...obs, at: 'not a date' } }).trust).toBe('STALE')
  })
  it('a failed fetch that kept the previous hash does not change the verdict; a change outranks staleness', () => {
    expect(run({ obs: { ...obs, ok: false, error: 'HTTP 503' } }).trust).toBe('VERIFIED')
    expect(run({ r: { reviewedAt: ymd(200) }, obs: { ...obs, hash: 'c'.repeat(64) } }).trust).toBe('CHANGED')
  })
  it('a record that is not monitored can be verified by review alone (monitoring is shown separately)', () => {
    const r = assessWith({ ...entry, watch: false }, { ...review, sourceHash: undefined }, undefined, fp, NOW)
    expect(r.trust).toBe('VERIFIED')
  })
  it('garbage in a review never throws', () => {
    expect(() => assessWith(entry, { id: 'cn-labor', reviewer: 5 as never, reviewedAt: null as never, contentHash: {} as never }, obs, fp, NOW)).not.toThrow()
  })
  it('only VERIFIED maps to the "verified" status chip', () => {
    for (const t of ['UNVERIFIED', 'STALE', 'CHANGED', 'NO_RECORD', 'GAP'] as const) expect(toVerification(t)).not.toBe('VERIFIED')
    expect(toVerification('VERIFIED')).toBe('VERIFIED')
  })
  it('fingerprints are stable and sensitive to every character of the summary', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc')); expect(fingerprint('abc')).not.toBe(fingerprint('abd'))
    expect(contentFingerprint('cn-labor')).toMatch(/^[0-9a-f]{14}$/)
  })
})

describe('registry and live data integrity', () => {
  it('ids are unique and every record with a summary has non-empty text in TH, ZH and EN; gaps have none', () => {
    const ids = registry.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of registry) for (const lang of ['th', 'zh', 'en'] as const) for (const f of ['auth', 'title', 'rule'] as const) {
      const t = localText(e.id, f, lang)
      if (e.gap) expect(t).toBe(''); else expect(t.length, `${e.id}.${f}.${lang}`).toBeGreaterThan(f === 'rule' ? 10 : 2)
    }
  })
  it('an official text link is an https deep link, never the agency home page; monitoring requires a link', () => {
    for (const e of registry) {
      expect(e.agencyUrl).toMatch(/^https?:\/\//)
      if (e.textUrl) { const u = new URL(e.textUrl); expect(u.protocol).toBe('https:'); expect(e.textUrl).not.toBe(e.agencyUrl); expect(u.pathname.length, e.id).toBeGreaterThan(1) }
      if (e.watch) expect(e.textUrl, e.id).toBeTruthy()
    }
  })
  it('every review and observation refers to a real, non-gap record', () => {
    for (const r of reviews) { const e = getEntry(r.id); expect(e, r.id).toBeTruthy(); expect(e?.gap).toBeFalsy() }
    for (const id of Object.keys(observed)) expect(getEntry(id), id).toBeTruthy()
    expect(new Set(reviews.map((r) => r.id)).size).toBe(reviews.length)
  })
  it('the live data never reports VERIFIED without a complete review on file (today: no record is reviewed, and the app says so)', () => {
    for (const e of registry) {
      const t = assess(e.id, NOW)
      if (t.trust === 'VERIFIED') { expect(t.review?.reviewer.trim().length).toBeGreaterThan(4); expect(e.textUrl).toBeTruthy() }
    }
    const s = trustSummary(NOW)
    expect(s.total).toBe(registry.length); expect(s.verified + s.unverified + s.needsReview + s.gaps).toBe(s.total)
  })
  it('the employment-contract gaps are listed by name for both countries', () => {
    const gaps = registry.filter((e) => e.gap && e.area === 'employment')
    expect(gaps.some((e) => e.country === 'TH')).toBe(true); expect(gaps.some((e) => e.country === 'CN')).toBe(true)
    for (const g of gaps) expect(g.instrument, g.id).toBeTruthy()
  })
})

describe('citations are built from the registry, never from the answer', () => {
  const view = (rs: LegalReview[], es: LegalEntry[] = [entry]) => makeLegalView(es, rs, { 'cn-labor': obs }, () => NOW)
  it('an unreviewed record exposes no provisions, effective date or reviewer — nothing written from memory', () => {
    const c = view([]).cite('cn-labor')!
    expect(c.trust).toBe('UNVERIFIED'); expect(c.provisions).toEqual([]); expect(c.effectiveDate).toBeUndefined(); expect(c.reviewedBy).toBeUndefined()
    expect(c.jurisdiction).toBe('CN'); expect(c.monitored).toBe(true)
  })
  it('a reviewed record exposes exactly what the reviewer entered', () => {
    const c = view([{ ...review, provisions: ['Art. 17'], effectiveDate: '2008-01-01' }]).cite('cn-labor')!
    expect(c.trust).toBe('VERIFIED'); expect(c.provisions).toEqual(['Art. 17']); expect(c.effectiveDate).toBe('2008-01-01'); expect(c.reviewedBy).toMatch(/Somchai/)
  })
  it('unknown ids have no citation', () => { expect(view([]).cite('made-up-law')).toBeUndefined(); expect(view([]).has('made-up-law')).toBe(false) })
})
