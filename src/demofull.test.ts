import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { reachFor } from './domain/match/release'
import { makePost } from './domain/match/logic'
import { rowToPost, type PostRow } from './domain/match/remote'
import { samplePostInput } from './matchData'

// the demo account can try everything alone (owner, 27 Nov 2026: the judges test the live site with it)
const at = '2026-11-27T10:00:00.000Z', now = Date.parse(at)
const input = samplePostInput({ country: 'CN', province: 'CN-YN' }, 'logistics', ['warehouse_operations'], '2026-11-27')

describe('the demo account alone', () => {
  it("the simulated employer's post is a valid post that fits the pin", () => {
    const r = makePost(input, 'p1', 'employer:sim-demo', at)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.province).toBe('CN-YN'); expect(r.value.industry).toBe('logistics'); expect(r.value.salary?.currency).toBe('CNY')
  })
  it('a post open to every level is visible at once, even to a pin in another country and from an unverified employer', () => {
    const r = makePost(input, 'p1', 'employer:x', at); if (!r.ok) throw new Error('post')
    const farPin = [{ country: 'TH' as const, province: 'TH-10', industry: 'finance' as const, skills: [], at }]
    expect(reachFor({ ...r.value, verified: false }, farPin, farPin, now).visible).toBe(false) // as before: waits, and stops at level 2
    expect(reachFor({ ...r.value, verified: false, openAll: true }, farPin, farPin, now)).toMatchObject({ visible: true, opensAt: null })
  })
  it('a post made for this demo account is marked so; for anyone else it is not', () => {
    const row = { id: 'x', employer_id: null, is_sample: true, company: 'บริษัทตัวอย่าง (นายจ้างจำลอง)', position: 'พนักงานคลังสินค้า', industry: 'logistics', skills: ['warehouse_operations'], min_years: 0, details: '', headcount: 3,
      employment: 'permanent', salary_min: 4500, salary_max: 7000, salary_currency: 'CNY', start_date: null, languages: [], education: 'none', benefits: [], country: 'CN', province: 'CN-YN',
      created_at: at, demo_for: 'me' } as PostRow
    expect(rowToPost(row, 'me')).toMatchObject({ simFor: true, openAll: true, sample: true })
    expect(rowToPost(row, 'someone-else').simFor).toBeUndefined()
  })
  it('SQL 0021: every helper checks for a demo account, and a post made for one is read by that account only', () => {
    const sql = readFileSync('supabase/migrations/0021_demo_full.sql', 'utf8')
    for (const f of ['demo_verify_employer', 'demo_sample_apply', 'demo_sample_post', 'demo_sample_answer']) {
      const body = sql.slice(sql.indexOf(`function public.${f}`)); expect(body.slice(0, body.indexOf('$$;'))).toContain('if not public.is_demo_user() then raise')
      expect(sql).toMatch(new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon`))
    }
    expect(sql).toContain('(demo_for is null or demo_for = auth.uid() or public.is_admin()) and (')
    expect(sql).toContain('demo_for uuid references auth.users (id) on delete cascade')
  })
})
