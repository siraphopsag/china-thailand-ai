import type { Msg } from './common.js'
/** Goal-based entry, progressive questions (why we ask) and the action plan workspace. */
export const plan = {
  // ---------- landing: value proposition + goals
  'goal.th_cn.t': ['ขยายธุรกิจไทยไปจีน', '将泰国业务拓展至中国', 'Expand a Thai business into China'],
  // ---------- interview: why each question is asked, skipping
  // ---------- action plan
} as const satisfies Record<string, Msg>
