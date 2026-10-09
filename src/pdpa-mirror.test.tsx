import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { messages } from './locales'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const tri = (k: string) => messages[k as keyof typeof messages] as readonly string[]

describe('PDPA privacy notice (owner, 10 Oct 2026)', () => {
  it('has the parts the PDPA asks for, in three languages', () => {
    for (let i = 1; i <= 11; i++) for (const p of ['h', 't']) { const [th, zh, en] = tri(`pri.${i}.${p}`); expect(th && zh && en, `pri.${i}.${p}`).toBeTruthy() }
    expect(tri('pri.1.t')[0]).toContain('c.a.l.l.project00@gmail.com') // who is responsible, and how to reach them
    expect(tri('pri.3.t')[0]).toContain('มาตรา 24(3)'); expect(tri('pri.3.t')[0]).toContain('มาตรา 24(5)') // legal bases
    expect(tri('pri.5.t')[2]).toContain('free Gemini tier') // the AI provider may use what is sent
    expect(tri('pri.6.t')[2]).toContain('Personal Information Protection Law') // users in China
    expect(tri('pri.7.t')[0]).toContain('182 วัน'); expect(tri('pri.7.t')[0]).toContain('30 วัน'); expect(tri('pri.7.t')[0]).toContain('7 วัน') // retention as the database does it
    expect(tri('pri.9.t')[2]).toContain('72 hours')
  })
  it('the page shows each part as a heading with its points, and the address as a mail link', () => {
    const page = src('./pages/info.tsx')
    expect(page).toContain("const PRI = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const")
    expect(page).toContain('href={`mailto:${MAIL}`}')
  })
  it('retention matches the database clean-up', () => {
    const sql = src('../supabase/migrations/0011_demo_accounts.sql')
    expect(sql).toContain("released_at <= now() - interval '182 days'")
    expect(sql).toContain("created_at <= now() - interval '30 days'")
    expect(sql).toContain("is_anonymous and created_at <= now() - interval '7 days'")
  })
})

describe('backup demo for mainland China (owner, 10 Oct 2026)', () => {
  it('a copy on Cloudflare Pages or Netlify says it is the backup demo', () => {
    const app = src('./App.tsx')
    expect(app).toContain("/\\.(pages\\.dev|netlify\\.app)$/.test(location.hostname)")
    expect(app).toContain("if (status === 'off' && isMirror())")
    expect(tri('m.demo.mirror')[1]).toContain('中国')
    expect(src('../public/_redirects')).toMatch(/^\/\*\s+\/index\.html\s+200/)
    expect(src('../docs/setup-china-mirror.md')).toContain('NODE_VERSION')
  })
})
