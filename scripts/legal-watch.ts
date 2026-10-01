/**
 * Legal change monitor. For every registry entry with `watch: true` and a `textUrl`, fetch the official text, hash its
 * readable words and compare with the last observation. Writes src/data/legal/observed.ts.
 *
 *   npm run legal:watch
 *
 * Exit codes: 0 = nothing changed · 2 = an official text CHANGED (records fall to "source changed" once this is committed)
 *             3 = some fetches failed (no data lost; the previous hash is kept)
 * It can only ever LOWER trust. Raising trust needs a human: npm run legal:review.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { registry } from '../src/data/legal/registry.js'
import { observed as previous } from '../src/data/legal/observed.js'
import { classify, observe, renderObserved, type Change } from '../src/data/legal/watch.js'
import type { Observation } from '../src/data/legal/types.js'

const OUT = fileURLToPath(new URL('../src/data/legal/observed.ts', import.meta.url))
const next: Record<string, Observation> = { ...previous }
const rows: [string, Change, string][] = []
for (const e of registry) {
  if (e.gap || !e.watch || !e.textUrl) { rows.push([e.id, 'not-monitored', e.textUrl ? 'watch=false' : 'no textUrl yet']); continue }
  const o = await observe(e, previous[e.id], (url, init) => fetch(url, init))
  next[e.id] = o
  rows.push([e.id, classify(e, previous[e.id], o), o.ok ? `${o.bytes} chars, sha256 ${o.hash?.slice(0, 12)}…` : (o.error ?? '')])
}
writeFileSync(OUT, renderObserved(next))
for (const [id, c, note] of rows) console.log(`${c.toUpperCase().padEnd(14)} ${id.padEnd(18)} ${note}`)
const monitored = rows.filter((r) => r[1] !== 'not-monitored').length
console.log(`\n${monitored} monitored, ${rows.length - monitored} not monitored (no official text link / watch off).`)
// exitCode (not process.exit) lets open fetch sockets close cleanly; calling exit() can crash Node on Windows
process.exitCode = rows.some((r) => r[1] === 'changed') ? 2 : rows.some((r) => r[1] === 'failed') ? 3 : 0
