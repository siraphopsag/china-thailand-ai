import type { Msg } from './common.js'
/** C.A.L.L. identity. The name and the full English name are identical in every language; only descriptions are translated. Loaded last. */
const NAME = 'C.A.L.L.', FULL = 'Cross ASEAN Language Legal', TITLE = 'C.A.L.L. — Cross ASEAN Language Legal'
export const brand = {
  'app.name': [NAME, NAME, NAME],
  'app.tagline': [FULL, FULL, FULL],
  'app.title': [TITLE, TITLE, TITLE],
  'brand.stands': ['C.A.L.L. ย่อมาจาก', 'C.A.L.L. 代表', 'What C.A.L.L. stands for'],
  // short sentences of about the same length in every language (owner approved the Thai draft, Oct 2026)
  'brand.cross': ['เชื่อมคนทำงานกับนายจ้างข้ามพรมแดนไทย–จีน', '跨越泰中边境，连接求职者与雇主', 'Links workers and employers, Thailand–China'],
  'brand.asean': ['เริ่มที่ไทย–จีน แล้วขยายสู่อาเซียนทั้งภูมิภาค', '从泰中起步，逐步扩展到整个东盟', 'Starts with Thailand–China, then all of ASEAN'],
  'brand.language': ['ข้อมูล 3 ภาษา ลดปัญหาภาษาและวัฒนธรรมการทำงาน', '三种语言信息，减少语言与职场文化障碍', 'Three languages, fewer workplace-culture gaps'],
  'brand.legal': ['เข้าใจข้อกำหนดการทำงานข้ามประเทศ พร้อมแหล่งอ้างอิง', '了解跨国工作要求，并附参考来源', 'Cross-border work rules, with their sources'],
  'brand.together': ['ทั้งสี่ส่วนช่วยให้เตรียมตัวได้ครบในที่เดียว แต่ไม่ใช่การให้คำปรึกษาหรือรับรองทางกฎหมาย และไม่รับประกันการได้งานหรือวีซ่า', '四个部分帮助您在一处完成准备，但不构成法律意见或认证，也不保证获得工作或签证。', 'Together they help you prepare in one place — but they are not legal advice or certification, and do not guarantee a job or a visa.'],
  'hero.cta': ['เริ่มใช้งาน C.A.L.L.', '开始使用 C.A.L.L.', 'Start using C.A.L.L.'],
} as const satisfies Record<string, Msg>
