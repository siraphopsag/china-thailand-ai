import type { LegalEntry, LegalReview, Observation } from './types.js'

/** Node-only helpers for scripts/legal-review.ts. */

export interface ReviewInput { reviewer: string; effectiveDate?: string; provisions?: string[]; note?: string }

/** Everything that must be true before a human sign-off may be recorded. Returns the problems (empty = OK). */
export function reviewProblems(entry: LegalEntry | undefined, input: ReviewInput, obs: Observation | undefined): string[] {
  const p: string[] = []
  if (!entry) return ['unknown record id']
  if (entry.gap) p.push('this record has no summary in the app (coverage gap): write and add the summary text first')
  if (!entry.textUrl || !/^https:\/\//.test(entry.textUrl)) p.push('the registry has no https textUrl for this record: add the official text link first')
  if (!entry.watch) p.push('set watch: true in the registry so the reviewed version of the text can be tracked')
  if (entry.watch && !obs?.hash) p.push('no observed hash yet: run npm run legal:watch first so the review is tied to a version of the official text')
  if (!input.reviewer || input.reviewer.trim().length < 5 || !/\s/.test(input.reviewer.trim())) p.push('--by must be the reviewer\'s real name and role, e.g. "Name Surname, Thai labour lawyer"')
  if (input.effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) p.push('--effective must be YYYY-MM-DD')
  return p
}

export function buildReview(entry: LegalEntry, input: ReviewInput, obs: Observation | undefined, contentHash: string, today: string): LegalReview {
  return {
    id: entry.id, reviewer: input.reviewer.trim(), reviewedAt: today, contentHash,
    ...(obs?.hash ? { sourceHash: obs.hash } : {}),
    ...(input.effectiveDate ? { effectiveDate: input.effectiveDate } : {}),
    ...(input.provisions?.length ? { provisions: input.provisions } : {}),
    ...(input.note ? { note: input.note } : {}),
  }
}

export function renderReviews(rs: LegalReview[]): string {
  const body = [...rs].sort((a, b) => a.id.localeCompare(b.id)).map((r) => `  ${JSON.stringify(r)},`).join('\n')
  return `import type { LegalReview } from './types.js'\n\n/** Human sign-offs. Entries are added only with \`npm run legal:review\` (see README) and merged through a Pull Request that a legal\n *  reviewer approves. Never add an entry by hand, and never on behalf of someone else. */\nexport const reviews: LegalReview[] = [${rs.length ? '\n' + body + '\n' : ''}]\n`
}
