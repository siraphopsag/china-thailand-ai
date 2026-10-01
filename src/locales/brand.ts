import type { Msg } from './common.js'
/** C.A.L.L. identity. The name and the full English name are identical in every language; only descriptions are translated. Loaded last. */
const NAME = 'C.A.L.L.', FULL = 'Cross ASEAN Language Legal', TITLE = 'C.A.L.L. — Cross ASEAN Language Legal'
export const brand = {
  'app.name': [NAME, NAME, NAME],
  'app.tagline': [FULL, FULL, FULL],
  'app.title': [TITLE, TITLE, TITLE],
  'land.pos': ['C.A.L.L. ช่วยให้ธุรกิจรับมือความซับซ้อนข้ามพรมแดน โดยเชื่อมบริบทธุรกิจ ภาษา ความเข้าใจด้านกฎหมาย การระบุความเสี่ยง และขั้นตอนที่ต้องทำต่อไว้ในที่เดียว', 'C.A.L.L. 将业务背景、语言、法律理解、风险识别和可执行的下一步连接在一起，帮助企业应对跨境业务的复杂性。', 'C.A.L.L. helps businesses navigate cross-border complexity by connecting business context, language, legal understanding, risk identification and actionable next steps.'],
  'brand.stands': ['C.A.L.L. ย่อมาจาก', 'C.A.L.L. 代表', 'What C.A.L.L. stands for'],
  'brand.cross': ['การเชื่อมต่อและความร่วมมือทางธุรกิจข้ามพรมแดน', '跨境商业连接与合作', 'Cross-border business connection and collaboration'],
  'brand.asean': ['บริบทธุรกิจและกฎหมายในภูมิภาคอาเซียน', '东盟区域的商业与法律环境', 'The ASEAN regional business and legal context'],
  'brand.language': ['ลดอุปสรรคด้านภาษา และช่วยให้เข้าใจกันข้ามภาษา', '减少语言障碍，促进跨语言理解', 'Fewer language barriers, better cross-language understanding'],
  'brand.legal': ['เข้าใจข้อกำหนด ความเสี่ยง สิ่งที่ต้องตรวจสอบ และขั้นตอนถัดไป', '理解法律要求、风险、需核实事项与下一步', 'Understanding legal requirements, risks, what to verify and next actions'],
  'brand.together': ['ทั้งสี่ส่วนทำงานร่วมกันในเส้นทางเดียว ไม่ใช่เครื่องมือแยกกัน และไม่ใช่การให้คำปรึกษาหรือรับรองทางกฎหมาย', '四个部分在同一流程中协同工作，并非独立工具，也不构成法律意见或法律认证。', 'The four work together in one workflow — not separate tools, and not legal advice or certification.'],
  'doc.brand': ['สร้างด้วย C.A.L.L. — Cross ASEAN Language Legal (ฉบับร่างเพื่อตรวจสอบ)', '由 C.A.L.L. — Cross ASEAN Language Legal 生成（待审草稿）', 'Generated with C.A.L.L. — Cross ASEAN Language Legal (draft for review)'],
  'ctx.analyzing': ['C.A.L.L. กำลังวิเคราะห์ธุรกิจนี้', 'C.A.L.L. 正在分析此业务', 'C.A.L.L. is analysing this business'],
  'an.working': ['C.A.L.L. กำลังวิเคราะห์ข้อมูลธุรกิจของคุณ…', 'C.A.L.L. 正在分析您的业务信息……', 'C.A.L.L. is analyzing your business context…'],
  'cc.title': ['ถาม C.A.L.L. เกี่ยวกับธุรกิจนี้', '就此业务向 C.A.L.L. 提问', 'Ask C.A.L.L. about this business'],
} as const satisfies Record<string, Msg>
