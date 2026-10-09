// The employer's own words on a post in other languages (owner, Oct 2026): when a post reaches job seekers who read another language,
// the job title and details the AI translated while checking the post are shown instead, with the original one tap away.
// Also the occupations Thai law closes to foreigners, which keep a post inside Thailand. Pure: no React, no storage, no other modules
// (the AI server function uses it too).
export type UiLang = 'th' | 'zh' | 'en'
export const UI_LANGS: readonly UiLang[] = ['th', 'zh', 'en']
export interface PostText { position: string; details: string }
/** src: the language the employer wrote in; one entry per language (the source language may be left out) */
export type PostTranslations = { src?: UiLang } & Partial<Record<UiLang, PostText>>

const CONTACT = (s: string) => /[^\s@]+@[^\s@]+/.test(s) || /(https?:\/\/|www\.)/i.test(s) || /\d[\d\s-]{6,}\d/.test(s)
const isLang = (v: unknown): v is UiLang => v === 'th' || v === 'zh' || v === 'en'
const MAX_POSITION = 120, MAX_DETAILS = 1500

/** keeps only well-formed translations: short strings, no contact details (the database refuses those too), at least a title */
export function cleanTranslations(v: unknown): PostTranslations {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const r = v as Record<string, unknown>
  const out: PostTranslations = {}
  if (isLang(r.src)) out.src = r.src
  for (const l of UI_LANGS) {
    const x = r[l]
    if (!x || typeof x !== 'object') continue
    const { position, details } = x as Record<string, unknown>
    if (typeof position !== 'string' || typeof details !== 'string') continue
    const p = position.trim().slice(0, MAX_POSITION), d = details.trim().slice(0, MAX_DETAILS)
    if (!p || CONTACT(p) || CONTACT(d)) continue
    out[l] = { position: p, details: d }
  }
  return UI_LANGS.some((l) => out[l]) ? out : {}
}
export const hasTranslations = (t: PostTranslations | undefined) => !!t && UI_LANGS.some((l) => t[l])

interface Translatable extends PostText { translations?: PostTranslations; orig?: PostText; translatedFrom?: UiLang }
/**
 * The post as a reader of `lang` sees it: the AI translation when there is one for that language and the post was written in another
 * one; the employer's own words are kept in `orig` (shown on request, and used when the employer edits the post).
 */
export function localizePost<T extends Translatable>(p: T, lang: UiLang): T {
  const tr = p.translations
  if (!tr || tr.src === lang) return p
  const t = tr[lang]
  if (!t) return p
  // the same words as the original (e.g. a title that is a name): nothing to show
  if (t.position === p.position && t.details === p.details) return p
  return { ...p, position: t.position, details: t.details || p.details, orig: { position: p.position, details: p.details }, ...(tr.src ? { translatedFrom: tr.src } : {}) }
}

/**
 * Occupations closed to foreigners in Thailand (List 1 of the Ministry of Labour notification of 2020 under the 2017 Emergency Decree;
 * some have exceptions, which a person checks) as they appear in a job title, in Thai, Chinese and English. A post for them in
 * Thailand stays inside the country. The AI check also says so (closedToForeigners) for wording these patterns miss.
 */
const CLOSED = [
  // services
  /ตัดผม|ดัดผม|ทำผม|เสริมสวย|理发|美发|发型师|美容师|hair\s*(dress|styl|cut)|barber|beautician/i,
  /นวดไทย|泰式按摩|泰国按摩|thai\s*massage/i,
  /มัคคุเทศก์|ไกด์|导游|tour\s*guide/i,
  /เลขานุการ|秘书|secretar(y|ial)/i,
  /ทนายความ|ว่าความ|อรรถคดี|律师|诉讼代理|lawyer|attorney|litigat/i,
  /คนขับรถ|พนักงานขับรถ|ขับรถ|司机|驾驶员|\bdriver\b/i,
  /ขายทอดตลาด|拍卖师|auctioneer/i,
  /เร่ขาย|หาบเร่|流动摊贩|street\s*vend|hawker/i,
  // Thai crafts
  /แกะสลักไม้|木雕|wood\s*carv/i, /เจียระไน|宝石切割|gem\s*(cutt|polish)/i, /ทอผ้า|ทอเสื่อ|จักสาน|手工织|hand[-\s]*weav/i,
  /เครื่องดนตรีไทย|泰国乐器|thai\s*musical\s*instrument/i, /พระพุทธรูป|佛像|buddha\s*image/i, /เครื่องเขิน|เครื่องถม|เครื่องลงหิน|lacquerware|niello/i,
  /ตุ๊กตาไทย|ทำบาตร|กระดาษสา|ร่มกระดาษ|ร่มผ้า|มวนบุหรี่|สาวไหม|เรียงอักษร/i,
]
export const closedToForeigners = (text: string) => CLOSED.some((re) => re.test(text))

/** the language a post was written in, from its letters: Thai script → th, Chinese characters → zh, otherwise en */
export function guessLang(text: string): UiLang {
  const th = (text.match(/[฀-๿]/g) ?? []).length, zh = (text.match(/[㐀-鿿]/g) ?? []).length
  return th === 0 && zh === 0 ? 'en' : th >= zh ? 'th' : 'zh'
}
