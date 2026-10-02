import type { Msg } from './common.js'
/** First step after "Start using C.A.L.L." (/choose-role): find work, hire (both simulated), or plan a business (the existing tool). */
export const entry = {
  'choose.title': ['คุณต้องการใช้ C.A.L.L. ทำอะไร?', '您想用 C.A.L.L. 做什么？', 'What would you like to do with C.A.L.L.?'],
  'choose.sub': ['เลือกหนึ่งทาง การหางานและการรับสมัครเป็นการจำลองด้วยข้อมูลสมมติ ส่วนการวางแผนธุรกิจเป็นเครื่องมือเดิมของ C.A.L.L.', '请选择一项。求职和招聘是使用虚构数据的模拟；业务规划是 C.A.L.L. 原有的工具。', 'Choose one. Finding work and hiring are simulations with fictional data; business planning is the existing C.A.L.L. tool.'],
  'choose.employment': ['หางานและรับสมัครงานในจีน (จำลอง)', '在中国求职与招聘（模拟）', 'Work and hiring in China (simulation)'],
  'choose.simBadge': ['จำลอง · ข้อมูลสมมติ', '模拟 · 虚构数据', 'Simulation · fictional data'],
  'choose.worker.get': ['ดูงานตัวอย่าง · โปรไฟล์ · ทดลองสมัครและติดตามสถานะ', '浏览示例职位 · 个人资料 · 尝试申请并跟踪状态', 'Browse sample jobs · profile · try applying and follow the status'],
  'choose.employer.get': ['ดูองค์กรตัวอย่าง · สร้างประกาศ · ดูใบสมัครจำลอง', '查看示例机构 · 发布职位 · 查看模拟申请', 'See the sample organisation · post jobs · review simulated applications'],
  'choose.business.h': ['วางแผนธุรกิจข้ามพรมแดน', '跨境业务规划', 'Cross-border business planning'],
  'choose.business.t': ['ฉันต้องการวางแผนหรือขยายธุรกิจไทย–จีน', '我想规划或拓展泰中业务', 'I want to plan or expand a Thailand–China business'],
  'choose.business.d': ['เครื่องมือเดิม: เลือกเส้นทางบนแผนที่ ตอบคำถามสั้น ๆ แล้วได้แผนงาน เอกสาร และหน่วยงานที่ต้องติดต่อ ไม่เกี่ยวกับการหางาน', '原有工具：在地图上选择路线、回答几个问题，获得行动计划、文件清单和主管部门。与求职无关。', 'The existing tool: choose a route on the map, answer a few questions and get an action plan, documents and authorities. Not about finding a job.'],
  'choose.error': ['เปิดบทบาทตัวอย่างนี้ไม่ได้ จึงยังไม่ได้เปลี่ยนหน้า ลองใหม่ หรือเลือกบทบาทจากเมนู "บทบาทจำลอง" ด้านบน', '无法打开该示例角色，因此未跳转页面。请重试，或从上方的“模拟角色”菜单中选择。', 'This sample role could not be opened, so the page did not change. Try again, or pick a role from the “Simulated role” menu above.'],
  'choose.back': ['กลับหน้าแรก', '返回首页', 'Back to the home page'],
} as const satisfies Record<string, Msg>
