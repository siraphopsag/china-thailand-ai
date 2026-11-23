/**
 * Terms table: Thai/Chinese/English explanation comes from locales (term.N.n / term.N.m); official originals stay untranslated.
 * How to say each original (owner, 24 Nov 2026: "users don't know how to pronounce the Chinese"): `say` is the word alone (what
 * the speaker button reads out), `py` the pinyin with tone marks, `th` an approximate reading in Thai letters; for the Thai term,
 * `roman` is the reading in Latin letters for Chinese and English readers.
 */
export interface Term { n: number; orig: string; lang: 'zh' | 'th'; say: string; py?: string; th?: string; roman?: string }
export const terms: readonly Term[] = [
  { n: 1, orig: '外商投资准入特别管理措施（负面清单） (Negative List)', lang: 'zh', say: '外商投资准入特别管理措施，负面清单',
    py: 'wàishāng tóuzī zhǔnrù tèbié guǎnlǐ cuòshī (fùmiàn qīngdān)', th: 'ไว่ซาง โถวจือ จุ่นรู่ เท่อเปี๋ย ก่วนหลี่ ชั่วซือ (ฟู่เมี่ยน ชิงตาน)' },
  { n: 2, orig: '实际控制人 (Actual controller)', lang: 'zh', say: '实际控制人', py: 'shíjì kòngzhìrén', th: 'สือจี้ ค่งจื้อเหริน' },
  { n: 3, orig: '劳动合同 (Employment (labour) contract)', lang: 'zh', say: '劳动合同', py: 'láodòng hétong', th: 'เหลาต้ง เหอทง' },
  { n: 4, orig: '试用期 (Probation period)', lang: 'zh', say: '试用期', py: 'shìyòngqī', th: 'ซื่อย่งชี' },
  { n: 5, orig: '社会保险 (Social insurance)', lang: 'zh', say: '社会保险', py: 'shèhuì bǎoxiǎn', th: 'เซ่อฮุ่ย เป่าเสี่ยน' },
  { n: 6, orig: '外国人来华工作许可 (Work permit)', lang: 'zh', say: '外国人来华工作许可', py: 'wàiguórén lái Huá gōngzuò xǔkě', th: 'ไว่กั๋วเหริน ไหลหัว กงจั้ว สวี่เข่อ' },
  { n: 7, orig: 'คนต่างด้าว (alien – Foreign Business Act)', lang: 'th', say: 'คนต่างด้าว', roman: 'khon tang dao' },
]
/** Business-situation guidance: sit.S.t title, sit.S.i intro, sit.S.p.K.t/d considerations, sit.S.a suggested approach. */
export const situations = [0, 1, 2, 3]
export const situationPoints = [0, 1, 2, 3]
