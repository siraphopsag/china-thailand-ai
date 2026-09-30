/** Browser storage keys. Real data and demo data live in separate slots so the demo can never overwrite real work. */
export const KEYS = { real: 'cnth-real-v3', demo: 'cnth-demo-v3', mode: 'cnth-mode-v3', legacy: 'cnth-prototype-v2', interview: 'cnth-interview-v3' } as const
export const STATE_VERSION = 3

export const safeGet = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
export const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* storage unavailable */ } }
/** Removes saved business data (not the language/theme preferences). */
export function clearSavedData() {
  try { Object.values(KEYS).forEach((k) => localStorage.removeItem(k)) } catch { /* ignore */ }
}
