import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MsgKey } from '../locales'
import { LANGS, isLang, setCurrentLang, tr, type Lang, type Vars } from './core'

export * from './core'
const KEY = 'cnth-lang'

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: MsgKey, v?: Vars) => string }
const C = createContext<Ctx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { const s = localStorage.getItem(KEY); if (isLang(s)) return s } catch { /* ignore */ }
    return 'th'
  })
  setCurrentLang(lang) // set during render so children/engines compute with the right language
  useEffect(() => {
    document.documentElement.lang = LANGS.find((l) => l.id === lang)!.html
    document.querySelector('meta[name="description"]')?.setAttribute('content', tr('app.desc', undefined, lang))
    try { localStorage.setItem(KEY, lang) } catch { /* ignore */ }
  }, [lang])
  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (k, v) => tr(k, v, lang) }), [lang, setLang])
  return <C.Provider value={value}>{children}</C.Provider>
}
export function useI18n() { const c = useContext(C); if (!c) throw new Error('i18n'); return c }
