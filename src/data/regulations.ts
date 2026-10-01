import type { Regulation } from '../types'
import { tr, tk, type Lang } from '../i18n'
import { registry } from './legal/registry'
import { assess, toVerification } from './legal/trust'

/** ระเบียนกฎระเบียบที่แสดงในแอป — สร้างจากทะเบียนแหล่งข้อมูล (data/legal/registry.ts) + การตรวจของผู้เชี่ยวชาญ (reviews.ts)
 *  + ผลเฝ้าระวังอัตโนมัติ (observed.ts) สถานะ "ตรวจสอบแล้ว" คำนวณจากหลักฐานเท่านั้น ห้ามกำหนดมือ
 *  วันที่มีผลบังคับใช้/มาตรา ปรากฏได้เฉพาะเมื่อผู้ตรวจเป็นคนกรอก (ไม่มีค่าที่เขียนจากความจำ)
 *  ข้อความสรุป (หน่วยงาน/หัวข้อ/ชื่อ/สรุปกฎ) อยู่ใน locales (reg.<id>.*) */
function toRegulation(id: string): Regulation {
  const e = registry.find((x) => x.id === id)!
  const t = assess(id)
  return {
    id, country: e.country, originalTerm: e.originalTerm, instrument: e.instrument,
    sourceUrl: e.textUrl ?? e.agencyUrl, agencyUrl: e.agencyUrl, textUrl: e.textUrl,
    effectiveDate: t.review?.effectiveDate, provisions: t.review?.provisions, lastVerified: t.review?.reviewedAt, reviewedBy: t.review?.reviewer,
    verificationStatus: toVerification(t.trust), trust: t.trust, trustReasons: t.reasons, monitored: e.watch && !!e.textUrl,
    isSample: t.trust !== 'VERIFIED',
  }
}
/** Records that have a summary the app can show. Coverage gaps (instrument known by name only) are listed separately. */
export const regulations: Regulation[] = registry.filter((e) => !e.gap).map((e) => toRegulation(e.id))
export const coverageGaps: Regulation[] = registry.filter((e) => e.gap).map((e) => toRegulation(e.id))

/** จำลองการเปลี่ยนแปลงเวอร์ชันของกฎระเบียบ: ระเบียนใหม่มาแทนที่ระเบียนเก่า (เดโมเท่านั้น ไม่ใช่ประกาศจริง) */
export const simulatedReplacement: Regulation = {
  id: 'cn-neglist-next', country: 'CN', originalTerm: '负面清单（模拟版本）', sourceUrl: 'https://www.ndrc.gov.cn/', agencyUrl: 'https://www.ndrc.gov.cn/',
  publicationDate: 'simulated', effectiveDate: 'simulated', verificationStatus: 'EXPERT', trust: 'UNVERIFIED', trustReasons: ['no-review'], monitored: false, isSample: true,
}
export const getReg = (id: string) => [...regulations, ...coverageGaps].find((r) => r.id === id) ?? (id === simulatedReplacement.id ? simulatedReplacement : undefined)
export const regText = (id: string, field: 'auth' | 'topic' | 'title' | 'rule', lang?: Lang) => tr(`reg.${id}.${field}` as never, undefined, lang)
export const lastVerifiedText = (r: Regulation) => r.lastVerified ?? tk('reg', 'notVerified')
