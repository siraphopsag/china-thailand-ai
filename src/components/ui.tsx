import { useState, type ReactNode } from 'react'
import type { ActionItem, AIResponse, AlertItem, Level, Profile, RiskCardData, RoadmapStep, StepStatus, Verification } from '../types'
import { STEP_STATUSES, dirInfo, levelBar, levelChip, levelIconName, stepChip, stepNode, verifyChip } from '../utils/labels'
import { getReg, lastVerifiedText, regText } from '../data/regulations'
import { checklistItems } from '../data/demo'
import { dv, tk, useI18n } from '../i18n'
import { holderName, ownershipRows } from '../services/engines'
import { go, useStore } from '../store'
import { CountryBadge, Icon } from './icons'

/* ---------- small primitives ---------- */
export const StatusBadge = ({ level }: { level: Level }) => { useI18n(); return <span className={`chip ${levelChip[level]}`}><Icon name={levelIconName[level]} size={13} />{tk('level', level)}</span> }
export const VerifyBadge = ({ v }: { v: Verification }) => { useI18n(); return <span className={`chip font-medium ${verifyChip[v]}`}>{tk('verify', v)}</span> }
export const StepBadge = ({ s }: { s: StepStatus }) => { useI18n(); return <span className={`chip font-medium ${stepChip[s]}`}>{tk('step', s)}</span> }
export const SimTag = () => { const { t } = useI18n(); return <span title={t('sim.note')} className="chip bg-surface3 text-muted border-line font-medium cursor-help"><Icon name="info" size={12} />{t('sim.tag')}</span> }
export const SampleTag = ({ text }: { text?: string }) => { const { t } = useI18n(); return <span className="inline-block text-[11px] bg-surface3 text-muted rounded px-1.5 py-0.5">{text ?? t('c.sample')}</span> }
export const Disclaimer = () => { const { t } = useI18n(); return <p className="text-xs text-muted border-t border-line pt-3 mt-6">{t('c.disclaimer')}</p> }
export const ExtLink = ({ href, children }: { href?: string; children: ReactNode }) => (
  <a className="inline-flex items-center gap-1 text-primary underline underline-offset-2" href={href} target="_blank" rel="noopener noreferrer">{children}<Icon name="external" size={13} /></a>
)
export const Go = ({ children }: { children: ReactNode }) => <>{children}<Icon name="next" size={16} /></>
export const Ok = ({ children }: { children: ReactNode }) => <span className="inline-flex items-center gap-1.5"><Icon name="ok" size={16} />{children}</span>

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

/** Answers the three questions on every screen: where am I, what is the AI doing, what should I do next. */
export function GuideStrip({ page, nextRoute }: { page: string; nextRoute: string }) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl border border-line bg-brand text-brandfg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" role="status">
      <Icon name="ai" size={20} className="text-primary" />
      <div className="flex-1 min-w-[220px] text-sm"><span className="font-semibold">{t('guide.doing')}: </span>{tk('guide', `${page}.d`)}</div>
      <button className="btn-ghost !min-h-[36px] !py-1 text-sm" onClick={() => go(nextRoute)}><Go>{t('guide.next')}: {tk('guide', `${page}.n`)}</Go></button>
    </div>
  )
}

export function EmptyState({ title, text }: { title?: string; text?: string }) {
  const { t } = useI18n()
  const { startDemo, beginNew } = useStore()
  return (
    <div className="card text-center py-12 max-w-xl mx-auto">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand text-brandfg grid place-items-center mb-3"><Icon name="business" size={24} /></div>
      <h2 className="h2">{title ?? t('empty.title')}</h2><p className="text-muted mt-2">{text ?? t('empty.text')}</p>
      <div className="flex gap-2 justify-center mt-5 flex-wrap">
        <button className="btn-primary" onClick={beginNew}><Go>{t('cta.start')}</Go></button>
        <button className="btn-ghost" onClick={() => { startDemo(); go('profile') }}>{t('cta.demo')}</button>
      </div>
    </div>
  )
}

/* ---------- journey ---------- */
export function WorkflowStrip({ active = -1 }: { active?: number }) {
  const { t } = useI18n()
  const cur = Math.max(active, 0)
  return (
    <div aria-label={t('wf.aria')}>
      <p className="sm:hidden text-sm"><span className="font-semibold">{cur + 1}/7</span> · {tk('wf', String(cur + 1))}<span className="block h-1.5 rounded bg-surface3 mt-1.5 overflow-hidden"><span className="block h-1.5 bg-primary" style={{ width: `${((cur + 1) / 7) * 100}%` }} /></span></p>
      <ol className="hidden sm:flex flex-wrap items-center gap-y-2 text-sm">
        {[1, 2, 3, 4, 5, 6, 7].map((n, i) => (
          <li key={n} className="flex items-center">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${i === active ? 'bg-primary text-onprimary border-primary' : i < active ? 'bg-brand text-brandfg border-line' : 'bg-surface text-muted border-line'}`}>{i < active ? <Icon name="check" size={14} /> : <span className="text-xs font-semibold">{n}</span>}{tk('wf', String(n))}</span>
            {i < 6 && <span className="mx-1 text-muted" aria-hidden><Icon name="next" size={14} /></span>}
          </li>
        ))}
      </ol>
    </div>
  )
}
export function ProgressStepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <ol className="space-y-1" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${i === current ? 'bg-brand text-brandfg font-semibold' : 'text-muted'}`}>
          <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs ${i < current ? 'bg-ok-fg text-surface' : i === current ? 'bg-primary text-onprimary' : 'bg-surface3'}`}>{i < current ? <Icon name="check" size={13} /> : i + 1}</span>{s}
        </li>
      ))}
    </ol>
  )
}
const GROUPS: Record<string, [string, string][]> = {
  ownership: [['ownership', 'tabs.owner1'], ['nominee', 'tabs.owner2']],
  employment: [['employment', 'tabs.emp1'], ['contract', 'tabs.emp2']],
}
export function SectionTabs({ group, active }: { group: 'ownership' | 'employment'; active: string }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('tabs.aria')} className="flex gap-2 overflow-x-auto pb-1 mb-4">
      {GROUPS[group].map(([k, key]) => <button key={k} onClick={() => go(k)} aria-current={active === k ? 'page' : undefined} className={`tab ${active === k ? 'tab-on' : ''}`}>{t(key as never)}</button>)}
    </nav>
  )
}

/* ---------- AI output (Answer · Reason · Risk · Source · Next action) ---------- */
export function AIMessage({ r }: { r: AIResponse }) {
  const { t } = useI18n()
  return (
    <div className={`rounded-xl border p-4 space-y-3 text-sm ${r.blocked ? 'border-danger-line bg-danger-bg' : r.kind === 'educational' ? 'border-info-line bg-info-bg' : 'border-line bg-brand'}`} aria-live="polite">
      <div className="flex flex-wrap gap-1.5 items-center text-xs text-muted"><span className="font-semibold inline-flex items-center gap-1"><Icon name="ai" size={14} />{t('ai.modules')}:</span>{r.modules.map((m) => <span key={m} className="bg-surface border border-line rounded px-2 py-0.5">{m}</span>)}<span className="ml-auto"><SimTag /></span></div>
      <div><div className="text-xs font-semibold text-muted">{t('ai.answer')}</div><p className="text-base font-semibold">{r.answer}</p></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><div className="text-xs font-semibold text-muted">{t('ai.reason')}</div><p>{r.reason}</p></div>
        <div><div className="text-xs font-semibold text-muted">{t('ai.risk')}</div><StatusBadge level={r.risk} /></div>
        <div className="sm:col-span-2"><div className="text-xs font-semibold text-muted">{t('ai.source')}</div>
          <p>{r.sources.length ? r.sources.map((s) => `${regText(s, 'auth')}: ${regText(s, 'title')}`).join(' / ') + ` (${t('c.sample')})` : t('ai.noSource')}</p></div>
      </div>
      <div className="rounded-lg bg-surface border border-line px-3 py-2"><div className="text-xs font-semibold text-muted">{t('ai.next')}</div><p className="font-medium">{r.next}</p></div>
    </div>
  )
}

export function SourceCard({ id }: { id: string }) {
  const { t } = useI18n()
  const r = getReg(id)
  if (!r) return <div className="text-sm text-muted">{t('verify.NO_SOURCE')}</div>
  const dt = (x?: string) => (!x ? t('c.unspecified') : x === 'simulated' ? t('reg.simulated') : x)
  return (
    <div className="card-i text-sm space-y-1.5">
      <div className="flex flex-wrap gap-2 items-center justify-between"><b className="inline-flex items-center gap-2"><CountryBadge c={r.country} />{regText(id, 'auth')}</b><VerifyBadge v={r.verificationStatus} /></div>
      <div className="font-medium">{regText(id, 'title')}</div><p className="text-muted">{regText(id, 'rule')}</p>
      {r.originalTerm && <p className="text-muted">{t('reg.originalTerm')}: <span lang="zh">{r.originalTerm}</span></p>}
      <div className="text-xs text-muted flex flex-wrap gap-x-4"><span>{t('reg.published')}: {dt(r.publicationDate)}</span><span>{t('reg.effective')}: {dt(r.effectiveDate)}</span><span>{t('reg.lastVerified')}: {lastVerifiedText(r)}</span></div>
      {r.supersededBy && <Warn>{t('reg.outdated')}</Warn>}
      <div className="flex items-center gap-2 flex-wrap">{r.isSample && <SampleTag />}<ExtLink href={r.sourceUrl}>{t('c.openOfficial')}</ExtLink></div>
    </div>
  )
}

/* ---------- risk: found → why it matters → (details) verify → next action ---------- */
export function RiskCard({ r, actions, onAction, compact }: { r: RiskCardData; actions?: ActionItem[]; onAction?: (id: string, s: StepStatus) => void; compact?: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(!compact)
  return (
    <article className={`card border-l-4 ${levelBar[r.level]} space-y-2 !p-4`}>
      <div className="flex flex-wrap justify-between gap-2 items-center"><h3 className="font-semibold">{r.category}</h3><StatusBadge level={r.level} /></div>
      <p className="text-sm text-muted">{r.why}</p>
      {open && <>
        <div className="text-sm"><b>{t('risk.check')}:</b>{r.check.length ? <ul className="list-disc ml-5">{r.check.map((c, i) => <li key={i}>{c}</li>)}</ul> : <span> -</span>}</div>
        <p className="text-sm"><b>{t('risk.nextStep')}:</b> {r.next}</p>
        <div className="text-sm"><b>{t('risk.sources')}:</b>{' '}{r.sourceIds.length ? r.sourceIds.map((s) => { const g = getReg(s); return g ? <span key={s} className="mr-2"><ExtLink href={g.sourceUrl}>{regText(s, 'auth')}</ExtLink></span> : null }) : t('risk.noLaw')} <SampleTag /></div>
        <VerifyBadge v={r.verification} />
      </>}
      {actions && actions.length > 0 && open && (
        <div className="rounded-lg bg-surface2 border border-line p-2 space-y-1.5"><div className="text-xs font-semibold text-muted">{t('risk.actions')}</div>
          {actions.map((a) => (
            <label key={a.id} className="flex items-start gap-2 text-sm min-h-[36px] cursor-pointer"><input type="checkbox" className="mt-1 w-4 h-4 accent-[rgb(var(--primary))]" checked={a.status === 'done'} onChange={(e) => onAction?.(a.id, e.target.checked ? 'done' : 'todo')} /><span className={a.status === 'done' ? 'line-through text-muted' : ''}>{a.title}</span></label>))}
        </div>)}
      {compact && <button className="text-sm text-primary font-medium inline-flex items-center gap-1" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? t('ui.hide') : t('ui.show')}<Icon name={open ? 'up' : 'down'} size={14} /></button>}
    </article>
  )
}

/* ---------- business profile ---------- */
export function BusinessProfile({ p, onEdit }: { p: Profile; onEdit?: () => void }) {
  const { t } = useI18n()
  const d = dirInfo(p.direction)
  const from = tk('country', d.from)
  const rows: [string, string][] = [
    [t('bp.name'), dv(p.companyName)], [t('bp.origin'), from], [t('bp.target'), tk('country', d.to)],
    [t('bp.type'), p.businessType === 'other' && p.businessTypeOther ? p.businessTypeOther : tk('opt.btype', p.businessType)], [t('bp.activity'), dv(p.activity)],
    [t('bp.forms'), p.forms.map((f) => tk('opt.forms', f, { from })).join(', ') || '-'], [t('bp.invest'), p.investmentRange ? tk('opt.invest', p.investmentRange) : '-'],
    [t('bp.employees'), String(p.employees)], [t('bp.cross'), p.crossBorderWorkers ? t('c.yes') : t('c.no')],
    [t('bp.holders'), p.holders.map((h) => `${tk('country', h.nationality)} ${h.percent}%`).join(' / ')], [t('bp.products'), dv(p.products) || '-'], [t('bp.market'), dv(p.targetMarket) || '-'],
    [t('bp.regulated'), p.regulatedGoods ? tk('opt.regulated', p.regulatedGoods) : '-'], [t('bp.location'), dv(p.location) || '-'], [t('bp.crossBorder'), p.crossBorder.map((x) => tk('opt.cross', x)).join(', ') || '-'],
  ]
  return (
    <div className="card">
      <div className="flex justify-between items-center gap-2 flex-wrap mb-3"><h2 className="h2">{t('bp.title')} {p.isDemo && <SampleTag text={t('c.demoTag')} />}</h2>{onEdit && <button className="btn-ghost" onClick={onEdit}>{t('c.editData')}</button>}</div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">{rows.map(([k, v]) => <div key={k} className="border-b border-line pb-1"><dt className="text-muted">{k}</dt><dd className="font-medium break-words">{v}</dd></div>)}</dl>
    </div>
  )
}

/* ---------- ownership visuals ---------- */
export function OwnershipMap({ p }: { p: Profile }) {
  const { t } = useI18n()
  const d = dirInfo(p.direction)
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-4" role="img" aria-label={p.holders.map((h) => `${holderName(h)} ${h.percent}%`).join(', ')}>
      <div className="flex-1 space-y-3">
        {p.holders.map((h, i) => (
          <div key={h.id} className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
            <div className={`flex-1 rounded-xl border-2 p-3 ${i === 0 ? 'border-primary bg-brand' : 'border-info-fg bg-info-bg'}`}>
              <div className="text-xs text-muted flex items-center gap-1.5"><CountryBadge c={h.nationality} />{h.id === 'origin' ? t('own.foreign', { c: tk('country', d.to) }) : t('own.local')}</div>
              <div className="font-semibold mt-1">{holderName(h)}</div><div className="text-3xl font-bold">{h.percent}%</div>
            </div>
            <div className="flex md:w-28 items-center justify-center text-muted text-sm" aria-hidden>
              <span className="hidden md:block flex-1 h-0.5 bg-line" /><span className="chip bg-surface text-ink border-line mx-1">{h.percent}% {t('own.shares')}</span><Icon name="next" size={14} className="hidden md:block" /><Icon name="down" size={14} className="md:hidden" />
            </div>
          </div>
        ))}
      </div>
      <div className="md:w-56 rounded-xl border-2 border-line bg-surface2 p-4 text-center">
        <div className="text-xs text-muted flex items-center justify-center gap-1.5"><CountryBadge c={d.to} />{tk('country', d.to)}</div><div className="font-semibold break-words mt-1">{dv(p.companyName)}</div><div className="text-xs text-muted mt-1">{t('own.entity')}</div>
      </div>
    </div>
  )
}
export function ControlBars({ p }: { p: Profile }) {
  const { t } = useI18n()
  const rows = ownershipRows(p)
  const [a, b] = p.holders
  return (
    <div>
      <div className="text-center font-semibold text-ink mb-3">{t('own.neq')}</div>
      <div className="flex flex-wrap gap-4 text-xs text-muted mb-3"><span><i className="inline-block w-3 h-3 rounded-sm bg-primary align-middle mr-1" />{holderName(a)}</span><span><i className="inline-block w-3 h-3 rounded-sm bg-info-fg align-middle mr-1" />{holderName(b)}</span></div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex justify-between gap-2 text-sm"><span className="font-medium">{tk('row', r.key)}</span>{r.mismatch && <span className="text-review-fg font-semibold inline-flex items-center gap-1"><Icon name="warn" size={14} />{t('own.mismatch')}</span>}{r.origin !== null && r.partner !== null && r.origin + r.partner !== 100 && <span className="text-danger-fg text-xs font-semibold">{t('own.sumWarn')}</span>}</div>
            {r.origin === null || r.partner === null ? <div className="h-5 rounded bg-surface3 text-xs text-muted grid place-items-center">{t('own.unknownVal')}</div> : (
              <div className={`flex h-6 rounded-md overflow-hidden text-xs font-semibold ${r.mismatch ? 'ring-2 ring-review-fg' : ''}`} role="img" aria-label={`${r.origin}% / ${r.partner}%`}>
                <div className="bg-primary grid place-items-center text-onprimary transition-all duration-500" style={{ width: r.origin + '%' }}>{r.origin >= 12 ? r.origin + '%' : ''}</div>
                <div className="bg-info-fg grid place-items-center text-surface transition-all duration-500" style={{ width: r.partner + '%' }}>{r.partner >= 12 ? r.partner + '%' : ''}</div>
              </div>)}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- checklist / roadmap / actions ---------- */
export function Checklist({ done, onToggle }: { done: Record<string, boolean>; onToggle: (id: string) => void }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">{(['business', 'ownership', 'employment'] as const).map((g) => (
      <fieldset key={g}><legend className="font-semibold mb-1">{tk('chk.group', g)}</legend>
        {checklistItems.filter((i) => i.group === g).map((i) => (
          <label key={i.id} className="flex gap-3 items-start py-2 min-h-[44px] cursor-pointer"><input type="checkbox" className="mt-1.5 w-5 h-5 accent-[rgb(var(--primary))]" checked={!!done[i.id]} onChange={() => onToggle(i.id)} /><span className={done[i.id] ? 'line-through text-muted' : ''}>{t(`chk.${i.id}` as never)}</span></label>
        ))}
      </fieldset>))}
    </div>
  )
}

export function RoadmapTimeline({ steps, onStatus }: { steps: RoadmapStep[]; onStatus: (id: number, s: StepStatus) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState<number | null>(() => steps.find((s) => s.status === 'fix')?.id ?? steps.find((s) => s.status !== 'done')?.id ?? null)
  return (
    <ol>{steps.map((s, i) => {
      const isOpen = open === s.id
      return (
        <li key={s.id} className="relative pl-14 pb-4 last:pb-0">
          {i < steps.length - 1 && <span className="absolute left-5 top-10 bottom-0 w-0.5 bg-line" aria-hidden />}
          <button aria-label={`${t('rm.stepN', { n: s.id })}: ${s.title}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}
            className={`absolute left-0 top-0 w-10 h-10 rounded-full grid place-items-center font-semibold border-2 transition-colors ${stepNode[s.status]}`}>{s.status === 'done' ? <Icon name="check" size={18} /> : String(s.id).padStart(2, '0')}</button>
          <div className={`card !p-4 transition-shadow ${isOpen ? 'shadow-md' : ''} ${s.status === 'fix' ? 'border-danger-line' : ''}`}>
            <button className="w-full text-left flex flex-wrap items-center justify-between gap-2" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
              <span className="font-semibold">{s.title}</span><StepBadge s={s.status} />
            </button>
            {s.note && <div className="mt-2"><Warn tone={s.status === 'fix' ? 'danger' : 'warn'}>{s.note}</Warn></div>}
            {isOpen && (
              <div className="mt-3 space-y-3 text-sm">
                <p>{s.description}</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div><b>{t('rm.docs')}</b><ul className="list-disc ml-5">{s.docs.map((d) => <li key={d}>{d}</li>)}</ul></div>
                  <div><b>{t('rm.why')}</b><p>{s.why}</p></div>
                  <div><b>{t('rm.next')}</b><p>{s.next}</p></div>
                </div>
                <div><label className="label" htmlFor={'st' + s.id}>{t('rm.setStatus')}</label>
                  <select id={'st' + s.id} className="input !w-auto" value={s.status} onChange={(e) => onStatus(s.id, e.target.value as StepStatus)}>{STEP_STATUSES.map((k) => <option key={k} value={k}>{tk('step', k)}</option>)}</select></div>
              </div>)}
          </div>
        </li>)
    })}</ol>
  )
}

export function ActionList({ actions, onStatus }: { actions: ActionItem[]; onStatus: (id: string, s: StepStatus) => void }) {
  const { t } = useI18n()
  if (!actions.length) return <div className="card text-sm text-ok-fg"><Ok>{t('act.none')}</Ok></div>
  return (
    <ul className="space-y-2">{actions.map((a) => (
      <li key={a.id} className="card-i flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm min-w-0"><div className={a.status === 'done' ? 'line-through text-muted' : 'font-medium'}>{a.title}</div><div className="text-xs text-muted">{t('c.fromRisk')}: {a.riskLabel} · {t('c.owner')}: {a.owner}</div></div>
        <div className="flex items-center gap-2"><StepBadge s={a.status} />
          <select aria-label={`${t('c.status')}: ${a.title}`} className="input !w-auto !py-1.5 text-sm" value={a.status} onChange={(e) => onStatus(a.id, e.target.value as StepStatus)}>{STEP_STATUSES.map((k) => <option key={k} value={k}>{tk('step', k)}</option>)}</select></div>
      </li>))}</ul>
  )
}

export function AlertCard({ a, profileName }: { a: AlertItem; profileName: string }) {
  const { t, lang } = useI18n()
  const g = getReg(a.sourceId)
  const k = (x: string) => t(x as never)
  return (
    <article className={`card border-l-4 ${levelBar[a.severity]} text-sm space-y-1`}>
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold inline-flex items-center gap-1.5"><Icon name="warn" size={16} />{t('alert.head')}</h3>{a.isSample && <SampleTag text={t('alert.tag')} />}</div>
      <p><b>{t('alert.changed')}:</b> {k(a.titleKey)}</p><p><b>{t('alert.when')}:</b> {a.when === 'sample' ? t('alert.sampleWhen') : Number.isNaN(Date.parse(a.when)) ? a.when : new Date(a.when).toLocaleString(lang === 'th' ? 'th-TH' : lang === 'zh' ? 'zh-CN' : 'en-GB')}</p>
      <p className="flex items-center gap-1.5 flex-wrap"><b>{t('alert.countryTopic')}:</b> <CountryBadge c={a.country} /> {tk('country', a.country)} · {k(a.topicKey)}</p>
      <p><b>{t('alert.profile')}:</b> {profileName}</p>
      <p><b>{t('alert.source')}:</b> {g ? <ExtLink href={g.sourceUrl}>{regText(a.sourceId, 'auth')}</ExtLink> : '-'}</p>
      <p><b>{t('alert.impact')}:</b> {k(a.impactKey)}</p><p><b>{t('alert.next')}:</b> {k(a.nextKey)}</p>
    </article>
  )
}
