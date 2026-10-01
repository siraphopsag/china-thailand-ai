import { describe, expect, it } from 'vitest'
import { BRAND } from './brand'
import { messages } from './locales/index'
import { tr } from './i18n/core'

describe('C.A.L.L. identity', () => {
  it('the name and full name are the same in every language (never translated)', () => {
    for (const lang of ['th', 'zh', 'en'] as const) {
      expect(tr('app.name', undefined, lang)).toBe('C.A.L.L.')
      expect(tr('app.tagline', undefined, lang)).toBe('Cross ASEAN Language Legal')
      expect(tr('app.title', undefined, lang)).toBe(BRAND.title)
    }
  })
  it('no user-facing message still carries the old product name', () => {
    const old = /China[–-]Thailand AI|Thailand[–-]China AI|ไทย[–-]จีน AI|泰中 AI|TH[–-]CN AI|Business Entry|Compliance Platform|แพลตฟอร์ม AI วางแผน/
    for (const [k, v] of Object.entries(messages)) for (const s of v as readonly string[]) expect(old.test(s), k).toBe(false)
  })
  it('the brand is written exactly, never as a misspelt variant', () => {
    for (const [k, v] of Object.entries(messages)) for (const s of v as readonly string[]) {
      expect(/C\.A\.L\.L(?!\.)|CALL\b|C\.A\.L\.L\.\./.test(s), k).toBe(false)
      if (s.includes('Cross ASEAN')) expect(s, k).toContain('Cross ASEAN Language Legal')
    }
  })
})
