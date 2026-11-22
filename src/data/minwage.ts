// Legal minimum wages by province (v2 model, Nov 2026). Keys are the app's ISO 3166-2 province codes (src/locales/provinces.ts).
// Each value is the LOWEST rate that applies anywhere in the province, so the rule never flags a lawful post.
// Sources, dates and open items: docs/legal-data.md. Checked 22 Nov 2026.

/** Thailand: daily minimum wage in baht — Wage Committee Notification No. 14, Royal Gazette Vol. 142 Special Part 236 Ngor
 *  pp. 29–31, in force 1 July 2025 (no newer notification found). Higher rates in Mueang Chiang Mai (380), Hat Yai (380), Ko Samui
 *  (400) and for hotels of types 2–4 and entertainment venues (400 everywhere) are not used: the province's lowest rate is. */
export const TH_MIN_DAILY: Record<string, number> = {
  'TH-10': 400,
  'TH-11': 372,
  'TH-12': 372,
  'TH-13': 372,
  'TH-14': 357,
  'TH-15': 348,
  'TH-16': 356,
  'TH-17': 348,
  'TH-18': 348,
  'TH-19': 357,
  'TH-20': 400,
  'TH-21': 400,
  'TH-22': 352,
  'TH-23': 354,
  'TH-24': 400,
  'TH-25': 357,
  'TH-26': 355,
  'TH-27': 352,
  'TH-30': 359,
  'TH-31': 352,
  'TH-32': 351,
  'TH-33': 347,
  'TH-34': 352,
  'TH-35': 350,
  'TH-36': 348,
  'TH-37': 347,
  'TH-38': 349,
  'TH-39': 347,
  'TH-40': 357,
  'TH-41': 347,
  'TH-42': 347,
  'TH-43': 355,
  'TH-44': 347,
  'TH-45': 349,
  'TH-46': 349,
  'TH-47': 352,
  'TH-48': 352,
  'TH-49': 352,
  'TH-50': 357,
  'TH-51': 350,
  'TH-52': 347,
  'TH-53': 347,
  'TH-54': 345,
  'TH-55': 345,
  'TH-56': 345,
  'TH-57': 352,
  'TH-58': 347,
  'TH-60': 350,
  'TH-61': 347,
  'TH-62': 347,
  'TH-63': 352,
  'TH-64': 347,
  'TH-65': 352,
  'TH-66': 347,
  'TH-67': 349,
  'TH-70': 347,
  'TH-71': 352,
  'TH-72': 355,
  'TH-73': 372,
  'TH-74': 372,
  'TH-75': 358,
  'TH-76': 351,
  'TH-77': 352,
  'TH-80': 349,
  'TH-81': 354,
  'TH-82': 352,
  'TH-83': 400,
  'TH-84': 352,
  'TH-85': 347,
  'TH-86': 351,
  'TH-90': 352,
  'TH-91': 347,
  'TH-92': 345,
  'TH-93': 348,
  'TH-94': 337,
  'TH-95': 337,
  'TH-96': 337,
}
/** China: lowest monthly minimum wage tier in yuan — MOHRSS national table as of 1 Oct 2026, with Ningxia's change of 1 Nov 2026 */
export const CN_MIN_MONTHLY: Record<string, number> = {
  'CN-AH': 2000, // Anhui, from 2025-09-01
  'CN-BJ': 2540, // Beijing, from 2025-09-01
  'CN-CQ': 2200, // Chongqing, from 2025-01-01
  'CN-FJ': 1895, // Fujian, from 2025-04-01
  'CN-GD': 2040, // Guangdong, from 2026-09-01
  'CN-GS': 2080, // Gansu, from 2025-12-01
  'CN-GX': 1870, // Guangxi, from 2025-07-01
  'CN-GZ': 1890, // Guizhou, from 2025-02-01
  'CN-HA': 2000, // Henan, from 2025-12-01
  'CN-HB': 1970, // Hubei, from 2025-12-01
  'CN-HE': 2080, // Hebei, from 2025-12-01
  'CN-HI': 2070, // Hainan, from 2025-12-01
  'CN-HL': 1910, // Heilongjiang, from 2025-12-01
  'CN-HN': 1800, // Hunan, from 2025-09-01
  'CN-JL': 1870, // Jilin, from 2025-12-01
  'CN-JS': 2180, // Jiangsu, from 2026-01-01
  'CN-JX': 1950, // Jiangxi, from 2025-12-01
  'CN-LN': 1930, // Liaoning, from 2025-12-01
  'CN-NM': 2250, // Inner Mongol, from 2025-12-01
  'CN-NX': 2190, // Ningxia, from 2026-11-01
  'CN-QH': 2080, // Qinghai, from 2025-05-01
  'CN-SC': 2200, // Sichuan, from 2025-01-01
  'CN-SD': 2020, // Shandong, from 2025-10-01
  'CN-SH': 2740, // Shanghai, from 2025-07-01
  'CN-SN': 2140, // Shaanxi, from 2026-01-01
  'CN-SX': 2150, // Shanxi, from 2026-10-01
  'CN-TJ': 2510, // Tianjin, from 2025-09-01
  'CN-XJ': 1930, // Xinjiang, from 2026-10-01
  'CN-XZ': 2360, // Xizang, from 2025-11-01
  'CN-YN': 1970, // Yunnan, from 2026-09-01
  'CN-ZJ': 2180, // Zhejiang, from 2026-01-01
}
/** published changes that start later: from that day the new lowest tier applies */
export const CN_MIN_MONTHLY_NEXT: Record<string, { from: string; lowest: number }> = {
  'CN-HL': { from: '2026-12-01', lowest: 2050 }, // Heilongjiang notice of 18 Nov 2026 (2350/2150/2050)
}
export const MINWAGE_SOURCES = {
  TH: 'ประกาศคณะกรรมการค่าจ้าง เรื่อง อัตราค่าจ้างขั้นต่ำ (ฉบับที่ 14) มีผล 1 ก.ค. 2568',
  CN: '全国各地区月最低工资标准（人力资源和社会保障部，截至2026年10月1日）',
} as const
