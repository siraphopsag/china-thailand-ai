// The calendar (owner, Oct 2026): appointment days from the cases (courses, tests, documents, departure, first working day)
// and, for employers, the days their posts end. Each side sees only its own; an administrator (the agency) sees every case.
// From 13 Oct 2026 also the days people plan around: when the weekly allowance comes back (posts or pins), a warning a week
// before a post ends, when each pin ends, and when a membership ends.
// Days are YYYY-MM-DD in local time. Also builds an .ics file for phone calendars. Pure: no React, no storage.
import { APPOINTMENTS, type Case } from './cases'
import { DAY_MS } from './release'
import { activePins, memberActive, pinQuota, postQuota } from './logic'
import { EXPIRY_WARN_DAYS, ME, MY_EMPLOYER, PIN_LIFE_DAYS, POST_LIFE_DAYS, type Industry, type MatchState } from './types'

export const EVENT_KINDS = ['training', 'test', 'documents', 'departure', 'start', 'expiry', 'expiring', 'postQuota', 'pinEnd', 'pinQuota', 'memberEnd'] as const
/** the kinds each side can have (the legend lists only these) */
export const KINDS_FOR = {
  seeker: ['training', 'test', 'documents', 'departure', 'start', 'pinEnd', 'pinQuota', 'memberEnd'],
  employer: ['training', 'test', 'documents', 'departure', 'start', 'expiring', 'expiry', 'postQuota', 'memberEnd'],
} as const satisfies Record<'seeker' | 'employer', readonly (typeof EVENT_KINDS)[number][]>
export type EventKind = (typeof EVENT_KINDS)[number]
export interface CalEvent {
  id: string; day: string; kind: EventKind
  /** what it is: a built-in key ("@orient", "language", …) or the agency's own course name */
  what: string
  /** the post it belongs to (title shown with the event); '' for events of the person (allowances, pins, membership) */
  postId: string
  caseId?: string
  /** a pin that ends: where and which field */
  pin?: { country: string; province: string; industry: Industry }
  /** where the event opens when it is not a case or a post */
  to?: string
}
const KIND: Record<(typeof APPOINTMENTS)[number], EventKind> = { documents: 'documents', language: 'test', skill: 'test', start: 'start' }
const localDay = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** the cases this person follows: their own as a job seeker, their posts' as an employer, all of them as the agency */
export function casesFor(st: MatchState, agency: boolean): Case[] {
  const mine = new Set(st.posts.filter((p) => p.employerId === MY_EMPLOYER).map((p) => p.id))
  return st.cases.filter((c) => agency || (st.role === 'seeker' && c.seekerId === ME) || (st.role === 'employer' && mine.has(c.postId)))
}
/** `now`: the time allowances follow (the demo clock in the local demo, real time when signed in) */
export function calendarEvents(st: MatchState, agency: boolean, now = Date.now()): CalEvent[] {
  const out: CalEvent[] = []
  for (const c of casesFor(st, agency)) {
    if (c.steps.arrived) continue // finished
    for (const x of c.trainings) if (x.date && !x.done) out.push({ id: `${c.id}:t:${x.id}`, day: x.date, kind: 'training', what: x.name, postId: c.postId, caseId: c.id })
    for (const k of APPOINTMENTS) { const d = c.dates[k]; if (d) out.push({ id: `${c.id}:${k}`, day: d, kind: KIND[k], what: k, postId: c.postId, caseId: c.id }) }
    if (c.departureDate && !c.steps.departure) out.push({ id: `${c.id}:dep`, day: c.departureDate, kind: 'departure', what: 'departure', postId: c.postId, caseId: c.id })
  }
  if (st.role === 'employer') {
    for (const p of st.posts.filter((x) => x.employerId === MY_EMPLOYER)) {
      const ends = Date.parse(p.releasedAt) + POST_LIFE_DAYS * DAY_MS
      out.push({ id: `${p.id}:warn`, day: localDay(ends - EXPIRY_WARN_DAYS * DAY_MS), kind: 'expiring', what: 'expiring', postId: p.id })
      out.push({ id: `${p.id}:end`, day: localDay(ends), kind: 'expiry', what: 'expiry', postId: p.id })
    }
    const q = postQuota(st, now)
    if (q.resetAt && Number.isFinite(q.limit)) out.push({ id: 'quota:post', day: localDay(q.resetAt), kind: 'postQuota', what: String(q.limit), postId: '', to: 'hire' })
  }
  if (st.role === 'seeker') {
    for (const p of activePins(st.me, now)) out.push({ id: `${p.id}:end`, day: localDay(Date.parse(p.at) + PIN_LIFE_DAYS * DAY_MS), kind: 'pinEnd', what: 'pinEnd', postId: '', to: 'seek?tab=mine', pin: { country: p.country, province: p.province, industry: p.industry } })
    const q = pinQuota(st, now)
    if (q.resetAt && Number.isFinite(q.limit)) out.push({ id: 'quota:pin', day: localDay(q.resetAt), kind: 'pinQuota', what: String(q.limit), postId: '', to: 'seek' })
  }
  if (st.role && memberActive(st, now) && st.memberUntil) out.push({ id: 'member:end', day: localDay(Date.parse(st.memberUntil)), kind: 'memberEnd', what: 'memberEnd', postId: '', to: 'member' })
  return out.sort((a, b) => a.day.localeCompare(b.day) || EVENT_KINDS.indexOf(a.kind) - EVENT_KINDS.indexOf(b.kind))
}

/** the weeks shown for a month (each week 7 days, starting on Sunday or Monday), as YYYY-MM-DD */
export function monthGrid(year: number, month: number, weekStart: 0 | 1): string[][] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() - weekStart + 7) % 7
  const start = new Date(year, month, 1 - lead)
  const days = new Date(year, month + 1, 0).getDate()
  const weeks = Math.ceil((lead + days) / 7)
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const x = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
    return localDay(x.getTime())
  }))
}

/** an .ics file (all-day events) for phone calendars — titles only, no personal data */
export function toIcs(events: { id: string; day: string; title: string }[], stamp: Date): string {
  const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
  const ymd = (d: string) => d.replace(/-/g, '')
  const next = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return localDay(new Date(y, m - 1, dd + 1).getTime()) }
  const ts = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//C.A.L.L.//Calendar//EN', 'CALSCALE:GREGORIAN']
  for (const e of events) lines.push('BEGIN:VEVENT', `UID:${esc(e.id)}@call`, `DTSTAMP:${ts}`, `DTSTART;VALUE=DATE:${ymd(e.day)}`, `DTEND;VALUE=DATE:${ymd(next(e.day))}`, `SUMMARY:${esc(e.title)}`, 'END:VEVENT')
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
