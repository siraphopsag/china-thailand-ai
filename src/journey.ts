/** The one journey the product is built around:
 *  tell us about the business → AI understands → AI checks key issues → see what AI found → know what to do next.
 *  Pure (no React) so the rule can be tested. */
export const JOURNEY = [
  { id: 1, route: 'profile' },
  { id: 2, route: 'profile' },
  { id: 3, route: 'analysis' },
  { id: 4, route: 'analysis' },
  { id: 5, route: 'plan' },
] as const

export interface JourneyFacts {
  hasProfile: boolean
  /** ownership facts still unknown (empty = the AI has what it needs to understand the situation) */
  unknownCount: number
  analysisDone: boolean
  actionTotal: number
  actionsDone: number
}

/** Which steps are finished. Steps 3 and 4 finish together: the AI checks, and the findings are then on screen. */
export function journeyDone(f: JourneyFacts): boolean[] {
  const understood = f.hasProfile && f.unknownCount === 0
  return [f.hasProfile, understood, f.hasProfile && f.analysisDone, f.hasProfile && f.analysisDone, f.analysisDone && f.actionTotal > 0 && f.actionsDone >= f.actionTotal]
}

/** Index (0–4) of the step the user is on: the page may say so, otherwise the first unfinished step. */
export function journeyCurrent(done: boolean[], active?: number): number {
  if (active !== undefined && active >= 0 && active < 5) return active
  const i = done.findIndex((d) => !d)
  return i < 0 ? 4 : i
}
