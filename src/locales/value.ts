import type { Msg } from './common.js'
/** Copy for the parts that make C.A.L.L. useful in practice: personalised findings, the case brief for an advisor, the legal review pack. */
export const value = {
  // findings that follow what the user actually plans
  'risk.found.emp.na': ['แผนตอนนี้ยังไม่มีการจ้างหรือส่งพนักงาน จึงยังไม่ต้องตรวจเรื่องการจ้างงาน', '目前的计划不涉及雇用或派遣员工，暂不需要核查用工事项。', 'Your current plan does not involve hiring or sending staff, so employment does not need checking yet.'],
  'risk.found.tax.na': ['ยังไม่มีพนักงานทำงานข้ามประเทศ ประเด็นภาษีของพนักงานจึงยังไม่เกี่ยวข้อง', '目前没有跨境工作的员工，员工税务事项暂不相关。', 'No staff work across borders yet, so employee tax questions are not relevant now.'],
  'risk.next.na': ['ถ้าแผนเปลี่ยนเป็นการจ้างหรือส่งพนักงาน ให้กลับมาตอบคำถามการจ้างงาน', '如果计划改为雇用或派遣员工，请回来回答用工问题。', 'If your plan changes to hiring or sending staff, come back and answer the employment questions.'],
  'risk.legal.c.eec': ['ที่ตั้งอยู่ในพื้นที่ EEC (ฉะเชิงเทรา ชลบุรี ระยอง): ตรวจสิทธิประโยชน์และเงื่อนไขกับสำนักงาน EEC เพิ่มเติม', '所在地位于东部经济走廊（EEC：北柳、春武里、罗勇）：请另行向 EEC 办公室核实优惠与条件。', 'The location is in the EEC (Chachoengsao, Chon Buri, Rayong): check incentives and conditions with the EEC Office as well.'],
  'risk.legal.c.ftz': ['ตรวจว่าที่ตั้งใน{place}อยู่ในเขตการค้าเสรีนำร่อง (FTZ) หรือไม่ เพราะ FTZ ใช้รายการข้อจำกัดการลงทุนอีกฉบับ', '核实{place}的所在地是否位于自由贸易试验区，自贸区适用另一份外资准入负面清单。', 'Check whether the location in {place} is inside a pilot free trade zone, which uses a separate foreign-investment negative list.'],
  // case brief for a lawyer / advisor
  'doc.brief.t': ['สรุปเคสสำหรับทนาย/ที่ปรึกษา (Case brief)', '律师/顾问案情摘要（Case brief）', 'Case brief for your lawyer or advisor'],
  'doc.brief.d': ['สรุปข้อเท็จจริง สิ่งที่ยังไม่รู้ ประเด็นที่พบ และคำถามที่ควรถาม เพื่อให้การปรึกษาสั้นและตรงประเด็นขึ้น', '汇总事实、未知事项、发现的问题和应提出的问题，让咨询更简短、更有针对性。', 'Facts, unknowns, findings and the questions to ask — so the consultation is shorter and more focused.'],
  'doc.br.route': ['เส้นทางธุรกิจ', '业务路线', 'Business route'],
  'doc.br.biz': ['ข้อมูลธุรกิจ', '业务信息', 'Business'],
  'doc.br.forms': ['รูปแบบที่วางแผน', '计划形式', 'Planned activities'],
  'doc.br.staff': ['จำนวนพนักงาน', '员工人数', 'Employees'],
  'doc.br.own': ['ผู้ถือหุ้นและอำนาจควบคุม', '股权与控制', 'Ownership and control'],
  'doc.br.holder': ['{holder}: หุ้น {percent} · เงินลงทุน {capital} · สิทธิออกเสียง {voting} · กรรมการ {board} · ผลตอบแทน {economic}', '{holder}：持股 {percent} · 出资 {capital} · 表决权 {voting} · 董事 {board} · 收益 {economic}', '{holder}: shares {percent} · funding {capital} · voting {voting} · board {board} · profit {economic}'],
  'doc.br.found': ['ประเด็นที่ C.A.L.L. พบ (คัดกรองเบื้องต้น ไม่ใช่ข้อสรุปทางกฎหมาย)', 'C.A.L.L. 发现的事项（初步筛查，并非法律结论）', 'What C.A.L.L. flagged (early screening, not a legal conclusion)'],
  'doc.br.ask': ['คำถามที่ควรถามทนาย/ที่ปรึกษา', '应向律师/顾问提出的问题', 'Questions to ask your lawyer or advisor'],
  'doc.br.tasks': ['สถานะงาน', '任务状态', 'Task status'],
  'doc.br.taskCount': ['เสร็จแล้ว {done} จาก {total} งาน งานที่ยังค้าง:', '已完成 {done}/{total} 项任务，待办：', '{done} of {total} tasks done. Still open:'],
  'doc.br.src': ['แหล่งข้อมูลที่ใช้ และสถานะการตรวจสอบ', '使用的来源及核实状态', 'Sources used and their verification status'],
  // home
  'dash.brief': ['สร้างสรุปเคสสำหรับทนาย', '生成律师案情摘要', 'Create a case brief for your lawyer'],
  // admin: legal review pack
  'adm.pack': ['ดาวน์โหลดชุดเอกสารให้ทนายตรวจ', '下载律师审核材料', 'Download the lawyer review pack'],
  'adm.pack.d': ['ไฟล์รวมข้อความสรุปทุกระเบียนทั้ง 3 ภาษา พร้อมช่องให้ทนายกรอกลิงก์ตัวบท มาตรา วันที่มีผลบังคับใช้ และการแก้ไข', '汇总所有记录的三语摘要，并为律师留有填写官方文本链接、条款、生效日期和修改意见的空栏。', 'All record summaries in three languages, with blanks for the lawyer to fill in the official text link, articles, effective date and corrections.'],
  'adm.pack.title': ['ชุดเอกสารสำหรับตรวจข้อมูลกฎหมายของ C.A.L.L.', 'C.A.L.L. 法律信息审核材料', 'C.A.L.L. legal information review pack'],
  'adm.pack.intro': ['โปรดอ่านตัวบทฉบับทางการเทียบกับข้อความสรุปของแต่ละระเบียน แล้วกรอกช่องว่าง ข้อความสรุปเขียนโดยผู้พัฒนาและยังไม่ผ่านการตรวจ เมื่อตรวจแล้วผู้พัฒนาจะบันทึกด้วย npm run legal:review ภายใต้ชื่อของท่าน', '请对照官方文本阅读每条记录的摘要并填写空栏。摘要由开发者撰写，尚未经过核查。核查后开发者将以您的名义通过 npm run legal:review 记录。', 'Please read the official text against each record summary and fill in the blanks. The summaries were written by the developers and have not been reviewed. Once reviewed, the developers record it with npm run legal:review under your name.'],
  'adm.pack.link': ['ลิงก์ตัวบทฉบับทางการ', '官方文本链接', 'Official text link'],
  'adm.pack.articles': ['มาตรา/ข้อ', '条款', 'Articles'],
  'adm.pack.effective': ['วันที่มีผลบังคับใช้', '生效日期', 'Effective date'],
  'adm.pack.ok': ['ข้อความถูกต้อง ☐ ใช่ ☐ ต้องแก้ไข:', '内容正确 ☐ 是 ☐ 需修改：', 'Summary correct ☐ yes ☐ needs change:'],
  'adm.pack.by': ['ผู้ตรวจ / ตำแหน่ง / วันที่', '核查人 / 职务 / 日期', 'Reviewer / role / date'],
  'adm.pack.gaps': ['กฎหมายที่ยังไม่มีข้อความสรุป (ขอคำแนะนำว่าควรสรุปประเด็นใด)', '尚无摘要的法规（请建议应摘要的要点）', 'Laws with no summary yet (please advise what should be summarised)'],
} as const satisfies Record<string, Msg>
