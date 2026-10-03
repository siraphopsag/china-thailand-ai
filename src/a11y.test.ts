import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { isValidElement, type ReactElement } from 'react'
import { langRuns } from './components/ui'
import { REQUIREMENTS } from './data/legal/kb'
import { viewRequirement } from './services/compliance'

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
const tokens = (sel: string) => { const i = css.indexOf(sel); const b = css.slice(i, css.indexOf('}', i)); return Object.fromEntries([...b.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+)/g)].map((m) => [m[1], [+m[2], +m[3], +m[4]]])) as Record<string, number[]> }
const light = tokens(":root, :root[data-theme='light']"), dark = { ...light, ...tokens(":root[data-theme='dark']") }
const lum = ([r, g, b]: number[]) => { const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const cr = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('accessibility audit fixes (WCAG 2.2 A/AA)', () => {
  it('#4 page titles keep every letter and collapse line breaks', async () => {
    const { pageTitle } = await import('./utils/labels')
    expect(pageTitle('Connect across borders.\nUnderstand what matters.', 'C.A.L.L.', 'x')).toBe('Connect across borders. Understand what matters. · C.A.L.L.')
    expect(pageTitle('  ', 'C.A.L.L.', 'fallback')).toBe('fallback')
  })
  it('#1 borders of controls reach 3:1 on every surface, in both themes', () => {
    for (const t of [light, dark]) for (const s of ['surface', 'surface2', 'surface3', 'page']) expect(cr(t['control-line'], t[s]), s).toBeGreaterThanOrEqual(3)
    for (const cls of ['.input', '.btn-ghost', '.tab']) expect(css).toMatch(new RegExp(`\\${cls} \\{ @apply[^}]*border-control`))
  })
  it('#3 "coming soon" countries reach 3:1 against the sea (solid fill, no stripe pattern)', () => {
    for (const t of [light, dark]) expect(cr(t['globe-soon'], t['globe-ocean'])).toBeGreaterThanOrEqual(3)
    expect(css).toMatch(/\.g-soon \{ fill: rgb\(var\(--globe-soon\)\)/)
    expect(css).not.toMatch(/g-hatch/)
  })
  it('#11 no decorative animation runs forever without a way to pause it (WCAG 2.2.2)', () => {
    expect(css).not.toMatch(/animation:[^;]*(retro-drift|cta-spin)[^;]*infinite/)
    // the only endless one is the hero's Background Paths light band (owner, Oct 2026): it runs only while .is-on, which the on/off switch in Settings
    // controls (reduce-motion devices start off)
    const endless = [...css.matchAll(/animation:\s*([a-z-]+)[^;}]*infinite/g)].map((m) => m[1])
    // (ai-scan is a busy indicator, shown only while the AI is working)
    expect(endless.sort()).toEqual(['ai-scan', 'bg-flow', 'bg-sheen', 'bg-sheen-lines'])
    expect(css).toContain('.bg-paths.is-on .bg-sheen { display: block; animation: bg-sheen')
  })
  it('#6 a source title is never a raw message key', () => {
    for (const r of REQUIREMENTS) for (const l of ['th', 'zh', 'en'] as const) for (const s of viewRequirement(r, null, l).official_source) expect(s.title, r.id).not.toMatch(/^reg\./)
  })
  it('#13 Chinese inside Thai text (and Thai inside Chinese text) is marked with its own language', () => {
    const out = langRuns('ใบอนุญาตประกอบธุรกิจ (营业执照)', 'th')
    expect(isValidElement(out)).toBe(true)
    const kids = ((out as ReactElement<{ children: unknown[] }>).props.children) as unknown[]
    const span = kids.find((k) => isValidElement(k)) as ReactElement<{ lang: string; children: string }>
    expect(span.props.lang).toBe('zh-CN'); expect(span.props.children).toBe('营业执照')
    expect(langRuns('Thai text only in English', 'en')).toBe('Thai text only in English')
    expect(langRuns('营业执照', 'zh')).toBe('营业执照')
    const th = langRuns('泰国 ชลบุรี', 'zh') as ReactElement<{ children: unknown[] }>
    expect((th.props.children.find((k) => isValidElement(k)) as ReactElement<{ lang: string }>).props.lang).toBe('th')
  })
})
