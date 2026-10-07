// Simulated data (owner, Oct 2026): the administrator's generator makes realistic posts and pins — different countries,
// provinces, fields, numbers of people and times — so the board, the rings and the market view look lived-in. Everything it
// makes is stored as simulated (is_sample) and shown with a yellow "ข้อมูลจำลอง" label. Company names are invented.
// Pure: a random-number function is passed in (tests use a fixed seed).
import { provinces } from '../../locales/provinces'
import { DAY_MS, makePost, type PostInput } from './logic'
import { postToRow } from './remote'
import type { Benefit, Country, Edu, Employment, Industry, LanguageSkill, Skill, VerifyKind } from './types'
import { INDUSTRIES } from './types'

export type Rng = () => number
/** a small seeded generator (mulberry32) so a test always gets the same set */
export function seeded(seed: number): Rng {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const between = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1))
const some = <T,>(r: Rng, xs: readonly T[], lo: number, hi: number): T[] => { const pool = [...xs]; const out: T[] = []; const n = Math.min(pool.length, between(r, lo, hi)); while (out.length < n) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); return out }

/** every province of a country on the map; the bigger job markets come up more often so "the busiest provinces" mean something */
export const provincesOf = (c: Country) => Object.keys(provinces).filter((k) => k.startsWith(`prov.${c}-`)).map((k) => k.slice(5))
const HUBS: Record<Country, string[]> = { TH: ['TH-10', 'TH-20', 'TH-50', 'TH-83', 'TH-11', 'TH-21', 'TH-40', 'TH-90'], CN: ['CN-SH', 'CN-BJ', 'CN-GD', 'CN-ZJ', 'CN-JS', 'CN-YN', 'CN-GX', 'CN-SC'] }
const placeIn = (r: Rng, c: Country) => { const hubs = HUBS[c].filter((p) => provincesOf(c).includes(p)); return r() < 0.6 && hubs.length ? pick(r, hubs) : pick(r, provincesOf(c)) }

const SKILLS_OF: Record<Industry, Skill[]> = {
  manufacturing: ['quality_control', 'mechanical_engineering', 'electrical_engineering', 'project_management'],
  technology: ['software_engineering', 'data_analysis', 'project_management', 'electrical_engineering'],
  hospitality: ['hospitality_management', 'marketing', 'thai_chinese_translation'],
  food_service: ['culinary_arts', 'hospitality_management'],
  education: ['thai_chinese_translation', 'project_management', 'marketing'],
  logistics: ['project_management', 'data_analysis', 'thai_chinese_translation'],
  finance: ['accounting_finance', 'data_analysis', 'thai_chinese_translation'],
}
const POSITIONS: Record<Industry, string[]> = {
  manufacturing: ['Production Supervisor', 'Quality Control Inspector', 'Maintenance Technician', 'CNC Machine Operator', 'Process Engineer', 'Assembly Line Lead', 'Electrical Technician'],
  technology: ['Software Developer', 'QA Tester', 'IT Support Specialist', 'Data Analyst', 'Network Administrator', 'Mobile App Developer', 'Bilingual Technical Writer'],
  hospitality: ['Front Desk Agent', 'Guest Relations Officer', 'Housekeeping Supervisor', 'Tour Coordinator', 'Chinese-speaking Concierge', 'Spa Receptionist', 'Banquet Captain'],
  food_service: ['Line Cook', 'Sous Chef', 'Restaurant Supervisor', 'Barista', 'Dim Sum Cook', 'Thai Cuisine Chef', 'Kitchen Assistant'],
  education: ['Thai Language Teacher', 'Chinese Language Teacher', 'English Tutor', 'Teaching Assistant', 'Curriculum Coordinator', 'Kindergarten Assistant'],
  logistics: ['Warehouse Coordinator', 'Forklift Driver', 'Customs Documentation Officer', 'Delivery Driver', 'Inventory Controller', 'Freight Forwarding Assistant'],
  finance: ['Accounting Officer', 'Bilingual Accounts Assistant', 'Payroll Officer', 'Cashier', 'Credit Analyst', 'Bookkeeper'],
}
const NAMES = ['Golden Reed', 'Jade Harbor', 'Blue Lantern', 'Silver Pine', 'Red Kite', 'Twin River', 'North Star', 'Morning Bay', 'Green Valley', 'Pearl Gate',
  'Bamboo Bridge', 'Cloud Peak', 'Amber Field', 'Crystal Lake', 'Maple Hill', 'Orchid Lane', 'Sunrise Delta', 'Coral Point', 'Willow Creek', 'Stone Garden']
const KINDS: Record<Industry, string[]> = {
  manufacturing: ['Precision Works', 'Industrial Co., Ltd.', 'Auto Parts', 'Electronics Factory'],
  technology: ['Digital', 'Software Studio', 'Tech Co., Ltd.', 'Cloud Services'],
  hospitality: ['Hotel & Resort', 'Boutique Hotel', 'Travel', 'Riverside Inn'],
  food_service: ['Kitchen', 'Restaurant Group', 'Noodle House', 'Café'],
  education: ['Language School', 'Learning Center', 'International School', 'Tutoring'],
  logistics: ['Logistics', 'Freight', 'Cold Chain', 'Express'],
  finance: ['Accounting Services', 'Finance Co., Ltd.', 'Bookkeeping', 'Advisory'],
}
/** monthly pay, per field: Thai baht in Thailand, yuan in China */
const PAY: Record<Industry, Record<Country, [number, number]>> = {
  manufacturing: { TH: [15000, 32000], CN: [5000, 9500] }, technology: { TH: [25000, 65000], CN: [9000, 22000] },
  hospitality: { TH: [13000, 30000], CN: [4500, 8500] }, food_service: { TH: [12000, 26000], CN: [4500, 8500] },
  education: { TH: [18000, 42000], CN: [6000, 13000] }, logistics: { TH: [13000, 27000], CN: [5000, 9000] }, finance: { TH: [18000, 42000], CN: [6000, 13000] },
}
const EDU_OF: Record<Industry, Edu[]> = {
  manufacturing: ['secondary', 'vocational', 'high_vocational', 'bachelor'], technology: ['high_vocational', 'bachelor', 'bachelor', 'master'],
  hospitality: ['secondary', 'vocational', 'bachelor'], food_service: ['none', 'lower_secondary', 'secondary', 'vocational'],
  education: ['bachelor', 'bachelor', 'master'], logistics: ['none', 'secondary', 'vocational', 'high_vocational'], finance: ['high_vocational', 'bachelor', 'bachelor'],
}
const DETAILS: Record<Industry, string[]> = {
  manufacturing: ['ทำงานเป็นกะ มีพี่เลี้ยงสอนงานช่วงแรก มีรถรับส่งจากหอพัก', 'ดูแลไลน์ผลิตและตรวจคุณภาพชิ้นงานตามมาตรฐานโรงงาน'],
  technology: ['ทีมเล็ก ทำงานกับลูกค้าไทยและจีน ใช้ภาษาอังกฤษในงานเอกสาร', 'พัฒนาและดูแลระบบภายในบริษัท ทำงานแบบผสมเข้าออฟฟิศและทำงานที่บ้าน'],
  hospitality: ['ต้อนรับแขกที่พูดภาษาจีนเป็นหลัก มีที่พักและอาหารให้', 'ทำงานในโรงแรมย่านท่องเที่ยว วันหยุดสัปดาห์ละ 1 วัน'],
  food_service: ['ครัวเปิดใหม่ ต้องการคนที่ชอบทำอาหารและทำงานเป็นทีม', 'ร้านอาหารยอดนิยม มีอาหารพนักงานทุกมื้อ'],
  education: ['สอนนักเรียนระดับประถมถึงมัธยม มีหลักสูตรและสื่อการสอนให้', 'สอนกลุ่มเล็กช่วงเย็นและวันหยุด มีอบรมก่อนเริ่มสอน'],
  logistics: ['คลังสินค้าขนาดใหญ่ ทำงานกับระบบสแกนบาร์โค้ด', 'ประสานงานเอกสารนำเข้าส่งออกระหว่างไทยกับจีน'],
  finance: ['ทำบัญชีให้ลูกค้าธุรกิจไทยและจีน ใช้โปรแกรมบัญชีมาตรฐาน', 'ดูแลเอกสารการเงินและรายงานประจำเดือน'],
}
const HEADS = [1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 8, 10, 12]
const EMPLOYMENTS: Employment[] = ['permanent', 'permanent', 'permanent', 'contract', 'contract', 'temporary', 'internship']

export interface SimOptions {
  country: 'any' | Country; province: string | null; industry: 'any' | Industry
  /** people wanted (posts) */ headMin: number; headMax: number
  /** how long ago, in days */ daysMin: number; daysMax: number
}
export const SIM_DEFAULTS: SimOptions = { country: 'any', province: null, industry: 'any', headMin: 1, headMax: 12, daysMin: 0, daysMax: 60 }
/** the starter set the owner asked for: 32 posts and 50 pins */
export const STARTER = { posts: 32, pins: 50 } as const
export const PIN_DAYS_MAX = 29 // pins last 30 days

export type SimPost = PostInput & { createdAt: string; verified: boolean; verifiedAs?: VerifyKind }
export interface SimPin { country: Country; province: string; industry: Industry; skills: Skill[]; at: string }

const countryOf = (r: Rng, o: SimOptions): Country => (o.country === 'any' ? (r() < 0.5 ? 'TH' : 'CN') : o.country)
const provinceOf = (r: Rng, o: SimOptions, c: Country) => (o.province && o.province.startsWith(c + '-') ? o.province : placeIn(r, c))
/** more recent times come up more often (a lived-in board), spread over the whole range */
const timeIn = (r: Rng, now: number, lo: number, hi: number) => { const d = lo + (hi - lo) * r() ** 1.6; return new Date(now - d * DAY_MS - between(r, 0, 59) * 60_000).toISOString() }
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const addDays = (day: string, n: number) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + n); return localDay(d.toISOString()) }

export function simPosts(n: number, o: SimOptions, now: number, r: Rng = Math.random): SimPost[] {
  const out: SimPost[] = []
  for (let guard = 0; out.length < n && guard < n * 20; guard++) {
    const industry: Industry = o.industry === 'any' ? pick(r, INDUSTRIES) : o.industry
    const c = countryOf(r, o), province = provinceOf(r, o, c)
    const lo = Math.max(1, Math.min(o.headMin, o.headMax)), hi = Math.min(99, Math.max(o.headMin, o.headMax))
    const fit = HEADS.filter((h) => h >= lo && h <= hi), headcount = fit.length ? pick(r, fit) : between(r, lo, hi)
    const [pmin, pmax] = PAY[industry][c], step = c === 'TH' ? 500 : 100
    const a = pmin + Math.floor(r() * (pmax - pmin) * 0.6), b = a + Math.floor((pmax - a) * (0.25 + r() * 0.5))
    const salary = r() < 0.85 ? { min: Math.round(a / step) * step, max: Math.round(b / step) * step, currency: c === 'TH' ? 'THB' as const : 'CNY' as const } : null
    const createdAt = timeIn(r, now, Math.max(0, o.daysMin), Math.max(o.daysMin, o.daysMax))
    // a Thai workplace asks some Thai and often Chinese; a Chinese one asks Chinese, with Thai as the worker's own language
    const languages: LanguageSkill[] = c === 'CN'
      ? [{ lang: 'zh', level: pick(r, ['basic', 'conversational', 'conversational', 'professional'] as const) }, ...(r() < 0.6 ? [{ lang: 'th' as const, level: 'native' as const }] : [])]
      : [{ lang: 'th', level: pick(r, ['basic', 'conversational', 'professional'] as const) }, ...(r() < 0.6 ? [{ lang: 'zh' as const, level: pick(r, ['conversational', 'native'] as const) }] : [])]
    const v = r()
    const input: PostInput = {
      place: { country: c, province }, company: `${pick(r, NAMES)} ${pick(r, KINDS[industry])}`, position: pick(r, POSITIONS[industry]), industry,
      skills: some(r, SKILLS_OF[industry], 1, 2), minYears: pick(r, [0, 0, 1, 1, 2, 3, 5]), details: pick(r, DETAILS[industry]), headcount,
      employment: pick(r, EMPLOYMENTS), salary, startDate: addDays(localDay(createdAt), between(r, 7, 45)), languages, education: pick(r, EDU_OF[industry]),
      benefits: some(r, (c === 'CN' ? ['housing', 'workDocs', 'insurance', 'meals'] : ['insurance', 'meals', 'housing', 'workDocs']) as Benefit[], 0, 3),
    }
    if (!makePost(input, 'x', 'y', createdAt).ok) continue // the same checks as a real post
    out.push({ ...input, createdAt, verified: v < 0.8, ...(v < 0.65 ? { verifiedAs: 'company' as const } : v < 0.8 ? { verifiedAs: 'person' as const } : {}) })
  }
  return out
}

export function simPins(n: number, o: SimOptions, now: number, r: Rng = Math.random): SimPin[] {
  return Array.from({ length: n }, () => {
    const industry: Industry = o.industry === 'any' ? pick(r, ['manufacturing', 'manufacturing', 'hospitality', 'hospitality', 'food_service', 'technology', 'education', 'logistics', 'finance'] as const) : o.industry
    const c = countryOf(r, o)
    return { country: c, province: provinceOf(r, o, c), industry, skills: some(r, SKILLS_OF[industry], 1, 3), at: timeIn(r, now, Math.min(PIN_DAYS_MAX, Math.max(0, o.daysMin)), Math.min(PIN_DAYS_MAX, Math.max(o.daysMin, o.daysMax))) }
  })
}

/** rows for admin_add_samples (0008) */
export const simPostRow = (p: SimPost) => ({ ...postToRow(p), created_at: p.createdAt, verified: p.verified, verify_kind: p.verified ? p.verifiedAs ?? 'company' : null })
export const simPinRow = (p: SimPin) => ({ country: p.country, province: p.province, industry: p.industry, skills: p.skills, created_at: p.at })
