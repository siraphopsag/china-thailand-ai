import { describe, expect, it } from 'vitest'
import { cleanTranslations, closedToForeigners, guessLang, localizePost } from './domain/match/postText'
import { makePost, mustStayDomestic, type PostInput } from './domain/match/logic'
import { levelCap, capStage } from './domain/match/release'
import { postToInput, postToRow, rowToPost, type PostRow } from './domain/match/remote'
import { cleanCheck } from './ai/spec'
import type { Post } from './domain/match/types'

const AT = '2026-10-09T09:00:00.000Z'
const base: PostInput = {
  place: { country: 'TH', province: 'TH-10' }, company: 'Sample Co', position: 'ล่ามภาษาจีน', industry: 'manufacturing', skills: ['thai_chinese_translation'], minYears: 1,
  details: 'แปลเอกสารและประชุมกับลูกค้าจีน', headcount: 1, employment: 'permanent', salary: null, startDate: '2026-10-20',
  languages: [{ lang: 'zh', level: 'professional' }], education: 'bachelor', benefits: [],
}
const tr = { src: 'th' as const, th: { position: 'ล่ามภาษาจีน', details: 'แปลเอกสารและประชุมกับลูกค้าจีน' }, zh: { position: '中文翻译', details: '翻译文件并与中国客户开会' }, en: { position: 'Chinese interpreter', details: 'Translate documents and join meetings with Chinese clients' } }

describe('translations of the employer’s own words (owner, Oct 2026)', () => {
  it('keeps only clean, short translations without contact details', () => {
    expect(cleanTranslations(tr)).toEqual(tr)
    expect(cleanTranslations({ zh: { position: '翻译', details: '电话 081 234 5678' }, en: { position: 'Interpreter', details: '' } })).toEqual({ en: { position: 'Interpreter', details: '' } })
    expect(cleanTranslations({ zh: { position: '', details: 'x' } })).toEqual({})
    expect(cleanTranslations('nonsense')).toEqual({})
    expect(cleanTranslations({ src: 'fr', en: { position: 'X', details: 'see www.example.com' } })).toEqual({})
  })
  it('a reader of another language sees the translation; the original stays in orig; the writer’s language sees the original', () => {
    const p: Pick<Post, 'position' | 'details' | 'translations' | 'orig' | 'translatedFrom'> = { position: base.position, details: base.details, translations: tr }
    const zh = localizePost(p, 'zh')
    expect(zh.position).toBe('中文翻译'); expect(zh.orig).toEqual({ position: base.position, details: base.details }); expect(zh.translatedFrom).toBe('th')
    expect(localizePost(p, 'th')).toBe(p)
    expect(localizePost({ position: 'X', details: '' }, 'en')).toEqual({ position: 'X', details: '' })
  })
  it('editing a translated post edits the employer’s own words', () => {
    const post = makePost({ ...base, translations: tr }, 'p1', 'me', AT)
    if (!post.ok) throw new Error('post')
    const shown = localizePost(post.value, 'en')
    expect(shown.position).toBe('Chinese interpreter')
    expect(postToInput(shown as Post).position).toBe(base.position)
  })
  it('guesses the language a post was written in from its letters', () => {
    expect(guessLang('ล่ามภาษาจีน')).toBe('th'); expect(guessLang('中文翻译')).toBe('zh'); expect(guessLang('Chinese interpreter')).toBe('en')
  })
  it('the AI check passes translations and the closed-occupation flag through its cleaning', () => {
    const c = cleanCheck({ verdict: 'ok', summary: '', flags: [], translations: tr, closedToForeigners: true })
    expect(c.translations?.zh?.position).toBe('中文翻译'); expect(c.closedToForeigners).toBe(true)
    const d = cleanCheck({ verdict: 'ok', summary: '', flags: [] })
    expect(d.translations).toBeUndefined(); expect(d.closedToForeigners).toBeUndefined()
  })
})

describe('who can apply (owner, Oct 2026)', () => {
  it('in-country only: the release stops at level 4, even for a verified company', () => {
    expect(levelCap({ verified: true, verifiedAs: 'company' })).toBe(5)
    expect(levelCap({ verified: true, verifiedAs: 'company', domesticOnly: true })).toBe(4)
    expect(levelCap({ verified: true, verifiedAs: 'person', domesticOnly: true })).toBe(3)
    expect(levelCap({ verified: false, domesticOnly: true })).toBe(2)
    expect(capStage(5, { verified: true, verifiedAs: 'company', domesticOnly: true })).toBe(4)
  })
  it('occupations closed to foreigners in Thailand stay in Thailand', () => {
    expect(closedToForeigners('รับสมัครไกด์ทัวร์จีน')).toBe(true); expect(closedToForeigners('招聘中文导游')).toBe(true); expect(closedToForeigners('Thai massage therapist')).toBe(true)
    expect(closedToForeigners('ล่ามภาษาจีน')).toBe(false)
    expect(mustStayDomestic({ ...base, position: 'ไกด์ภาษาจีน' })).toBe(true)
    expect(mustStayDomestic({ ...base, place: { country: 'CN', province: 'CN-GD' }, position: '导游' })).toBe(false) // the rule is Thai law
    const p = makePost({ ...base, position: 'ไกด์ภาษาจีน' }, 'p2', 'me', AT)
    expect(p.ok && p.value.domesticOnly).toBe(true)
  })
  it('the options and translations go to the database and come back', () => {
    const row = postToRow({ ...base, domesticOnly: true, workRight: true, translations: tr })
    expect(row.domestic_only).toBe(true); expect(row.work_right).toBe(true); expect(row.translations).toEqual(tr)
    expect(postToRow(base)).toMatchObject({ domestic_only: false, work_right: false, translations: {} }) // an edit without AI clears old translations
    const back = rowToPost({ id: 'x', employer_id: 'u', is_sample: false, company: 'C', position: 'P1', industry: 'manufacturing', skills: [], min_years: 0, details: '', headcount: 1, employment: 'permanent',
      salary_min: null, salary_max: null, salary_currency: null, start_date: null, languages: [], education: 'none', benefits: [], country: 'TH', province: 'TH-10', created_at: AT,
      domestic_only: true, work_right: true, translations: tr } as PostRow, 'u')
    expect(back.domesticOnly).toBe(true); expect(back.workRight).toBe(true); expect(back.translations?.en?.position).toBe('Chinese interpreter')
  })
})
