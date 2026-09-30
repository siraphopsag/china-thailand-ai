import type { Regulation } from '../types'

const S = true // ข้อมูลตัวอย่างสำหรับ Prototype

/** ฐานข้อมูลกฎระเบียบแบบโครงสร้าง — ข้อมูลตัวอย่างสำหรับ Prototype ไม่ใช่ข้อมูลกฎหมายแบบเรียลไทม์
 *  URL ชี้ไปยังหน้าหลักของหน่วยงานทางการ เพื่อให้ผู้ใช้ไปตรวจสอบข้อความฉบับจริง */
export const regulations: Regulation[] = [
  {
    id: 'th-fba', country: 'TH', authority: 'กรมพัฒนาธุรกิจการค้า (DBD)', topic: 'การจำกัดธุรกิจของคนต่างด้าว',
    title: 'พระราชบัญญัติการประกอบธุรกิจของคนต่างด้าว พ.ศ. 2542 (Foreign Business Act)',
    rule: 'ธุรกิจบางประเภทจำกัดหรือห้ามคนต่างด้าวประกอบการ หรือต้องได้รับอนุญาตก่อน ต้องจัดประเภทกิจกรรมธุรกิจเทียบกับบัญชีท้ายกฎหมายและตรวจ "ความเป็นคนต่างด้าว" จากทั้งสัดส่วนหุ้นและสิทธิควบคุมจริง',
    originalTerm: 'Foreign Business Act (FBA)', applicableBusinessType: 'ทุกประเภท (ขึ้นกับกิจกรรมจริง)', applicableNationality: 'ผู้ลงทุนต่างชาติ',
    sourceUrl: 'https://www.dbd.go.th/', publicationDate: '1999-10-24 (ตัวอย่าง)', effectiveDate: 'ตรวจสอบจากแหล่งทางการ', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'th-dbd-reg', country: 'TH', authority: 'กรมพัฒนาธุรกิจการค้า (DBD)', topic: 'การจดทะเบียนนิติบุคคล',
    title: 'ขั้นตอนจดทะเบียนจัดตั้งบริษัทและการแจ้งข้อมูลผู้ถือหุ้น/กรรมการ',
    rule: 'บริษัทที่จัดตั้งในไทยต้องจดทะเบียนกับ DBD และรายงานรายชื่อผู้ถือหุ้น กรรมการ และเปลี่ยนแปลงข้อมูลตามที่กฎหมายกำหนด (รายละเอียดเอกสารและเวลาต้องตรวจสอบกับ DBD)',
    applicableBusinessType: 'นิติบุคคลทุกประเภท', applicableNationality: 'ทุกสัญชาติ',
    sourceUrl: 'https://www.dbd.go.th/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'th-boi', country: 'TH', authority: 'สำนักงานคณะกรรมการส่งเสริมการลงทุน (BOI)', topic: 'สิทธิประโยชน์การลงทุน',
    title: 'การขอรับการส่งเสริมการลงทุนจาก BOI',
    rule: 'กิจการที่อยู่ในประเภทส่งเสริมอาจขอรับสิทธิประโยชน์และ/หรือใบอนุญาตที่เกี่ยวข้องได้ เงื่อนไขขึ้นกับประเภทกิจการและต้องยื่นคำขอตามเกณฑ์ปัจจุบันของ BOI',
    originalTerm: 'BOI Promotion', applicableBusinessType: 'กิจการในบัญชีส่งเสริม', applicableNationality: 'ทุกสัญชาติ',
    sourceUrl: 'https://www.boi.go.th/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'th-labour', country: 'TH', authority: 'กระทรวงแรงงาน', topic: 'การทำงานของคนต่างด้าว',
    title: 'ใบอนุญาตทำงานของคนต่างด้าวในประเทศไทย (Work Permit)',
    rule: 'คนต่างด้าวที่จะทำงานในไทยต้องได้รับอนุญาตให้ทำงานและมีสถานะการเข้าเมืองที่สอดคล้อง รวมถึงอาจมีเงื่อนไขเรื่องสัดส่วนแรงงานไทย (ต้องตรวจสอบตามประเภทงาน)',
    originalTerm: 'Work Permit', applicableBusinessType: 'ทุกประเภท', applicableNationality: 'คนต่างด้าว',
    sourceUrl: 'https://www.mol.go.th/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'th-tax', country: 'TH', authority: 'กรมสรรพากร', topic: 'ภาษีและเงินได้พนักงาน',
    title: 'ภาษีเงินได้นิติบุคคล ภาษีเงินได้บุคคลธรรมดา และภาษีมูลค่าเพิ่ม (ไทย)',
    rule: 'บริษัทต้องจดทะเบียนภาษีที่เกี่ยวข้อง และหักภาษี ณ ที่จ่ายจากเงินเดือนตามเกณฑ์ สถานะผู้มีถิ่นที่อยู่ทางภาษีของลูกจ้างมีผลต่อการคำนวณ',
    originalTerm: 'Tax residency', applicableBusinessType: 'ทุกประเภท', applicableNationality: 'ทุกสัญชาติ',
    sourceUrl: 'https://www.rd.go.th/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'th-customs', country: 'TH', authority: 'กรมศุลกากร', topic: 'การนำเข้า–ส่งออก',
    title: 'พิธีการศุลกากรและอัตราอากรสำหรับสินค้านำเข้า–ส่งออก (ไทย)',
    rule: 'สินค้าควบคุมบางประเภทต้องมีใบอนุญาตหรือมาตรฐานก่อนนำเข้า–ส่งออก ต้องจำแนกพิกัดศุลกากรให้ถูกต้อง',
    applicableBusinessType: 'ธุรกิจที่ค้าขายข้ามพรมแดน', applicableNationality: 'ทุกสัญชาติ',
    sourceUrl: 'https://www.customs.go.th/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'cn-neglist-2024', country: 'CN', authority: 'NDRC / MOFCOM', topic: 'การเข้าถึงตลาดสำหรับผู้ลงทุนต่างชาติ',
    title: 'รายการข้อจำกัดการลงทุนจากต่างประเทศ ฉบับปี 2024 (Foreign Investment Access Negative List)',
    rule: 'ระบุสาขาที่ห้ามหรือจำกัดเงื่อนไขการลงทุนจากต่างประเทศ (เช่น ข้อกำหนดสัดส่วนหุ้นหรือคุณสมบัติผู้บริหารในบางสาขา) กิจกรรมที่ไม่อยู่ในรายการโดยทั่วไปได้รับการปฏิบัติใกล้เคียงกับนักลงทุนในประเทศ ต้องตรวจฉบับจริงเทียบกับกิจกรรมของธุรกิจ',
    originalTerm: '外商投资准入特别管理措施（负面清单）', applicableBusinessType: 'ตามสาขาใน Negative List', applicableNationality: 'ผู้ลงทุนต่างชาติ',
    sourceUrl: 'https://www.ndrc.gov.cn/', publicationDate: '2024-09 (ตัวอย่าง)', effectiveDate: '2024-11-01 (ตัวอย่าง)', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'cn-fil', country: 'CN', authority: 'กระทรวงพาณิชย์จีน (MOFCOM)', topic: 'กฎหมายการลงทุนจากต่างประเทศ',
    title: 'กฎหมายการลงทุนจากต่างประเทศของจีน และขั้นตอนรายงานข้อมูลการลงทุน',
    rule: 'ผู้ลงทุนต่างชาติที่จัดตั้งกิจการในจีนต้องจดทะเบียนกับหน่วยงานกำกับตลาดและรายงานข้อมูลการลงทุนตามระบบที่กำหนด รวมถึงข้อมูลผู้ควบคุมกิจการที่แท้จริงตามที่กฎหมายเกี่ยวข้องกำหนด',
    originalTerm: '外商投资法 / 外商投资信息报告', applicableBusinessType: 'ทุกประเภท', applicableNationality: 'ผู้ลงทุนต่างชาติ',
    sourceUrl: 'https://www.mofcom.gov.cn/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ตรวจสอบจากแหล่งทางการ', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'cn-labor', country: 'CN', authority: 'กระทรวงทรัพยากรบุคคลและประกันสังคมจีน (MOHRSS)', topic: 'สัญญาจ้างและสวัสดิการแรงงาน',
    title: 'กฎหมายสัญญาแรงงานของจีน (Labor Contract Law) และระบบประกันสังคม',
    rule: 'ต้องทำสัญญาจ้างเป็นลายลักษณ์อักษร มีเนื้อหาขั้นต่ำ เช่น ระยะเวลา ลักษณะงาน สถานที่ทำงาน ค่าตอบแทน และการจ่ายเงินสมทบประกันสังคม รายละเอียดเช่นระยะทดลองงานขึ้นกับระยะเวลาสัญญา (ต้องตรวจสอบฉบับจริง)',
    originalTerm: '劳动合同法 / 社会保险', applicableBusinessType: 'ทุกประเภท', applicableNationality: 'ลูกจ้างทุกสัญชาติ (ตามเงื่อนไข)',
    sourceUrl: 'https://www.mohrss.gov.cn/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ตรวจสอบจากแหล่งทางการ', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'cn-immigration', country: 'CN', authority: 'สำนักงานตรวจคนเข้าเมืองแห่งชาติจีน (NIA)', topic: 'วีซ่าและใบอนุญาตทำงานของคนต่างชาติ',
    title: 'การขออนุญาตทำงานและใบอนุญาตพำนักของชาวต่างชาติในจีน',
    rule: 'ชาวต่างชาติที่จะทำงานในจีนต้องได้รับอนุญาตทำงานและใบอนุญาตพำนักที่สอดคล้องกับงานที่ทำ กระบวนการและเอกสารที่ใช้ต้องตรวจสอบกับหน่วยงานในพื้นที่',
    originalTerm: '外国人工作许可 / 居留许可', applicableBusinessType: 'ทุกประเภท', applicableNationality: 'คนต่างด้าว',
    sourceUrl: 'https://www.nia.gov.cn/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'cn-tax', country: 'CN', authority: 'State Taxation Administration', topic: 'ภาษีของบริษัทและพนักงาน (จีน)',
    title: 'ภาษีเงินได้ภาษีมูลค่าเพิ่ม และภาษีเงินได้บุคคลธรรมดาของชาวต่างชาติในจีน',
    rule: 'นิติบุคคลในจีนมีหน้าที่ยื่นภาษีหลายประเภท ภาษีเงินได้ของพนักงานต่างชาติขึ้นกับจำนวนวันพำนักในจีน (ต้องตรวจสอบกับหน่วยงานภาษีและสนธิสัญญาภาษีซ้อนไทย–จีน)',
    originalTerm: '个人所得税 / 税收居民', applicableBusinessType: 'ทุกประเภท', applicableNationality: 'ทุกสัญชาติ',
    sourceUrl: 'https://www.chinatax.gov.cn/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
  {
    id: 'cn-customs', country: 'CN', authority: 'General Administration of Customs', topic: 'การนำเข้า–ส่งออก (จีน)',
    title: 'พิธีการศุลกากรจีนสำหรับสินค้านำเข้า–ส่งออกและการขึ้นทะเบียนผู้ประกอบการ',
    rule: 'ผู้ประกอบการที่นำเข้า–ส่งออกต้องขึ้นทะเบียนกับศุลกากร และสินค้าบางประเภท (เช่น อาหาร เครื่องสำอาง) ต้องผ่านการขึ้นทะเบียนหรือตรวจสอบเฉพาะ',
    applicableBusinessType: 'ธุรกิจที่ค้าขายข้ามพรมแดน', applicableNationality: 'ทุกสัญชาติ',
    sourceUrl: 'http://english.customs.gov.cn/', publicationDate: 'ไม่ระบุ', effectiveDate: 'ปัจจุบัน', lastVerified: 'ยังไม่ได้ตรวจสอบโดยผู้เชี่ยวชาญ', verificationStatus: 'EXPERT', isSample: S,
  },
]

/** จำลองการเปลี่ยนแปลงเวอร์ชันของกฎระเบียบ: ระเบียนใหม่มาแทนระเบียนเก่า */
export const simulatedReplacement: Regulation = {
  id: 'cn-neglist-next', country: 'CN', authority: 'NDRC / MOFCOM', topic: 'การเข้าถึงตลาดสำหรับผู้ลงทุนต่างชาติ',
  title: 'รายการข้อจำกัดการลงทุนจากต่างประเทศ ฉบับถัดไป (เหตุการณ์สมมติเพื่อสาธิต)',
  rule: 'ระเบียนสมมติที่แสดงว่าระบบสามารถแทนที่เวอร์ชันกฎหมายเก่าด้วยเวอร์ชันใหม่ได้ ไม่ใช่ประกาศจริง',
  originalTerm: '负面清单（模拟版本）', applicableBusinessType: 'ตามสาขาใน Negative List', applicableNationality: 'ผู้ลงทุนต่างชาติ',
  sourceUrl: 'https://www.ndrc.gov.cn/', publicationDate: 'สมมติ', effectiveDate: 'สมมติ', lastVerified: new Date().toISOString().slice(0, 10),
  verificationStatus: 'EXPERT', isSample: true,
}

export const getReg = (id: string) => regulations.find((r) => r.id === id) ?? (id === simulatedReplacement.id ? simulatedReplacement : undefined)
