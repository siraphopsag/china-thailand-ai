import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Verification } from '../types'
import { verifyChip } from '../utils/labels'
import { getReg, lastVerifiedText, regText } from '../data/regulations'
import { MAX_MONITOR_AGE_DAYS, MAX_REVIEW_AGE_DAYS } from '../data/legal/trust'
import { tk, useI18n } from '../i18n'
import { CountryBadge, Icon } from './icons'

/* ---------- small primitives ---------- */
export const VerifyBadge = ({ v }: { v: Verification }) => { useI18n(); return <span title={v} className={`chip font-medium ${verifyChip[v]}`}>{tk('verify', v)}</span> }
export const SampleTag = ({ text }: { text?: string }) => { const { t } = useI18n(); return <span className="inline-block text-[11px] bg-surface3 text-muted rounded px-1.5 py-0.5">{text ?? t('c.sample')}</span> }
export const Disclaimer = () => { const { t } = useI18n(); return <p className="text-xs text-muted border-t border-line pt-3 mt-6">{t('c.disclaimer')}</p> }
export const ExtLink = ({ href, children }: { href?: string; children: ReactNode }) => (
  <a className="inline-flex items-center gap-1 min-h-[24px] text-primary underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">{children}<Icon name="external" size={13} /></a>
)

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div className="min-w-0"><h1 className="h1">{title}</h1>{sub && <p className="text-muted mt-1 max-w-3xl">{sub}</p>}</div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  )
}
export function Warn({ children, tone = 'warn' }: { children: ReactNode; tone?: 'warn' | 'danger' | 'info' }) {
  const c = { warn: 'bg-warn-bg border-warn-line text-warn-fg', danger: 'bg-danger-bg border-danger-line text-danger-fg', info: 'bg-info-bg border-info-line text-info-fg' }[tone]
  return <div role="note" className={`border rounded-xl px-4 py-3 text-sm flex gap-2.5 ${c}`}><Icon name={tone === 'info' ? 'info' : 'warn'} size={18} className="mt-0.5" /><div className="min-w-0">{children}</div></div>
}

/** Accessible tab list: roving tabindex, ArrowLeft/Right, Home/End. */
export function TabBar({ items, value, onChange, label }: { items: { id: string; label: ReactNode }[]; value: string; onChange: (id: string) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const move = (e: KeyboardEvent, i: number) => {
    const n = items.length
    const j = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
    if (j < 0) return
    e.preventDefault(); onChange(items[j].id); refs.current[items[j].id]?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 flex-wrap">
      {items.map((it, i) => (
        <button key={it.id} ref={(el) => { refs.current[it.id] = el }} role="tab" aria-selected={value === it.id} tabIndex={value === it.id ? 0 : -1} onClick={() => onChange(it.id)} onKeyDown={(e) => move(e, i)} className={`tab !whitespace-normal text-left ${value === it.id ? 'tab-on' : ''}`}>{it.label}</button>
      ))}
    </div>
  )
}

/** Progressive disclosure: level 4 details stay behind one calm button. */
export function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="card !p-0 overflow-hidden">
      <button className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left font-semibold hover:bg-surface2 transition-colors min-h-[48px]" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span><Icon name={open ? 'up' : 'down'} className="text-muted" />
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-3 border-t border-line">{children}</div>}
    </section>
  )
}



/* ---------- journey ---------- */

/* ---------- AI output (Answer · Reason · Risk · Source · Next action) ---------- */

/** Why a record is not shown as reviewed (plain words, one per reason). */
export function useReasonText() {
  const { t } = useI18n()
  return (codes: string[]) => codes.map((c) => t(`trust.r.${c}` as never, { n: c === 'monitor-stale' ? MAX_MONITOR_AGE_DAYS : MAX_REVIEW_AGE_DAYS })).join(' · ')
}

export function SourceCard({ id }: { id: string }) {
  const { t } = useI18n()
  const r = getReg(id)
  if (!r) return <div className="text-sm text-muted">{t('verify.NO_SOURCE')}</div>
  const dt = (x?: string) => (!x ? t('cite.unspecified') : x === 'simulated' ? t('reg.simulated') : x)
  const reason = useReasonText()
  return (
    <div className="card-i text-sm space-y-1.5">
      <div className="flex flex-wrap gap-2 items-center justify-between"><b className="inline-flex items-center gap-2"><CountryBadge c={r.country} />{regText(id, 'auth')}</b><VerifyBadge v={r.verificationStatus} /></div>
      <div className="font-medium">{regText(id, 'title')}</div><p className="text-muted">{regText(id, 'rule')}</p>
      {r.instrument && <p className="text-muted">{t('cite.instrument')}: <LangText text={r.instrument} /></p>}
      {r.originalTerm && <p className="text-muted">{t('reg.originalTerm')}: <LangText text={r.originalTerm} /></p>}
      <div className="text-xs text-muted flex flex-wrap gap-x-4"><span>{t('cite.provisions')}: {r.provisions?.length ? r.provisions.join(', ') : t('cite.unspecified')}</span><span>{t('reg.effective')}: {dt(r.effectiveDate)}</span><span>{t('reg.lastVerified')}: {lastVerifiedText(r)}{r.reviewedBy ? ` · ${r.reviewedBy}` : ''}</span></div>
      {r.supersededBy && <Warn>{t('reg.outdated')}</Warn>}
      {r.trust !== 'VERIFIED' && r.trustReasons.length > 0 && <p className="text-xs text-warn-fg"><b>{t('cite.whyNot')}:</b> {reason(r.trustReasons)}</p>}
      <div className="flex items-center gap-2 flex-wrap">{r.isSample && <SampleTag />}<ExtLink href={r.sourceUrl}>{r.textUrl ? t('cite.textLink') : t('cite.agencyOnly')}</ExtLink><span className="text-xs text-muted">{r.monitored ? t('cite.monitored') : t('cite.notMonitored')}</span></div>
    </div>
  )
}

/* ---------- language of parts (WCAG 3.1.2) ---------- */
const RUNS = /([\u3400-\u9FFF\uF900-\uFAFF]+(?:[\s\u3000-\u303F\uFF00-\uFFEF·]*[\u3400-\u9FFF\uF900-\uFAFF]+)*)|([\u0E00-\u0E7F]+(?:\s+[\u0E00-\u0E7F]+)*)/g
/** Splits a string into runs and marks Chinese or Thai runs that differ from the page language, so screen readers switch voice. */
export function langRuns(text: string, pageLang: string): ReactNode {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(RUNS)) {
    const l = m[1] ? 'zh' : 'th'
    if (l === pageLang) continue
    if (m.index! > last) out.push(text.slice(last, m.index))
    out.push(<span key={m.index} lang={l === 'zh' ? 'zh-CN' : 'th'}>{m[0]}</span>)
    last = m.index! + m[0].length
  }
  if (!out.length) return text
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}
export function LangText({ text }: { text: string }) { const { lang } = useI18n(); return <>{langRuns(text, lang)}</> }

/* ---------- risk: found → why it matters → (details) verify → next action ---------- */

/* ---------- business profile ---------- */

/* ---------- ownership visuals ---------- */

/* ---------- checklist / roadmap / actions ---------- */



