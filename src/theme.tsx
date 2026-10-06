import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
/** accent colour (owner, Oct 2026): indigo is the default; each one re-tints actions, selection and the map (index.css) */
export const ACCENTS = ['indigo', 'forest', 'ocean', 'plum', 'ember'] as const
export type Accent = (typeof ACCENTS)[number]
/** first day of the week in the calendar: 0 = Sunday (common in Thailand), 1 = Monday (common in China) */
export type WeekStart = 0 | 1
const KEY = 'cnth-theme', ACCENT_KEY = 'cnth-accent', WEEK_KEY = 'cnth-week'
const read = (): Theme => {
  const a = document.documentElement.getAttribute('data-theme') // set before paint by /theme-init.js
  return a === 'dark' ? 'dark' : 'light'
}
const readAccent = (): Accent => {
  const a = document.documentElement.getAttribute('data-accent') // also set before paint
  return (ACCENTS as readonly string[]).includes(a ?? '') ? a as Accent : 'indigo'
}
const readWeek = (): WeekStart => { try { return localStorage.getItem(WEEK_KEY) === '1' ? 1 : 0 } catch { return 0 } }
interface Ctx { theme: Theme; toggle: () => void; accent: Accent; setAccent: (a: Accent) => void; weekStart: WeekStart; setWeekStart: (w: WeekStart) => void }
const C = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read)
  const [accent, setAccent] = useState<Accent>(readAccent)
  const [weekStart, setWeekStart] = useState<WeekStart>(readWeek)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  }, [theme])
  useEffect(() => {
    if (accent === 'indigo') document.documentElement.removeAttribute('data-accent'); else document.documentElement.setAttribute('data-accent', accent)
    try { localStorage.setItem(ACCENT_KEY, accent) } catch { /* ignore */ }
  }, [accent])
  useEffect(() => { try { localStorage.setItem(WEEK_KEY, String(weekStart)) } catch { /* ignore */ } }, [weekStart])
  const value = useMemo(() => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), accent, setAccent, weekStart, setWeekStart }), [theme, accent, weekStart])
  return <C.Provider value={value}>{children}</C.Provider>
}
export function useTheme() { const c = useContext(C); if (!c) throw new Error('theme'); return c }
