import type {
  AIResponse, ContractInput, EmploymentArea, EmploymentInput, Holder, Level, NomineeResult, Profile, RiskCardData, RoadmapStep, Verification,
} from '../types'
import { dirInfo, DISCLAIMER, escapeHtml } from '../utils/labels'

const GAP = 25 // ส่วนต่าง (จุดเปอร์เซ็นต์) ที่ถือว่าควรตรวจสอบเพิ่มเติม

export const hasCompany = (p: Profile) => p.forms.some((f) => ['เปิดบริษัท', 'ลงทุน'].includes(f))
export const targetCountry = (p: Profile) => (p.direction === 'TH_CN' ? 'CN' : 'TH')
export const holdersSum = (p: Profile) => p.holders.reduce((a, h) => a + h.percent, 0)

/* ---------- Ownership ---------- */
export interface OwnershipDim { key: string; title: string; status: Level; note: string }
export function ownershipDims(p: Profile): OwnershipDim[] {
  const gap = (h: Holder, v: number) => Math.abs(v - h.percent)
  const worst = (f: (h: Holder) => number) => Math.max(...p.holders.map((h) => gap(h, f(h))))
  const lv = (g: number): Level => (g >= GAP ? 'NEEDS_REVIEW' : 'LOW')
  const maj = [...p.holders].sort((a, b) => b.percent - a.percent)[0]
  return [
    { key: 'own', title: 'ความเป็นเจ้าของ (Ownership)', status: Math.round(holdersSum(p)) === 100 ? 'LOW' : 'NEEDS_REVIEW', note: Math.round(holdersSum(p)) === 100 ? 'สัดส่วนหุ้นรวม 100%' : `สัดส่วนหุ้นรวม ${holdersSum(p)}% — ข้อมูลยังไม่ครบ 100%` },
    { key: 'fund', title: 'แหล่งเงินทุน (Funding)', status: lv(worst((h) => h.capital)), note: worst((h) => h.capital) >= GAP ? 'สัดส่วนเงินลงทุนไม่สอดคล้องกับสัดส่วนหุ้น' : 'สอดคล้องกับสัดส่วนหุ้น' },
    { key: 'ctl', title: 'อำนาจควบคุม (Control)', status: lv(worst((h) => h.voting)), note: worst((h) => h.voting) >= GAP ? 'สิทธิออกเสียงไม่สอดคล้องกับสัดส่วนหุ้น' : 'สิทธิออกเสียงสอดคล้องกับสัดส่วนหุ้น' },
    { key: 'dir', title: 'กรรมการ (Director)', status: lv(worst((h) => h.board)), note: worst((h) => h.board) >= GAP ? 'การแต่งตั้งกรรมการไม่สอดคล้องกับสัดส่วนหุ้น' : 'การแต่งตั้งกรรมการสอดคล้องกับสัดส่วนหุ้น' },
    { key: 'eco', title: 'สิทธิประโยชน์ทางเศรษฐกิจ (Economic rights)', status: lv(worst((h) => h.economic)), note: worst((h) => h.economic) >= GAP ? 'ส่วนแบ่งผลประโยชน์ไม่สอดคล้องกับสัดส่วนหุ้น' : 'สอดคล้องกับสัดส่วนหุ้น' },
    { key: 'agr', title: 'ข้อตกลง/การจัดการระหว่างผู้ถือหุ้น (Agreement)', status: p.sideAgreement === 'yes' ? 'HIGH' : p.sideAgreement === 'unknown' ? 'NEEDS_REVIEW' : 'LOW',
      note: p.sideAgreement === 'yes' ? 'มีข้อตกลงนอกเอกสารจดทะเบียน — ต้องเปิดเผยให้ผู้ตรวจสอบพิจารณา' : p.sideAgreement === 'unknown' ? 'ยังไม่ทราบว่ามีข้อตกลงอื่นหรือไม่' : `ไม่มีข้อตกลงอื่นที่ส่งผลต่ออำนาจ/ผลประโยชน์ (ผู้ถือหุ้นใหญ่: ${maj.label})` },
  ]
}

/* ---------- Nominee risk ---------- */
export function detectNomineeRisk(p: Profile): NomineeResult {
  const ind: NomineeResult['indicators'] = []
  const unknowns: string[] = []
  if (!hasCompany(p)) {
    return { level: 'LOW', indicators: [], unknowns: [], stop: false, headline: 'ยังไม่เข้าข่ายการตรวจโครงสร้างผู้ถือหุ้น', answer: 'รูปแบบการขยายธุรกิจที่เลือกยังไม่เกี่ยวข้องกับการถือหุ้นในนิติบุคคลท้องถิ่น', reason: 'ไม่มีข้อมูลการจัดตั้งบริษัทหรือการลงทุนในโปรไฟล์', next: ['หากเปลี่ยนแผนเป็นการจัดตั้งบริษัทหรือร่วมลงทุน ให้กลับมาตรวจอีกครั้ง'] }
  }
  const fmt = (h: Holder, v: number, name: string) => `${h.label} ถือหุ้น ${h.percent}% แต่${name} ${v}%`
  p.holders.forEach((h) => {
    if (Math.abs(h.capital - h.percent) >= GAP)
      ind.push({ key: 'fund-' + h.id, text: `พบข้อมูลว่าแหล่งเงินลงทุนอาจไม่สอดคล้องกับผู้ถือหุ้น (${fmt(h, h.capital, 'จัดหาเงินลงทุน')})`, why: 'โดยปกติสัดส่วนเงินลงทุนมักสัมพันธ์กับสัดส่วนหุ้น หากต่างกันมากควรมีคำอธิบายและหลักฐานที่ตรวจสอบได้ เช่น สัญญาเงินกู้ที่เปิดเผยและถูกต้อง', verify: 'หลักฐานการโอนเงินลงทุน ที่มาของเงิน และเอกสารการชำระค่าหุ้น' })
    if (Math.abs(h.economic - h.percent) >= GAP)
      ind.push({ key: 'eco-' + h.id, text: `พบข้อมูลที่ต้องตรวจสอบเพิ่มเติมเกี่ยวกับสิทธิทางเศรษฐกิจ (${fmt(h, h.economic, 'ได้รับสิทธิประโยชน์ทางเศรษฐกิจ')})`, why: 'สิทธิรับเงินปันผลหรือผลกำไรที่ไม่สอดคล้องกับหุ้น อาจสะท้อนว่าผลประโยชน์จริงไปอยู่กับอีกฝ่าย', verify: 'ข้อบังคับบริษัท ข้อตกลงผู้ถือหุ้น และนโยบายการจ่ายเงินปันผล' })
    if (Math.abs(h.voting - h.percent) >= GAP || Math.abs(h.board - h.percent) >= GAP)
      ind.push({ key: 'ctl-' + h.id, text: `พบความไม่ชัดเจนเกี่ยวกับผู้ควบคุมกิจการ (สิทธิออกเสียง/การแต่งตั้งกรรมการของ${h.label}ไม่สอดคล้องกับหุ้น)`, why: 'อำนาจควบคุมจริงอาจต่างจากที่ปรากฏในสัดส่วนหุ้น', verify: 'ข้อบังคับบริษัท หุ้นบุริมสิทธิ์ และรายชื่อกรรมการพร้อมผู้แต่งตั้ง' })
  })
  const maj = [...p.holders].sort((a, b) => b.percent - a.percent)[0]
  ;(p.unknownFacts ?? []).forEach((u) => unknowns.push(u))
  if (p.realInvestor === 'unknown') unknowns.push('ยังไม่ทราบว่าใครเป็นผู้ลงทุนจริง')
  else if (p.realInvestor !== 'shared' && p.realInvestor !== maj.id && maj.percent > 50)
    ind.push({ key: 'investor', text: 'พบข้อมูลว่าผู้ลงทุนจริงไม่ใช่ผู้ถือหุ้นรายใหญ่ที่ปรากฏในทะเบียน', why: 'ผู้ที่ถือหุ้นส่วนใหญ่แต่ไม่ใช่ผู้ลงทุนจริง เป็นปัจจัยที่หน่วยงานมักพิจารณาเพิ่มเติม', verify: 'เอกสารแสดงผู้ลงทุนและเจ้าของผลประโยชน์ที่แท้จริง' })
  if (p.operator === 'unknown') unknowns.push('ยังไม่ทราบว่าใครมีอำนาจบริหารจริง')
  else if (p.operator !== 'joint' && p.operator !== maj.id && maj.percent > 50)
    ind.push({ key: 'operator', text: 'พบข้อมูลว่าผู้บริหารจริงไม่ใช่ผู้ถือหุ้นรายใหญ่', why: 'อำนาจบริหารที่อยู่กับอีกฝ่ายควรถูกอธิบายและสอดคล้องกับเอกสารจดทะเบียน', verify: 'หนังสือแต่งตั้งผู้มีอำนาจ อำนาจกรรมการ และขอบเขตการมอบอำนาจ' })
  if (p.sideAgreement === 'yes') ind.push({ key: 'agr', text: 'พบข้อตกลงระหว่างผู้ถือหุ้นที่อยู่นอกเอกสารจดทะเบียน', why: 'ข้อตกลงที่กระทบอำนาจหรือผลประโยชน์ต้องเปิดเผยและต้องได้รับการตรวจสอบทางกฎหมาย', verify: 'สำเนาข้อตกลงทั้งหมดเพื่อให้ผู้เชี่ยวชาญตรวจ' })
  if (p.sideAgreement === 'unknown') unknowns.push('ยังไม่ทราบว่ามีข้อตกลงอื่นระหว่างผู้ถือหุ้นหรือไม่')
  if (Math.round(holdersSum(p)) !== 100) unknowns.push(`สัดส่วนหุ้นรวมเป็น ${holdersSum(p)}% (ควรเท่ากับ 100%)`)

  const types = new Set(ind.map((i) => i.key.split('-')[0]))
  const level: Level = types.size >= 3 ? 'HIGH' : types.size >= 1 ? 'MEDIUM' : unknowns.length ? 'NEEDS_REVIEW' : 'LOW'
  const stop = level === 'HIGH'
  const next =
    level === 'LOW' ? ['เก็บเอกสารแสดงที่มาของเงินลงทุนและโครงสร้างการควบคุมไว้ให้พร้อมตรวจสอบ']
    : level === 'NEEDS_REVIEW' ? ['ตอบข้อมูลที่ยังขาดเพื่อให้ระบบประเมินได้ครบถ้วน', 'ตรวจสอบเอกสารโครงสร้างผู้ถือหุ้นกับผู้เชี่ยวชาญก่อนดำเนินการ']
    : ['หยุดการดำเนินการในรูปแบบนี้ชั่วคราว', 'ตรวจสอบแหล่งเงินลงทุนและหลักฐานการชำระค่าหุ้น', 'ตรวจสอบโครงสร้างการควบคุมและสิทธิประโยชน์ทางเศรษฐกิจ', 'พิจารณาขอคำยืนยันจากผู้เชี่ยวชาญ/หน่วยงานที่เกี่ยวข้อง']
  return {
    level, indicators: ind, unknowns, stop,
    headline: level === 'LOW' ? 'ยังไม่พบปัจจัยที่ควรตรวจสอบเพิ่มเติมจากข้อมูลที่ให้มา' : 'พบปัจจัยเสี่ยงที่ควรตรวจสอบเพิ่มเติม',
    answer: level === 'LOW' ? 'จากข้อมูลปัจจุบัน โครงสร้างหุ้น เงินลงทุน และการควบคุมดูสอดคล้องกัน (ไม่ใช่การรับรองทางกฎหมาย)' : 'จากข้อมูลปัจจุบัน โครงสร้างนี้มีประเด็นที่ต้องตรวจสอบเพิ่มเติม',
    reason: ind.length ? `ระบบพบ ${ind.length} รายการที่ข้อมูลเงินลงทุน อำนาจควบคุม หรือสิทธิประโยชน์ไม่สอดคล้องกับสัดส่วนหุ้น` : unknowns.length ? 'ข้อมูลเกี่ยวกับผู้ลงทุนจริงหรืออำนาจควบคุมยังไม่ชัดเจน' : 'ข้อมูลในแต่ละมิติสอดคล้องกัน',
    next,
  }
}

/** ผลกระทบที่อาจเกี่ยวข้อง — ไม่ระบุโทษเฉพาะเจาะจงเพราะข้อมูลข้อเท็จจริงยังไม่พอ */
export function consequences(p: Profile) {
  const th = targetCountry(p) === 'TH'
  return [
    { topic: 'ความเป็นคนต่างด้าวตามกฎหมายการลงทุน', law: th ? 'พ.ร.บ.การประกอบธุรกิจของคนต่างด้าว พ.ศ. 2542' : 'กฎหมายการลงทุนจากต่างประเทศของจีน / Negative List 2024', regId: th ? 'th-fba' : 'cn-neglist-2024',
      effect: 'การประกอบธุรกิจอาจถูกตรวจสอบโดยหน่วยงานที่เกี่ยวข้อง', reason: 'ข้อมูลเงินลงทุนและการควบคุมยังไม่สอดคล้องกับสัดส่วนหุ้นที่แจ้ง', v: 'EXPERT' as Verification },
    { topic: 'ความถูกต้องของข้อมูลการจดทะเบียน', law: th ? 'ข้อกำหนดการจดทะเบียนของ DBD' : 'ระบบรายงานข้อมูลการลงทุนของ MOFCOM', regId: th ? 'th-dbd-reg' : 'cn-fil',
      effect: 'ข้อมูลที่ยื่นอาจต้องถูกแก้ไขหรือชี้แจงเพิ่มเติม', reason: 'ผู้ถือหุ้นและผู้ควบคุมที่แท้จริงต้องสอดคล้องกับข้อมูลที่ยื่น', v: 'NEED_INFO' as Verification },
  ].map((c) => ({ ...c, penalty: 'ไม่แสดงโทษที่เฉพาะเจาะจง เนื่องจากข้อมูลข้อเท็จจริงยังไม่เพียงพอ' }))
}

export const compliantOptions = [
  { k: 'A', t: 'ตรวจสอบว่าประเภทธุรกิจสามารถดำเนินการภายใต้โครงสร้างที่เสนอได้หรือไม่', d: 'จัดประเภทกิจกรรมเทียบกับบัญชี/รายการข้อจำกัดการลงทุนฉบับทางการ' },
  { k: 'B', t: 'ตรวจสอบสิทธิ/ใบอนุญาตสำหรับการลงทุนจากต่างประเทศ', d: 'เช่น การขออนุญาตประกอบธุรกิจ หรือสิทธิส่งเสริมการลงทุน (BOI) ที่เหมาะกับกิจกรรม' },
  { k: 'C', t: 'ตรวจสอบทางเลือกด้านโครงสร้างธุรกิจที่กฎหมายรองรับ', d: 'เช่น สัดส่วนการถือหุ้นที่เปิดเผยจริงตามเงินลงทุนของแต่ละฝ่าย หรือรูปแบบการร่วมทุนที่โปร่งใส' },
  { k: 'D', t: 'ส่งต่อให้ผู้เชี่ยวชาญตรวจสอบข้อเท็จจริงเพิ่มเติม', d: 'ทนายความหรือที่ปรึกษากฎหมายที่มีคุณสมบัติในประเทศเป้าหมาย' },
]

/* ---------- Employment ---------- */
export function analyzeEmployment(e: EmploymentInput, p: Profile | null): EmploymentArea[] {
  const tc = p ? targetCountry(p) : 'CN'
  const cross = /ส่ง/.test(e.mode)
  const miss = (v: string) => !v.trim()
  const sid = (th: string, cn: string) => (tc === 'TH' ? th : cn)
  const row = (area: string, v: string, note: string, sourceId: string, forceReview = false): EmploymentArea =>
    miss(v) ? { area, status: 'NEEDS_REVIEW', note: 'ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์ — กรุณาระบุข้อมูลเพิ่มเติม', sourceId }
      : { area, status: forceReview ? 'NEEDS_REVIEW' : 'LOW', note, sourceId }
  return [
    row('นายจ้าง (Employer)', p?.companyName ?? '', 'นายจ้างต้องเป็นนิติบุคคลที่จดทะเบียนถูกต้องในประเทศที่จ้างงาน', sid('th-dbd-reg', 'cn-fil')),
    row('สัญชาติลูกจ้าง', e.nationality, 'สัญชาติมีผลต่อสิทธิการทำงานและภาษี', sid('th-labour', 'cn-immigration')),
    row('สถานที่ทำงาน', e.location, 'กฎหมายแรงงานที่ใช้บังคับขึ้นกับสถานที่ทำงานจริง', sid('th-labour', 'cn-labor')),
    row('ระยะเวลาจ้าง', e.duration, 'ระยะเวลามีผลต่อประเภทสัญญา ทดลองงาน และสถานะภาษี', sid('th-labour', 'cn-labor'), true),
    row('เงินเดือน', e.salary, 'ควรระบุสกุลเงิน วันจ่าย และภาระภาษี', sid('th-tax', 'cn-tax'), true),
    row('ชั่วโมงทำงาน', e.hours, 'ต้องตรวจสอบเพดานชั่วโมงทำงานและค่าล่วงเวลาตามกฎหมายท้องถิ่น', sid('th-labour', 'cn-labor'), true),
    row('วันลา', e.leave, 'ต้องตรวจสิทธิวันลาขั้นต่ำตามกฎหมายท้องถิ่น', sid('th-labour', 'cn-labor'), true),
    row('ประกันสังคม', e.socialSecurity, 'ต้องตรวจว่าลูกจ้างต่างชาติ/ที่ส่งไปทำงานต้องเข้าระบบใดและเงินสมทบเป็นอย่างไร', sid('th-labour', 'cn-labor'), true),
    row('สิทธิการทำงาน (Work authorization)', e.workAuth, 'ต้องตรวจสอบกับหน่วยงานที่รับผิดชอบก่อนเริ่มงาน', sid('th-labour', 'cn-immigration'), true),
    row('ข้อกำหนดสัญญาจ้าง', e.mode, 'ต้องมีสัญญาเป็นลายลักษณ์อักษรและเนื้อหาครบตามกฎหมายท้องถิ่น', sid('th-labour', 'cn-labor'), true),
    row('ข้อพิจารณาด้านภาษี', e.tax || (cross ? '' : 'x'), 'ภาษีของพนักงานที่ทำงานข้ามประเทศขึ้นกับจำนวนวันพำนักและสนธิสัญญาภาษีซ้อน', sid('th-tax', 'cn-tax'), true),
  ]
}

/* ---------- Risk cards ---------- */
export function assessRisks(p: Profile, emp: EmploymentInput): RiskCardData[] {
  const tc = targetCountry(p)
  const nom = detectNomineeRisk(p)
  const dims = ownershipDims(p)
  const ownLvl: Level = dims.some((d) => d.status === 'HIGH') ? 'HIGH' : dims.filter((d) => d.status === 'NEEDS_REVIEW').length >= 2 ? 'MEDIUM' : dims.some((d) => d.status === 'NEEDS_REVIEW') ? 'NEEDS_REVIEW' : 'LOW'
  const empAreas = analyzeEmployment(emp, p)
  const missEmp = empAreas.filter((a) => a.note.startsWith('ข้อมูลยังไม่เพียงพอ')).length
  const empLvl: Level = missEmp >= 3 ? 'HIGH' : missEmp >= 1 ? 'MEDIUM' : 'NEEDS_REVIEW'
  const restricted = /ค้าปลีก|บริการ|สื่อ|การเงิน|ที่ปรึกษา|การศึกษา|สุขภาพ/.test(p.businessType)
  const regulated = p.regulatedGoods && p.regulatedGoods !== 'ไม่มี'
  return [
    { id: 'legal', category: 'กฎหมาย/การเข้าถึงตลาด', level: restricted || regulated ? 'NEEDS_REVIEW' : 'MEDIUM', verification: 'PARTIAL',
      why: restricted || regulated ? 'กิจกรรมหรือสินค้าของคุณอาจอยู่ในสาขาที่มีเงื่อนไขพิเศษ ต้องตรวจเทียบรายการทางการ' : 'ยังไม่ได้ยืนยันกับรายการข้อจำกัดการลงทุนฉบับจริง แม้ประเภทธุรกิจผลิตโดยทั่วไปมีข้อจำกัดน้อยกว่า',
      sourceIds: [tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'], check: ['ตรวจกิจกรรมธุรกิจเทียบรายการข้อจำกัดฉบับล่าสุด', 'ตรวจว่าต้องขออนุญาตเฉพาะหรือไม่'], next: 'เปิดแหล่งข้อมูลทางการและยืนยันประเภทกิจกรรมก่อนยื่นจัดตั้ง' },
    { id: 'ownership', category: 'โครงสร้างผู้ถือหุ้น', level: ownLvl, verification: 'NEED_INFO',
      why: 'โครงสร้างควรพิจารณาจากเงินลงทุน อำนาจควบคุม และผลประโยชน์ ไม่ใช่สัดส่วนหุ้นอย่างเดียว', sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-fba'],
      check: dims.filter((d) => d.status !== 'LOW').map((d) => d.title), next: 'เปิดหน้า “วิเคราะห์โครงสร้างผู้ถือหุ้น” และตอบคำถามเรื่องการควบคุม' },
    { id: 'nominee', category: 'ความเสี่ยงด้านนอมินี', level: nom.level, verification: nom.level === 'LOW' ? 'PARTIAL' : 'EXPERT',
      why: nom.reason, sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-fba'], check: nom.indicators.map((i) => i.verify).slice(0, 3), next: nom.next[0] },
    { id: 'employment', category: 'การจ้างงาน', level: empLvl, verification: 'NEED_INFO',
      why: missEmp ? `ข้อมูลการจ้างงานยังขาด ${missEmp} หัวข้อ จึงยังสรุปไม่ได้` : 'ข้อมูลครบเบื้องต้น แต่ต้องตรวจเงื่อนไขท้องถิ่น', sourceIds: [tc === 'CN' ? 'cn-labor' : 'th-labour', tc === 'CN' ? 'cn-immigration' : 'th-labour'],
      check: empAreas.filter((a) => a.status !== 'LOW').slice(0, 4).map((a) => a.area), next: 'กรอกข้อมูลในหน้า “การจ้างงาน” ให้ครบ' },
    { id: 'tax', category: 'ภาษี', level: p.crossBorderWorkers ? 'MEDIUM' : 'NEEDS_REVIEW', verification: 'NEED_INFO',
      why: p.crossBorderWorkers ? 'มีพนักงานทำงานข้ามประเทศ สถานะภาษีและภาษีซ้อนต้องตรวจสอบ' : 'ยังไม่มีข้อมูลโครงสร้างภาษีเพียงพอ', sourceIds: [tc === 'CN' ? 'cn-tax' : 'th-tax'],
      check: ['จำนวนวันพำนักของพนักงาน', 'การหักภาษี ณ ที่จ่าย', 'ภาษีซ้อนระหว่างไทย–จีน'], next: 'ปรึกษานักบัญชี/ที่ปรึกษาภาษีที่รู้กฎของประเทศเป้าหมาย' },
    { id: 'language', category: 'ภาษา', level: 'MEDIUM', verification: 'PARTIAL',
      why: 'สัญญาและเอกสารทางการควรมีฉบับภาษาท้องถิ่นและต้องกำหนดว่าฉบับใดใช้ตีความ', sourceIds: [tc === 'CN' ? 'cn-labor' : 'th-labour'],
      check: ['ภาษาที่ใช้ตีความสัญญา', 'ศัพท์กฎหมายที่แปลตรงตัวไม่ได้'], next: 'จัดทำฉบับสองภาษาและให้ผู้เชี่ยวชาญตรวจ' },
    { id: 'culture', category: 'วัฒนธรรมองค์กร', level: 'LOW', verification: 'PARTIAL',
      why: 'มีแนวโน้มด้านการสื่อสารที่ควรคำนึงถึง แต่ความแตกต่างรายบุคคลและรายองค์กรมีอยู่เสมอ', sourceIds: [], check: ['ความคาดหวังการประชุมและการตัดสินใจ'], next: 'อ่านคู่มือสื่อสารในหน้า “ภาษาและวัฒนธรรม”' },
    { id: 'documents', category: 'เอกสาร', level: 'MEDIUM', verification: 'NEED_INFO',
      why: 'เอกสารหลายรายการยังไม่พร้อม เช่น หลักฐานเงินลงทุน ข้อบังคับบริษัท และสัญญาจ้าง', sourceIds: [tc === 'CN' ? 'cn-fil' : 'th-dbd-reg'], check: ['หลักฐานเงินลงทุน', 'เอกสารผู้ถือหุ้น', 'สัญญาจ้าง'], next: 'ไปที่ศูนย์จัดการเอกสารและสร้างรายการเอกสารที่ต้องเตรียม' },
  ]
}

/* ---------- Roadmap ---------- */
export function generateRoadmap(p: Profile): RoadmapStep[] {
  const nom = detectNomineeRisk(p)
  const flagged = nom.level !== 'LOW'
  const tc = targetCountry(p)
  const S = (id: number, title: string, description: string, docs: string[], why: string, next: string, status: RoadmapStep['status'], note?: string): RoadmapStep => ({ id, title, description, docs, why, next, status, note })
  return [
    S(1, 'ตรวจสอบประเภทธุรกิจ', 'จัดประเภทกิจกรรมธุรกิจให้ชัดเจนและตรวจเทียบรายการข้อจำกัด', ['คำอธิบายกิจกรรมธุรกิจ', 'รายการสินค้า/บริการ'], 'ประเภทธุรกิจกำหนดว่าข้อกำหนดใดเกี่ยวข้อง', 'ยืนยันกิจกรรมกับรายการทางการ', 'done'),
    S(2, 'ตรวจสอบสิทธิการลงทุน', tc === 'CN' ? 'ตรวจ Negative List 2024 และเงื่อนไขการเข้าถึงตลาด' : 'ตรวจ Foreign Business Act และสิทธิ BOI', ['หนังสือรับรองบริษัท', 'แผนธุรกิจ'], 'ช่วยให้ทราบว่าลงทุนรูปแบบใดได้หรือต้องขออนุญาต', 'เปิดแหล่งข้อมูลทางการและบันทึกผลตรวจ', 'review'),
    S(3, 'ตรวจสอบโครงสร้างผู้ถือหุ้น', 'ตรวจความสอดคล้องของหุ้น เงินลงทุน การควบคุม และผลประโยชน์', ['รายชื่อผู้ถือหุ้น', 'หลักฐานชำระค่าหุ้น', 'ข้อตกลงผู้ถือหุ้น'], 'ข้อมูลที่ไม่สอดคล้องกันเป็นปัจจัยที่หน่วยงานมักตรวจสอบ', flagged ? 'ทบทวนโครงสร้างและหลักฐานตามรายการที่ระบบแจ้ง' : 'เก็บเอกสารให้พร้อมตรวจ', flagged ? 'fix' : 'review', flagged ? 'ต้องแก้ไขก่อนไปขั้นถัดไป' : undefined),
    S(4, 'ตรวจสอบความเสี่ยงด้านนอมินี', 'ตรวจปัจจัยที่ควรตรวจสอบเพิ่มเติมเกี่ยวกับผู้ลงทุนจริงและอำนาจควบคุม', ['หลักฐานแหล่งเงินทุน', 'แผนผังการควบคุม'], 'ลดความเสี่ยงการถูกตรวจสอบหรือโครงสร้างที่ไม่สอดคล้องกับข้อเท็จจริง', nom.next[0], flagged ? 'fix' : 'review', flagged ? 'ควรหยุดการดำเนินการในขั้นตอนนี้และตรวจสอบเพิ่มเติม' : undefined),
    S(5, 'ตรวจสอบข้อกำหนดการจ้างงาน', 'ตรวจสิทธิการทำงาน สัญญาจ้าง ประกันสังคม และภาษีพนักงาน', ['ข้อมูลพนักงาน', 'ร่างสัญญาจ้าง'], 'การจ้างงานผิดรูปแบบอาจกระทบการเริ่มงาน', 'กรอกข้อมูลในหน้าการจ้างงานให้ครบ', 'doing'),
    S(6, 'เตรียมเอกสาร', 'รวบรวมและแปลเอกสารที่ต้องใช้', ['เอกสารบริษัท', 'เอกสารผู้ถือหุ้น', 'สัญญาจ้างสองภาษา'], 'เอกสารพร้อมช่วยลดการตีกลับ', 'สร้างรายการเอกสารที่ศูนย์จัดการเอกสาร', 'todo'),
    S(7, 'ดำเนินการตามขั้นตอน', 'ยื่นคำขอ/จดทะเบียนตามช่องทางทางการ', ['เอกสารชุดยื่นจริง'], 'ดำเนินการหลังผ่านการตรวจสอบข้อ 1–6 แล้วเท่านั้น', flagged ? 'รอผลแก้ไขข้อ 3–4' : 'เริ่มยื่นคำขอกับหน่วยงาน', 'todo', flagged ? 'ถูกพักไว้ชั่วคราวจนกว่าข้อ 3–4 จะเรียบร้อย' : undefined),
    S(8, 'ติดตาม Compliance', 'ติดตามการเปลี่ยนแปลงกฎระเบียบและวันครบกำหนด', ['ปฏิทินกำหนดส่ง'], 'กฎระเบียบเปลี่ยนแปลงได้ตลอดเวลา', 'เปิดการติดตาม Compliance', 'todo'),
  ]
}

/* ---------- Contract ---------- */
export const contractRequired: { k: keyof ContractInput; label: string }[] = [
  { k: 'employer', label: 'นายจ้าง' }, { k: 'employee', label: 'ลูกจ้าง' }, { k: 'nationality', label: 'สัญชาติ' }, { k: 'job', label: 'ตำแหน่งงาน' },
  { k: 'location', label: 'สถานที่ทำงาน' }, { k: 'startDate', label: 'วันเริ่มงาน' }, { k: 'duration', label: 'ระยะเวลาสัญญา' }, { k: 'salary', label: 'ค่าตอบแทน' },
  { k: 'hours', label: 'เวลาทำงาน' }, { k: 'leave', label: 'วันลา' }, { k: 'probation', label: 'ระยะทดลองงาน' },
]
export function generateContract(c: ContractInput) {
  const missing = contractRequired.filter((r) => !c[r.k].trim()).map((r) => r.label)
  const v = (x: string, cn = false) => (x.trim() ? x.trim() : cn ? '【待补充】' : '[ยังไม่ระบุ]')
  const th = `ร่างสัญญาจ้างแรงงานเบื้องต้น (DRAFT)
${DISCLAIMER_DRAFT}

ข้อ 1 คู่สัญญา: นายจ้าง ${v(c.employer)} และลูกจ้าง ${v(c.employee)} สัญชาติ ${v(c.nationality)}
ข้อ 2 ตำแหน่งและลักษณะงาน: ${v(c.job)}
ข้อ 3 สถานที่ทำงาน: ${v(c.location)}
ข้อ 4 วันเริ่มงานและระยะเวลา: เริ่ม ${v(c.startDate)} ระยะเวลา ${v(c.duration)}
ข้อ 5 ระยะทดลองงาน: ${v(c.probation)}
ข้อ 6 ค่าตอบแทน: ${v(c.salary)}
ข้อ 7 สวัสดิการ: ${v(c.benefits)}
ข้อ 8 เวลาทำงาน: ${v(c.hours)}
ข้อ 9 วันลา: ${v(c.leave)}
ข้อ 10 เงื่อนไขอื่นที่ตกลงกัน: ${v(c.other)}
ข้อ 11 กฎหมายที่ใช้บังคับและภาษาที่ใช้ตีความ: [ต้องตรวจสอบโดยผู้เชี่ยวชาญ]
ข้อ 12 การเลิกสัญญา การชดเชย และการระงับข้อพิพาท: [ต้องตรวจสอบตามกฎหมายท้องถิ่น]`
  const cn = `劳动合同（草案 — 仅供核查，不构成法律认证）

第一条 双方当事人：用人单位 ${v(c.employer, true)}；劳动者 ${v(c.employee, true)}，国籍 ${v(c.nationality, true)}
第二条 岗位及工作内容：${v(c.job, true)}
第三条 工作地点：${v(c.location, true)}
第四条 起始日期及合同期限：${v(c.startDate, true)}；${v(c.duration, true)}
第五条 试用期：${v(c.probation, true)}
第六条 劳动报酬：${v(c.salary, true)}
第七条 福利待遇：${v(c.benefits, true)}
第八条 工作时间：${v(c.hours, true)}
第九条 休息休假：${v(c.leave, true)}
第十条 其他约定：${v(c.other, true)}
第十一条 适用法律及文本解释：【需专业人士确认】
第十二条 合同解除、经济补偿及争议解决：【需依当地法律核查】`
  const checks = [
    { t: 'สัญญาต้องทำเป็นลายลักษณ์อักษรและให้ทั้งสองฝ่ายลงนาม', id: 'cn-labor', v: 'PARTIAL' as Verification },
    { t: 'ระยะทดลองงาน วันลา และชั่วโมงทำงานต้องไม่ต่ำกว่าเกณฑ์ตามกฎหมายท้องถิ่น', id: 'cn-labor', v: 'NEED_INFO' as Verification },
    { t: 'พนักงานต่างชาติต้องมีใบอนุญาตทำงาน/สถานะพำนักที่ถูกต้องก่อนเริ่มงาน', id: 'cn-immigration', v: 'NEED_INFO' as Verification },
    { t: 'ประกันสังคมและภาษีเงินได้ต้องตรวจตามสถานะพำนักของลูกจ้าง', id: 'cn-tax', v: 'NEED_INFO' as Verification },
    { t: 'กำหนดภาษาที่ใช้ตีความสัญญาและให้ผู้เชี่ยวชาญตรวจฉบับสองภาษา', id: 'cn-labor', v: 'EXPERT' as Verification },
  ]
  return { missing, th, cn, checks, ready: !!(c.employer.trim() && c.employee.trim() && c.job.trim()) }
}
const DISCLAIMER_DRAFT = 'เอกสารนี้เป็นร่างเพื่อประกอบการตรวจสอบ ไม่ใช่การรับรองทางกฎหมาย'
export { DISCLAIMER_DRAFT }

/* ---------- Documents ---------- */
export type DocType = 'business' | 'ownership' | 'employment' | 'contract' | 'report' | 'translation' | 'plan'
export const docTypes: { type: DocType; title: string; desc: string }[] = [
  { type: 'business', title: 'รายการตรวจธุรกิจ (Business checklist)', desc: 'รายการที่ต้องตรวจเกี่ยวกับประเภทธุรกิจและสิทธิการลงทุน' },
  { type: 'ownership', title: 'รายการตรวจโครงสร้างผู้ถือหุ้น (Ownership checklist)', desc: 'เอกสารและข้อมูลที่ต้องเตรียมเพื่อยืนยันโครงสร้าง' },
  { type: 'employment', title: 'รายการตรวจการจ้างงาน (Employment checklist)', desc: 'สิทธิทำงาน สัญญา ประกันสังคม ภาษี' },
  { type: 'contract', title: 'ร่างสัญญาจ้าง (Contract draft)', desc: 'ร่างสัญญาสองภาษา พร้อมรายการข้อมูลที่ยังไม่ครบ' },
  { type: 'report', title: 'รายงาน Compliance (Compliance report)', desc: 'สรุปการประเมินความเสี่ยงและแหล่งข้อมูลอ้างอิง' },
  { type: 'translation', title: 'คำศัพท์และการแปล (Translation)', desc: 'ตารางศัพท์ไทย–จีน–อังกฤษพร้อมบริบท' },
  { type: 'plan', title: 'แผนการดำเนินงาน (Action plan)', desc: 'ลำดับขั้นตอนและเอกสารที่ต้องใช้' },
]
export function buildDocument(type: DocType, p: Profile, emp: EmploymentInput, con: ContractInput, terms: { th: string; orig: string; mean: string }[]) {
  const d = dirInfo(p.direction)
  const head = `${docTypes.find((x) => x.type === type)!.title}\nธุรกิจ: ${p.companyName} | ทิศทาง: ${d.text}\nสร้างเมื่อ: ${new Date().toLocaleDateString('th-TH')} | ข้อมูลตัวอย่างสำหรับ Prototype\n`
  let body = ''
  if (type === 'business') body = ['ระบุกิจกรรมธุรกิจ: ' + p.activity, 'ตรวจเทียบรายการข้อจำกัดการลงทุน', 'ตรวจใบอนุญาตเฉพาะสินค้า: ' + p.regulatedGoods, 'ตรวจพิธีการนำเข้า–ส่งออก: ' + (p.crossBorder.join(', ') || 'ไม่มี')].map((x) => '☐ ' + x).join('\n')
  if (type === 'ownership') body = [...p.holders.map((h) => `☐ หลักฐานของ${h.label} (หุ้น ${h.percent}% / เงินลงทุน ${h.capital}% / สิทธิประโยชน์ ${h.economic}%)`), '☐ ข้อบังคับบริษัทและสิทธิออกเสียง', '☐ ข้อตกลงระหว่างผู้ถือหุ้นทั้งหมด', '☐ หลักฐานแหล่งเงินลงทุน'].join('\n')
  if (type === 'employment') body = analyzeEmployment(emp, p).map((a) => `☐ ${a.area} — ${a.status === 'LOW' ? 'มีข้อมูลเบื้องต้น' : 'ต้องตรวจสอบเพิ่มเติม'}`).join('\n')
  if (type === 'contract') { const g = generateContract(con); body = `${DISCLAIMER_DRAFT}\n\n[ข้อมูลที่ยังไม่ครบ]\n${g.missing.map((m) => '- ' + m).join('\n') || '-'}\n\n[ฉบับไทย]\n${g.th}\n\n[ฉบับจีน]\n${g.cn}` }
  if (type === 'report') body = assessRisks(p, emp).map((r) => `• ${r.category}: ${r.level} — ${r.why}\n  สิ่งที่ควรทำ: ${r.next}`).join('\n') + `\n\n${DISCLAIMER}`
  if (type === 'translation') body = terms.map((t) => `${t.th} | ${t.orig} | ${t.mean}`).join('\n')
  if (type === 'plan') body = generateRoadmap(p).map((s) => `ขั้นที่ ${s.id} ${s.title}\n  ${s.description}\n  เอกสาร: ${s.docs.join(', ')}\n  ขั้นต่อไป: ${s.next}`).join('\n')
  return { title: docTypes.find((x) => x.type === type)!.title, text: head + '\n' + body + `\n\n${DISCLAIMER}` }
}
export const docToHtml = (title: string, text: string) =>
  `<!doctype html><html lang="th"><meta charset="utf-8"><title>${escapeHtml(title)}</title><body style="font-family:'Noto Sans Thai',sans-serif;max-width:800px;margin:2rem auto;line-height:1.7"><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text)}</pre></body></html>`

/* ---------- Orchestrator ---------- */
const EVASION = /(ปกปิด|ซ่อน.*(เจ้าของ|ผู้ถือหุ้น|ผู้ลงทุน)|หลบ|เลี่ยง.*(กฎหมาย|ข้อจำกัด|สัดส่วน)|ผู้ถือหุ้นปลอม|หาคน.*ถือหุ้นแทน|ถือหุ้นแทน|สัญญาลับ|สัญญาหลอก|hide.*owner|bypass|nominee.*(setup|create))/i
export function orchestrate(q: string, p: Profile | null): AIResponse {
  if (EVASION.test(q))
    return { blocked: true, modules: ['Legal Analysis AI', 'Nominee Risk AI'], risk: 'HIGH', answer: 'ระบบไม่สามารถช่วยวางโครงสร้างที่ปกปิดเจ้าของหรือเลี่ยงข้อจำกัดการลงทุนได้',
      reason: 'คำขอนี้เกี่ยวข้องกับการซ่อนผู้ลงทุน/ผู้ควบคุมจริง ซึ่งอาจขัดต่อกฎหมายของประเทศเป้าหมาย', sources: ['th-fba', 'cn-neglist-2024'],
      next: 'ระบบช่วยได้: ตรวจว่าประเภทธุรกิจรองรับโครงสร้างใด, ตรวจสิทธิ/ใบอนุญาตลงทุน, ตรวจรูปแบบร่วมทุนที่โปร่งใสและกฎหมายรองรับ, หรือส่งต่อผู้เชี่ยวชาญ' }
  const m: [RegExp, string][] = [
    [/พนักงาน|จ้าง|แรงงาน|สัญญาจ้าง|ส่งไป/, 'Employment AI'], [/ภาษี/, 'Tax Analysis AI'], [/หุ้น|ผู้ถือหุ้น|เจ้าของ|ควบคุม/, 'Ownership Analysis AI'],
    [/นอมินี|ผู้ลงทุนจริง|แหล่งเงิน/, 'Nominee Risk AI'], [/สัญญา|เอกสาร|ร่าง/, 'Document AI'], [/ภาษา|แปล|จีน|อังกฤษ/, 'Language AI'],
    [/วัฒนธรรม|เจรจา|ประชุม|สื่อสาร/, 'Culture & Communication AI'], [/กฎหมาย|ลงทุน|ใบอนุญาต|ข้อจำกัด|เปิดบริษัท/, 'Legal Analysis AI'],
  ]
  const modules = m.filter(([r]) => r.test(q)).map(([, n]) => n)
  if (/พนักงาน|จ้าง|ส่งไป/.test(q) && !modules.includes('Legal Analysis AI')) modules.push('Legal Analysis AI')
  if (/ส่ง.*พนักงาน|พนักงาน.*(ไป|ข้าม)/.test(q)) for (const x of ['Tax Analysis AI', 'Document AI']) if (!modules.includes(x)) modules.push(x)
  if (/สัญญา/.test(q) && !modules.includes('Language AI')) modules.push('Language AI')
  if (!p) return { modules: ['Business Intake AI'], risk: 'NEEDS_REVIEW', answer: 'ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์', reason: 'ยังไม่มีโปรไฟล์ธุรกิจให้ระบบใช้เป็นบริบท', sources: [], next: 'เริ่มสัมภาษณ์ธุรกิจหรือกด “เริ่ม Demo” ก่อน' }
  if (!modules.length) return { modules: ['Business Intake AI'], risk: 'NEEDS_REVIEW', answer: 'ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์', reason: 'ระบบยังจับประเด็นคำถามไม่ได้', sources: [], next: 'ลองระบุหัวข้อ เช่น การจ้างงาน ผู้ถือหุ้น ภาษี หรือสัญญา' }
  const tc = targetCountry(p)
  const nom = detectNomineeRisk(p)
  const hit = modules.includes('Nominee Risk AI') || modules.includes('Ownership Analysis AI')
  const srcs = hit ? [tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'] : modules.includes('Employment AI') ? [tc === 'CN' ? 'cn-labor' : 'th-labour', tc === 'CN' ? 'cn-immigration' : 'th-labour'] : modules.includes('Tax Analysis AI') ? [tc === 'CN' ? 'cn-tax' : 'th-tax'] : [tc === 'CN' ? 'cn-neglist-2024' : 'th-fba']
  return {
    modules, sources: srcs, risk: hit ? nom.level : 'NEEDS_REVIEW',
    answer: hit ? nom.answer : 'จากข้อมูลปัจจุบัน ประเด็นนี้ควรตรวจสอบเพิ่มเติมกับแหล่งข้อมูลทางการก่อนตัดสินใจ',
    reason: hit ? nom.reason : `ระบบเรียกโมดูลที่เกี่ยวข้อง ${modules.length} โมดูลโดยใช้โปรไฟล์ “${p.companyName}” และข้อมูลยังไม่ครบพอสรุปขั้นสุดท้าย`,
    next: hit ? nom.next[0] : 'กรอกข้อมูลในหน้าที่เกี่ยวข้องให้ครบ แล้วตรวจกับแหล่งข้อมูลทางการหรือผู้เชี่ยวชาญ',
  }
}

/* ---------- Verification layer ---------- */
export interface VerifyStep { name: string; ok: boolean; note: string }
export function verifyAnalysis(p: Profile, emp: EmploymentInput): { steps: VerifyStep[]; recheck: boolean; final: Verification } {
  const risks = assessRisks(p, emp)
  const steps: VerifyStep[] = [
    { name: 'ตรวจแหล่งข้อมูล (Source Check)', ok: risks.filter((r) => r.category !== 'วัฒนธรรมองค์กร').every((r) => r.sourceIds.length > 0), note: 'ทุกประเด็นกฎหมายมีระเบียนแหล่งข้อมูลอ้างอิง (เป็นข้อมูลตัวอย่าง)' },
    { name: 'ตรวจความสอดคล้อง (Consistency Check)', ok: Math.round(holdersSum(p)) === 100, note: Math.round(holdersSum(p)) === 100 ? 'สัดส่วนหุ้นรวม 100%' : 'สัดส่วนหุ้นรวมไม่เท่ากับ 100% — ต้องแก้ไข' },
    { name: 'ตรวจข้อมูลที่ขาด (Missing Information Check)', ok: analyzeEmployment(emp, p).every((a) => !a.note.startsWith('ข้อมูลยังไม่เพียงพอ')), note: 'ข้อมูลการจ้างงานบางหัวข้อยังไม่ครบ — ระบบจะไม่สรุปเกินข้อมูล' },
    { name: 'ตรวจความเสี่ยง (Risk Check)', ok: !detectNomineeRisk(p).stop, note: detectNomineeRisk(p).stop ? 'พบประเด็นเสี่ยงสูง — แนะนำให้ผู้เชี่ยวชาญตรวจก่อนดำเนินการ' : 'ไม่พบประเด็นเสี่ยงสูง' },
  ]
  const recheck = !steps[1].ok
  const final: Verification = steps.some((s) => !s.ok) ? (detectNomineeRisk(p).stop ? 'EXPERT' : 'NEED_INFO') : 'PARTIAL'
  return { steps, recheck, final }
}
