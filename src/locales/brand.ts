import type { Msg } from './common.js'
/** C.A.L.L. identity. The name and the full English name are identical in every language; only descriptions are translated. Loaded last. */
const NAME = 'C.A.L.L.', FULL = 'Cross ASEAN Language Legal', TITLE = 'C.A.L.L. — Cross ASEAN Language Legal'
export const brand = {
  'app.name': [NAME, NAME, NAME],
  'app.tagline': [FULL, FULL, FULL],
  'app.title': [TITLE, TITLE, TITLE],
  'land.pos': ['C.A.L.L. ช่วยให้ธุรกิจรับมือความซับซ้อนข้ามพรมแดน โดยเชื่อมบริบทธุรกิจ ภาษา ความเข้าใจด้านกฎหมาย การระบุความเสี่ยง และขั้นตอนที่ต้องทำต่อไว้ในที่เดียว', 'C.A.L.L. 将业务背景、语言、法律理解、风险识别和可执行的下一步连接在一起，帮助企业应对跨境业务的复杂性。', 'C.A.L.L. helps businesses navigate cross-border complexity by connecting business context, language, legal understanding, risk identification and actionable next steps.'],
  'brand.stands': ['C.A.L.L. ย่อมาจาก', 'C.A.L.L. 代表', 'What C.A.L.L. stands for'],
  // short sentences of about the same length in every language (owner approved the Thai draft, Oct 2026)
  'brand.cross': ['เชื่อมคนทำงานกับนายจ้างข้ามพรมแดนไทย–จีน', '跨越泰中边境，连接求职者与雇主', 'Links workers and employers, Thailand–China'],
  'brand.asean': ['เริ่มที่ไทย–จีน แล้วขยายสู่อาเซียนทั้งภูมิภาค', '从泰中起步，逐步扩展到整个东盟', 'Starts with Thailand–China, then all of ASEAN'],
  'brand.language': ['ข้อมูล 3 ภาษา ลดปัญหาภาษาและวัฒนธรรมการทำงาน', '三种语言信息，减少语言与职场文化障碍', 'Three languages, fewer workplace-culture gaps'],
  'brand.legal': ['เข้าใจข้อกำหนดการทำงานข้ามประเทศ พร้อมแหล่งอ้างอิง', '了解跨国工作要求，并附参考来源', 'Cross-border work rules, with their sources'],
  'brand.together': ['ทั้งสี่ส่วนช่วยให้เตรียมตัวได้ครบในที่เดียว แต่ไม่ใช่การให้คำปรึกษาหรือรับรองทางกฎหมาย และไม่รับประกันการได้งานหรือวีซ่า', '四个部分帮助您在一处完成准备，但不构成法律意见或认证，也不保证获得工作或签证。', 'Together they help you prepare in one place — but they are not legal advice or certification, and do not guarantee a job or a visa.'],
  'doc.brand': ['สร้างด้วย C.A.L.L. — Cross ASEAN Language Legal (ฉบับร่างเพื่อตรวจสอบ)', '由 C.A.L.L. — Cross ASEAN Language Legal 生成（待审草稿）', 'Generated with C.A.L.L. — Cross ASEAN Language Legal (draft for review)'],
  'ctx.analyzing': ['C.A.L.L. กำลังวิเคราะห์ธุรกิจนี้', 'C.A.L.L. 正在分析此业务', 'C.A.L.L. is analysing this business'],
  'an.working': ['C.A.L.L. กำลังวิเคราะห์ข้อมูลธุรกิจของคุณ…', 'C.A.L.L. 正在分析您的业务信息……', 'C.A.L.L. is analyzing your business context…'],
  'cc.title': ['ถาม C.A.L.L. เกี่ยวกับธุรกิจนี้', '就此业务向 C.A.L.L. 提问', 'Ask C.A.L.L. about this business'],
  'hero.h1a': ['เชื่อมธุรกิจข้ามพรมแดน', '跨越边界，连接业务', 'Connect across borders.'],
  'hero.h1b': ['เข้าใจสิ่งที่สำคัญ', '理解真正重要的事', 'Understand what matters.'],
  'hero.cta': ['เริ่มใช้งาน C.A.L.L.', '开始使用 C.A.L.L.', 'Start using C.A.L.L.'],
  'hero.preview': ['ตัวอย่างการทำงาน', '运行示例', 'How it works'],
  'hero.act.1': ['รับข้อมูลธุรกิจแล้ว', '已接收业务信息', 'Business information received'],
  'hero.act.2': ['สร้างบริบทธุรกิจแล้ว', '已建立业务背景', 'Business context created'],
  'hero.act.3': ['วิเคราะห์ปัจจัยข้ามพรมแดน: ภาษา กฎหมาย การจ้างงาน', '已分析跨境因素：语言、法律、用工', 'Cross-border factors analysed: language, legal, employment'],
  'hero.act.4': ['กำลังสร้างงานที่ควรทำต่อ', '正在生成下一步行动', 'Creating recommended next actions'],
  'hero.tag.lang': ['ภาษา', '语言', 'Language'],
  'hero.tag.legal': ['ข้อกำหนดทางกฎหมาย', '法律要求', 'Legal requirements'],
  'hero.tag.risk': ['ความเสี่ยงที่ต้องตรวจสอบ', '需核实的风险', 'Risks to verify'],
  'hero.tag.next': ['สิ่งที่ต้องทำต่อ', '下一步行动', 'Next actions'],
  'hero.sample': ['ภาพตัวอย่างเพื่ออธิบายการทำงาน ไม่ใช่ผลวิเคราะห์จริง', '用于说明流程的示例，并非真实分析结果。', 'Illustration of how it works — not a real analysis.'],
} as const satisfies Record<string, Msg>
