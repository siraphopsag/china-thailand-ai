/** Browser storage of C.A.L.L. (this browser only — nothing is sent anywhere). */
import { MATCH_KEY } from './matchData'

/** Keys left behind by removed prototypes (the business-planning tool and the first job board, removed Oct 2026). */
export const STALE_KEYS = ['cnth-real-v3', 'cnth-demo-v3', 'cnth-mode-v3', 'cnth-prototype-v2', 'cnth-interview-v3', 'call.jobboard.poc.v1'] as const

/** Run once at start-up: forget data of removed prototypes so it does not linger in visitors' browsers. */
export function clearStaleData() {
  try { STALE_KEYS.forEach((k) => localStorage.removeItem(k)) } catch { /* storage blocked: nothing to clear */ }
}

/** "Clear data and start again" (error page): removes the prototype data; keeps language, theme and animation preferences. */
export function clearSavedData() {
  clearStaleData()
  try { localStorage.removeItem(MATCH_KEY); sessionStorage.removeItem('call.admin.poc') } catch { /* storage blocked */ }
}
