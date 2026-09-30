import type { AlertItem, ContractInput, EmploymentInput, Profile, ChecklistItem } from '../types'

/** ข้อมูลสมมติเพื่อสาธิตเท่านั้น (Fictional demonstration data) */
export const demoProfile: Profile = {
  companyName: 'ABC Manufacturing (บริษัทสมมติ)',
  direction: 'TH_CN',
  businessType: 'ผลิต (Manufacturing)',
  activity: 'ผลิตชิ้นส่วนพลาสติกสำหรับอุตสาหกรรมเครื่องใช้ไฟฟ้า',
  forms: ['เปิดบริษัท', 'จ้างพนักงาน', 'ส่งพนักงานจากไทยไปทำงาน'],
  investmentRange: '10–50 ล้านบาท',
  employees: 20,
  crossBorderWorkers: true,
  holders: [
    { id: 'origin', label: 'ผู้ถือหุ้นไทย', nationality: 'TH', percent: 60, capital: 0, voting: 60, board: 60, economic: 20 },
    { id: 'partner', label: 'ผู้ถือหุ้นจีน', nationality: 'CN', percent: 40, capital: 100, voting: 40, board: 40, economic: 80 },
  ],
  realInvestor: 'partner',
  operator: 'partner',
  sideAgreement: 'unknown',
  products: 'ชิ้นส่วนพลาสติกฉีดขึ้นรูป',
  regulatedGoods: 'ไม่มี',
  location: 'ซูโจว มณฑลเจียงซู',
  crossBorder: ['นำเข้าวัตถุดิบ', 'ส่งออกสินค้า'],
  isDemo: true,
}

export const demoEmployment: EmploymentInput = {
  mode: 'ส่งพนักงานไทยไปจีน', nationality: 'ไทย', location: 'ซูโจว มณฑลเจียงซู (จีน)', duration: '24 เดือน',
  salary: '28,000 หยวน/เดือน (สมมติ)', hours: '8 ชั่วโมง/วัน 5 วัน/สัปดาห์', leave: '', socialSecurity: '', workAuth: '', tax: '',
}

export const demoContract: ContractInput = {
  employer: 'ABC Manufacturing (Suzhou) Co., Ltd. (บริษัทสมมติ)', employee: 'นายสมชาย ใจดี (ชื่อสมมติ)', nationality: 'ไทย',
  job: 'ผู้จัดการฝ่ายผลิต', location: 'ซูโจว มณฑลเจียงซู', startDate: '', duration: '2 ปี', salary: '28,000 หยวน/เดือน',
  benefits: '', hours: '8 ชั่วโมง/วัน 5 วัน/สัปดาห์', leave: '', probation: '', other: '',
}

export const emptyEmployment: EmploymentInput = { mode: '', nationality: '', location: '', duration: '', salary: '', hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' }
export const emptyContract: ContractInput = { employer: '', employee: '', nationality: '', job: '', location: '', startDate: '', duration: '', salary: '', benefits: '', hours: '', leave: '', probation: '', other: '' }

export const baseAlerts: AlertItem[] = [
  {
    id: 'a1', changed: 'ตัวอย่าง: หน่วยงานเผยแพร่ข้อมูลอัปเดตเกี่ยวกับรายการข้อจำกัดการลงทุนจากต่างประเทศ', when: 'ตัวอย่าง — ไม่ใช่เหตุการณ์จริง',
    profile: 'ABC Manufacturing (บริษัทสมมติ)', sourceId: 'cn-neglist-2024', severity: 'NEEDS_REVIEW',
    impact: 'กิจกรรมธุรกิจผลิตของคุณอาจต้องตรวจเทียบกับรายการเวอร์ชันล่าสุดอีกครั้ง', next: 'เปิดแหล่งข้อมูลทางการและยืนยันว่ากิจกรรมของคุณไม่อยู่ในรายการจำกัด',
    isSample: true,
  },
  {
    id: 'a2', changed: 'ตัวอย่าง: ปรับปรุงแนวทางการขออนุญาตทำงานของชาวต่างชาติ', when: 'ตัวอย่าง — ไม่ใช่เหตุการณ์จริง',
    profile: 'ABC Manufacturing (บริษัทสมมติ)', sourceId: 'cn-immigration', severity: 'MEDIUM',
    impact: 'แผนส่งพนักงานไทยไปจีนอาจต้องเตรียมเอกสารเพิ่มเติม', next: 'ตรวจสอบรายการเอกสารกับหน่วยงานในพื้นที่ก่อนยื่นคำขอ', isSample: true,
  },
]

export const checklistItems: ChecklistItem[] = [
  { id: 'b1', group: 'รายการตรวจธุรกิจ', text: 'ระบุกิจกรรมธุรกิจเป็นรายการให้ชัดเจน (สินค้า/บริการ/ช่องทางขาย)' },
  { id: 'b2', group: 'รายการตรวจธุรกิจ', text: 'ตรวจเทียบกิจกรรมกับรายการข้อจำกัดการลงทุนของประเทศเป้าหมาย' },
  { id: 'b3', group: 'รายการตรวจธุรกิจ', text: 'ตรวจว่ากิจกรรมต้องขออนุญาตหรือใบรับรองเฉพาะหรือไม่' },
  { id: 'o1', group: 'รายการตรวจโครงสร้างผู้ถือหุ้น', text: 'รวบรวมหลักฐานแหล่งเงินลงทุนของผู้ถือหุ้นทุกราย' },
  { id: 'o2', group: 'รายการตรวจโครงสร้างผู้ถือหุ้น', text: 'จัดทำแผนผังสิทธิออกเสียง การแต่งตั้งกรรมการ และสิทธิประโยชน์ทางเศรษฐกิจ' },
  { id: 'o3', group: 'รายการตรวจโครงสร้างผู้ถือหุ้น', text: 'เปิดเผยข้อตกลงระหว่างผู้ถือหุ้นทั้งหมดให้ผู้ตรวจสอบพิจารณา' },
  { id: 'o4', group: 'รายการตรวจโครงสร้างผู้ถือหุ้น', text: 'ขอความเห็นจากผู้เชี่ยวชาญ/หน่วยงานที่เกี่ยวข้องเมื่อพบปัจจัยที่ควรตรวจสอบเพิ่มเติม' },
  { id: 'e1', group: 'รายการตรวจการจ้างงาน', text: 'กำหนดรูปแบบการจ้าง (จ้างในพื้นที่ / ส่งไปทำงานต่างประเทศ)' },
  { id: 'e2', group: 'รายการตรวจการจ้างงาน', text: 'ตรวจสอบใบอนุญาตทำงานและสถานะการพำนักของพนักงานต่างชาติ' },
  { id: 'e3', group: 'รายการตรวจการจ้างงาน', text: 'ตรวจสอบประกันสังคมและภาษีเงินได้ของพนักงาน' },
  { id: 'e4', group: 'รายการตรวจการจ้างงาน', text: 'จัดทำสัญญาจ้างเป็นลายลักษณ์อักษรและให้ผู้เชี่ยวชาญตรวจ' },
]
