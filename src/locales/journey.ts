import type { Msg } from './common.js'
/** Five primary areas, the five-step journey, and the "found → why → unknown → verify → next" finding structure. Loaded last (overrides earlier keys). */
export const journey = {
  // ---- five primary areas
  // ---- the journey
  // ---- finding structure (same five parts everywhere)
  // ---- business page: what the AI understood / still needs
  // ---- analysis page
  // ---- status wording (four statuses the product uses)
  'verify.EXPERT': ['ต้องให้ผู้เชี่ยวชาญตรวจ', '需专家审核', 'Expert review required'],
  'verify.NEED_INFO': ['ต้องการข้อมูลเพิ่ม', '需补充信息', 'Needs more information'],
  'verify.PARTIAL': ['ตรวจสอบบางส่วน', '部分核实', 'Partially verified'],
  'verify.VERIFIED': ['ตรวจสอบแล้ว', '已核实', 'Verified'],
  'c.sample': ['ข้อมูลเดโม/ตัวอย่าง', '演示/示例数据', 'Demo / Example data'],
  // ---- documents: why a document is needed and what it is tied to
  // ---- home
  // ---- guided demo: one connected story (7 steps)
  // ---- names that follow the five areas
} as const satisfies Record<string, Msg>
