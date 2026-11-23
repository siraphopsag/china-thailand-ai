import type { Msg } from './common.js'
/** Owner's review, 23 Nov 2026: switching accounts, the chat list, and chat / contract / verification / aftercare shared through the database. */
export const v2e = {
  // ---------- switching accounts
  'ac2.switch': ['สลับบัญชี', '切换账号', 'Switch account'],
  'ac2.add': ['เพิ่มบัญชี', '添加账号', 'Add another account'],
  'ac2.remove': ['ลบ {n} ออกจากเครื่องนี้', '从此设备移除 {n}', 'Remove {n} from this device'],
  'ac2.logoutAll': ['ออกจากระบบทุกบัญชีในเครื่องนี้', '退出此设备上的所有账号', 'Sign out of every account on this device'],
  'ac2.shared': ['บัญชีที่จำไว้กดเข้าได้ทันทีโดยไม่ต้องใส่รหัสผ่าน ถ้าใช้เครื่องร่วมกับคนอื่น ให้ออกจากระบบทุกบัญชีก่อนลุกจากเครื่อง', '已记住的账号无需密码即可直接进入。如与他人共用设备，离开前请退出所有账号', 'Remembered accounts open without a password. On a shared computer, sign out of every account before you leave.'],
  'ac2.saved': ['บัญชีที่เคยใช้ในเครื่องนี้', '此设备上用过的账号', 'Accounts used on this device'],
  'ac2.role.none': ['ยังไม่เลือกบทบาท', '尚未选择身份', 'No role chosen yet'],

  // ---------- chat list
  'm.nav.chats': ['แชต', '聊天', 'Chats'],
  'sh.list.title': ['แชตทั้งหมด', '全部聊天', 'All chats'],
  'sh.list.sub': ['คุยกับนายจ้างหรือผู้สมัครของทุกงานในที่เดียว', '在一处与所有职位的雇主或求职者聊天', 'Talk with the employer or applicant of every job in one place'],
  'sh.list.emptySeeker': ['ยังไม่มีแชต แชตจะเปิดเมื่อคุณสมัครงาน', '还没有聊天。申请职位后即可开始聊天', 'No chats yet. A chat opens when you apply for a job.'],
  'sh.list.emptyEmployer': ['ยังไม่มีแชต แชตจะเปิดเมื่อมีคนสมัครงานในประกาศของคุณ', '还没有聊天。有人申请您的职位后即可开始聊天', 'No chats yet. A chat opens when someone applies to your post.'],
  'sh.list.asSeeker': ['คุณเป็นผู้สมัคร', '您是求职者', 'You applied'],
  'sh.list.asEmployer': ['คุณเป็นนายจ้าง', '您是雇主', 'You are the employer'],
  'sh.list.you': ['คุณ', '您', 'You'],
  'sh.list.noMsg': ['ยังไม่มีข้อความ', '还没有消息', 'No messages yet'],
  'sh.intro': ['แนะนำตัวตอนสมัคร', '申请时的自我介绍', 'Introduction when applying'],

  // ---------- shared records
  'sh.dbOld': ['ฐานข้อมูลยังไม่ได้อัปเดต ส่วนนี้จึงยังใช้ร่วมกันไม่ได้ เจ้าของระบบต้องรันไฟล์ 0014_shared_records.sql ใน Supabase ก่อน', '数据库尚未更新，此部分暂时无法共享。系统所有者需先在 Supabase 中运行 0014_shared_records.sql', 'The database has not been updated, so this part cannot be shared yet. The site owner needs to run 0014_shared_records.sql in Supabase first.'],
  'sh.network': ['บันทึกหรือโหลดไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง', '保存或加载失败，请检查网络后重试', 'Could not save or load. Check the internet connection and try again.'],
  'sh.contract.shared': ['สัญญานี้ใช้ร่วมกันทั้งสองฝ่าย ลายเซ็นหรือการแก้ไขของอีกฝ่ายจะขึ้นที่นี่ทันที', '本合同由双方共用，对方的签名或修改会立即显示在这里', 'Both sides share this contract. The other side’s signature or changes appear here at once.'],
} as const satisfies Record<string, Msg>
