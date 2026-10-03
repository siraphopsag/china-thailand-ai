import type { Msg } from './common.js'
/** Employment-first home page and the main navigation (design pass). Business planning stays available as a secondary area. */
export const home = {
  // ---------- main navigation
  'nav.jobs': ['หางานในจีน', '在中国找工作', 'Jobs in China'],
  'nav.employerArea': ['สำหรับนายจ้าง', '雇主专区', 'For employers'],
  'nav.bizPlanning': ['วางแผนธุรกิจ', '业务规划', 'Business planning'],
  // ---------- hero
  'home.paths': ['เริ่มจากบทบาทของคุณ', '从您的角色开始', 'Start from your role'],
  // ---------- pillars (the four letters of C.A.L.L.)
  // ---------- how it works
  'home.steps.h': ['ลองใช้ต้นแบบใน 3 ขั้น', '三步体验原型', 'Try the prototype in 3 steps'],
  // ---------- secondary: business planning
  'home.biz.h': ['เครื่องมือวางแผนธุรกิจไทย–จีน', '泰中业务规划工具', 'Thailand–China business-planning tools'],
} as const satisfies Record<string, Msg>
