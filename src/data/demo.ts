import type { AlertItem, ChecklistItem, ContractInput, EmploymentInput, Profile } from '../types'

/** ข้อมูลสมมติเพื่อสาธิตเท่านั้น (Fictional demonstration data). ค่าที่ขึ้นต้นด้วย "@" คือ token ข้อความที่แปลตามภาษาที่เลือก (ดู dv()) */
export const demoProfile: Profile = {
  companyName: '@demo.company',
  direction: 'TH_CN',
  businessType: 'manufacturing',
  activity: '@demo.activity',
  forms: ['company', 'hire', 'send'],
  investmentRange: '10to50',
  employees: 20,
  crossBorderWorkers: true,
  holders: [
    { id: 'origin', nationality: 'TH', percent: 60, capital: 0, voting: 60, board: 60, economic: 20 },
    { id: 'partner', nationality: 'CN', percent: 40, capital: 100, voting: 40, board: 40, economic: 80 },
  ],
  realInvestor: 'partner',
  operator: 'partner',
  sideAgreement: 'unknown',
  products: '@demo.products',
  regulatedGoods: 'none',
  location: '@demo.location',
  crossBorder: ['import', 'export'],
  targetMarket: '@demo.market',
  isDemo: true,
}

export const demoEmployment: EmploymentInput = {
  mode: 'send_th_cn', nationality: '@opt.empNat.TH', location: '@demo.empLocation', duration: '@demo.empDuration',
  salary: '@demo.empSalary', hours: '@demo.empHours', leave: '', socialSecurity: '', workAuth: '', tax: '',
}
export const demoContract: ContractInput = {
  employer: '@demo.employer', employee: '@demo.employee', nationality: '@opt.empNat.TH',
  job: '@demo.job', location: '@demo.empLocation', startDate: '', duration: '@demo.conDuration', salary: '@demo.empSalary',
  benefits: '', hours: '@demo.empHours', leave: '', probation: '', other: '',
}
/** End-to-end example: a Thai SME opening a restaurant in Shanghai (fictional business; all facts are invented for the demo). */
export const restaurantProfile: Profile = {
  companyName: '@demo.r.company', direction: 'TH_CN', businessType: 'food', activity: '@demo.r.activity', forms: ['company', 'hire', 'send'], investmentRange: 'lt10',
  employees: 8, crossBorderWorkers: true,
  holders: [
    { id: 'origin', nationality: 'TH', percent: 100, capital: 100, voting: 100, board: 100, economic: 100 },
    { id: 'partner', nationality: 'CN', percent: 0, capital: 0, voting: 0, board: 0, economic: 0 },
  ],
  realInvestor: 'origin', operator: 'origin', sideAgreement: 'no', products: '@demo.r.products', regulatedGoods: 'food', location: '@demo.r.location', crossBorder: ['import'],
  targetMarket: '@demo.r.market', unknownFacts: [], originProvince: 'TH-10', destProvince: 'CN-SH', isDemo: true,
}
export const restaurantEmployment: EmploymentInput = { mode: 'send_th_cn', nationality: '@opt.empNat.TH', location: '@demo.r.location', duration: '', salary: '', hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' }
export const emptyEmployment: EmploymentInput = { mode: '', nationality: '', location: '', duration: '', salary: '', hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' }
export const emptyContract: ContractInput = { employer: '', employee: '', nationality: '', job: '', location: '', startDate: '', duration: '', salary: '', benefits: '', hours: '', leave: '', probation: '', other: '' }

export const baseAlerts: AlertItem[] = [
  { id: 'a1', titleKey: 'alert.a1.title', when: 'sample', country: 'CN', topicKey: 'alert.a1.topic', sourceId: 'cn-neglist-2024', impactKey: 'alert.a1.impact', nextKey: 'alert.a1.next', isSample: true, severity: 'NEEDS_REVIEW' },
  { id: 'a2', titleKey: 'alert.a2.title', when: 'sample', country: 'CN', topicKey: 'alert.a2.topic', sourceId: 'cn-immigration', impactKey: 'alert.a2.impact', nextKey: 'alert.a2.next', isSample: true, severity: 'MEDIUM' },
]

export const checklistItems: ChecklistItem[] = [
  { id: 'b1', group: 'business' }, { id: 'b2', group: 'business' }, { id: 'b3', group: 'business' },
  { id: 'o1', group: 'ownership' }, { id: 'o2', group: 'ownership' }, { id: 'o3', group: 'ownership' }, { id: 'o4', group: 'ownership' },
  { id: 'e1', group: 'employment' }, { id: 'e2', group: 'employment' }, { id: 'e3', group: 'employment' }, { id: 'e4', group: 'employment' },
]
