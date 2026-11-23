// The job market from outside the app (advisers' feedback at the pitch, owner 24 Nov 2026: "the market data now comes only from our
// own users, so it is narrow and may lag; add a mode that uses outside data, refreshed about once a week, and follow each source's
// terms of use and PDPA"). Only open, officially licensed statistics are used, and only totals — never anything about a person:
//  · Thailand, per province and per industry, monthly: job vacancies and job seekers registered with the Department of Employment
//    (กรมการจัดหางาน, published on data.go.th under its "Open Data Common" licence and conditions of use; the source is named).
//  · Thailand and China, national, yearly: unemployment, youth unemployment, the labour force and where people work (World Bank
//    World Development Indicators, modelled ILO estimates, CC BY 4.0).
// Job posts of government agencies are not copied: their sites offer no open feed, so the page links to them instead.
// Pure: no React, no storage, no other modules (the server function api/market.ts uses this file too).

export interface SourceRef {
  id: 'doe' | 'wb' | 'thaimengaantam' | 'mohrss' | 'ncss'
  url: string
  licence: string
  licenceUrl?: string
}
/** where the numbers come from, and the licence each is used under (shown on the map and on the open-data page) */
export const SOURCES: Record<'doe' | 'wb', SourceRef> = {
  doe: { id: 'doe', url: 'https://data.go.th/dataset/dataset13_08', licence: 'Open Data Common (data.go.th)', licenceUrl: 'https://data.go.th/uploads/page_images/2021-04-30-061647.317473Conditions-for-Use-of--Open-Government-Data-PortalEN28042021.pdf' },
  wb: { id: 'wb', url: 'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' },
}
/** government job boards: linked, never copied (no open feed; their pages belong to them) */
export const AGENCY_BOARDS: readonly SourceRef[] = [
  { id: 'thaimengaantam', url: 'https://xn--72c5abh2bf8icw0m9d.doe.go.th/', licence: '' },
  { id: 'mohrss', url: 'http://job.mohrss.gov.cn/', licence: '' },
  { id: 'ncss', url: 'https://24365.ncss.cn/', licence: '' },
]
/** the department's datasets on data.go.th (read through its public CKAN API, no key): job vacancies, job seekers */
export const DOE_DATASETS = { vacancies: 'dataset13_08', seekers: 'dataset13_04' } as const
export const DATA_GO_TH = 'https://data.go.th/api/3/action/package_show?id='
export const WB_INDICATORS = {
  unemployment: 'SL.UEM.TOTL.ZS',
  youth: 'SL.UEM.1524.ZS',
  labourForce: 'SL.TLF.TOTL.IN',
  agriculture: 'SL.AGR.EMPL.ZS',
  industry: 'SL.IND.EMPL.ZS',
  services: 'SL.SRV.EMPL.ZS',
} as const
export type WbKey = keyof typeof WB_INDICATORS
/** ISIC sections the department counts vacancies by */
export const ISIC = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'] as const
export type Isic = (typeof ISIC)[number]

/** the department's province abbreviations → ISO 3166-2 (the codes the map uses) */
export const DOE_PROVINCE: Record<string, string> = {
  BKK: 'TH-10', SPK: 'TH-11', NBI: 'TH-12', PTE: 'TH-13', AYA: 'TH-14', ATG: 'TH-15', LRI: 'TH-16', SBR: 'TH-17', CNT: 'TH-18', SRI: 'TH-19',
  CBI: 'TH-20', RYG: 'TH-21', CTI: 'TH-22', TRT: 'TH-23', CCO: 'TH-24', PRI: 'TH-25', NYK: 'TH-26', SKW: 'TH-27',
  NMA: 'TH-30', BRM: 'TH-31', SRN: 'TH-32', SSK: 'TH-33', UBN: 'TH-34', YST: 'TH-35', CPM: 'TH-36', ACR: 'TH-37', BKN: 'TH-38', NBP: 'TH-39',
  KKN: 'TH-40', UDN: 'TH-41', LEI: 'TH-42', NKI: 'TH-43', MKM: 'TH-44', RET: 'TH-45', KSN: 'TH-46', SNK: 'TH-47', NPM: 'TH-48', MDH: 'TH-49',
  CMI: 'TH-50', LPN: 'TH-51', LPG: 'TH-52', UTT: 'TH-53', PRE: 'TH-54', NAN: 'TH-55', PYO: 'TH-56', CRI: 'TH-57', MSN: 'TH-58',
  NSN: 'TH-60', UTI: 'TH-61', KPT: 'TH-62', TAK: 'TH-63', STI: 'TH-64', PLK: 'TH-65', PCK: 'TH-66', PNB: 'TH-67',
  RBR: 'TH-70', KRI: 'TH-71', SPB: 'TH-72', NPT: 'TH-73', SKN: 'TH-74', SKM: 'TH-75', PBI: 'TH-76', PKN: 'TH-77',
  NRT: 'TH-80', KBI: 'TH-81', PNA: 'TH-82', PKT: 'TH-83', SNI: 'TH-84', RNG: 'TH-85', CPN: 'TH-86',
  SKA: 'TH-90', STN: 'TH-91', TRG: 'TH-92', PLG: 'TH-93', PTN: 'TH-94', YLA: 'TH-95', NWT: 'TH-96',
}

export interface MonthCounts { month: string; total: number; byProvince: Record<string, number> }
export interface External {
  /** when the sources were last read (ISO) */
  checkedAt: string
  /** Thailand by province: the latest month with figures, and the month before */
  th: null | {
    vacancies: { now: MonthCounts; before: MonthCounts | null }
    seekers: { now: MonthCounts; before: MonthCounts | null }
    /** vacancies per industry in the latest month, largest first */
    industries: { month: string; rows: Array<{ section: Isic; n: number }> }
  }
  /** national figures per country: the latest year with a value */
  countries: null | Record<'TH' | 'CN', Partial<Record<WbKey, { year: string; value: number }>>>
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
/** one CSV line, with quoted fields ("1,234") */
export function csvLine(line: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === ',' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}
/** " 41,215 " → 41215; "-" or empty → 0 */
export const num = (s: string | undefined) => { const v = Number((s ?? '').replace(/[\s,"]/g, '')); return Number.isFinite(v) && v > 0 ? Math.round(v) : 0 }
const rowsOf = (csv: string) => csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim()).map(csvLine)
const monthOf = (y: string, m: string) => { const i = MONTHS.indexOf(m.trim().slice(0, 3).toLowerCase()); return /^\d{4}$/.test(y.trim()) && i >= 0 ? `${y.trim()}-${String(i + 1).padStart(2, '0')}` : null }

/** the department's "per province" file: a header row (Year, Month, Total, regions…, BKK, SPK, …) then one row per month; months
 * not yet published are all zeros. Returns the latest month with figures and the one before. */
export function parseDoeProvinces(csv: string): { now: MonthCounts; before: MonthCounts | null } | null {
  const rows = rowsOf(csv)
  const h = rows.findIndex((r) => r[0]?.trim().toLowerCase() === 'year')
  if (h < 0) return null
  const head = rows[h].map((x) => x.trim().toUpperCase())
  const cols = head.map((x, i) => [DOE_PROVINCE[x], i] as const).filter(([iso]) => !!iso)
  if (cols.length < 70) return null
  const months: MonthCounts[] = []
  for (const r of rows.slice(h + 1)) {
    const month = monthOf(r[0] ?? '', r[1] ?? ''); if (!month) continue
    const byProvince: Record<string, number> = {}; let total = 0
    for (const [iso, i] of cols) { const n = num(r[i]); if (n) { byProvince[iso] = n; total += n } }
    if (total > 0) months.push({ month, total, byProvince })
  }
  months.sort((a, b) => a.month.localeCompare(b.month))
  const now = months[months.length - 1]
  return now ? { now, before: months[months.length - 2] ?? null } : null
}
/** the department's "per industry" file: Year, Month, Total, A … U */
export function parseDoeIndustries(csv: string): { month: string; rows: Array<{ section: Isic; n: number }> } | null {
  const rows = rowsOf(csv)
  const h = rows.findIndex((r) => r[0]?.trim().toLowerCase() === 'year')
  if (h < 0) return null
  const head = rows[h].map((x) => x.trim().toUpperCase())
  let best: { month: string; rows: Array<{ section: Isic; n: number }> } | null = null
  for (const r of rows.slice(h + 1)) {
    const month = monthOf(r[0] ?? '', r[1] ?? ''); if (!month) continue
    const xs = ISIC.map((s) => ({ section: s, n: num(r[head.indexOf(s)]) })).filter((x) => x.n > 0)
    if (xs.length && (!best || month > best.month)) best = { month, rows: xs.sort((a, b) => b.n - a.n) }
  }
  return best
}
/** the newest CSV file of a CKAN dataset whose name contains `want` (the department adds a new file every month) */
export function newestCsv(pkg: unknown, want: string): string | null {
  const res = (pkg as { result?: { resources?: Array<{ name?: string; url?: string; format?: string; created?: string; last_modified?: string }> } })?.result?.resources ?? []
  const xs = res.filter((r) => typeof r.url === 'string' && /^https:\/\//.test(r.url) && (r.format ?? '').toUpperCase() === 'CSV' && (r.name ?? '').includes(want))
  xs.sort((a, b) => (b.last_modified ?? b.created ?? '').localeCompare(a.last_modified ?? a.created ?? ''))
  return xs[0]?.url ?? null
}
/** a World Bank API answer ([meta, rows]) → per country, the latest year with a value */
export function parseWorldBank(json: unknown): Partial<Record<'TH' | 'CN', { year: string; value: number }>> {
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? (json[1] as Array<{ countryiso3code?: string; date?: string; value?: unknown }>) : []
  const out: Partial<Record<'TH' | 'CN', { year: string; value: number }>> = {}
  for (const r of rows) {
    const c = r.countryiso3code === 'THA' ? 'TH' : r.countryiso3code === 'CHN' ? 'CN' : null
    if (!c || typeof r.value !== 'number' || !/^\d{4}$/.test(r.date ?? '')) continue
    if (!out[c] || r.date! > out[c]!.year) out[c] = { year: r.date!, value: r.value }
  }
  return out
}

const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
const cleanCounts = (v: unknown): MonthCounts | null => {
  const r = v as MonthCounts | null
  if (!r || !isMonth(r.month) || typeof r.byProvince !== 'object' || !r.byProvince) return null
  const byProvince: Record<string, number> = {}
  for (const [k, n] of Object.entries(r.byProvince)) if (/^TH-\d{2}$/.test(k) && Number.isFinite(n) && (n as number) >= 0) byProvince[k] = Math.round(n as number)
  return { month: r.month, total: Object.values(byProvince).reduce((a, b) => a + b, 0), byProvince }
}
/** keeps only well-formed numbers (the answer comes over the network) */
export function cleanExternal(v: unknown): External | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Partial<External>
  if (typeof r.checkedAt !== 'string' || Number.isNaN(Date.parse(r.checkedAt))) return null
  let th: External['th'] = null
  const t = r.th
  if (t && typeof t === 'object') {
    const vn = cleanCounts(t.vacancies?.now), sn = cleanCounts(t.seekers?.now)
    const rows = Array.isArray(t.industries?.rows) ? t.industries.rows.filter((x) => ISIC.includes(x?.section) && Number.isFinite(x?.n) && x.n > 0).map((x) => ({ section: x.section, n: Math.round(x.n) })) : []
    if (vn && sn) th = { vacancies: { now: vn, before: cleanCounts(t.vacancies?.before) }, seekers: { now: sn, before: cleanCounts(t.seekers?.before) },
      industries: { month: isMonth(t.industries?.month) ? t.industries.month : vn.month, rows: rows.sort((a, b) => b.n - a.n) } }
  }
  let countries: External['countries'] = null
  if (r.countries && typeof r.countries === 'object') {
    const one = (c: unknown) => {
      const o: Partial<Record<WbKey, { year: string; value: number }>> = {}
      for (const k of Object.keys(WB_INDICATORS) as WbKey[]) { const x = (c as Record<string, { year?: unknown; value?: unknown }> | undefined)?.[k]; if (x && typeof x.year === 'string' && /^\d{4}$/.test(x.year) && typeof x.value === 'number' && Number.isFinite(x.value)) o[k] = { year: x.year, value: x.value } }
      return o
    }
    countries = { TH: one(r.countries.TH), CN: one(r.countries.CN) }
  }
  return th || countries ? { checkedAt: r.checkedAt, th, countries } : null
}
/** how much a number moved since the month before, in per cent (null when there is nothing to compare) */
export const change = (now: number, before: number | undefined | null) => (before ? Math.round(((now - before) / before) * 100) : null)
