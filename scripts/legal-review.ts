/**
 * Record a human expert's sign-off on one legal record.
 *
 *   npm run legal:review -- --id cn-labor --by "Name Surname, China labour lawyer" [--effective YYYY-MM-DD] [--provisions "第X条,第Y条"] [--note "..."] --yes
 *
 * Without --yes it only prints what would be signed (the official link, the summary text in all three languages, the
 * source hash). The sign-off is bound to exactly this summary text and this version of the official text: if either
 * changes later, the record automatically stops being "verified".
 * Run it under the reviewer's own name, then open a Pull Request for a second legal reviewer to approve.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getEntry } from '../src/data/legal/registry.js'
import { reviews } from '../src/data/legal/reviews.js'
import { observed } from '../src/data/legal/observed.js'
import { contentFingerprint, summaryText } from '../src/data/legal/trust.js'
import { buildReview, renderReviews, reviewProblems } from '../src/data/legal/review.js'

function main(): number {
  const args = process.argv.slice(2)
  const arg = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined }
  const id = arg('id') ?? ''
  const entry = getEntry(id)
  const input = { reviewer: arg('by') ?? '', effectiveDate: arg('effective'), provisions: arg('provisions')?.split(',').map((s) => s.trim()).filter(Boolean), note: arg('note') }
  const problems = reviewProblems(entry, input, observed[id])
  if (problems.length || !entry) { console.error('Cannot record a review:\n' + problems.map((p) => ' - ' + p).join('\n')); return 1 }
  console.log(`Record:        ${id}\nOfficial text: ${entry.textUrl}\nSource hash:   ${observed[id]?.hash}\n\n--- summary text that will be signed off (TH / ZH / EN) ---\n${summaryText(id)}\n`)
  if (!args.includes('--yes')) { console.log('Dry run. Read the official text against the summary, then re-run with --yes under your own name.'); return 0 }
  const today = new Date().toISOString().slice(0, 10)
  const next = [...reviews.filter((r) => r.id !== id), buildReview(entry, input, observed[id], contentFingerprint(id), today)]
  writeFileSync(fileURLToPath(new URL('../src/data/legal/reviews.ts', import.meta.url)), renderReviews(next))
  console.log(`Recorded review of ${id} by ${input.reviewer} on ${today}. Commit it in a Pull Request for a second reviewer to approve.`)
  return 0
}
process.exitCode = main()
