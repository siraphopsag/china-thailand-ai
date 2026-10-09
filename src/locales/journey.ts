import type { Msg } from './common.js'
/** Five primary areas, the five-step journey, and the "found → why → unknown → verify → next" finding structure. */
export const journey = {
  // ---- five primary areas
  // ---- the journey
  // ---- finding structure (same five parts everywhere)
  // ---- business page: what the AI understood / still needs
  // ---- analysis page
  // ---- status wording: verify.* lives in legal.ts (VERIFIED, NO_SOURCE, STALE, CHANGED) and ux.ts (PARTIAL, NEED_INFO, EXPERT)
  'c.sample': ['ข้อมูลเดโม/ตัวอย่าง', '演示/示例数据', 'Demo / sample data'],
  // ---- documents: why a document is needed and what it is tied to
  // ---- home
  // ---- guided demo: one connected story (7 steps)
  // ---- names that follow the five areas
} as const satisfies Record<string, Msg>
