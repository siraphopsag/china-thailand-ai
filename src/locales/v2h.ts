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
  'm.err.needVerify': ['ต้องยืนยันตัวตนก่อน จึงจะลงประกาศหรือปักหมุดได้', '需先完成身份验证，才能发布招聘信息或标记', 'Verify yourself first to post or pin'],
} as const satisfies Record<string, Msg>
