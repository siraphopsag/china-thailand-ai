import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { TEXT_SCALE, TEXT_SIZES } from './theme'

// text size in Settings (owner, 27 Nov 2026: some users cannot read small letters)
describe('text size', () => {
  it('five steps, normal in the middle', () => {
    expect(TEXT_SIZES).toHaveLength(5); expect(TEXT_SCALE.md).toBe(1)
    expect(TEXT_SCALE.sm).toBeLessThan(1); expect(TEXT_SCALE.xxl).toBeGreaterThan(TEXT_SCALE.xl)
  })
  it('the settings page offers all five', () => { const m = readFileSync('src/pages/match.tsx', 'utf8'); expect(m).toContain('TEXT_SIZES.map'); expect(m).toContain("setTextSize(s)") })
  it('the root size and fixed sizes follow --fs, and the page restores it before paint', () => {
    const css = readFileSync('src/index.css', 'utf8')
    expect(css).toContain('font-size: calc(100% * var(--fs))'); expect(css).toContain('html[data-text="xxl"] { --fs: 1.5 }')
    expect(css).toContain('.g-name { font-size: calc(17px * var(--fs))')
    const init = readFileSync('public/theme-init.js', 'utf8'); expect(init).toContain("localStorage.getItem('cnth-text')"); for (const s of TEXT_SIZES.filter((x) => x !== 'md')) expect(init).toContain("text === '" + s + "'")
  })
})
