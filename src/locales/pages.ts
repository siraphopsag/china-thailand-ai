import type { Msg } from './common.js'
export const pages = {
  // ---- history / activity
  // ---- tabs
  // ---- shared ui
  // ---- AI command center / timeline
  // ---- analysis center
  // ---- ownership page
  // ---- nominee page
  // ---- employment
  // ---- contract
  // ---- language & culture
  'lng.title': ['ภาษาและวัฒนธรรมทางธุรกิจ', '语言与商务文化', 'Language and business culture'],
  'lng.sub': ['ศัพท์กฎหมายไม่ควรแปลตรงตัว ระบบจึงแสดงคำอธิบาย ศัพท์ต้นฉบับ และบริบทควบคู่กัน', '法律术语不宜直译，因此系统同时给出说明、原文术语和语境。', 'Legal terms should not be translated word for word, so the system shows the explanation, the original term and the context together.'],
  'lng.table': ['ตารางศัพท์ · ต้นฉบับ · ความหมาย/บริบท', '术语表 · 原文 · 含义/语境', 'Glossary · original · meaning/context'],
  'lng.col1': ['คำอธิบาย (ภาษาที่เลือก)', '说明（所选语言）', 'Explanation (selected language)'],
  'lng.col2': ['ศัพท์ต้นฉบับ', '原文术语', 'Original term'],
  'lng.col3': ['ความหมาย/บริบท', '含义/语境', 'Meaning / context'],
  'lng.note': ['ภาษาที่รองรับ: ไทย · จีน · อังกฤษ (ตัวอย่างคำศัพท์สำหรับ Prototype)', '支持语言：泰语 · 中文 · 英语（原型示例术语）', 'Supported languages: Thai · Chinese · English (sample terms for the prototype)'],
  'cul.title': ['แนวโน้มที่ควรคำนึงถึง ตามสถานการณ์ของคุณ', '结合您情境的值得留意的倾向', 'Tendencies worth considering, by situation'],
  'cul.warn': ['ข้อมูลนี้เป็นเพียง “แนวโน้มที่ควรคำนึงถึง” ไม่ใช่ข้อสรุปเกี่ยวกับบุคคลหรือคนทั้งกลุ่ม ทุกองค์กรและทุกคนมีความแตกต่างกัน ควรสอบถามและปรับตามสถานการณ์จริง', '以下只是“值得留意的倾向”，并非对个人或整个群体的结论。每个组织和每个人都不同，请根据实际情况询问并调整。', 'These are only tendencies worth considering, not conclusions about individuals or whole groups. Every organisation and person differs — ask and adapt to the real situation.'],
  'cul.pick': ['เลือกสถานการณ์', '选择情境', 'Choose a situation'],
  // ---- dashboard
  // ---- risk board
  // ---- roadmap
  // ---- documents
  // ---- monitoring
  // ---- sources / admin
  'src.title': ['ศูนย์แหล่งข้อมูล', '信息来源中心', 'Source center'],
  'src.sub': ['ทุกข้อกำหนดที่ระบบแสดงต้องอ้างอิงแหล่งทางการ กรุณากดลิงก์เพื่อตรวจสอบฉบับจริงเสมอ', '系统展示的每项规定都须引用官方来源，请务必点击链接核对正式文本。', 'Every requirement shown must cite an official source — always follow the link to check the real text.'],
  'src.warn': ['ข้อมูลตัวอย่างสำหรับ Prototype: ระเบียนด้านล่างเป็นการสรุปแบบย่อเพื่อสาธิตโครงสร้างข้อมูล ไม่ใช่ข้อมูลกฎหมายแบบเรียลไทม์ ลิงก์ชี้ไปยังหน้าหลักของหน่วยงาน และยังไม่มีระเบียนใดผ่านการตรวจสอบโดยผู้เชี่ยวชาญ (สถานะจึงเป็น “ต้องให้ผู้เชี่ยวชาญตรวจ”)', '原型示例数据：以下记录是为演示数据结构而作的简要概述，并非实时法规数据；链接指向机构首页，且尚无任何记录经专家核查（因此状态为“需专家审核”）。', 'Prototype sample data: the records below are short summaries to demonstrate the data structure, not real-time law; links point to agency home pages and no record has been expert-reviewed (hence “expert review required”).'],
  'src.search': ['ค้นหาแหล่งข้อมูล/หัวข้อ', '搜索来源/主题', 'Search sources/topics'],
  'src.allCountries': ['ทุกประเทศ', '所有国家', 'All countries'],
  // ---- pricing / privacy
  'pri.title': ['ความเป็นส่วนตัวและการเก็บข้อมูล', '隐私与数据存储', 'Privacy and data storage'],
  'pri.sub': ['สรุปสั้น ๆ สำหรับเวอร์ชัน Prototype', '原型版本的简要说明', 'A short summary for the prototype'],
  'pri.1.h': ['ข้อมูลที่เก็บ', '保存的数据', 'Data stored'],
  'pri.1.t': ['ข้อมูลที่คุณกรอกในการสัมภาษณ์และแบบฟอร์ม (เช่น ชื่อธุรกิจ สัดส่วนผู้ถือหุ้น ข้อมูลการจ้างงาน) รวมถึงภาษาและธีมที่คุณเลือก', '您在访谈和表单中填写的信息（如企业名称、持股比例、用工信息），以及您选择的语言和主题。', 'What you enter in the interview and forms (e.g. business name, shareholding, employment data), plus your chosen language and theme.'],
  'pri.2.h': ['เก็บที่ไหน', '存储位置', 'Where it is stored'],
  'pri.2.t': ['ในเบราว์เซอร์ของคุณเท่านั้น (localStorage) ระบบไม่บันทึกข้อมูลนี้ลงฐานข้อมูลกลาง ข้อมูลไม่ถูกแชร์ข้ามเครื่อง', '仅保存在您的浏览器中（localStorage）。系统不会把这些数据存入中央数据库，也不会跨设备共享。', 'Only in your browser (localStorage). The system does not save it to a central database and it is not shared across devices.'],
  'pri.3.h': ['ส่งออกนอกเครื่องเมื่อไร', '何时会离开您的设备', 'When data leaves your device'],
  'pri.3.t': ['เฉพาะเมื่อคุณใช้ช่อง “ถาม AI เฉพาะประเด็น” คำถาม โปรไฟล์ธุรกิจ และภาษาที่เลือกจะถูกส่งไปยังฟังก์ชันของเว็บนี้เพื่อประมวลผลแบบจำลอง ไม่มีการส่งให้ผู้ให้บริการ AI ภายนอกในเวอร์ชันนี้', '仅当您使用“就具体问题询问 AI”时，问题、企业档案和所选语言会发送到本网站的函数进行模拟处理；此版本不会发送给外部 AI 服务商。', 'Only when you use “Ask the AI about a specific point”: the question, business profile and chosen language are sent to this site’s function for simulated processing. Nothing goes to an external AI provider in this version.'],
  'pri.4.h': ['การลบข้อมูล', '删除数据', 'Deleting data'],
  'pri.4.t': ['กด “ล้างข้อมูลในเบราว์เซอร์” ที่ท้ายหน้าเว็บ หรือล้างข้อมูลเว็บไซต์ในเบราว์เซอร์', '点击页面底部的“清除浏览器中的数据”，或在浏览器中清除网站数据。', 'Press “Clear data in this browser” in the footer, or clear the site data in your browser.'],
  'pri.5.h': ['คำแนะนำ', '建议', 'Advice'],
  'pri.5.t': ['ไม่ควรกรอกข้อมูลส่วนบุคคลจริงหรือความลับทางธุรกิจในเวอร์ชันทดลอง ระบบนี้ไม่ได้ให้การรักษาความลับแบบที่ปรึกษากฎหมาย', '试用版本请勿填写真实个人信息或商业秘密。本系统不提供律师式的保密保障。', 'Do not enter real personal data or trade secrets in the trial version. This system does not provide lawyer-style confidentiality.'],
} as const satisfies Record<string, Msg>
