import type { Level, StepStatus, Verification, Direction } from '../types'

export const levelLabel: Record<Level, string> = {
  LOW: 'ความเสี่ยงต่ำ (LOW)', MEDIUM: 'ความเสี่ยงปานกลาง (MEDIUM)', HIGH: 'ความเสี่ยงสูง (HIGH)', NEEDS_REVIEW: 'ต้องตรวจสอบเพิ่มเติม (NEEDS REVIEW)',
}
export const levelShort: Record<Level, string> = { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง', NEEDS_REVIEW: 'ต้องตรวจสอบ' }
export const levelStyle: Record<Level, string> = {
  LOW: 'bg-green-100 text-green-800 border-green-300',
  MEDIUM: 'bg-amber-100 text-amber-900 border-amber-300',
  HIGH: 'bg-red-100 text-red-800 border-red-300',
  NEEDS_REVIEW: 'bg-orange-100 text-orange-900 border-orange-300',
}
export const levelBar: Record<Level, string> = { LOW: 'border-l-green-500', MEDIUM: 'border-l-amber-400', HIGH: 'border-l-red-500', NEEDS_REVIEW: 'border-l-orange-400' }
export const levelIcon: Record<Level, string> = { LOW: '✓', MEDIUM: '!', HIGH: '⚠', NEEDS_REVIEW: '?' }

export const verifyLabel: Record<Verification, string> = {
  VERIFIED: 'ตรวจสอบแล้ว (VERIFIED)', PARTIAL: 'ตรวจสอบบางส่วน (PARTIALLY VERIFIED)', NEED_INFO: 'ต้องการข้อมูลเพิ่ม (NEEDS MORE INFORMATION)',
  NO_SOURCE: 'ไม่พบแหล่งข้อมูล (SOURCE NOT FOUND)', EXPERT: 'ต้องให้ผู้เชี่ยวชาญตรวจ (EXPERT REVIEW REQUIRED)',
}
export const verifyStyle: Record<Verification, string> = {
  VERIFIED: 'bg-green-100 text-green-800', PARTIAL: 'bg-sky-100 text-sky-800', NEED_INFO: 'bg-amber-100 text-amber-900',
  NO_SOURCE: 'bg-slate-200 text-slate-700', EXPERT: 'bg-red-100 text-red-800',
}

export const stepLabel: Record<StepStatus, string> = { todo: 'ยังไม่เริ่ม', doing: 'กำลังดำเนินการ', review: 'รอตรวจสอบ', done: 'เสร็จแล้ว', fix: 'ต้องแก้ไข' }
export const stepStyle: Record<StepStatus, string> = {
  todo: 'bg-slate-100 text-slate-700', doing: 'bg-blue-100 text-blue-800', review: 'bg-amber-100 text-amber-900', done: 'bg-green-100 text-green-800', fix: 'bg-red-100 text-red-800',
}

export const dirInfo = (d: Direction) =>
  d === 'TH_CN'
    ? { from: 'ไทย', to: 'จีน', fromFlag: '🇹🇭', toFlag: '🇨🇳', text: 'ประเทศไทย → ประเทศจีน', originNat: 'ไทย', localNat: 'จีน' }
    : { from: 'จีน', to: 'ไทย', fromFlag: '🇨🇳', toFlag: '🇹🇭', text: 'ประเทศจีน → ประเทศไทย', originNat: 'จีน', localNat: 'ไทย' }

export const DISCLAIMER =
  'ข้อมูลจากระบบมีวัตถุประสงค์เพื่อช่วยวิเคราะห์และจัดเตรียมข้อมูลเบื้องต้น ไม่ถือเป็นคำปรึกษาหรือการรับรองทางกฎหมาย และควรตรวจสอบกับแหล่งข้อมูลทางการหรือผู้เชี่ยวชาญเมื่อเป็นกรณีที่มีความเสี่ยงสูง'
export const SAMPLE_NOTE = 'ข้อมูลตัวอย่างสำหรับ Prototype'

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
