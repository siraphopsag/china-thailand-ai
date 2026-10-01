import { go, useStore, DOC_STATES, type DocState } from '../store'
import type { StepStatus } from '../types'
import { ActionList, Disclaimer, EmptyState, ExtLink, Go, LangText, PageHead, Warn, useRouteText } from '../components/ui'
import { Icon } from '../components/icons'
import { usePlan, useActions } from '../hooks'
import { missingInfo, type PlanItem } from '../services/compliance'
import { targetCountry } from '../services/engines'
import { ReqBadge, provincesOf } from './compliance'
import { STEP_STATUSES, stepChip } from '../utils/labels'
import { dv, tk, useI18n } from '../i18n'

/** The four layers every result is made of, always labelled the same way. */
const LAYER = {
  official: 'border-info-line bg-info-bg text-info-fg', ai: 'border-line bg-surface3 text-ink', user: 'border-ok-line bg-ok-bg text-ok-fg', open: 'border-warn-line bg-warn-bg text-warn-fg',
} as const
function Layer({ k }: { k: keyof typeof LAYER }) { const { t } = useI18n(); return <span className={`chip ${LAYER[k]}`}>{t(`plan.layer.${k}` as never)}</span> }

function PlanCard({ i, onStatus, onDoc }: { i: PlanItem; onStatus: (s: StepStatus) => void; onDoc: (id: string, s: DocState) => void }) {
  const { t } = useI18n()
  const row = (label: string, layer: keyof typeof LAYER | null, body: React.ReactNode) => (
    <div className="text-sm"><div className="flex flex-wrap items-center gap-2 mb-1"><span className="text-xs font-semibold text-muted">{label}</span>{layer && <Layer k={layer} />}</div>{body}</div>)
  const unresolved = i.sourceStatus !== 'ACTIVE'
  return (
    <article className={`card space-y-3 !p-4 ${i.status === 'done' ? 'opacity-90' : ''}`} aria-labelledby={i.id + '-h'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 id={i.id + '-h'} className={`font-semibold min-w-0 flex-1 basis-56 ${i.status === 'done' ? 'line-through' : ''}`}><LangText text={i.title} />{i.optional && <span className="ml-2 chip bg-surface3 text-muted border-line">{t('plan.optional')}</span>}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <ReqBadge s={i.sourceStatus} />
          <label className="sr-only" htmlFor={i.id + '-st'}>{t('plan.statusLabel')}: {i.title}</label>
          <select id={i.id + '-st'} className={`input !w-auto !py-1 !min-h-[36px] text-sm font-medium ${stepChip[i.status]}`} value={i.status} onChange={(e) => onStatus(e.target.value as StepStatus)}>{STEP_STATUSES.map((s) => <option key={s} value={s}>{tk('step', s)}</option>)}</select>
        </div>
      </div>
      <div className="rounded-lg bg-brand text-brandfg px-3 py-2 text-sm flex gap-2 items-start"><Icon name="next" size={16} className="mt-0.5 shrink-0" /><span><b>{t('plan.next')}:</b> <LangText text={i.next} /></span></div>
      {row(t('plan.why'), 'ai', <p className="text-muted"><LangText text={i.why} /></p>)}
      {i.dependsOn.length > 0 && row(t('plan.depends'), null, <ul className="space-y-1">{i.dependsOn.map((d) => <li key={d.id} className="flex items-center gap-2"><Icon name={d.done ? 'ok' : 'circle'} size={15} className={d.done ? 'text-ok-fg' : 'text-muted'} /><LangText text={d.title} /><span className="text-xs text-muted">({d.done ? t('plan.depDone') : t('plan.depWait')})</span></li>)}</ul>)}
      {row(t('plan.prepare'), i.documents.length ? 'user' : null, i.documents.length ? (
        <ul className="space-y-1.5">{i.documents.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 basis-48"><LangText text={d.name} /></span>
            <label className="sr-only" htmlFor={i.id + d.id}>{t('c.status')}: {d.name}</label>
            <select id={i.id + d.id} className="input !w-auto !py-1 !min-h-[36px] text-sm" value={d.status} onChange={(e) => onDoc(d.id, e.target.value as DocState)}>{DOC_STATES.map((s) => <option key={s} value={s}>{tk('dc.s', s)}</option>)}</select></li>))}</ul>
      ) : <p className="text-muted">{t('plan.noDocs')}</p>)}
      {i.receives.length > 0 && row(t('plan.receives'), null, <p><LangText text={i.receives.map((d) => d.name).join(' · ')} /></p>)}
      <div className="grid sm:grid-cols-2 gap-3">
        {row(t('plan.authority'), i.office.resolved ? null : 'open', <p><LangText text={i.authority} />{i.authorityUrl && <> <ExtLink href={i.authorityUrl}>{t('nv.site')}</ExtLink></>}<span className={`block text-xs ${i.office.resolved ? 'text-muted' : 'text-warn-fg font-medium'}`}><LangText text={i.office.text} /></span></p>)}
        {row(t('plan.source'), i.sources.length ? 'official' : 'open', i.sources.length ? (
          <p className="space-y-0.5">{i.sources.map((s) => <span key={s.id} className="block"><ExtLink href={s.url}><LangText text={s.title} /></ExtLink></span>)}<span className="block text-xs text-muted">{t('nv.lastVerified')}: {t('nv.never')}{unresolved ? ' · ' + tk('kb.s', i.sourceStatus) : ''}</span></p>
        ) : <p className="text-warn-fg">{t('nv.noSource')}</p>)}
      </div>
    </article>
  )
}

export function PlanPage() {
  const { t } = useI18n()
  const { profile, goal, employeeCheck, docStatus, destinationProvince, set, setActionStatus } = useStore()
  const plan = usePlan()
  const actions = useActions()
  const route = useRouteText()
  if (!profile) return <div><PageHead title={t('plan.title')} /><EmptyState /></div>
  // checking one employee does not need business-activity or ownership details
  const missing = missingInfo(profile, employeeCheck).filter((m) => goal !== 'employee' || (m.id !== 'activity' && m.id !== 'ownership'))
  const country = targetCountry(profile)
  const other = actions.filter((a) => !a.id.startsWith('act-req-'))
  const done = actions.filter((a) => a.status === 'done').length
  const verified = plan.filter((i) => i.sourceStatus === 'ACTIVE').length
  const steps = [...new Set(plan.map((i) => i.step))]
  const setStatus = (i: PlanItem, s: StepStatus) => setActionStatus({ id: i.id, riskId: 'req', riskLabel: tk('kb.d', i.domain), title: i.title, owner: t('kb.act.owner'), status: i.status }, s)
  const setDoc = (id: string, s: DocState) => set({ docStatus: { ...docStatus, [id]: s } })
  const setOther = (id: string, s: StepStatus) => { const a = actions.find((x) => x.id === id); if (a) setActionStatus(a, s) }
  const setProvince = (code: string) => set({ destinationProvince: code || null, profile: { ...profile, destProvince: code || undefined } })
  return (
    <div className="space-y-5 max-w-4xl">
      <PageHead title={t('plan.title')} sub={t('plan.sub')} />
      <section className="card-i !p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" aria-label={t('plan.case')}>
        <span className="font-semibold">{dv(profile.companyName) || t('plan.case')}</span>
        <span>{t(`plan.goal.${goal ?? 'expand'}` as never)}</span>
        <span className="text-muted">{route}</span>
        <span className="text-muted">{profile.businessType === 'other' && profile.businessTypeOther ? profile.businessTypeOther : tk('opt.btype', profile.businessType)}</span>
        <button className="ml-auto text-primary underline inline-flex items-center min-h-[24px]" onClick={() => go('profile')}>{t('plan.edit')}</button>
      </section>
      <div>
        <div className="flex justify-between text-sm"><span className="font-medium">{t('plan.progress', { done, total: actions.length })}</span></div>
        <div className="h-2 rounded bg-surface3 overflow-hidden mt-1" role="progressbar" aria-valuemin={0} aria-valuemax={actions.length} aria-valuenow={done} aria-label={t('plan.progress', { done, total: actions.length })}><div className="h-2 bg-primary transition-all duration-500" style={{ width: (actions.length ? (done / actions.length) * 100 : 0) + '%' }} /></div>
      </div>
      <Warn tone="info">{t('plan.sources', { v: verified, n: plan.length })}</Warn>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold text-muted">{t('plan.layers')}:</span><Layer k="official" /><Layer k="ai" /><Layer k="user" /><Layer k="open" /></div>

      <section className="card space-y-3" aria-labelledby="miss-h">
        <h2 id="miss-h" className="h2">{t('plan.missing.t')}</h2>
        {missing.length ? <>
          <p className="text-sm text-muted">{t('plan.missing.d')}</p>
          <ul className="space-y-2">{missing.map((m) => (
            <li key={m.id} className="card-i flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 basis-60"><div className="font-medium text-sm">{t(`plan.mi.${m.id}.t` as never)}</div><div className="text-xs text-muted">{t(`plan.mi.${m.id}.why` as never)}</div></div>
              {m.id === 'province' ? <><label className="sr-only" htmlFor="mi-prov">{t('plan.mi.province.t')}</label>
                <select id="mi-prov" className="input !w-auto" value={destinationProvince ?? ''} onChange={(e) => setProvince(e.target.value)}><option value="">{t('plan.mi.choose')}</option>{provincesOf(country).map((p) => <option key={p} value={p}>{tk('prov', p)}</option>)}</select></>
                : <button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go(m.route!)}>{t('plan.mi.answer')}</button>}
            </li>))}</ul>
        </> : <p className="text-sm text-ok-fg">{t('plan.mi.none')}</p>}
      </section>

      {!plan.length ? <div className="card space-y-3"><p className="text-muted">{t('plan.empty')}</p><button className="btn-primary" onClick={() => go('interview')}><Go>{t('plan.toIntake')}</Go></button></div>
        : steps.map((n) => (
          <section key={n} className="space-y-3" aria-labelledby={'step-' + n}>
            <h2 id={'step-' + n} className="h2 flex flex-wrap items-baseline gap-x-3">{t('plan.step', { n })}<span className="text-sm font-normal text-muted">{n === 1 ? t('plan.step.now') : t('plan.step.after')}</span></h2>
            {plan.filter((i) => i.step === n).map((i) => <PlanCard key={i.id} i={i} onStatus={(s) => setStatus(i, s)} onDoc={setDoc} />)}
          </section>))}

      {other.length > 0 && <section className="card space-y-2" aria-labelledby="other-h">
        <h2 id="other-h" className="h2">{t('plan.other.t')}</h2><p className="text-sm text-muted">{t('plan.other.d')}</p>
        <ActionList actions={other} onStatus={setOther} />
      </section>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={() => go('employee')}><Icon name="employment" size={16} />{t('nav.employeeCheck')}</button>
        <button className="btn-ghost" onClick={() => go('documents')}><Icon name="documents" size={16} />{t('nav.documents')}</button>
        <button className="btn-ghost" onClick={() => go('analysis')}><Icon name="ai" size={16} />{t('plan.findings')}</button>
      </div>
      <Disclaimer />
    </div>
  )
}
