// Vercel serverless function (Node runtime): the job market from outside the app (advisers' feedback, owner 24 Nov 2026). Reads
// open statistics — the Department of Employment's monthly files on data.go.th and the World Bank's indicators — and answers with
// totals only. No key, nothing paid, nothing about the visitor is sent anywhere (the function asks the sources itself; the browser
// only asks this function). Vercel's cache keeps one answer for a week, so each source is read about once a week, not per visit.
// What is read and how it is cleaned: src/domain/openData.ts (tested).
import { DATA_GO_TH, DOE_DATASETS, WB_INDICATORS, cleanExternal, newestCsv, parseDoeIndustries, parseDoeProvinces, parseWorldBank, type External, type WbKey } from '../src/domain/openData.js'

const WEEK = 7 * 24 * 3600
const UA = 'CALL-prototype open-data reader (weekly)'

async function get(url: string, as: 'json' | 'text', ms = 40000): Promise<unknown> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : 'text/csv,*/*' }, signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return as === 'json' ? r.json() : r.text()
}

/** reads every source; a source that fails is left out (null) instead of failing the whole answer */
export async function readExternal(now = new Date(), problems: string[] = []): Promise<External | null> {
  const note = (where: string) => (e: unknown) => { problems.push(`${where}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`.slice(0, 200)); return null }
  const th = (async () => {
    const [vp, sp] = await Promise.all([get(DATA_GO_TH + DOE_DATASETS.vacancies, 'json'), get(DATA_GO_TH + DOE_DATASETS.seekers, 'json')])
    const vu = newestCsv(vp, 'รายจังหวัด'), su = newestCsv(sp, 'รายจังหวัด'), iu = newestCsv(vp, 'อุตสาหกรรม')
    if (!vu || !su || !iu) throw new Error('no csv')
    const [vc, sc, ic] = await Promise.all([get(vu, 'text'), get(su, 'text'), get(iu, 'text')]) as string[]
    const vacancies = parseDoeProvinces(vc), seekers = parseDoeProvinces(sc), industries = parseDoeIndustries(ic)
    if (!vacancies || !seekers) throw new Error('bad csv')
    return { vacancies, seekers, industries: industries ?? { month: vacancies.now.month, rows: [] } }
  })().catch(note('doe'))
  const countries = (async () => {
    const keys = Object.keys(WB_INDICATORS) as WbKey[]
    const answers = await Promise.all(keys.map((k) => get(`https://api.worldbank.org/v2/country/THA;CHN/indicator/${WB_INDICATORS[k]}?format=json&mrnev=1&per_page=10`, 'json').catch(() => null)))
    const out: NonNullable<External['countries']> = { TH: {}, CN: {} }
    keys.forEach((k, i) => { const p = parseWorldBank(answers[i]); if (p.TH) out.TH[k] = p.TH; if (p.CN) out.CN[k] = p.CN })
    return Object.keys(out.TH).length || Object.keys(out.CN).length ? out : null
  })().catch(note('worldbank'))
  return cleanExternal({ checkedAt: now.toISOString(), th: await th, countries: await countries })
}

export async function GET() {
  const problems: string[] = []
  const data = await readExternal(new Date(), problems)
  const ok = !!data?.th && !!data?.countries
  // which source did not answer (no personal data): shown only so the owner can see why a part fell back to the saved copy
  return new Response(JSON.stringify(data && problems.length ? { ...data, problems } : data), {
    status: data ? 200 : 502,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // a full answer is kept for a week (then refreshed in the background); a partial one is tried again within the hour
      'cache-control': ok ? `public, max-age=3600, s-maxage=${WEEK}, stale-while-revalidate=${WEEK}` : 'public, max-age=300, s-maxage=3600',
    },
  })
}
