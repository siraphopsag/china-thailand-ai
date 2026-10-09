import type { Msg } from './common.js'
/** Legal-information trust layer: status words, citation labels, guard replies, admin copy. Spread after common, pages and ux in locales/index.ts and not redefined later, so its verify.* words are the ones shown. */
export const legal = {
  // ---- status chips (only "verified" means a named person checked it against the official text and nothing changed since)
  'verify.VERIFIED': ['ผู้เชี่ยวชาญตรวจแล้ว', '专家已核实', 'Reviewed by an expert'],
  'verify.STALE': ['การตรวจเก่าเกินกำหนด', '核查已过期', 'Review out of date'],
  'verify.CHANGED': ['ต้นฉบับเปลี่ยน รอตรวจใหม่', '原文已变更，待重新核查', 'Source changed — re-review needed'],
  'verify.NO_SOURCE': ['ยังไม่มีเนื้อหาที่ตรวจแล้ว', '尚无已核实内容', 'No reviewed content yet'],
  // ---- why a record is not shown as verified
  'trust.r.no-review': ['ยังไม่มีผู้เชี่ยวชาญตรวจและลงชื่อรับรองระเบียนนี้', '尚无专家核查并署名确认此记录', 'No expert has reviewed and signed off this record'],
  'trust.r.bad-review': ['บันทึกการตรวจไม่สมบูรณ์ (ไม่มีชื่อผู้ตรวจหรือวันที่ที่ถูกต้อง)', '核查记录不完整（缺少核查人或有效日期）', 'The review record is incomplete (no reviewer name or valid date)'],
  'trust.r.no-text-url': ['ยังไม่มีลิงก์ไปยังตัวบทฉบับทางการ จึงไม่มีต้นฉบับให้เทียบ', '尚无官方文本链接，无原文可供对照', 'There is no link to the official text yet, so there is nothing to check it against'],
  'trust.r.no-source-hash': ['บันทึกการตรวจไม่ผูกกับเวอร์ชันของตัวบท', '核查记录未绑定原文版本', 'The review is not tied to a version of the official text'],
  'trust.r.summary-edited': ['ข้อความสรุปถูกแก้ไขหลังการตรวจ ต้องตรวจซ้ำ', '摘要在核查后被修改，须重新核查', 'The summary was edited after the review and must be reviewed again'],
  'trust.r.source-changed': ['ตัวบทต้นฉบับเปลี่ยนไปจากฉบับที่ผู้ตรวจรับรอง', '官方原文已与核查时的版本不同', 'The official text differs from the version the reviewer approved'],
  'trust.r.review-old': ['การตรวจครั้งล่าสุดเกิน {n} วัน', '最近一次核查已超过 {n} 天', 'The last review is more than {n} days old'],
  'trust.r.monitor-stale': ['ระบบเฝ้าระวังการเปลี่ยนแปลงไม่มีข้อมูลใหม่เกิน {n} วัน', '变更监测已超过 {n} 天没有新数据', 'The change monitor has produced no data for more than {n} days'],
  'trust.r.gap': ['ระบบรู้จักชื่อกฎหมายนี้ แต่ยังไม่มีเนื้อหาสรุปที่ตรวจแล้ว', '系统只知道该法规的名称，尚无经核实的内容摘要', 'The app knows this law by name only and has no reviewed summary of it'],
  'trust.r.no-entry': ['ไม่พบระเบียนนี้ในทะเบียนแหล่งข้อมูล', '来源登记册中没有此记录', 'This record is not in the source registry'],
  'cite.whyNot': ['ทำไมยังไม่ขึ้น “ผู้เชี่ยวชาญตรวจแล้ว”', '为什么尚未显示“专家已核实”', 'Why this is not shown as “Reviewed by an expert”'],
  // ---- citation labels
  'cite.instrument': ['ตัวบท', '法规文本', 'Instrument'],
  'cite.provisions': ['มาตรา/ข้อ', '条款', 'Provisions'],
  'cite.unspecified': ['ยังไม่ระบุ (รอผู้ตรวจ)', '未注明（待核查人填写）', 'Not stated (awaiting a reviewer)'],
  'cite.textLink': ['เปิดตัวบทฉบับทางการ', '打开官方文本', 'Open the official text'],
  'cite.agencyOnly': ['เว็บไซต์หน่วยงาน (ยังไม่มีลิงก์ตัวบท)', '官方机构网站（尚无官方文本链接）', 'Agency website (no link to the legal text yet)'],
  'cite.monitored': ['เฝ้าระวังการเปลี่ยนแปลงอัตโนมัติ', '自动监测变更', 'Change monitoring on'],
  'cite.notMonitored': ['ยังไม่มีการเฝ้าระวังการเปลี่ยนแปลง', '尚未监测变更', 'No change monitoring yet'],
  // ---- notices on AI answers
  // ---- replies when the app cannot answer from verified sources
  // ---- sources page / admin page
  'src.warn': ['ระเบียนด้านล่างเป็นสรุปทั่วไป ตรวจสอบแล้ว {v} จาก {n} ระเบียน ป้าย “ผู้เชี่ยวชาญตรวจแล้ว” จะขึ้นได้ก็ต่อเมื่อมีผู้ตรวจลงชื่อเทียบกับตัวบททางการ และตัวบทกับข้อความสรุปยังไม่เปลี่ยนนับจากนั้น ใช้ลิงก์เพื่อตรวจฉบับจริงเสมอ', '下列记录为一般性摘要，已核实 {v}/{n} 条。只有当核查人对照官方文本署名确认，且此后原文和摘要均未变化时，才会显示“专家已核实”。请始终通过链接核对原文。', 'The records below are general summaries; {v} of {n} are reviewed. “Reviewed by an expert” appears only when a named reviewer signed off against the official text and neither the text nor the summary has changed since. Always check the original via the link.'],
} as const satisfies Record<string, Msg>
