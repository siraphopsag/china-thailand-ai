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
  'pri.sub': ['สรุปสั้น ๆ สำหรับต้นแบบ C.A.L.L. (ปรับปรุง ต.ค. 2569)', '原型 C.A.L.L. 的简要说明（2026年10月更新）', 'A short summary for the C.A.L.L. prototype (updated Oct 2026)'],
  'pri.1.h': ['ข้อมูลที่เก็บ', '保存的数据', 'Data stored'],
  'pri.1.t': ['บัญชี: ชื่อ อีเมล (และลิงก์รูปโปรไฟล์ถ้าใช้ Google) วันที่สมัครและเข้าสู่ระบบล่าสุด · สิ่งที่คุณทำ: บทบาท ชื่อร้าน จังหวัดต้นทาง หมุด ประกาศงาน และการกดรับงาน · ภาษาและธีมเก็บในเบราว์เซอร์ของคุณ · รหัสผ่านถูกเข้ารหัสโดยผู้ให้บริการ เราไม่เห็น', '账号：姓名、邮箱（使用 Google 时还有头像链接）、注册日期和最近登录日期 · 您的操作：角色、店铺名、出发省份、图钉、招聘信息和接受的工作 · 语言和主题保存在您的浏览器中 · 密码由服务商加密保存，我们看不到', 'Account: name, e-mail (and profile picture link if you use Google), sign-up and last sign-in dates · What you do: role, shop name, home province, pins, job posts and accepted jobs · Language and theme stay in your browser · Passwords are stored encrypted by the provider; we never see them'],
  'pri.2.h': ['เก็บที่ไหน', '存储位置', 'Where it is stored'],
  'pri.2.t': ['ฐานข้อมูล Supabase (ศูนย์ข้อมูลในสิงคโปร์) และเว็บนี้ให้บริการผ่าน Vercel · ถ้าระบบบัญชีใช้งานไม่ได้ เว็บจะเข้าโหมดสาธิตและเก็บข้อมูลในเบราว์เซอร์ของคุณเท่านั้น', 'Supabase 数据库（新加坡数据中心），网站由 Vercel 提供服务 · 账号服务不可用时，网站进入演示模式，数据仅保存在您的浏览器中', 'A Supabase database (Singapore data centre); the site is served by Vercel · If accounts are unavailable, the site switches to demo mode and keeps data in your browser only'],
  'pri.3.h': ['ใช้ทำอะไร', '用途', 'What it is used for'],
  'pri.3.t': ['เพื่อจับคู่ประกาศกับผู้หางานตามพื้นที่และสายงาน · นายจ้างเห็นเฉพาะชื่อของผู้หางานที่กดรับประกาศของตน (ไม่เห็นอีเมล) · ผู้ดูแลระบบเห็นข้อมูลทั้งหมดเพื่อดูแลระบบและนับสถิติ · ไม่ขาย ไม่ส่งต่อ และไม่ใช้ทำโฆษณา', '用于按地区和行业匹配招聘与求职者 · 雇主只能看到接受其招聘的求职者姓名（看不到邮箱）· 管理员可查看全部数据以维护系统和统计 · 不出售、不转让，也不用于广告', 'To match posts with job seekers by area and field · An employer sees only the names of job seekers who accepted their post (not their e-mail) · Administrators see everything to run the site and count statistics · Never sold, shared or used for advertising'],
  'pri.4.h': ['การลบข้อมูล', '删除数据', 'Deleting data'],
  'pri.4.t': ['ลบบัญชีได้ทุกเมื่อที่หน้า "โปรไฟล์" → "ลบบัญชีของฉัน" บัญชี ประกาศ หมุด และการกดรับงานของคุณจะถูกลบทันที · ข้อมูลในเบราว์เซอร์ลบได้ด้วยการล้างข้อมูลเว็บไซต์ในเบราว์เซอร์', '您可以随时在"个人资料"→"删除我的账号"中删除账号，您的账号、招聘、图钉和接受的工作会立即删除 · 浏览器中的数据可通过清除浏览器的网站数据来删除', 'Delete your account at any time under "Profile" → "Delete my account": your account, posts, pins and accepted jobs are removed immediately · Data in your browser can be removed by clearing this site\'s data in your browser'],
  'pri.5.h': ['ต้นแบบ', '原型', 'Prototype'],
  'pri.5.t': ['นี่คือต้นแบบสำหรับนำเสนอ ข้อมูลงานและผู้หางานเป็นข้อมูลตัวอย่าง ไม่มีการส่งข้อมูลไปหน่วยงานจริง และไม่มีการรับชำระเงิน อย่ากรอกข้อมูลส่วนบุคคลหรือความลับทางธุรกิจจริงในแบบฟอร์ม', '这是用于演示的原型。招聘和求职数据均为示例，不会发送给任何真实机构，也不收取任何费用。请勿在表单中填写真实的个人信息或商业机密。', 'This is a demonstration prototype. Job and job-seeker data are samples; nothing is sent to real agencies and no payment is taken. Do not enter real personal data or business secrets in the forms.'],
} as const satisfies Record<string, Msg>
