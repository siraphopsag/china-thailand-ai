import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { contactOk, localSet, localState } from './contactShare'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const at = '2026-11-28T10:00:00.000Z'
// a small in-memory browser storage (the tests run without a browser)
const mem = new Map<string, string>()
Object.assign(globalThis, { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), clear: () => mem.clear() } })

// owner, 28 Nov 2026: contact details are exchanged only after the team checked the documents, and only with consent both ways
describe('exchanging contact details', () => {
  beforeEach(() => localStorage.clear())
  it('each side sees the other only when both have agreed, and can take theirs back', () => {
    localSet('a1', 'seeker', '081 234 5678', at)
    expect(localState('a1', 'seeker', true)).toMatchObject({ mine: '081 234 5678', theirs: null, themAt: null })
    expect(localState('a1', 'employer', true)).toMatchObject({ mine: null, theirs: null, themAt: at }) // knows the other agreed, not what they gave
    localSet('a1', 'employer', 'LINE: shop', at)
    expect(localState('a1', 'seeker', true).theirs).toBe('LINE: shop'); expect(localState('a1', 'employer', true).theirs).toBe('081 234 5678')
    localSet('a1', 'seeker', null, at)
    expect(localState('a1', 'employer', true).theirs).toBeNull()
  })
  it('3 to 80 characters', () => { expect(contactOk('ab')).toBe(false); expect(contactOk(' abc ')).toBe(true); expect(contactOk('x'.repeat(81))).toBe(false) })
  it('the database decides: locked before the documents step, both sides only, consent both ways, the team can read', () => {
    const sql = src('../supabase/migrations/0026_contact_share.sql')
    expect(sql).toContain("'unlocked', coalesce(st ? 'documents', false)")
    expect(sql).toContain("if not (s ->> 'unlocked')::boolean then raise exception 'locked'")
    expect(sql).toContain('both_ok := r.seeker_at is not null and r.employer_at is not null')
    expect(sql).toContain("'theirs', case when both_ok then")
    expect(sql).toContain('revoke all on public.contact_shares from anon, authenticated')
    expect(sql).toContain('using (public.is_admin())')
    // the chat keeps hiding contact details: the page shows the exchange as its own card
    expect(src('./pages/chat.tsx')).toContain('<ContactShareCard key={side}')
  })
})
