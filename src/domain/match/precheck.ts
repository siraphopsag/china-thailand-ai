// "Pre-check before posting" (owner, Oct 2026). SIMULATED: simple rules standing in for a future AI review, which should look
// for signs of illegal content, missing details and anything odd before a post goes out. The page labels it "simulated AI".
// Messages say "may … please check" — this is not a legal assessment.
import { mustStayDomestic, postIssues, type PostInput, type Problem } from './logic'
import { wageWarning, type MinWage } from './minwage'
import type { Industry, Skill } from './types'

export type Warning = 'noSalary' | 'skillMismatch' | 'shortDetails' | 'discrimination' | 'scamRisk' | 'manyPeople' | 'lure'
/**
 * Fixed legal rules (v2 model, owner Nov 2026): matters with a legal number or an official list are checked by rules, not guessed
 * by the AI, and they show even when the AI answers. 'belowMinWage' blocks a permanent or contract job (it would be unlawful pay);
 * for temporary work and internships it is a warning. 'closedJob' keeps the post inside Thailand (as before) and now says why.
 */
export type LawRule =
  | { rule: 'belowMinWage'; block: boolean; min: MinWage }
  | { rule: 'veryHighPay'; block: false; min: MinWage }
  | { rule: 'closedJob'; block: false }
export interface Precheck { errors: Problem[]; warnings: Warning[]; laws: LawRule[] }
/** the fixed legal rules of a post (also used by the board and the contract check) */
export function lawRules(input: Pick<PostInput, 'place' | 'salary' | 'minYears' | 'employment' | 'position' | 'details'>): LawRule[] {
  const out: LawRule[] = []
  const w = wageWarning(input.place, input.salary, input.minYears)
  if (w?.warning === 'belowMinWage') out.push({ rule: 'belowMinWage', block: input.employment === 'permanent' || input.employment === 'contract', min: w.min })
  if (w?.warning === 'veryHighPay') out.push({ rule: 'veryHighPay', block: false, min: w.min })
  if (mustStayDomestic(input)) out.push({ rule: 'closedJob', block: false })
  return out
}

/** skills that usually belong to each field (a post whose skills share none of these gets a gentle warning) */
const RELATED: Record<Industry, Skill[]> = {
  manufacturing: ['mechanical_engineering', 'electrical_engineering', 'civil_engineering', 'quality_control', 'project_management'],
  technology: ['software_engineering', 'data_analysis', 'project_management', 'electrical_engineering'],
  hospitality: ['hospitality_management', 'culinary_arts', 'thai_chinese_translation', 'marketing'],
  food_service: ['culinary_arts', 'hospitality_management', 'thai_chinese_translation'],
  education: ['thai_chinese_translation', 'project_management', 'data_analysis'],
  logistics: ['project_management', 'data_analysis', 'accounting_finance', 'thai_chinese_translation'],
  finance: ['accounting_finance', 'data_analysis', 'project_management'],
  legal_services: ['legal_research', 'contract_drafting', 'labour_law', 'compliance_privacy', 'visa_work_permit', 'intellectual_property', 'legal_translation', 'thai_chinese_translation'],
  healthcare: ['customer_service', 'thai_chinese_translation', 'data_analysis', 'project_management'],
  construction: ['civil_engineering', 'electrical_engineering', 'mechanical_engineering', 'project_management', 'welding_cnc', 'electrical_technician'],
  retail_ecommerce: ['sales_bizdev', 'customer_service', 'cross_border_ecommerce', 'livestream_sales', 'marketing', 'warehouse_operations'],
  agriculture: ['supply_chain', 'quality_control', 'sales_bizdev', 'customs_brokerage', 'thai_chinese_translation'],
  automotive_ev: ['mechanical_engineering', 'electrical_engineering', 'quality_control', 'welding_cnc', 'electrical_technician', 'supply_chain'],
  energy: ['electrical_engineering', 'electrical_technician', 'project_management', 'mechanical_engineering', 'data_analysis'],
  trade: ['customs_brokerage', 'supply_chain', 'sales_bizdev', 'thai_chinese_translation', 'accounting_finance', 'cross_border_ecommerce'],
  media_marketing: ['marketing', 'graphic_design', 'video_editing', 'livestream_sales', 'thai_chinese_translation'],
  real_estate: ['sales_bizdev', 'customer_service', 'contract_drafting', 'marketing', 'thai_chinese_translation'],
  beauty_wellness: ['customer_service', 'sales_bizdev', 'marketing', 'livestream_sales'],
}
/** wording that may exclude people for who they are (age, sex, religion, nationality) — Thai, Chinese and English */
const DISCRIMINATION = /อายุไม่เกิน|อายุ\s*\d+\s*[-–]\s*\d+|เพศชาย|เพศหญิง|เฉพาะผู้ชาย|เฉพาะผู้หญิง|เฉพาะชาย|เฉพาะหญิง|ศาสนา|เชื้อชาติ|สัญชาติ|年龄|限男|限女|男性|女性|宗教|民族|国籍|\bage\b|\bmale only\b|\bfemale only\b|\breligio|\bnationality\b|\brace\b/i
/** wording often seen in job scams: fees or deposits asked from the job seeker (registration fees added Oct 2026: an AI evaluation
 *  found "Pay the 990 baht registration fee" passed the rules) */
const SCAM = /ค่าสมัคร|ค่ามัดจำ|ค่าหัวคิว|ค่าธรรมเนียม|ค่าลงทะเบียน|โอนเงิน|เงินประกันการทำงาน|押金|报名费|注册费|手续费|保证金|中介费|\bdeposit\b|\bapplication fee\b|\bregistration fee\b|\bpay (a |the )?fee\b|\bprocessing fee\b/i

export function precheck(input: PostInput, at: string): Precheck {
  // every rule error at once (QA, Oct 2026), each problem listed once
  const errors: Problem[] = [...new Set(postIssues(input, at).map((x) => x.problem))]
  const warnings: Warning[] = []
  if (input.salary === null) warnings.push('noSalary')
  if (input.skills.length && !input.skills.some((s) => RELATED[input.industry]?.includes(s))) warnings.push('skillMismatch')
  if (input.details.trim().length < 30) warnings.push('shortDetails')
  const words = [input.company, input.position, input.details].join(' ')
  if (DISCRIMINATION.test(words)) warnings.push('discrimination')
  if (SCAM.test(words)) warnings.push('scamRisk')
  if (input.headcount > 50) warnings.push('manyPeople')
  return { errors, warnings, laws: errors.length ? [] : lawRules(input) }
}
