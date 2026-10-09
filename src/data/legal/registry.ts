import type { LegalEntry } from './types.js'

/** Registry of legal topics the app knows about. PR-reviewed file: changing it is how an admin adds an official text link.
 *  `textUrl` is deliberately empty everywhere: no deep link to an official text has been verified yet, and an agency
 *  home page is not a legal source. Until a text link exists a record cannot become VERIFIED (see trust.ts). */
const e = (x: LegalEntry): LegalEntry => x
export const registry: LegalEntry[] = [
  e({ id: 'th-fba', country: 'TH', area: 'investment', instrument: 'พระราชบัญญัติการประกอบธุรกิจของคนต่างด้าว พ.ศ. 2542', originalTerm: 'Foreign Business Act (FBA)', agencyUrl: 'https://www.dbd.go.th/', watch: false }),
  e({ id: 'th-dbd-reg', country: 'TH', area: 'investment', agencyUrl: 'https://www.dbd.go.th/', watch: false }),
  e({ id: 'th-boi', country: 'TH', area: 'investment', instrument: 'พระราชบัญญัติส่งเสริมการลงทุน พ.ศ. 2520', originalTerm: 'การส่งเสริมการลงทุน', agencyUrl: 'https://www.boi.go.th/', watch: false }),
  e({ id: 'th-labour', country: 'TH', area: 'employment', instrument: 'พระราชกำหนดการบริหารจัดการการทำงานของคนต่างด้าว พ.ศ. 2560', originalTerm: 'ใบอนุญาตทำงาน', agencyUrl: 'https://www.mol.go.th/', watch: false }),
  e({ id: 'th-tax', country: 'TH', area: 'tax', originalTerm: 'Tax residency', agencyUrl: 'https://www.rd.go.th/', watch: false }),
  e({ id: 'th-customs', country: 'TH', area: 'customs', agencyUrl: 'https://www.customs.go.th/', watch: false }),
  e({ id: 'cn-neglist-2024', country: 'CN', area: 'investment', instrument: '外商投资准入特别管理措施（负面清单）（2024年版）', originalTerm: '外商投资准入特别管理措施（负面清单）', agencyUrl: 'https://www.ndrc.gov.cn/', watch: false }),
  e({ id: 'cn-fil', country: 'CN', area: 'investment', instrument: '中华人民共和国外商投资法', originalTerm: '外商投资法 / 外商投资信息报告', agencyUrl: 'https://www.mofcom.gov.cn/', watch: false }),
  e({ id: 'cn-labor', country: 'CN', area: 'employment', instrument: '中华人民共和国劳动合同法；中华人民共和国社会保险法', originalTerm: '劳动合同法 / 社会保险', agencyUrl: 'https://www.mohrss.gov.cn/', watch: false }),
  e({ id: 'cn-immigration', country: 'CN', area: 'immigration', originalTerm: '外国人工作许可 / 居留许可', agencyUrl: 'https://www.nia.gov.cn/', watch: false }),
  e({ id: 'cn-tax', country: 'CN', area: 'tax', originalTerm: '个人所得税 / 税收居民', agencyUrl: 'https://www.chinatax.gov.cn/', watch: false }),
  e({ id: 'cn-food-safety', country: 'CN', area: 'licensing', instrument: '中华人民共和国食品安全法', originalTerm: '食品经营许可', agencyUrl: 'https://www.samr.gov.cn/', watch: false }),
  e({ id: 'cn-customs', country: 'CN', area: 'customs', agencyUrl: 'http://english.customs.gov.cn/', watch: false }),

  // Coverage gaps for Thai–Chinese employment contracts: instruments known by name only. The app has NO summary of their content.
  // Names only — no paraphrased rules, no articles, no dates — until a reviewer supplies them.
  e({ id: 'th-lpa', country: 'TH', area: 'employment', gap: true, instrument: 'พระราชบัญญัติคุ้มครองแรงงาน พ.ศ. 2541', originalTerm: 'Labour Protection Act', agencyUrl: 'https://www.mol.go.th/', watch: false }),
  e({ id: 'th-ccc-hire', country: 'TH', area: 'employment', gap: true, instrument: 'ประมวลกฎหมายแพ่งและพาณิชย์ ว่าด้วยจ้างแรงงาน', originalTerm: 'Civil and Commercial Code — hire of services', agencyUrl: 'https://www.krisdika.go.th/', watch: false }),
  e({ id: 'th-sso', country: 'TH', area: 'employment', gap: true, instrument: 'พระราชบัญญัติประกันสังคม พ.ศ. 2533', originalTerm: 'Social Security Act', agencyUrl: 'https://www.sso.go.th/', watch: false }),
  e({ id: 'cn-labor-law', country: 'CN', area: 'employment', gap: true, instrument: '中华人民共和国劳动法', originalTerm: 'Labor Law', agencyUrl: 'https://www.mohrss.gov.cn/', watch: false }),
  e({ id: 'cn-lcl-impl', country: 'CN', area: 'employment', gap: true, instrument: '中华人民共和国劳动合同法实施条例', originalTerm: 'Regulations on the Implementation of the Labor Contract Law', agencyUrl: 'https://www.mohrss.gov.cn/', watch: false }),
]
export const getEntry = (id: string) => registry.find((x) => x.id === id)
