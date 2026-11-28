import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { cleanExtras, hasExtras, hoursADay, areaProblem } from './domain/match/postExtras'
import { makePost, postIssues, type PostInput } from './domain/match/logic'
import { postToRow, rowToPost } from './domain/match/remote'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const at = '2026-11-28T03:00:00.000Z'
const base: PostInput = { place: { country: 'TH', province: 'TH-10' }, company: 'Sample Co', position: 'Cook', industry: 'hospitality', skills: ['culinary_arts'], minYears: 0, details: '',
  headcount: 2, employment: 'permanent', salary: null, startDate: '2026-12-10', languages: [{ lang: 'th', level: 'basic' }], education: 'none', benefits: ['housing'] }

// owner, 28 Nov 2026: more job details in folding groups, saved as posts.extras (SQL 0024)
describe('more about the job', () => {
  it('keeps only known, valid parts', () => {
    expect(cleanExtras({ hours: { from: '08:00', to: '17:00' }, days: 6, ot: 'paid', housing: 'free', room: 4, meals: 2, contract: 12, probation: 3, pay: 'monthly', area: ' Bang Na ', shuttle: true, transit: false, x: 1 }))
      .toEqual({ hours: { from: '08:00', to: '17:00' }, days: 6, ot: 'paid', housing: 'free', room: 4, meals: 2, contract: 12, probation: 3, pay: 'monthly', area: 'Bang Na', shuttle: true })
    expect(cleanExtras({ hours: { from: '25:00', to: '17:00' }, days: 8, room: 0, meals: 4, probation: 9, pay: 'yearly', area: 'call 0812345678' })).toEqual({})
    expect(cleanExtras(null)).toEqual({}); expect(cleanExtras([1])).toEqual({}); expect(hasExtras({})).toBe(false)
  })
  it('counts the hours of a day, also a night shift', () => {
    expect(hoursADay({ from: '08:00', to: '17:00' })).toBe(9); expect(hoursADay({ from: '22:00', to: '06:00' })).toBe(8)
  })
  it('refuses contact details in the area and carries the details into the post and the database row', () => {
    expect(areaProblem('LINE @abc123')).toBe('contact')
    expect(postIssues({ ...base, extras: { area: 'line id: somchai99' } }, at).map((x) => x.field)).toContain('area')
    const r = makePost({ ...base, extras: { days: 6, housing: 'paid' } }, 'p1', 'e1', at)
    expect(r.ok && r.value.extras).toEqual({ days: 6, housing: 'paid' })
    expect(postToRow({ ...base, extras: { days: 6 } })).toMatchObject({ extras: { days: 6 } })
    expect('extras' in postToRow(base)).toBe(false) // nothing new → not sent, so posting works before SQL 0024
    expect(postToRow({ ...base, extras: null })).toMatchObject({ extras: {} }) // an edit that removed them all
    const row = { ...postToRow(base), id: 'p1', employer_id: 'u', is_sample: false, created_at: at, extras: { meals: 3, junk: 1 } }
    expect(rowToPost(row as never, 'u').extras).toEqual({ meals: 3 })
  })
  it('the form folds into groups, the required ones say so, and "who can apply" comes last once the required parts are in', () => {
    const h = src('./pages/hire.tsx')
    for (const g of ['job', 'skills', 'pay', 'hours', 'live', 'contract', 'place', 'lang', 'more']) expect(h).toContain(`t('pf.g.${g}')`)
    expect(h).toContain("const ready = company.trim().length >= 2 && position.trim().length >= 2 && skills.length > 0 && !!start && langs.length > 0")
    expect(h.indexOf("t('pf.final.h')")).toBeGreaterThan(h.indexOf("t('pf.g.more')"))
    expect(src('./pages/match.tsx')).toContain('<SkillGroup key={g}') // the skills open group by group
    expect(src('../supabase/migrations/0024_post_extras.sql')).toContain('public.no_contact(extras::text)')
  })
  it('the chat covers a phone screen and the page behind does not scroll', () => {
    const c = src('./pages/chat.tsx')
    expect(c).toContain('max-md:fixed max-md:inset-0'); expect(c).toContain('max-md:overscroll-contain'); expect(c).toContain("h.style.overflow = 'hidden'")
  })
})
