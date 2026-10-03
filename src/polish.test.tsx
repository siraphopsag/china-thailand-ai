// Owner review, Oct 2026: more education levels (incl. doctorate), the language level picker overlapping the text below,
// and the shadcn-style "Background Paths" behind the home hero (rebuilt in CSS, no framer-motion).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { makePost, parseState, type PostInput } from './domain/match/logic'
import { seedState } from './domain/match/seed'
import { EDU, MY_EMPLOYER } from './domain/match/types'
import type { MsgKey } from './locales/index'
import { BackgroundPaths } from './components/ui/background-paths'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const css = src('./index.css')
const tokens = (sel: string) => { const i = css.indexOf(sel); const b = css.slice(i, css.indexOf('}', i)); return Object.fromEntries([...b.matchAll(/--([\w-]+):\s*([\d.]+(?: \d+ \d+)?);/g)].map((m) => [m[1], m[2].split(' ').map(Number)])) as Record<string, number[]> }
const light = tokens(":root, :root[data-theme='light']"), dark = { ...light, ...tokens(":root[data-theme='dark']") }
const lum = ([r, g, b]: number[]) => { const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const cr = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const mix = (b: number[], c: number[], a: number) => b.map((v, i) => v * (1 - a) + c[i] * a)
const NOW = Date.parse('2026-10-03T08:00:00.000Z')

describe('education levels', () => {
  it('8 levels low → high, no primary school, up to a doctorate; Thai ปวช./ปวส. line up with Chinese 中专/大专', () => {
    expect(EDU).toEqual(['none', 'lower_secondary', 'secondary', 'vocational', 'high_vocational', 'bachelor', 'master', 'doctorate'])
    const th = EDU.map((e) => tr(`m.edu.${e}` as MsgKey, undefined, 'th'))
    expect(th).toEqual(['ไม่กำหนด', 'มัธยมต้น', 'มัธยมปลาย', 'ปวช.', 'ปวส. / อนุปริญญา', 'ปริญญาตรี', 'ปริญญาโท', 'ปริญญาเอก'])
    expect(EDU.map((e) => tr(`m.edu.${e}` as MsgKey, undefined, 'zh'))).toEqual(['不限', '初中', '高中', '中专/职高', '大专', '本科', '硕士', '博士'])
    expect(th.join()).not.toMatch(/ม\.\d/) // no "ม.3 / ม.6" (owner)
  })
  it('every level can be posted, and posts saved with the first version’s keys still load', () => {
    const base: PostInput = { place: { country: 'TH', province: 'TH-81' }, company: 'Shop', position: 'HR', industry: 'food_service', skills: ['culinary_arts'], minYears: 0, details: '',
      headcount: 1, employment: 'permanent', salary: null, startDate: '2026-10-10', languages: [{ lang: 'th', level: 'native' }], education: 'none', benefits: [] }
    for (const e of EDU) expect(makePost({ ...base, education: e }, 'p', MY_EMPLOYER, new Date(NOW).toISOString()).ok, e).toBe(true)
    const st = seedState(NOW)
    expect(st.posts.some((p) => p.education === 'vocational')).toBe(true) // first-version key, now read as ปวช.
    expect(parseState(JSON.parse(JSON.stringify(st)))).not.toBeNull()
  })
})

describe('language level picker', () => {
  it('the language chip keeps its own height, so the picker under it no longer spills onto the hint and the next heading', () => {
    expect(css).toMatch(/\.chip-check\.chip-auto \{ height: auto \}/)
    const h = src('./pages/hire.tsx')
    expect(h).toContain('<div className="grid sm:grid-cols-3 gap-2 items-start">{LANGS.map(')
    expect(h).toContain('<label className="chip-check chip-auto"><input id={`emp-langs-${l}`}')
    expect(h).toContain("<span className=\"block text-xs text-muted mb-1\">{t('m.f.level')}</span>") // a visible "Level" above the picker
  })
})

describe('Background Paths in the home hero', () => {
  const html = renderToStaticMarkup(<LanguageProvider><BackgroundPaths /></LanguageProvider>)
  it('2 sets × 36 curved lines, hidden from screen readers, with a pause button after the hero content', () => {
    expect(html.match(/<path /g)).toHaveLength(72)
    expect(html).toMatch(/<div class="bg-paths [^"]*" aria-hidden="true">/)
    expect(html).toMatch(/<button type="button" class="bg-paths-toggle globe-ctl" aria-pressed="false" aria-label="[^"]+"/)
    expect(html).not.toContain('framer') // no new library
    const intake = src('./pages/intake.tsx')
    expect(intake.indexOf('<BackgroundPaths />')).toBeGreaterThan(intake.indexOf("t('m.proto')")) // keyboard order: main button first
    expect(intake).not.toContain('RetroGrid')
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.bg-paths-toggle \{ display: none \} \}/)
  })
  it('text over the lines keeps ≥ 4.5:1 in both themes (lines at their strongest, 20 % over the text column)', () => {
    for (const t of [light, dark]) {
      const peak = 0.6 * t['paths-a'][0] * 0.2 // keyframe opacity × theme strength × mask over the text column
      expect(peak).toBeGreaterThan(0)
      for (const base of [t['hero-base'], t.surface2]) {
        const glowed = mix(base, t['glow-a'], t['glow-k'][0]) // the hero glow at its strongest
        for (const bg of [mix(base, t['paths-c'], peak), mix(glowed, t['paths-c'], peak)]) expect(cr(t.ink, bg)).toBeGreaterThanOrEqual(4.5)
        expect(cr(t.muted, mix(base, t['paths-c'], peak))).toBeGreaterThanOrEqual(4.5) // the small prototype note sits at the bottom, away from the glow
      }
    }
    expect(css).toContain('rgb(0 0 0 / .2) calc(50% - min(440px, 46%))')
  })
})
