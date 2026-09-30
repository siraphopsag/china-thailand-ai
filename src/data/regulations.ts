import type { Regulation } from '../types'
import { tr, tk, type Lang } from '../i18n'

/** โครงสร้างระเบียนกฎระเบียบ — ข้อความแสดงผล (หน่วยงาน/หัวข้อ/ชื่อ/สรุปกฎ) อยู่ใน locales (reg.<id>.*)
 *  ทุกระเบียนเป็น "ข้อมูลตัวอย่างสำหรับ Prototype" ยังไม่ผ่านการตรวจโดยผู้เชี่ยวชาญ (lastVerified ว่าง)
 *  URL ชี้ไปยังหน้าหลักของหน่วยงานทางการ เพื่อให้ผู้ใช้ไปตรวจสอบข้อความฉบับจริง */
const base = { isSample: true, verificationStatus: 'EXPERT' as const }
export const regulations: Regulation[] = [
  { id: 'th-fba', country: 'TH', originalTerm: 'Foreign Business Act (FBA)', sourceUrl: 'https://www.dbd.go.th/', ...base },
  { id: 'th-dbd-reg', country: 'TH', sourceUrl: 'https://www.dbd.go.th/', ...base },
  { id: 'th-boi', country: 'TH', originalTerm: 'BOI Promotion', sourceUrl: 'https://www.boi.go.th/', ...base },
  { id: 'th-labour', country: 'TH', originalTerm: 'Work Permit', sourceUrl: 'https://www.mol.go.th/', ...base },
  { id: 'th-tax', country: 'TH', originalTerm: 'Tax residency', sourceUrl: 'https://www.rd.go.th/', ...base },
  { id: 'th-customs', country: 'TH', sourceUrl: 'https://www.customs.go.th/', ...base },
  { id: 'cn-neglist-2024', country: 'CN', originalTerm: '外商投资准入特别管理措施（负面清单）', sourceUrl: 'https://www.ndrc.gov.cn/', publicationDate: '2024-09', effectiveDate: '2024-11-01', ...base },
  { id: 'cn-fil', country: 'CN', originalTerm: '外商投资法 / 外商投资信息报告', sourceUrl: 'https://www.mofcom.gov.cn/', ...base },
  { id: 'cn-labor', country: 'CN', originalTerm: '劳动合同法 / 社会保险', sourceUrl: 'https://www.mohrss.gov.cn/', ...base },
  { id: 'cn-immigration', country: 'CN', originalTerm: '外国人工作许可 / 居留许可', sourceUrl: 'https://www.nia.gov.cn/', ...base },
  { id: 'cn-tax', country: 'CN', originalTerm: '个人所得税 / 税收居民', sourceUrl: 'https://www.chinatax.gov.cn/', ...base },
  { id: 'cn-customs', country: 'CN', sourceUrl: 'http://english.customs.gov.cn/', ...base },
]

/** จำลองการเปลี่ยนแปลงเวอร์ชันของกฎระเบียบ: ระเบียนใหม่มาแทนระเบียนเก่า */
export const simulatedReplacement: Regulation = {
  id: 'cn-neglist-next', country: 'CN', originalTerm: '负面清单（模拟版本）', sourceUrl: 'https://www.ndrc.gov.cn/',
  publicationDate: 'simulated', effectiveDate: 'simulated', lastVerified: new Date().toISOString().slice(0, 10), verificationStatus: 'EXPERT', isSample: true,
}
export const getReg = (id: string) => regulations.find((r) => r.id === id) ?? (id === simulatedReplacement.id ? simulatedReplacement : undefined)
export const regText = (id: string, field: 'auth' | 'topic' | 'title' | 'rule', lang?: Lang) => tr(`reg.${id}.${field}` as never, undefined, lang)
export const lastVerifiedText = (r: Regulation) => r.lastVerified ?? tk('reg', 'notVerified')
