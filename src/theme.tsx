import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'cnth-theme'
const read = (): Theme => {
  const a = document.documentElement.getAttribute('data-theme') // set before paint by /theme-init.js
  return a === 'dark' ? 'dark' : 'light'
}
interface Ctx { theme: Theme; toggle: () => void }
const C = createContext<Ctx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(read)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  }, [theme])
  const value = useMemo(() => ({ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }), [theme])
  return <C.Provider value={value}>{children}</C.Provider>
}
export function useTheme() { const c = useContext(C); if (!c) throw new Error('theme'); return c }
