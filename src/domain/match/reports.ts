// Reporting a suspicious post (owner, Oct 2026): once per post, never one's own, 10 a day. Three different people hide the post
// from everyone but its employer, administrators and people in its case until an administrator decides (0005_reports.sql). The
// reporter no longer sees the post on the board. Reporters stay anonymous to employers. Pure: no React, no storage.
import { DAY_MS } from './release'
import { MY_EMPLOYER, type MatchState } from './types'

export const REPORT_REASONS = ['fee', 'false', 'illegal', 'contact', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]
export interface Report { id: string; postId: string; reason: ReportReason; note: string; at: string }
export const REPORTS_PER_DAY = 10
/** different people reporting the same post before it is hidden */
export const HIDE_AFTER = 3
export const REPORT_NOTE_MAX = 200
export type ReportProblem = 'unknown' | 'state' | 'reported' | 'reportLimit' | 'reportNote'

export const reportedIds = (st: Pick<MatchState, 'reports'>) => new Set(st.reports.map((r) => r.postId))
export function reportPost(st: MatchState, postId: string, reason: ReportReason, note: string, id: string, at: string): { ok: true; value: Report } | { ok: false; problem: ReportProblem } {
  const p = st.posts.find((x) => x.id === postId)
  if (!p) return { ok: false, problem: 'unknown' }
  if (p.employerId === MY_EMPLOYER || !(REPORT_REASONS as readonly string[]).includes(reason)) return { ok: false, problem: 'state' }
  if (st.reports.some((r) => r.postId === postId)) return { ok: false, problem: 'reported' }
  const text = note.trim()
  if (text.length > REPORT_NOTE_MAX) return { ok: false, problem: 'reportNote' }
  const now = Date.parse(at)
  if (st.reports.filter((r) => now - Date.parse(r.at) < DAY_MS).length >= REPORTS_PER_DAY) return { ok: false, problem: 'reportLimit' }
  return { ok: true, value: { id, postId, reason, note: text, at } }
}
/** stored reports (local demo): bad ones and those of posts that are gone are dropped */
export function parseReports(raw: unknown, postIds: Set<string>): Report[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  return raw.filter((r): r is Report => typeof r === 'object' && r !== null && typeof r.id === 'string' && typeof r.postId === 'string' && postIds.has(r.postId)
    && (REPORT_REASONS as readonly string[]).includes(r.reason) && typeof r.note === 'string' && r.note.length <= REPORT_NOTE_MAX
    && typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)))
    .filter((r) => (seen.has(r.postId) ? false : (seen.add(r.postId), true)))
    .slice(-200)
}

/** the administrator's queue: open reports grouped by post, most reported first */
export interface ReportGroup { postId: string; count: number; reasons: Partial<Record<ReportReason, number>>; notes: string[]; first: string }
export function groupReports(rows: { postId: string; reason: ReportReason; note: string; at: string }[]): ReportGroup[] {
  const by = new Map<string, ReportGroup>()
  for (const r of rows) {
    const g = by.get(r.postId) ?? { postId: r.postId, count: 0, reasons: {}, notes: [], first: r.at }
    g.count++; g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1
    if (r.note) g.notes.push(r.note)
    if (r.at < g.first) g.first = r.at
    by.set(r.postId, g)
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.first.localeCompare(b.first))
}
