// Saves today's outside market data into the website itself (src/data/marketSnapshot.json), so the page still shows figures
// where the server function cannot run — the offline kit, a local preview — or when a source is down. Run: npx tsx scripts/market-snapshot.ts
import { writeFileSync } from 'node:fs'
import { readExternal } from '../api/market.js'

const data = await readExternal()
if (!data?.th || !data.countries) { console.error('A source did not answer; the snapshot was not changed.'); process.exit(1) }
writeFileSync(new URL('../src/data/marketSnapshot.json', import.meta.url), JSON.stringify(data, null, 1) + '\n')
console.log(`Saved: Thailand ${data.th.vacancies.now.month}, countries ${Object.keys(data.countries.TH).length + Object.keys(data.countries.CN).length} figures.`)
