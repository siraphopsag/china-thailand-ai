import type { Msg } from './common.js'
/** Employment-first home page and the main navigation (design pass). Business planning stays available as a secondary area. */
export const home = {
  // ---------- main navigation
  'nav.jobs': ['หางานในจีน', '在中国找工作', 'Jobs in China'],
  'nav.employerArea': ['สำหรับนายจ้าง', '雇主专区', 'For employers'],
  'nav.legalInfo': ['ข้อมูลกฎหมาย', '法律信息', 'Legal info'],
  'nav.bizPlanning': ['วางแผนธุรกิจ', '业务规划', 'Business planning'],
  'nav.bizTools': ['เครื่องมือวางแผนธุรกิจ', '业务规划工具', 'Business-planning tools'],
  // ---------- hero
  'home.eyebrow': ['แพลตฟอร์มงานข้ามพรมแดนไทย–จีน · ต้นแบบ', '泰中跨境工作平台 · 原型', 'Thailand–China cross-border work platform · prototype'],
  'home.h1a': ['เชื่อมโอกาสการทำงานไทย⁠–⁠จีน', '连接泰中工作机会', 'Connecting work opportunities between Thailand and China'],
  'home.h1b': ['เตรียมตัวข้ามประเทศได้เข้าใจง่ายขึ้น', '让跨国准备更清晰', 'with clearer cross-border preparation'],
  'home.sub': ['C.A.L.L. รวมการดูตำแหน่งงาน การเตรียมตัวด้านภาษาและวัฒนธรรมการทำงาน และข้อมูลข้อกำหนดข้ามประเทศไว้ในที่เดียว สำหรับคนไทยที่มีทักษะและนายจ้างในจีน', 'C.A.L.L. 将职位浏览、语言与职场文化准备以及跨境要求信息汇集在一起，服务有技能的泰国人和中国雇主。', 'C.A.L.L. brings job exploration, language and workplace-culture preparation, and cross-border requirements together for skilled Thai professionals and employers in China.'],
  'home.proto': ['ตอนนี้เป็นต้นแบบที่ใช้ข้อมูลสมมติ ยังไม่มีการรับสมัครหรือจัดหางานจริง', '目前为使用虚构数据的原型，尚未进行真实招聘或职业介绍。', 'This is a prototype with fictional data; there is no real recruitment or placement yet.'],
  'home.paths': ['เริ่มจากบทบาทของคุณ', '从您的角色开始', 'Start from your role'],
  'home.orBiz': ['หรือ วางแผน/ขยายธุรกิจไทย–จีน', '或：规划/拓展泰中业务', 'Or plan / expand a Thailand–China business'],
  // ---------- pillars (the four letters of C.A.L.L.)
  'home.pillars.sub': ['สิ่งที่ทำให้การทำงานข้ามประเทศยาก และสิ่งที่ C.A.L.L. ช่วยเตรียม', '让跨国工作变难的因素，以及 C.A.L.L. 帮助准备的内容', 'What makes working across borders hard — and what C.A.L.L. helps you prepare'],
  'home.go.lang': ['ภาษาและวัฒนธรรม', '语言与文化', 'Language & culture'],
  'home.go.legal': ['ข้อมูลกฎหมายและแหล่งอ้างอิง', '法律信息与来源', 'Legal info & sources'],
  // ---------- how it works
  'home.steps.h': ['ลองใช้ต้นแบบใน 3 ขั้น', '三步体验原型', 'Try the prototype in 3 steps'],
  'home.step.1': ['เลือกว่าคุณเป็นคนหางานหรือนายจ้าง', '选择您是求职者还是雇主', 'Choose whether you are a worker or an employer'],
  'home.step.2': ['ดูตำแหน่งงานตัวอย่าง หรือสร้างประกาศตัวอย่าง', '浏览示例职位，或创建示例职位', 'Browse sample jobs, or create a sample job post'],
  'home.step.3': ['ลองสมัครและติดตามสถานะ — ทั้งหมดเป็นการจำลอง', '尝试申请并跟踪状态——全部为模拟', 'Try applying and follow the status — all simulated'],
  // ---------- secondary: business planning
  'home.biz.h': ['เครื่องมือวางแผนธุรกิจไทย–จีน', '泰中业务规划工具', 'Thailand–China business-planning tools'],
  'home.biz.d': ['สำหรับผู้ที่ต้องการตั้งหรือขยายธุรกิจข้ามพรมแดน: เลือกเส้นทางบนแผนที่ ตอบคำถาม แล้วได้แผนงาน เอกสาร และหน่วยงานที่ต้องติดต่อ', '面向计划设立或拓展跨境业务的用户：在地图上选择路线、回答问题，获得行动计划、文件和主管部门。', 'For setting up or expanding a cross-border business: choose a route on the map, answer questions, and get an action plan, documents and authorities.'],
} as const satisfies Record<string, Msg>
