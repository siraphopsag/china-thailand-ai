import type { Msg } from './common.js'
/** Simplified, plain-language user-facing copy. Keys here override earlier definitions (see locales/index.ts). */
export const ux = {
  // ---- navigation (few, plain labels)
  // ---- plain journey labels
  // ---- page titles in human language
  // ---- AI command center (5 clear actions)
  // ---- guide strip (where am I / what is AI doing / what next)
  // ---- progressive disclosure (level 1-4)
  // ---- simplified dashboard
  // ---- strip trailing arrow/link glyphs from action labels (icons are drawn in code)
  // ---- demo / real data separation, recovery
  'err.reset': ['ล้างข้อมูลที่บันทึกไว้แล้วเริ่มใหม่', '清除已保存的数据并重新开始', 'Clear saved data and start over'],
  'err.resetNote': ['หากข้อผิดพลาดเกิดซ้ำ อาจเกิดจากข้อมูลเก่าที่บันทึกไว้ในเบราว์เซอร์นี้', '如果错误反复出现，可能是本浏览器中保存的旧数据所致。', 'If this keeps happening, old data saved in this browser may be the cause.'],
  // ---- educational answer (not a refusal, not advice)
  // ---- API errors
  // ---- honesty about what is simulated
  // ---- ownership editor
  // ---- stale documents
  'c.loading': ['กำลังโหลด…', '加载中…', 'Loading…'],
  // ---- plain status words (codes stay in tooltips / details); verify.VERIFIED and verify.NO_SOURCE are in legal.ts
  'level.LOW': ['เรียบร้อย', '没问题', 'Looks fine'],
  'level.MEDIUM': ['ควรตรวจสอบ', '建议核查', 'Worth checking'],
  'level.NEEDS_REVIEW': ['ควรตรวจสอบ', '建议核查', 'Worth checking'],
  'level.HIGH': ['ควรหยุดก่อน', '建议先暂停', 'Pause first'],
  'verify.PARTIAL': ['ตรวจสอบบางส่วน', '部分核实', 'Partly verified'],
  'verify.NEED_INFO': ['ต้องการข้อมูลเพิ่ม', '需补充信息', 'Needs more information'],
  'verify.EXPERT': ['ผู้เชี่ยวชาญยังไม่ได้ตรวจ', '专家尚未核查', 'Not yet reviewed by an expert'],
  // ---- landing: one clear starting point
  // ---- quick start / resume
  // ---- merged pages
  // ---- guided demo: 9 steps on the simplified pages
} as const satisfies Record<string, Msg>
