// The real AI on screen (owner, Oct 2026 — "A + B"): the check result, the assistant page, and its place under "Prepare".
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { seedState } from './domain/match/seed'
import { ai } from './locales/ai'
import { AiCheckResult, AskPage } from './pages/ask'
import { RevealText, splitWords } from './components/morph-orb'
import { PreparePage } from './pages/match'

function html(node: ReactNode): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={seedState()}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) } finally { if (had) g.document = prev; else delete g.document }
}

describe('AI on screen', () => {
  it('every AI message exists in Thai, Chinese and English', () => {
    for (const [k, v] of Object.entries(ai)) expect(v.every((s) => s.trim().length > 0), k).toBe(true)
  })
  it('the check shows the verdict, each issue with its words, fix and legal record, and says it is not legal advice', () => {
    const out = html(<AiCheckResult left={7} res={{ verdict: 'high_risk', summary: 'Asks the job seeker for money.', flags: [
      { category: 'scam', severity: 'high', quote: 'pay 3,000 baht first', explanation: 'Job seekers should never pay.', suggestion: 'Remove the fee.', lawIds: ['th-labour'] },
      { category: 'missing_info', severity: 'low', quote: '', explanation: 'No working hours.', suggestion: 'Add hours.', lawIds: [] },
    ] }} />)
    expect(out).toContain('พบสัญญาณเสี่ยงหลอกลวงหรือค้ามนุษย์')
    expect(out).toContain('pay 3,000 baht first')
    expect(out).toContain('Remove the fee.')
    expect(out).toContain('ใบอนุญาตทำงานของคนต่างด้าวในประเทศไทย') // the record's title, linked to its agency
    expect(out).toContain('https://www.mol.go.th/')
    expect(out).toContain('ยังไม่ได้ตรวจโดยนักกฎหมาย')
    expect(out).toContain('ไม่ใช่คำปรึกษาทางกฎหมาย')
    expect(out).toContain('วันนี้ใช้ AI ได้อีก 7 ครั้ง')
    expect(out.indexOf('สูง')).toBeLessThan(out.indexOf('ต่ำ'))
  })
  it('the assistant asks visitors to sign in and keeps the box closed until then', () => {
    const out = html(<AskPage />)
    expect(out).toContain('ผู้ช่วยกฎหมาย AI')
    expect(out).toContain('เข้าสู่ระบบเพื่อใช้ผู้ช่วย AI')
    expect(out).toMatch(/<input[^>]*class="mo-field"[^>]*disabled/) // the pill of the thinking-orb stage
    expect(out).toContain('mo-root') // the dark stage
    expect(out).toContain('อย่าใส่ชื่อ เลขบัตร เบอร์โทร')
  })
  it('is the first card under "Prepare", and the AI key never reaches the browser code', () => {
    expect(html(<PreparePage />)).toContain('href="/ask"')
    for (const f of ['src/ai/client.ts', 'src/pages/ask.tsx', 'src/pages/hire.tsx']) expect(readFileSync(f, 'utf8')).not.toMatch(/ANTHROPIC|anthropic-ai/)
  })
  it('the answer appears word by word, Thai words split by the browser, line breaks kept', () => {
    expect(splitWords('คนจีนต้องมีใบอนุญาตทำงาน', 'th').length).toBeGreaterThan(3)
    const out = html(<RevealText text={'บรรทัดแรก\n• ข้อสอง'} lang="th" />)
    expect(out).toContain('<br/>')
    expect((out.match(/class="mo-w"/g) ?? []).length).toBeGreaterThan(3)
  })
})
