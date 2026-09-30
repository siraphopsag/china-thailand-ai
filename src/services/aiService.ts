import type { ContractInput, EmploymentInput, Profile } from '../types'
import * as E from './engines'
import { terms } from '../data/culture'

/** ชั้นบริการ AI: เรียก /api/* (serverless) ส่วน API key ของผู้ให้บริการ AI ต้องอยู่ฝั่งเซิร์ฟเวอร์เท่านั้น */
const delay = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms))

export const aiService = {
  analyzeBusiness: (p: Profile, emp: EmploymentInput) => delay(E.assessRisks(p, emp)),
  analyzeOwnership: (p: Profile) => delay(E.ownershipDims(p)),
  detectNomineeRisk: (p: Profile) => delay(E.detectNomineeRisk(p)),
  analyzeEmployment: (e: EmploymentInput, p: Profile | null) => delay(E.analyzeEmployment(e, p)),
  generateRoadmap: (p: Profile) => delay(E.generateRoadmap(p)),
  generateContract: (c: ContractInput) => delay(E.generateContract(c), 600),
  generateDocument: (t: E.DocType, p: Profile, e: EmploymentInput, c: ContractInput) => delay(E.buildDocument(t, p, e, c, terms), 400),
  /** เรียก serverless endpoint ก่อน หากไม่พร้อมใช้งานจะใช้ตัวจำลองในเบราว์เซอร์ เพื่อให้ Demo ทำงานได้เสมอ */
  orchestrate: async (q: string, p: Profile | null) => {
    try {
      const res = await fetch('/api/analyze-business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, profile: p }) })
      if (res.ok) return (await res.json()) as ReturnType<typeof E.orchestrate>
    } catch { /* fall through to local simulation */ }
    return delay(E.orchestrate(q, p), 700)
  },
  verify: (p: Profile, e: EmploymentInput) => delay(E.verifyAnalysis(p, e)),
}
