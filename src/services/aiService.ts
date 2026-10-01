import type { ActionItem, AIResponse, ContractInput, EmploymentInput, Profile } from '../types'
import type { Lang } from '../i18n'
import * as E from './engines'
import { isObj } from '../profileSchema'

/**
 * ชั้นบริการ AI: เรียก /api/* (serverless) พร้อมภาษาที่ผู้ใช้เลือก ถ้าเรียกไม่ได้จะใช้ตัวจำลองในเบราว์เซอร์
 * API key ของผู้ให้บริการ AI ต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่มีคีย์ใน frontend)
 */
/** The browser never trusts a response shape it did not check: a malformed answer falls back to the local engine. */
export const isAIResponse = (x: unknown): x is AIResponse =>
  isObj(x) && typeof x.answer === 'string' && typeof x.reason === 'string' && typeof x.next === 'string' && typeof x.risk === 'string' &&
  Array.isArray(x.sources) && x.sources.every((s) => typeof s === 'string') && Array.isArray(x.modules) &&
  (x.citations === undefined || (Array.isArray(x.citations) && x.citations.every((c) => isObj(c) && typeof c.id === 'string' && typeof c.trust === 'string' && Array.isArray(c.provisions))))
const delay = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms))

export const aiService = {
  analyzeBusiness: (p: Profile, emp: EmploymentInput) => delay(E.assessRisks(p, emp)),
  detectNomineeRisk: (p: Profile) => delay(E.detectNomineeRisk(p)),
  generateContract: (c: ContractInput, mode = '') => delay(E.generateContract(c, mode), 700),
  generateDocument: (t: E.DocType, p: Profile, e: EmploymentInput, c: ContractInput, lang: Lang, actions: ActionItem[] = []) => delay(E.buildDocument(t, p, e, c, lang, actions), 450),
  /** Source-aware orchestration: language is part of the AI request context. */
  orchestrate: async (q: string, p: Profile | null, lang: Lang): Promise<AIResponse> => {
    try {
      const res = await fetch('/api/analyze-business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, profile: p, lang }) })
      if (res.ok) { const j: unknown = await res.json(); if (isAIResponse(j)) return j }
    } catch { /* fall through to local simulation */ }
    return delay(E.orchestrate(q, p, lang), 700)
  },
}
