// Owner review, Oct 2026: more education levels (incl. doctorate), the language level picker overlapping the text below,
// and the shadcn-style "Background Paths" behind the home hero (rebuilt in CSS, no framer-motion).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { makePost, parseState, type PostInput } from './domain/match/logic'
import { seedState } from './domain/match/seed'
import { EDU, MY_EMPLOYER } from './domain/match/types'
import type { MsgKey } from './locales/index'
import { BackgroundPaths, fpsGuard } from './components/ui/background-paths'

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

describe('Background Paths in the home hero (still lines + moving light: A runs along the lines, B sweeps across)', () => {
  const html = renderToStaticMarkup(<LanguageProvider><BackgroundPaths /></LanguageProvider>)
  afterEach(() => { vi.unstubAllGlobals() })
  it('A by default: 72 still lines + 36 running lights (every other line); hidden from screen readers', () => {
    expect(html).toMatch(/<div data-fx="a" class="bg-paths [^"]*is-on[^"]*" aria-hidden="true">/) // moves by default
    expect(html.match(/<path /g)).toHaveLength(72 + 36)
    expect(html).toContain('<div class="bg-sheen-wrap"><svg class="bg-paths-svg bg-flow"')
    expect(html.match(/pathLength="1"/g)).toHaveLength(36)
    expect(html).toMatch(/style="--d:\d+s;--delay:-[\d.]+s"/)
    expect(html).not.toContain('framer') // no new library
    const intake = src('./pages/intake.tsx')
    expect(intake.indexOf('<BackgroundPaths />')).toBeGreaterThan(intake.indexOf("t('m.proto')")) // placed after the content, drawn behind it
    expect(intake).not.toContain('RetroGrid')
  })
  it('A: each light runs one way in a seamless loop (dash pattern repeats every 1), no reversing, no flicker', () => {
    expect(css).toContain('.bg-flow path { stroke-dasharray: .22 .78; stroke-linecap: round }')
    expect(.22 + .78).toBe(1)
    expect(css).toContain('@keyframes bg-flow { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -1 } }')
    expect(css).toContain('.bg-paths.is-on .bg-flow path { animation: bg-flow var(--d, 22s) linear var(--delay, 0s) infinite !important }')
    expect(css).toContain('.bg-paths.is-away .bg-flow path { animation-play-state: paused !important }')
    expect(css).not.toMatch(/@keyframes bg-flow[^\n]*opacity/)
  })
  it('frame-rate guard: smooth 60 fps never trips; sustained < 45 fps switches after the 2 s warm-up + 1.5 s; one hiccup does not; reset starts over', () => {
    const run = (fps: number, ms: number, g = fpsGuard(() => { slow++ })) => { for (let t = 0; t <= ms; t += 1000 / fps) g.frame(t); return g }
    let slow = 0
    run(60, 10000); expect(slow).toBe(0)
    run(58, 10000); expect(slow).toBe(0)
    run(30, 3400); expect(slow).toBe(0) // warming up, then not yet 1.5 s of slow frames
    run(30, 4100); expect(slow).toBe(1)
    slow = 0; const g = fpsGuard(() => { slow++ }); let t = 0
    for (; t < 3000; t += 16.7) g.frame(t)
    g.frame(t += 400) // one 400 ms hiccup (e.g. garbage collection)
    for (; t < 8000; t += 16.7) g.frame(t)
    expect(slow).toBe(0)
    const h = fpsGuard(() => { slow++ }); for (t = 0; t < 3300; t += 33) h.frame(t)
    h.reset(); for (t = 5000; t < 8300; t += 33) h.frame(t) // after reset the warm-up starts again
    expect(slow).toBe(0)
  })
  it('B for devices that report low memory or data saver, and for the rest of the session once A was too slow; ?fx= forces a mode', () => {
    const render = () => renderToStaticMarkup(<LanguageProvider><BackgroundPaths /></LanguageProvider>)
    vi.stubGlobal('navigator', { deviceMemory: 2, hardwareConcurrency: 8 })
    expect(render()).toContain('data-fx="b"')
    vi.stubGlobal('navigator', { connection: { saveData: true } })
    expect(render()).toContain('data-fx="b"')
    vi.unstubAllGlobals()
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => (k === 'call.fx.slow' ? '1' : null), setItem: () => {} })
    const b = render()
    expect(b).toContain('data-fx="b"'); expect(b).toContain('<div class="bg-sheen-wrap"><div class="bg-sheen"><div class="bg-sheen-lines">')
    vi.stubGlobal('location', { search: '?fx=a' })
    expect(render()).toContain('data-fx="a"') // forced, even though this session was marked slow
    const c = src('./components/ui/background-paths.tsx')
    expect(c).toContain("if (paused || away || fx !== 'a' || forced || typeof requestAnimationFrame !== 'function') return")
    expect(c).toContain("sessionStorage.setItem(SLOW, '1')")
  })
  it('B: only transforms move (smooth on low-end phones), the light stays on the lines, and it stops off-screen', () => {
    const kf = (n: string) => { const i = css.indexOf(`@keyframes ${n} {`); return css.slice(i + `@keyframes ${n} {`.length, css.indexOf('\n', i)).replace(/\r$/, '') }
    for (const n of ['bg-sheen', 'bg-sheen-lines']) { expect(kf(n)).toMatch(/transform: translateX/); expect(kf(n)).not.toMatch(/stroke|opacity|width|left/) }
    // window -100% → 250% of its 40 % width; copy +40% → -100% of its full (250 %) width: the two always cancel
    expect(kf('bg-sheen')).toBe(' 0% { transform: translateX(-100%) } 70%, 100% { transform: translateX(250%) } }')
    expect(kf('bg-sheen-lines')).toBe(' 0% { transform: translateX(40%) } 70%, 100% { transform: translateX(-100%) } }')
    expect(-100 * 0.4).toBe(-40); expect(250 * 0.4).toBe(100)
    expect(css).toContain('.bg-sheen { position: absolute; top: 0; bottom: 0; left: 0; width: 40%;')
    expect(css).toContain('.bg-sheen-lines { position: absolute; top: 0; bottom: 0; left: 0; width: 250%;')
    expect(css).toContain('.bg-paths.is-on .bg-sheen { display: block; animation: bg-sheen 14s ease-in-out infinite !important }')
    expect(css).toContain('.bg-paths.is-on .bg-sheen-lines { animation: bg-sheen-lines 14s ease-in-out infinite !important }')
    expect(css).toContain('.bg-paths.is-away .bg-sheen, .bg-paths.is-away .bg-sheen-lines { animation-play-state: paused !important }')
    expect(css).not.toContain('@keyframes bg-path ') // the old per-line dash animation (broken-looking lines) is gone
  })
  it('no button on the hero (owner); the on/off switch is in Settings, next to language and theme (WCAG 2.2.2)', () => {
    expect(html).not.toContain('<button')
    expect(css).not.toContain('bg-paths-toggle')
    const m = src('./pages/match.tsx')
    expect(m).toContain("<legend className=\"label\">{t('m.settings.motion')}</legend>")
    expect(m).toContain('aria-pressed={motion === on} onClick={() => { setMotion(on); setMotionOff(!on) }}')
    expect(tr('m.settings.motion', undefined, 'th')).toBe('ภาพเคลื่อนไหวหน้าแรก')
    expect([tr('m.settings.on', undefined, 'th'), tr('m.settings.off', undefined, 'th')]).toEqual(['เปิด', 'ปิด'])
    expect(src('./components/ui/background-paths.tsx')).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches")
  })
  it('with "reduce motion" on it starts off; the Settings choice wins over the device setting, both ways', async () => {
    const { setMotionOff } = await import('./components/ui/background-paths')
    const store: Record<string, string> = {}
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v } })
    const render = () => renderToStaticMarkup(<LanguageProvider><BackgroundPaths /></LanguageProvider>)
    expect(render()).not.toContain('is-on')
    setMotionOff(false) // Settings → On
    expect(store['call.motion.paused']).toBe('0'); expect(render()).toContain('is-on')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    setMotionOff(true) // Settings → Off on a normal device
    expect(render()).not.toContain('is-on')
  })
  it('text over the lines keeps ≥ 4.5:1 in both themes (still lines + light band at full strength, 15 % over the text column)', () => {
    for (const t of [light, dark]) {
      const m = 0.15 * t['paths-a'][0], still = 0.3 * m, band = 1 * m * 0.5 // band: full copy × the extra .5 over the text column
      for (const base of [t['hero-base'], t.surface2]) {
        const lined = mix(mix(base, t['paths-c'], still), t['paths-sheen'], band) // a pixel where a still line and the band overlap
        const glowed = mix(mix(mix(base, t['glow-a'], t['glow-k'][0]), t['paths-c'], still), t['paths-sheen'], band)
        expect(cr(t.ink, lined)).toBeGreaterThanOrEqual(4.5); expect(cr(t.ink, glowed)).toBeGreaterThanOrEqual(4.5)
        expect(cr(t.muted, lined)).toBeGreaterThanOrEqual(4.5) // the small prototype note sits at the bottom, away from the glow
      }
    }
    expect(css).toContain('rgb(0 0 0 / .15) calc(50% - min(440px, 46%))')
    expect(css).toContain('.bg-paths > .bg-paths-svg { opacity: .3 }'); expect(css).toContain('width: 250%; opacity: 1;'); expect(css).toContain('rgb(0 0 0 / .5) calc(50% - min(440px, 46%))')
  })
})
