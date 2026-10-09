import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { demoNumber } from './auth'
import { rowToPost, type PostRow } from './domain/match/remote'
import { messages } from './locales'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

describe('demo accounts (owner, Oct 2026: numbered so people trying at the same time can tell them apart)', () => {
  it('reads the running number from the name the database gives', () => {
    expect(demoNumber('บัญชีทดลอง 001')).toBe('001'); expect(demoNumber('บัญชีทดลอง 1234')).toBe('1234')
    expect(demoNumber('Somchai')).toBeNull(); expect(demoNumber('')).toBeNull(); expect(demoNumber(undefined)).toBeNull()
  })
  it('shows the name in each language', () => {
    const [th, zh, en] = messages['m.demo.name'] as readonly string[]
    expect(th).toBe('บัญชีทดลอง {n}'); expect(zh).toBe('体验账号 {n}'); expect(en).toBe('Demo account {n}')
  })
  it('posts from a demo account carry the mark', () => {
    const row = { id: 'x', employer_id: 'u', is_sample: false, company: 'C', position: 'P', industry: 'technology', skills: [], min_years: 0, details: '', headcount: 1, employment: 'permanent',
      salary_min: null, salary_max: null, salary_currency: null, start_date: null, languages: [], education: 'none', benefits: [], country: 'TH', province: 'TH-10', created_at: '2026-10-09T09:00:00Z' } as PostRow
    expect(rowToPost({ ...row, is_demo: true }, 'u').demo).toBe(true)
    expect(rowToPost(row, 'u').demo).toBeUndefined()
  })
  it('the sign-in page offers it; the database numbers the accounts and removes them after 7 days', () => {
    const page = src('./pages/auth.tsx')
    expect(page).toContain('<DemoButton />'); expect(page).toContain("rememberNext('choose-role'); const r = await signInDemo()")
    expect(src('./auth.tsx')).toContain('sb.auth.signInAnonymously()')
    const sql = src('../supabase/migrations/0011_demo_accounts.sql')
    expect(sql).toContain("'บัญชีทดลอง ' || lpad(nextval('public.demo_account_seq')::text, 3, '0')")
    expect(sql).toContain("delete from auth.users where is_anonymous and created_at <= now() - interval '7 days'")
  })
})

describe('seeker pins confirm first (owner, Oct 2026: it sent at once and jumped back to step 2 while saving)', () => {
  it('asks before pinning, shows it is saving, then a "pinned" step', () => {
    const m = src('./pages/match.tsx')
    expect(m).toContain("fe.clear(); setPinStage('confirm')")
    expect(m).toContain("<Modal open={pinStage === 'confirm'}")
    expect(m).toContain("if (r.ok) { setPinned({ country: dc, province: dp }); setPinStage('done'); return }")
    expect(m).toContain("{saving ? t('m.pin.busy') : t('m.pin.go')}")
    const [th] = messages['m.pin.cf.title'] as readonly string[]
    expect(th).toBe('ยืนยันการปักหมุดนี้ใช่หรือไม่?')
  })
})
