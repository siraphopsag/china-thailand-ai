import type { Msg } from './common.js'
/** Owner's blueprint, group A (24–27 Nov 2026): verification levels; chat warnings and blocks; the contract as a PDF; follow-ups;
 * reporting with a location; closing the job with reviews from both sides. */
export const v2h = {
  // ---------- verification levels
  'vl.h': ['ระดับการยืนยันตัวตน', '身份验证等级', 'Verification level'],
  'vl.full': ['ยืนยันครบ', '已完全验证', 'Fully verified'],
  'vl.partial': ['ยืนยันบางส่วน', '部分验证', 'Partly verified'],
  'vl.none': ['ยังไม่ยืนยัน', '尚未验证', 'Not verified'],
  'vl.need.emp': ['ยืนยันตัวตนก่อนจึงจะลงประกาศได้ ส่งเลขทะเบียนนิติบุคคล หรือยืนยันเบอร์มือถือด้านล่าง ระหว่างรอทีมตรวจ ประกาศเผยแพร่ได้ถึงวงที่ 2', '请先完成身份验证再发布招聘信息：在下方提交企业登记号或验证手机号。团队审核期间，招聘信息最多可发布到第2圈', 'Verify yourself before posting: send a company registration number or confirm a mobile number below. While the team checks it, posts reach up to circle 2.'],
  'vl.need.seek': ['ยืนยันเบอร์มือถือก่อนจึงจะปักหมุดได้ ใช้เวลาไม่ถึงนาที ยืนยันพาสปอร์ตเพิ่มเพื่อให้ยืนยันครบ', '请先验证手机号再标记，用时不到一分钟；再验证护照即可完全验证', 'Confirm your mobile number before pinning; it takes under a minute. Add your passport to be fully verified.'],
  // ---------- chat violations
  'ch.strike': ['ซ่อนช่องทางติดต่อแล้ว · เตือนครั้งที่ {n} จาก {max} ถ้าครบ {max} ครั้ง การจับคู่นี้จะถูกยกเลิก', '已隐藏联系方式 · 第 {n} 次警告（共 {max} 次），满 {max} 次将取消本次匹配', 'Contact details hidden · warning {n} of {max}; at {max} this match ends'],
  'ch.closed.me': ['การจับคู่นี้ถูกยกเลิกและแชตถูกล็อก เพราะคุณส่งช่องทางติดต่อครบ {max} ครั้ง ข้อความทั้งหมดยังเก็บไว้เป็นหลักฐาน', '由于您 {max} 次发送联系方式，本次匹配已取消，聊天已锁定。所有消息均保留作为记录', 'This match has ended and the chat is locked because you sent contact details {max} times. All messages are kept as a record.'],
  'ch.closed.other': ['การจับคู่นี้ถูกยกเลิกและแชตถูกล็อก เพราะอีกฝ่ายส่งช่องทางติดต่อครบ {max} ครั้ง ข้อความทั้งหมดยังเก็บไว้เป็นหลักฐาน และคุณรายงานได้ที่หน้าขอความช่วยเหลือ', '由于对方 {max} 次发送联系方式，本次匹配已取消，聊天已锁定。所有消息均保留作为记录，您可在求助页面举报', 'This match has ended and the chat is locked because the other side sent contact details {max} times. All messages are kept as a record; you can report it on the help page.'],
  // ---------- the contract as a file
  'sg.pdf': ['บันทึกเป็น PDF', '保存为 PDF', 'Save as PDF'],
  'sg.doc': ['ดาวน์โหลดไฟล์ Word (.doc)', '下载 Word 文件（.doc）', 'Download a Word file (.doc)'],
  'sg.pdf.hint': ['ในหน้าต่างพิมพ์ เลือกเครื่องพิมพ์เป็น "บันทึกเป็น PDF"', '在打印窗口中选择“另存为 PDF”', 'In the print window, choose "Save as PDF" as the printer'],
  // ---------- reporting with a location
  'cr.loc': ['ตำแหน่งที่แจ้ง', '报告位置', 'Location given'],
  'hp.loc.attach': ['พิกัดนี้จะแนบไปกับเรื่องที่ส่งให้ C.A.L.L. และในชุดเอกสารที่ดาวน์โหลด', '此位置会附在发给 C.A.L.L. 的报告和下载的材料包中', 'This location goes with the report you send to C.A.L.L. and into the pack you download'],
  // ---------- closing the job, both sides review
  'wr.closed': ['ปิดงานสำเร็จ', '工作顺利结束', 'Job closed successfully'],
  'wr.closed.d': ['ครบ 30 วันและไม่มีเรื่องร้องเรียนค้าง ถ้ามีปัญหาภายหลัง ยังรายงานได้เสมอด้านล่าง', '已满 30 天且没有待处理的投诉。之后如有问题，仍可随时在下方报告', '30 days are up and no complaint is open. If something happens later, you can still report it below.'],
  'wr.h': ['รีวิวลูกจ้าง', '评价员工', 'Review the worker'],
  'wr.d': ['ให้ดาวและเลือกหัวข้อที่ตรง ไม่มีช่องข้อความอิสระ นายจ้างคนต่อไปเห็นเป็นคะแนนรวมโดยไม่รู้ว่าใครให้', '给出星级并选择相符的要点，不设自由文字。之后的雇主只能看到不显示评价者的汇总', 'Give stars and pick the points that fit; there is no free text. Later employers see only a total, not who gave it.'],
  'wr.done': ['ส่งรีวิวลูกจ้างแล้ว', '已提交员工评价', 'Worker review sent'],
  'wr.anon': ['แสดงต่อนายจ้างคนอื่นเป็นคะแนนรวมเท่านั้น', '仅以汇总形式向其他雇主显示', 'Other employers see it only as part of a total'],
  'wr.when': ['รีวิวลูกจ้างได้ตั้งแต่ {d} (ครบ 30 วันหลังมาถึง)', '自 {d} 起可评价员工（到达满 30 天）', 'You can review the worker from {d} (30 days after arrival)'],
  'wr.received': ['รีวิวที่คุณได้รับจากนายจ้าง', '雇主给您的评价', 'Reviews you received from employers'],
  'wr.none': ['ยังไม่มีรีวิวจากนายจ้าง', '尚无雇主评价', 'No reviews from employers yet'],
  'wr.p.onTime': ['ตรงต่อเวลา', '守时', 'On time'],
  'wr.p.skilled': ['ทำงานได้ดี', '工作能力强', 'Skilled'],
  'wr.p.communicates': ['สื่อสารดี', '沟通良好', 'Communicates well'],
  'wr.p.followsRules': ['ทำตามกฎ', '遵守规章', 'Follows the rules'],
  'wr.p.teamwork': ['ทำงานเป็นทีม', '团队合作好', 'Works well with others'],
  'wr.p.late': ['มาสายบ่อย', '经常迟到', 'Often late'],
  'wr.p.absent': ['ขาดงานบ่อย', '经常缺勤', 'Often absent'],
  'wr.p.poorWork': ['งานต้องแก้บ่อย', '工作常需返工', 'Work often redone'],
  'wr.p.breaksRules': ['ไม่ทำตามกฎ', '不遵守规章', 'Breaks the rules'],
  'wr.p.leftEarly': ['ออกก่อนครบสัญญาโดยไม่แจ้ง', '未告知提前离职', 'Left early without notice'],
  'm.err.needVerify': ['ต้องยืนยันตัวตนก่อน จึงจะลงประกาศหรือปักหมุดได้', '需先完成身份验证，才能发布招聘信息或标记', 'Verify yourself first to post or pin'],
} as const satisfies Record<string, Msg>
