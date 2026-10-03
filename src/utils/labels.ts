import type { Verification } from '../types'


export const verifyChip: Record<Verification, string> = {
  VERIFIED: 'bg-ok-bg text-ok-fg border-ok-line', PARTIAL: 'bg-info-bg text-info-fg border-info-line', NEED_INFO: 'bg-warn-bg text-warn-fg border-warn-line',
  NO_SOURCE: 'bg-surface3 text-muted border-line', EXPERT: 'bg-danger-bg text-danger-fg border-danger-line',
  STALE: 'bg-warn-bg text-warn-fg border-warn-line', CHANGED: 'bg-danger-bg text-danger-fg border-danger-line',
}



/** Browser-tab title of a view: its h1 (whitespace collapsed) + the product name; the fallback when a view has no heading yet. */
export const pageTitle = (h1: string, brand: string, fallback: string) => { const t = h1.replace(/\s+/g, ' ').trim(); return t ? t + ' · ' + brand : fallback }
