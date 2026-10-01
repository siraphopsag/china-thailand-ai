import { useMemo } from 'react'
import { go, useStore, DOC_STATES, type DocState } from '../store'
import { Icon } from './icons'
import { Go } from './ui'
import { contextFrom, requiredDocuments, requirementStatus, retrieveRequirements, stages } from '../services/compliance'
import { tk, useI18n } from '../i18n'

const docChip: Record<DocState, string> = {
  required: 'bg-surface3 text-muted border-line', have: 'bg-info-bg text-info-fg border-info-line', missing: 'bg-warn-bg text-warn-fg border-warn-line',
  verified: 'bg-ok-bg text-ok-fg border-ok-line', review: 'bg-danger-bg text-danger-fg border-danger-line',
}

/** Document Center: the documents the applicable requirements need, each with a status the user records (no file upload). */
export function RequiredDocs({ docStatus, onChange }: { docStatus: Record<string, DocState>; onChange: (id: string, s: DocState) => void }) {
  const { t, lang } = useI18n()
  const { profile, employeeCheck } = useStore()
  const docs = useMemo(() => (profile ? requiredDocuments(retrieveRequirements(contextFrom(profile, employeeCheck))) : []), [profile, employeeCheck])
  if (!profile) return null
  return (
    <section className="card space-y-3" aria-labelledby="reqdocs-h" lang={lang}>
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div><h2 id="reqdocs-h" className="h2">{t('dc.req.t')}</h2><p className="text-sm text-muted">{t('dc.req.d')}</p></div>
        <button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('navigator')}><Go>{t('kb.toNavigator')}</Go></button>
      </div>
      {!docs.length ? <p className="text-sm text-muted">{t('dc.req.none')}</p> : (
        <ul className="divide-y divide-line">{docs.map((d) => { const st = docStatus[d.id] ?? 'required'; return (
          <li key={d.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <div className="min-w-0 flex-1 basis-56"><div className="font-medium text-sm">{tk('kb.doc', d.id)}</div>
              <div className="text-xs text-muted">{t('dc.req.for')}: {d.requirementIds.map((r) => tk('kb.r', r + '.t')).join(' · ')}</div></div>
            <span className={`chip font-medium ${docChip[st]}`}>{tk('dc.s', st)}</span>
            <select aria-label={`${t('c.status')}: ${tk('kb.doc', d.id)}`} className="input !w-auto !py-1 !min-h-[36px] text-sm" value={st} onChange={(e) => onChange(d.id, e.target.value as DocState)}>
              {DOC_STATES.map((s) => <option key={s} value={s}>{tk('dc.s', s)}</option>)}</select>
          </li>) })}</ul>)}
    </section>
  )
}

/** User-facing processing stages + the requirement summary (no internal reasoning is shown). */
export function StagesPanel({ missing, risks, actions }: { missing: number; risks: number; actions: number }) {
  const { t, lang } = useI18n()
  const { profile, employeeCheck } = useStore()
  const reqs = useMemo(() => (profile ? retrieveRequirements(contextFrom(profile, employeeCheck)) : []), [profile, employeeCheck])
  if (!profile) return null
  const lines = stages(profile, reqs, missing, risks, actions, lang)
  const verified = reqs.filter((r) => requirementStatus(r) === 'ACTIVE').length
  return (
    <section className="card space-y-3" aria-labelledby="stages-h">
      <h2 id="stages-h" className="h2">{t('st.title')}</h2>
      <ol className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">{lines.map((l, i) => <li key={i} className="flex items-start gap-2"><Icon name="ok" size={16} className="text-ok-fg mt-0.5 shrink-0" />{l}</li>)}</ol>
      <p className="text-xs text-muted">{t('nv.count', { n: reqs.length, v: verified, u: reqs.length - verified })} · {t('nv.legend')}</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary !min-h-[40px] text-sm" onClick={() => go('navigator')}><Icon name="documents" size={16} />{t('nav.navigator')}</button>
        <button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('employee')}><Icon name="employment" size={16} />{t('nav.employeeCheck')}</button>
      </div>
    </section>
  )
}
