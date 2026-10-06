// One anonymous visit per browser per day (owner, Oct 2026): the database adds 1 to today's total. Nothing that identifies
// the visitor is sent — no id, no cookie; the browser only remembers the day it last counted itself.
import { getClient } from './auth'

const KEY = 'cnth-visited'
export function trackVisit(today = new Date()) {
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  try { if (localStorage.getItem(KEY) === day) return; localStorage.setItem(KEY, day) } catch { return } // storage blocked: do not count
  void getClient().then((sb) => sb.rpc('track_visit')).then(() => undefined, () => undefined) // before 0006 the call simply fails
}
