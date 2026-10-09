export type Msg = readonly [th: string, zh: string, en: string]
export const common = {
  // ---- app / nav
  'nav.privacy': ['ความเป็นส่วนตัว', '隐私', 'Privacy'],
  'nav.skip': ['ข้ามไปยังเนื้อหา', '跳到主要内容', 'Skip to content'],
  'theme.toDark': ['เปลี่ยนเป็นโหมดมืด', '切换为深色模式', 'Switch to dark mode'],
  'theme.toLight': ['เปลี่ยนเป็นโหมดสว่าง', '切换为浅色模式', 'Switch to light mode'],
  'lang.choose': ['เลือกภาษา', '选择语言', 'Choose language'],
  // ---- levels / verification: level.* and verify.* live in ux.ts and legal.ts (the copies here were always overridden)
  // ---- common words
  'c.sample': ['ข้อมูลตัวอย่างสำหรับ Prototype', '原型示例数据', 'Sample data for the prototype'],
  'c.disclaimer': [
    'ข้อมูลจากระบบมีวัตถุประสงค์เพื่อช่วยวิเคราะห์และจัดเตรียมข้อมูลเบื้องต้น ไม่ถือเป็นคำปรึกษาหรือการรับรองทางกฎหมาย และควรตรวจสอบกับแหล่งข้อมูลทางการหรือผู้เชี่ยวชาญเมื่อเป็นกรณีที่มีความเสี่ยงสูง',
    '系统信息仅用于协助分析和准备初步资料，不构成法律意见或法律认证；高风险情形应向官方来源或专业人士核实。',
    'Information from this system is intended to support preliminary analysis and preparation. It is not legal advice or legal certification; high-risk cases should be verified with official sources or professionals.'],
  'c.country': ['ประเทศ', '国家', 'Country'],
  'c.noData': ['ไม่พบข้อมูล', '未找到数据', 'No data found'],
  'country.TH': ['ไทย', '泰国', 'Thailand'],
  'country.CN': ['จีน', '中国', 'China'],
  // ---- workflow
  // ---- empty / errors
  'err.generic': ['ระบบไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง', '系统暂时无法处理，请稍后再试。', 'The system cannot complete this right now. Please try again.'],
  'err.notFound': ['ไม่พบหน้าที่ต้องการ', '未找到该页面', 'Page not found'],
  'err.home': ['กลับหน้าแรก', '返回首页', 'Back to home'],
  // ---- footer
  'foot.note': ['Prototype สำหรับสาธิต — ข้อมูลกฎหมายเป็นข้อมูลตัวอย่าง ไม่ใช่ข้อมูลเรียลไทม์', '演示原型——法规数据为示例，并非实时数据', 'Demo prototype — regulatory data is sample data, not real-time'],
  // ---- business context bar / AI labels
  // ---- tour
} as const satisfies Record<string, Msg>
