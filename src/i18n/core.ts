// Pure i18n core (no React) so the serverless API and engines can localise too.
import { messages, type MsgKey } from '../locales/index.js'

export type Lang = 'th' | 'zh' | 'en'
export const LANGS: { id: Lang; label: string; short: string; html: string }[] = [
  { id: 'th', label: 'ไทย', short: 'TH', html: 'th' },
  { id: 'zh', label: '中文', short: '中', html: 'zh-CN' },
  { id: 'en', label: 'English', short: 'EN', html: 'en' },
]
const IDX: Record<Lang, number> = { th: 0, zh: 1, en: 2 }

let current: Lang = 'th'
export const setCurrentLang = (l: Lang) => { current = l }
export type Vars = Record<string, string | number>

export function tr(key: MsgKey, vars?: Vars, lang: Lang = current): string {
  const e = messages[key] as readonly [string, string, string] | undefined
  let s = e ? e[IDX[lang]] || e[0] : String(key)
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
  return s
}
/** Dynamic key helper, e.g. tk('level', 'HIGH'). */
export const tk = (prefix: string, id: string, vars?: Vars) => tr(`${prefix}.${id}` as MsgKey, vars)
/** Resolve stored demo tokens like "@demo.activity" into the current language; plain text is returned as is. */
export const dv = (s: string | undefined) => {
  if (!s || !s.startsWith('@')) return s ?? ''
  const k = s.slice(1)
  return k in messages ? tr(k as MsgKey) : s // user text that merely starts with @ stays untouched
}
export const isLang = (x: unknown): x is Lang => x === 'th' || x === 'zh' || x === 'en'
