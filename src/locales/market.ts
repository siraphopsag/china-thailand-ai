import type { Msg } from './common.js'
/**
 * Owner's feedback round after friends tried the site (Oct 2026): a clear "verified" tick after the employer's name, verifying an
 * employer who is a private person (option ก: a mobile number confirmed with a code), the board's map as a job-market view,
 * the quota as a small chip, and a smoother mode for older phones. (Re-worded older keys were changed where they are defined.)
 */
export const market = {
  // ---------- 1. the tick after the employer's name (friends read "Verified" as "the employees are verified")
  'm.vf.tick.company': ['บริษัทนี้ยืนยันตัวตนกับระบบแล้ว', '该公司已通过平台认证', 'This company is verified'],
  'm.vf.tick.person': ['นายจ้างบุคคลธรรมดา ยืนยันตัวตนด้วยเบอร์มือถือแล้ว', '个人雇主，已通过手机号认证', 'A private employer, verified by mobile number'],

  // ---------- option ก: the release levels shown as reach rings — who can see a post, never how good it is
  'm.lv.ring': ['วงที่ {n} จาก 5', '第 {n} 圈（共 5 圈）', 'Ring {n} of 5'],
  'm.lv.to.1': ['คนที่ตรงทุกข้อ', '完全匹配的人', 'perfect matches'],
  'm.lv.to.2': ['คนที่ตรงสายงาน', '专业对口的人', 'the same field'],
  'm.lv.to.3': ['คนในจังหวัดเดียวกัน', '同一府/省的人', 'the same province'],
  'm.lv.to.4': ['ทั้งประเทศ', '全国', 'the whole country'],
  'm.lv.to.5': ['ทุกประเทศ', '所有国家', 'every country'],

  // ---------- 6. verifying an employer: a company or a private person
  'm.vf.kind': ['คุณเป็นนายจ้างแบบไหน', '您是哪类雇主', 'What kind of employer are you?'],
  'm.vf.kind.company': ['บริษัท / นิติบุคคล', '公司 / 法人', 'A company'],
  'm.vf.kind.person': ['บุคคลธรรมดา', '个人', 'A private person'],
  'm.vf.lead.person': ['ไม่มีเลขทะเบียนบริษัทก็ยืนยันได้: ยืนยันเบอร์มือถือด้วยรหัสครั้งเดียว แล้วผู้ดูแลระบบ (ทำหน้าที่แทนหน่วยงานในต้นแบบ) จะตรวจและอนุมัติ ประกาศของนายจ้างบุคคลธรรมดาที่ยืนยันแล้วเผยแพร่ได้ถึงวงที่ 3',
    '没有企业注册号也能认证：用一次性验证码确认手机号码，再由管理员（在原型中代为扮演机构）审核批准。已认证的个人雇主，招聘信息最多发布到第 3 圈。',
    'No company number? Confirm a mobile number with a one-time code; an administrator (playing the agency in the prototype) then checks and approves it. A verified private employer’s posts reach ring 3 at most.'],
  'm.vf.country.person': ['ประเทศของเบอร์มือถือ', '手机号所属国家', 'Country of the mobile number'],
  'm.vf.phone': ['เบอร์มือถือ', '手机号码', 'Mobile number'],
  'm.vf.phone.hint.TH': ['เบอร์มือถือไทย 10 หลัก เช่น 08x-xxx-xxxx', '泰国手机号 10 位，例如 08x-xxx-xxxx', 'Thai mobile, 10 digits, e.g. 08x-xxx-xxxx'],
  'm.vf.phone.hint.CN': ['เบอร์มือถือจีน 11 หลัก เช่น 13x-xxxx-xxxx', '中国手机号 11 位，例如 13x-xxxx-xxxx', 'Chinese mobile, 11 digits, e.g. 13x-xxxx-xxxx'],
  'm.vf.phone.privacy': ['ระบบเก็บเฉพาะเลข 4 ตัวท้าย ไม่เก็บเบอร์เต็ม และไม่ขอเลขบัตรประชาชน', '系统只保存后 4 位，不保存完整号码，也不索取身份证号', 'Only the last 4 digits are kept — never the full number, and no ID-card number is asked for'],
  'm.vf.sendCode': ['ส่งรหัสยืนยัน', '发送验证码', 'Send a code'],
  'm.vf.codeDemo': ['ต้นแบบ: ระบบไม่ได้ส่ง SMS จริง — รหัสของคุณคือ {c}', '原型：不会真的发送短信——您的验证码是 {c}', 'Prototype: no real SMS is sent — your code is {c}'],
  'm.vf.code': ['รหัส 6 หลัก', '6 位验证码', '6-digit code'],
  'm.vf.confirmCode': ['ยืนยันรหัสและส่งตรวจ', '确认验证码并提交审核', 'Confirm the code and send'],
  'm.vf.resend': ['ขอรหัสใหม่', '重新获取', 'New code'],
  'm.vf.codeOld': ['รหัสหมดอายุหรือกรอกผิดหลายครั้งแล้ว — ขอรหัสใหม่', '验证码已过期或错误次数过多——请重新获取', 'The code has expired or was wrong too often — get a new one'],
  'm.err.phone': ['เบอร์มือถือไม่ถูกต้อง — ตรวจจำนวนหลักและประเทศอีกครั้ง', '手机号码不正确——请检查位数和国家', 'That mobile number is not valid — check the digits and the country'],
  'm.err.code': ['รหัสไม่ถูกต้อง ลองอีกครั้ง', '验证码不正确，请重试', 'Wrong code — try again'],
  'm.vf.verified.person': ['ยืนยันตัวบุคคลแล้ว', '已完成个人认证', 'Verified as a private person'],
  'm.vf.asPerson': ['บุคคลธรรมดา · มือถือ ••••{d}', '个人 · 手机 ••••{d}', 'Private person · mobile ••••{d}'],
  'm.vf.toCompanyBtn': ['เปลี่ยนวิธียืนยัน', '更改认证方式', 'Change how I am verified'],
  'm.vf.toCompany': ['มีบริษัทแล้ว? ยืนยันด้วยเลขทะเบียนเพื่อเปิดวงที่ 4–5', '已有公司？用注册号认证即可开放第 4–5 圈', 'Have a company? Verify its number to open rings 4–5'],
  'm.vf.capNote.person': ['คุณยืนยันแบบบุคคลธรรมดา ประกาศจึงเผยแพร่ได้ถึงวงที่ 3 — ยืนยันด้วยเลขทะเบียนบริษัทเพื่อเปิดวงที่ 4–5', '您以个人身份认证，招聘信息最多发布到第 3 圈——用企业注册号认证可开放第 4–5 圈', 'You are verified as a private person, so the post reaches ring 3 at most — verify a company number to open rings 4–5'],
  'm.adm.kind.person': ['บุคคลธรรมดา', '个人', 'Private person'],
  'm.adm.verifyPerson': ['บุคคลธรรมดา: ในต้นแบบเบอร์มือถือยืนยันด้วยรหัสแล้ว — ถ้าใช้งานจริงควรโทรกลับหรือตรวจผ่าน ThaID ก่อนอนุมัติ', '个人：原型中手机号已通过验证码确认——正式使用时应回电或通过 ThaID 核实后再批准', 'Private persons: in the prototype the mobile number was confirmed with a code — in real use, call back or check through ThaID before approving'],

  // ---------- 3. the board's top row
  'm.qb.chip.pin': ['หมุด {n}/{max}', '标记 {n}/{max}', 'Pins {n}/{max}'],
  'm.qb.chip.post': ['ประกาศ {n}/{max}', '发布 {n}/{max}', 'Posts {n}/{max}'],
  'm.qb.chip.d': ['ใช้ไปแล้วในรอบนี้ · {r}', '本周期已用 · {r}', 'Used this cycle · {r}'],
  'm.bd.waitingChip': ['รอคุณตอบ {n}', '待您回复 {n}', '{n} waiting for you'],

  // ---------- 4. the map view: the job market
  'm.mk.title': ['สภาพตลาดงาน', '就业市场概况', 'Job market'],
  'm.mk.scope': ['ดูข้อมูลของ', '查看范围', 'Show'],
  'm.mk.all': ['รวม', '全部', 'Both'],
  'm.mk.posts': ['ประกาศ', '招聘信息', 'Posts'],
  'm.mk.places': ['คนที่ต้องการ', '招聘人数', 'People wanted'],
  'm.mk.employers': ['นายจ้างที่โพสต์', '发布的雇主', 'Employers posting'],
  'm.mk.pins': ['หมุดผู้หางาน', '求职者标记', 'Job seekers’ pins'],
  'm.mk.top': ['5 จังหวัดที่คึกคักที่สุด', '最活跃的 5 个省份', 'The 5 busiest provinces'],
  'm.mk.col.place': ['ประเทศ · จังหวัด', '国家 · 省份', 'Country · province'],
  'm.mk.col.pins': ['หมุด', '标记', 'Pins'],
  'm.mk.col.employers': ['บริษัทที่โพสต์', '发布的公司', 'Employers'],
  'm.mk.rising': ['อาชีพมาแรง', '热门求职方向', 'Rising fields'],
  'm.mk.rising.d': ['นับจากหมุดของผู้หางาน · ลูกศรเทียบ 7 วันล่าสุดกับ 7 วันก่อน', '来自求职者的标记 · 箭头对比最近 7 天与之前 7 天', 'From job seekers’ pins · the arrow compares the last 7 days with the 7 before'],
  'm.mk.wanted': ['อาชีพยอดฮิต', '热门招聘行业', 'Most wanted fields'],
  'm.mk.wanted.d': ['นับจากประกาศของนายจ้าง (จำนวนคนที่ต้องการ)', '来自雇主的招聘信息（招聘人数）', 'From employers’ posts (people wanted)'],
  'm.mk.balance': ['อุปสงค์–อุปทาน', '供需对比', 'Demand and supply'],
  'm.mk.balance.d': ['ต่ออาชีพ: คนที่นายจ้างต้องการ เทียบกับคนที่ปักหมุดหางาน', '按行业：雇主需要的人数对比标记求职的人数', 'Per field: people employers want against people pinning for work'],
  'm.mk.need': ['ต้องการ {n}', '需求 {n}', '{n} wanted'],
  'm.mk.seek': ['หางาน {n}', '求职 {n}', '{n} looking'],
  'm.mk.short.people': ['คนขาด', '缺人', 'Short of people'],
  'm.mk.short.jobs': ['งานขาด', '缺岗位', 'Short of jobs'],
  'm.mk.even': ['ใกล้เคียงกัน', '基本平衡', 'About even'],
  'm.mk.up': ['7 วันล่าสุด {a} (ก่อนหน้า {b})', '最近 7 天 {a}（之前 {b}）', 'Last 7 days {a} (before {b})'],
  'm.mk.none': ['ยังไม่มีข้อมูล', '暂无数据', 'No data yet'],
  'm.mk.in': ['ข้อมูลของ{p}', '{p}的数据', 'In {p}'],
  'm.mk.showAll': ['ดูทั้งหมด', '查看全部', 'Show all'],
  'm.mk.privacy': ['ตัวเลขรวมเท่านั้น ไม่ระบุตัวบุคคล · นับเฉพาะหมุดที่ยังใช้งานและประกาศที่ยังเปิดอยู่', '仅为汇总数字，无法识别个人 · 只计有效标记和仍开放的招聘', 'Totals only — nobody can be identified · active pins and open posts only'],
  'm.mk.mapHint': ['แตะจังหวัดบนแผนที่เพื่อดูตัวเลขของที่นั่น', '点击地图上的省份查看该地数据', 'Tap a province on the map to see its numbers'],

  // ---------- 5. smoother on older phones
  'm.settings.lite': ['ลดเอฟเฟกต์เพื่อความลื่น', '减少特效以提升流畅度', 'Fewer effects, smoother'],
  'm.settings.lite.auto': ['อัตโนมัติ', '自动', 'Automatic'],
  'm.settings.lite.d': ['ปิดกระจกเบลอ แสงฟุ้ง แผนที่เอียง 3 มิติ และเส้นเคลื่อนไหว ให้มือถือรุ่นเก่าลื่นขึ้น · อัตโนมัติ = เปิดเองเมื่อเครื่องสเปกต่ำ (CPU ไม่เกิน 4 คอร์ หรือ RAM ไม่เกิน 4 GB) การ์ดจอรุ่นประหยัด หรือวัดแล้วหน้าเว็บกระตุก',
    '关闭毛玻璃、光晕、3D 倾斜地图和动态线条，让旧手机更流畅 · 自动 = 在低配设备（CPU 不超过 4 核或内存不超过 4 GB）、入门级显卡或测得卡顿时自动开启',
    'Turns off frosted glass, glows, the 3D tilted map and moving lines so older phones run smoother · Automatic = on for low-end devices (4 CPU cores or fewer, or 4 GB of memory or less), budget graphics chips or measured stutter'],
  'm.settings.lite.now': ['เครื่องนี้: {s}', '此设备：{s}', 'This device: {s}'],
  'm.settings.lite.isOn': ['ลดเอฟเฟกต์อยู่', '已减少特效', 'fewer effects'],
  'm.settings.lite.byAuto': ['เว็บเปิดให้เอง เพราะเครื่องนี้สเปกต่ำ การ์ดจอรุ่นประหยัด หรือวัดแล้วหน้าเว็บกระตุก', '网站自动开启：此设备配置较低、显卡入门级或测得页面卡顿', 'turned on by the site: a low-end device, a budget graphics chip or measured stutter'],
  'm.settings.lite.isOff': ['เอฟเฟกต์เต็ม', '完整特效', 'full effects'],
} as const satisfies Record<string, Msg>
