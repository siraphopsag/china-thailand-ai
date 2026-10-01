import type { LegalReview } from './types.js'

/** Human sign-offs. EMPTY on purpose: no legal record has been reviewed by a qualified person yet.
 *  Entries are added only with `npm run legal:review` (see README) and merged through a Pull Request that a legal
 *  reviewer approves. Never add an entry by hand, and never on behalf of someone else. */
export const reviews: LegalReview[] = []
