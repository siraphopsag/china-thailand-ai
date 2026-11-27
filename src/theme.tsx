import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { judgeDevice, readVerdict, type Verdict } from './lite'

export type Theme = 'light' | 'dark'
/** accent colour (owner, Oct 2026): indigo is the default; each one re-tints actions, selection and the map (index.css) */
export const ACCENTS = ['indigo', 'forest', 'ocean', 'plum', 'ember'] as const
export type Accent = (typeof ACCENTS)[number]
/** first day of the week in the calendar, from the language (owner, 23 Nov 2026: no setting for it): 0 = Sunday (common in
 *  Thailand, also English), 1 = Monday (common in China) */
export type WeekStart = 0 | 1
export const weekStartFor = (lang: string): WeekStart => (lang === "zh" ? 1 : 0)
const KEY = 'cnth-theme', ACCENT_KEY = 'cnth-accent', LITE_KEY = 'cnth-lite', TEXT_KEY = 'cnth-text'
/** text size (owner, 27 Nov 2026: some users cannot read small letters): five steps; the whole page grows with it, map labels too */
export const TEXT_SIZES = ['sm', 'md', 'lg', 'xl', 'xxl'] as const
export type TextSize = (typeof TEXT_SIZES)[number]
export const TEXT_SCALE: Record<TextSize, number> = { sm: 0.9, md: 1, lg: 1.15, xl: 1.3, xxl: 1.5 }
const readText = (): TextSize => { const a = document.documentElement.getAttribute('data-text'); return (TEXT_SIZES as readonly string[]).includes(a ?? '') ? a as TextSize : 'md' }
/** fewer effects for older phones (owner, Oct 2026): 'auto' = on for a low-end device (4 CPU cores or fewer, or ≤ 4 GB of memory) */
export type LiteMode = 'auto' | 'on' | 'off'
/** an iPhone or iPad (iPadOS says "MacIntel" but has touch): Safari reports a capped core count and no memory size */
export const appleMobile = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
export const lowEndDevice = () => {
  if (typeof navigator === 'undefined' || appleMobile()) return false // judged by how smoothly the page draws instead (src/lite.ts)
  const n = navigator.hardwareConcurrency, m = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return (!!n && n <= 4) || (!!m && m <= 4)
}
const readLite = (): LiteMode => { try { const v = localStorage.getItem(LITE_KEY); return v === 'on' || v === 'off' ? v : 'auto' } catch { return 'auto' } }
const read = (): Theme => {
  const a = document.documentElement.getAttribute('data-theme') // set before paint by /theme-init.js
  return a === 'dark' ? 'dark' : 'light'
}
const readAccent = (): Accent => {
  const a = document.documentElement.getAttribute('data-accent') // also set before paint
  return (ACCENTS as readonly string[]).includes(a ?? '') ? a as Accent : 'indigo'
}
interface Ctx { theme: Theme; toggle: () => void; accent: Accent; setAccent: (a: Accent) => void
  textSize: TextSize; setTextSize: (s: TextSize) => void
  liteMode: LiteMode; setLiteMode: (m: LiteMode) => void; /** fewer effects right now */ lite: boolean; /** …and chosen by the site, not by hand */ liteByAuto: boolean }
const C = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read)
  const [accent, setAccent] = useState<Accent>(readAccent)
  const [liteMode, setLiteMode] = useState<LiteMode>(readLite)
  const [textSize, setTextSize] = useState<TextSize>(readText)
  const [verdict, setVerdict] = useState<Verdict | null>(readVerdict)
  const liteByAuto = liteMode === 'auto' && (lowEndDevice() || verdict === 'on')
  const lite = liteMode === 'on' || liteByAuto
  // once per device: the graphics chip and the frame rate (src/lite.ts) — a Redmi 13C passes the core/memory check
  useEffect(() => {
    if (liteMode !== 'auto' || lowEndDevice() || verdict !== null) return
    let alive = true
    void judgeDevice().then(() => { if (alive) setVerdict(readVerdict()) })
    return () => { alive = false }
  }, [liteMode, verdict])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  }, [theme])
  useEffect(() => {
    if (accent === 'indigo') document.documentElement.removeAttribute('data-accent'); else document.documentElement.setAttribute('data-accent', accent)
    try { localStorage.setItem(ACCENT_KEY, accent) } catch { /* ignore */ }
  }, [accent])
  useEffect(() => {
    if (textSize === 'md') document.documentElement.removeAttribute('data-text'); else document.documentElement.setAttribute('data-text', textSize)
    try { if (textSize === 'md') localStorage.removeItem(TEXT_KEY); else localStorage.setItem(TEXT_KEY, textSize) } catch { /* ignore */ }
  }, [textSize])
  useEffect(() => { try { localStorage.removeItem('cnth-week') } catch { /* ignore */ } }, []) // the old week setting (removed)
  useEffect(() => {
    if (lite) document.documentElement.setAttribute('data-lite', ''); else document.documentElement.removeAttribute('data-lite')
    try { if (liteMode === 'auto') localStorage.removeItem(LITE_KEY); else localStorage.setItem(LITE_KEY, liteMode) } catch { /* ignore */ }
  }, [lite, liteMode])
  const value = useMemo(() => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), accent, setAccent, textSize, setTextSize, liteMode, setLiteMode, lite, liteByAuto }), [theme, accent, textSize, liteMode, lite, liteByAuto])
  return <C.Provider value={value}>{children}</C.Provider>
}
export function useTheme() { const c = useContext(C); if (!c) throw new Error('theme'); return c }
/** fewer effects now (false outside the provider, e.g. a lone component in a test) */
export const useLite = () => useContext(C)?.lite ?? false
/** how much larger the text is than normal (1 outside the provider) */
export const useTextScale = () => TEXT_SCALE[useContext(C)?.textSize ?? 'md']
