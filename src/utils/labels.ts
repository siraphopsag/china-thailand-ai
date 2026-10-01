import type { Direction, Level, StepStatus, Verification } from '../types'
import type { IconName } from '../components/icons'

/** Status → semantic token classes (defined in index.css, switch with light/dark theme). */
export const levelChip: Record<Level, string> = {
  LOW: 'bg-ok-bg text-ok-fg border-ok-line', MEDIUM: 'bg-warn-bg text-warn-fg border-warn-line',
  HIGH: 'bg-danger-bg text-danger-fg border-danger-line', NEEDS_REVIEW: 'bg-warn-bg text-warn-fg border-warn-line',
}
export const levelBar: Record<Level, string> = { LOW: 'border-l-ok-fg', MEDIUM: 'border-l-warn-fg', HIGH: 'border-l-danger-fg', NEEDS_REVIEW: 'border-l-warn-fg' }
export const levelPanel: Record<Level, string> = { LOW: 'border-ok-line bg-ok-bg', MEDIUM: 'border-warn-line bg-warn-bg', HIGH: 'border-danger-line bg-danger-bg', NEEDS_REVIEW: 'border-warn-line bg-warn-bg' }
export const levelIconName: Record<Level, IconName> = { LOW: 'ok', MEDIUM: 'alert', HIGH: 'warn', NEEDS_REVIEW: 'alert' }
export const levelOrder: Level[] = ['HIGH', 'NEEDS_REVIEW', 'MEDIUM', 'LOW']

export const verifyChip: Record<Verification, string> = {
  VERIFIED: 'bg-ok-bg text-ok-fg border-ok-line', PARTIAL: 'bg-info-bg text-info-fg border-info-line', NEED_INFO: 'bg-warn-bg text-warn-fg border-warn-line',
  NO_SOURCE: 'bg-surface3 text-muted border-line', EXPERT: 'bg-danger-bg text-danger-fg border-danger-line',
  STALE: 'bg-warn-bg text-warn-fg border-warn-line', CHANGED: 'bg-danger-bg text-danger-fg border-danger-line',
}
export const stepChip: Record<StepStatus, string> = {
  todo: 'bg-surface3 text-muted border-line', doing: 'bg-info-bg text-info-fg border-info-line', review: 'bg-warn-bg text-warn-fg border-warn-line',
  waitdoc: 'bg-warn-bg text-warn-fg border-warn-line', waitver: 'bg-info-bg text-info-fg border-info-line',
  done: 'bg-ok-bg text-ok-fg border-ok-line', fix: 'bg-danger-bg text-danger-fg border-danger-line',
}
export const stepNode: Record<StepStatus, string> = {
  todo: 'bg-surface text-muted border-line', doing: 'bg-info-bg text-info-fg border-info-fg', review: 'bg-warn-bg text-warn-fg border-warn-fg',
  waitdoc: 'bg-warn-bg text-warn-fg border-warn-fg', waitver: 'bg-info-bg text-info-fg border-info-fg',
  done: 'bg-ok-bg text-ok-fg border-ok-fg', fix: 'bg-danger-bg text-danger-fg border-danger-fg',
}
export const STEP_STATUSES: StepStatus[] = ['todo', 'doing', 'waitdoc', 'waitver', 'review', 'done', 'fix']

export const dirInfo = (d: Direction) => (d === 'TH_CN' ? { from: 'TH' as const, to: 'CN' as const } : { from: 'CN' as const, to: 'TH' as const })

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
