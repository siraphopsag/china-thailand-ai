// Owner's review, 23 Nov 2026: switching accounts like Gmail; a real chat between the two sides; contracts, job-seeker
// verification and aftercare shared through the database (SQL 0014) instead of one browser; settings and help page tidied.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Session } from '@supabase/supabase-js'
import { MAX_ACCOUNTS, supabaseKey, withAccount, type SavedAccount } from './accounts'
import { fromLocalStamp, isUuid, rowToInterview, rowToMsg, toLocalStamp, unreadOf } from './shared'
import { rowToVerify, verifyToRow } from './pages/seeker-verify'
import { cleanAftercare } from './aftercareStore'
import { cleanContract } from './contractStore'
import { PHRASES } from './domain/match/chat'
import { REVIEW_BAD, REVIEW_GOOD } from './domain/match/aftercare'
import { sideItems, MORE_KEYS } from './components/sidenav'
import { v2e } from './locales/v2e'
import { messages } from './locales/index'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const sql = src('../supabase/migrations/0014_shared_records.sql')
const session = (n: string) => ({ access_token: `a${n}`, refresh_token: `r${n}`, expires_at: 1, expires_in: 3600, token_type: 'bearer', user: { id: n } }) as unknown as Session
const acc = (id: string): Omit<SavedAccount, 'role' | 'at'> => ({ id, email: `${id}@example.com`, name: id, demo: false, session: session(id) })

describe('A. switching accounts', () => {
  it('the newest account comes first, a renewed session replaces the old one, the role is kept, and the list is capped', () => {
    let list: SavedAccount[] = []
    list = withAccount(list, { ...acc('a'), role: 'employer' }, '2026-11-23T01:00:00Z')
    list = withAccount(list, acc('b'), '2026-11-23T02:00:00Z')
    list = withAccount(list, { ...acc('a'), session: session('a2') }, '2026-11-23T03:00:00Z')
    expect(list.map((x) => x.id)).toEqual(['a', 'b'])
    expect([list[0].role, list[0].session.refresh_token]).toEqual(['employer', 'ra2'])
    for (let i = 0; i < 12; i++) list = withAccount(list, acc(`x${i}`), '2026-11-23T04:00:00Z')
    expect(list.length).toBe(MAX_ACCOUNTS)
  })
  it('the session goes where Supabase keeps it; no password is ever stored; the menu and the sign-in page offer the accounts', () => {
    expect(supabaseKey('https://abcd1234.supabase.co')).toBe('sb-abcd1234-auth-token')
    expect(supabaseKey(undefined)).toBeNull()
    expect(src('./accounts.ts')).not.toMatch(/password\s*[:=?]/i) // only the session, never a password field
    expect(src('./auth.tsx')).toContain('rememberAccount({ id: u.id')
    expect(src('./components/sidenav.tsx')).toContain('<AccountList accounts={accounts.filter((a) => a.id !== user.id)}')
    expect(src('./pages/auth.tsx')).toContain('autoComplete="username"')
  })
})

describe('B. the chat is shared', () => {
  it('rows from the database become the chat the page shows; interview times are real moments shown in local time', () => {
    expect(rowToMsg({ id: 'm1', side: 'employer', body: '', phrase: 'hello', masked: false, created_at: '2026-11-23T05:00:00Z' })).toEqual({ id: 'm1', from: 'employer', at: '2026-11-23T05:00:00.000Z', text: '', phrase: 'hello' })
    const local = '2026-12-01T10:30'
    expect(toLocalStamp(fromLocalStamp(local))).toBe(local)
    const iv = rowToInterview({ slots: [fromLocalStamp(local)], mode: 'onsite', offered_at: '2026-11-23T05:00:00Z', chosen: fromLocalStamp(local), chosen_at: '2026-11-23T06:00:00Z' })
    expect([iv.slots, iv.chosen, iv.mode]).toEqual([[local], local, 'onsite'])
  })
  it('unread = messages from the other side after I last opened the conversation', () => {
    const s = { accId: 'a1', mySide: 'seeker' as const, lastAt: null, lastSide: null, lastText: '', lastPhrase: null, otherTimes: ['2026-11-23T03:00:00.000Z', '2026-11-23T01:00:00.000Z'] }
    expect(unreadOf(s, 'u', {})).toBe(2)
    expect(unreadOf(s, 'u', { 'u:a1': '2026-11-23T02:00:00.000Z' })).toBe(1)
  })
  it('the database allows only the two sides, hides contact details itself, and knows the same phrases', () => {
    expect(sql).toContain('create policy "the two sides read their chat" on public.chat_messages')
    expect(sql).toContain('revoke update, delete on public.chat_messages from anon, authenticated')
    for (const s of ['seeker', 'employer'] as const) expect(sql).toContain(`array[${PHRASES[s].map((p) => `'${p}'`).join(', ')}]`)
    expect(sql).toMatch(/regexp_replace\(b, '\\\+\?\\d\[\\d\\s-\]\{6,\}\\d', '\[•••\]', 'g'\)/)
    const page = src('./pages/chat.tsx')
    expect(page).toContain("const intro = !demo && a?.intro?.trim()") // the introduction opens the conversation
    expect(page).toContain('useRemoteChat(remote ? accId : null)')
  })
  it('all chats have their own page and menu item (with the unread count); profile moves under "More" on phones', () => {
    expect(sideItems('seeker', false).map((i) => i.key)).toContain('m.nav.chats')
    expect(MORE_KEYS).toContain('m.profile')
    expect(src('./App.tsx')).toContain('chats: <ChatsPage />')
    expect(isUuid('5f0c8a52-3b8e-4a8e-9d1e-1c2b3d4e5f60')).toBe(true); expect(isUuid('acc-demo')).toBe(false)
  })
})

describe('C. contracts, verification and aftercare are shared', () => {
  it('contracts: both sides read; each signs only for itself; both signatures survive signing at the same moment', () => {
    expect(sql).toContain('create policy "people of the case read the contract" on public.contracts')
    expect(sql).toContain("me <> 'worker' then raise exception 'not_allowed'")
    expect(sql).toContain("p_patch := jsonb_set(p_patch, '{sign}', s_old || s_new)")
    expect(cleanContract({ checked: true, mrz: 'x'.repeat(200), sign: { hash: 'h', mode: 'online' } })).toEqual({ checked: true, sign: { hash: 'h', mode: 'online' } })
    expect(src('./pages/contract.tsx')).toContain("if (remote) doc.save(rest as never); else saveContract(key, rest as never)")
  })
  it('job-seeker verification keeps only last digits; employers see only a yes/no for their own applicants', () => {
    const v = { country: 'TH' as const, phone4: '5678', phoneAt: '2026-11-23T00:00:00Z', passport: { last4: '4567', nationality: 'THA', expiry: '2031-08-30', at: '2026-11-23T00:00:00Z' } }
    expect(rowToVerify(verifyToRow(v))).toEqual(v)
    expect(rowToVerify(verifyToRow(null))).toBeNull()
    expect(sql).toContain("seeker_phone4 text check (seeker_phone4 ~ '^[0-9]{4}$')")
    expect(sql).toMatch(/returns table \(seeker_id uuid, verified boolean\)/)
  })
  it('aftercare: the worker and the team only, never the employer; reviews reach posts only as anonymous points', () => {
    expect(sql).toContain('for select to authenticated using (seeker_id = auth.uid() or public.is_admin())')
    expect(sql).toContain('alter table public.employer_reviews enable row level security; -- no policies')
    expect(sql).toMatch(/returns table \(stars int, good text\[\], bad text\[\], at timestamptz\)/)
    for (const k of [...REVIEW_GOOD, ...REVIEW_BAD]) expect(sql).toContain(`'${k}'`)
    expect(cleanAftercare({ checkins: [{ day: 1 }], complaints: 'x', secret: 'tea' })).toEqual({ checkins: [{ day: 1 }], complaints: [], secret: 'tea' })
  })
})

describe('D. tidied pages and texts', () => {
  it('settings: no colour preview, week setting or demo clock; help page: no quick exit for now', () => {
    const s = src('./pages/match.tsx')
    expect(s).not.toContain("t('m.settings.preview.label')"); expect(s).not.toContain("t('m.settings.week')"); expect(s).not.toContain("<legend className=\"label\">{t('m.clock.title')}")
    expect(src('./theme.tsx')).not.toContain('setWeekStart')
    expect(src('./pages/sos.tsx')).not.toContain('quickExit')
    expect(src('./matchData.tsx')).toContain('useState(0) // the back office demo clock')
  })
  it('every new text has Thai, Chinese and English in the right scripts', () => {
    for (const [k, [th, zh, en]] of Object.entries(v2e)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(en, k).not.toMatch(/[฀-๿一-鿿]/)
      expect(messages[k as keyof typeof messages]).toEqual([th, zh, en])
    }
  })
})
