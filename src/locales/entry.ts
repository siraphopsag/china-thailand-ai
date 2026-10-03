import type { Msg } from './common.js'
/** First step after "Start using C.A.L.L." (/choose-role): find work, hire (both simulated), or plan a business (the existing tool). */
export const entry = {
  'choose.business.t': ['ฉันต้องการวางแผนหรือขยายธุรกิจไทย–จีน', '我想规划或拓展泰中业务', 'I want to plan or expand a Thailand–China business'],
} as const satisfies Record<string, Msg>
