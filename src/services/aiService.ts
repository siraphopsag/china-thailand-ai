import type { AIResponse, ContractInput, EmploymentInput, Profile } from '../types'
import type { Lang } from '../i18n'
import * as E from './engines'

/**
 * ชั้นบริการ AI: เรียก /api/* (serverless) พร้อมภาษาที่ผู้ใช้เลือก ถ้าเรียกไม่ได้จะใช้ตัวจำลองในเบราว์เซอร์
 * API key ของผู้ให้บริการ AI ต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น (ไม่มีคีย์ใน frontend)
 */
const delay = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms))

export const aiService = {
  analyzeBusiness: (p: Profile, emp: EmploymentInput) => delay(E.assessRisks(p, emp)),
  detectNomineeRisk: (p: Profile) => delay(E.detectNomineeRisk(p)),
  generateContract: (c: ContractInput, mode = '') => delay(E.generateContract(c, mode), 700),
  generateDocument: (t: E.DocType, p: Profile, e: EmploymentInput, c: ContractInput, lang: Lang) => delay(E.buildDocument(t, p, e, c, lang), 450),
  /** Source-aware orchestration: language is part of the AI request context. */
  orchestrate: async (q: string, p: Profile | null, lang: Lang): Promise<AIResponse> => {
    try {
      const res = await fetch('/api/analyze-business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, profile: p, lang }) })
      if (res.ok) return (await res.json()) as AIResponse
    } catch { /* fall through to local simulation */ }
    return delay(E.orchestrate(q, p, lang), 700)
  },
}
