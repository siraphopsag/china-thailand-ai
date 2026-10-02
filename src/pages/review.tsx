import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { usePersona } from '../persona'
import { useJobBoard } from '../jobboardData'
import { stripSynthetic } from '../domain/jobboard/personas'
import { REVIEW_REASONS, type AuditEvent, type Job, type Organization, type ReviewReason } from '../domain/jobboard/types'
import type { Result } from '../domain/jobboard/repo'
import { PageHead, Warn } from '../components/ui'
import { FictionalTag, SimulationNotice } from '../components/jobboard'
import { Icon } from '../components/icons'
import { Chip, ConfirmDialog, DataBar, JobFacts, Outcome, REVIEW_TONE, RoleGate, VERIF_TONE, useLabels, useOutcome } from './jobboard'

/**
 * Simulated review workspace (/review) for the job-board PoC — separate from the legal-status page /admin.
 * Queues and history come only from the repository with the current persona's actor (the repository and policy decide);
 * decisions go only through reviewOrganization / reviewJob after an explicit confirmation with a predefined reason code.
 * No worker profiles or applications are read here. Client-side simulation: not a real admin system and not tamper-proof.
 */
type Decision = 'verify' | 'approve' | 'reject'
type Pending = { kind: 'org'; item: Organization; decision: 'verify' | 'reject' } | { kind: 'job'; item: Job; decision: 'approve' | 'reject' }
/** only the domain's predefined reason codes can be confirmed (never free text) */
export const isReviewReason = (v: unknown): v is ReviewReason => typeof v === 'string' && (REVIEW_REASONS as readonly string[]).includes(v)

export function ReviewPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-5 max-w-5xl">
      <PageHead title={t('rv.title')} sub={t('rv.sub')}>
        <NavLink to="jobs" className="btn-ghost text-sm">{t('jb.toJobs')}</NavLink>
        <NavLink to="" className="btn-ghost text-sm"><Icon name="home" size={16} />{t('rv.toLobby')}</NavLink>
      </PageHead>
      <SimulationNotice />
      <Warn>{t('rv.disclaimer')}</Warn>
      <DataBar />
      <RoleGate kind="admin" note={t('rv.gate')}><ReviewWorkspace /></RoleGate>
    </div>
  )
}

export function ReviewWorkspace() {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version, mutate } = useJobBoard()
  const { actor } = usePersona()
  const { out, report } = useOutcome()
  const [pending, setPending] = useState<Pending | null>(null)
  const [reason, setReason] = useState('')
  const busy = useRef(false) // one decision at a time: a second click before the first finished is ignored
  const queue = useMemo(() => repo.listReviewQueue(actor), [repo, version, actor])
  if (!queue.ok) return <Warn tone="danger">{t('rv.loadError')}</Warn>
  const { organizations, jobs } = queue.value
  const orgName = (id: string) => { const o = repo.getOrganization(actor, id); return o.ok ? o.value : null }

  const open = (p: Pending) => { setReason(''); setPending(p) }
  const close = () => setPending(null) // cancel / Escape: no repository call
  const confirm = () => {
    const p = pending
    if (!p || busy.current || !isReviewReason(reason)) return
    busy.current = true
    setPending(null)
    const r: Result<unknown> = p.kind === 'org' ? mutate((rp) => rp.reviewOrganization(actor, p.item.id, p.decision, reason)) : mutate((rp) => rp.reviewJob(actor, p.item.id, p.decision, reason))
    report(r, t(`rv.done.${p.kind}.${p.decision}` as never))
    busy.current = false
  }
  const name = pending ? stripSynthetic(pending.kind === 'org' ? pending.item.name : pending.item.title) : ''
  const buttons = (onVerify: () => void, onReject: () => void, verify: Decision) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-primary text-sm" onClick={onVerify}>{t(`rv.decision.${verify}` as never)}</button>
      <button type="button" className="btn-ghost text-sm" onClick={onReject}>{t('rv.decision.reject')}</button>
    </div>
  )
  return (
    <div className="space-y-6">
      <Outcome o={out} />
      <section className="space-y-3" aria-labelledby="rv-org-h">
        <h2 id="rv-org-h" className="h2">{t('rv.org.h')}</h2>
        {!organizations.length ? <div className="card text-muted">{t('rv.org.empty')}</div> : (
          <ul className="space-y-3">{organizations.map((o) => (
            <li key={o.id} className="card !p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{stripSynthetic(o.name)}</h3><FictionalTag /><Chip tone={VERIF_TONE[o.verification]}>{L.verif(o.verification)}</Chip></div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted">{t('jb.field.industry')}</dt><dd>{L.industry(o.industry)}</dd>
                <dt className="text-muted">{t('jb.field.province')}</dt><dd>{L.province(o.province)}</dd>
              </dl>
              <p className="text-xs text-muted">{t('rv.created', { d: L.date(o.createdAt) })}</p>
              {buttons(() => open({ kind: 'org', item: o, decision: 'verify' }), () => open({ kind: 'org', item: o, decision: 'reject' }), 'verify')}
            </li>))}</ul>)}
      </section>
      <section className="space-y-3" aria-labelledby="rv-job-h">
        <h2 id="rv-job-h" className="h2">{t('rv.job.h')}</h2>
        {!jobs.length ? <div className="card text-muted">{t('rv.job.empty')}</div> : (
          <ul className="space-y-3">{jobs.map((j) => {
            const o = orgName(j.organizationId)
            return (
              <li key={j.id} className="card !p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{stripSynthetic(j.title)}</h3><FictionalTag /><Chip tone={REVIEW_TONE[j.review]}>{L.review(j.review)}</Chip></div>
                <p className="text-sm text-muted flex flex-wrap items-center gap-2">{t('jb.field.org')}: {o ? stripSynthetic(o.name) : '—'}{o && <Chip tone={VERIF_TONE[o.verification]}>{L.verif(o.verification)}</Chip>}</p>
                <JobFacts job={j} />
                <p className="text-xs text-muted">{t('rv.updated', { d: L.date(j.updatedAt) })}</p>
                {buttons(() => open({ kind: 'job', item: j, decision: 'approve' }), () => open({ kind: 'job', item: j, decision: 'reject' }), 'approve')}
              </li>)
          })}</ul>)}
      </section>
      <AuditLog />
      <ConfirmDialog open={!!pending} title={pending ? t(`rv.dlg.${pending.decision}` as never) : ''} ok={pending ? t(`rv.decision.${pending.decision}` as never) : ''}
        body={pending ? t('rv.dlg.d', { name, decision: t(`rv.decision.${pending.decision}` as never) }) : ''} okDisabled={!isReviewReason(reason)} onClose={close} onConfirm={confirm}>
        <fieldset className="space-y-1">
          <legend className="label">{t('rv.reason')}</legend>
          {REVIEW_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm min-h-[32px]"><input type="radio" name="rv-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />{t(`rv.reason.${r}` as never)}</label>))}
          {!isReviewReason(reason) && <p className="text-xs text-muted">{t('rv.reasonNeeded')}</p>}
        </fieldset>
      </ConfirmDialog>
    </div>
  )
}

/** Read-only simulated history from listAuditEvents, newest first. No edit or delete controls exist. */
export function AuditLog() {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version } = useJobBoard()
  const { actor } = usePersona()
  const res = useMemo(() => repo.listAuditEvents(actor), [repo, version, actor])
  if (!res.ok) return null
  const events = [...res.value].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
  const target = (e: AuditEvent) => {
    if (e.target.type === 'organization') { const o = repo.getOrganization(actor, e.target.id); return o.ok ? stripSynthetic(o.value.name) : t('rv.audit.missing', { id: e.target.id }) }
    const j = repo.getJob(actor, e.target.id)
    return j.ok ? stripSynthetic(j.value.title) : t('rv.audit.missing', { id: e.target.id })
  }
  const state = (e: AuditEvent, v: string) => (e.target.type === 'organization' ? L.verif(v as Organization['verification']) : L.review(v as Job['review']))
  return (
    <section className="space-y-3" aria-labelledby="rv-audit-h">
      <div className="flex flex-wrap items-center gap-2"><h2 id="rv-audit-h" className="h2">{t('rv.audit.h')}</h2><FictionalTag /><span className="text-sm text-muted">{t('rv.audit.count', { n: events.length })}</span></div>
      <p className="text-sm text-muted">{t('rv.audit.d')}</p>
      {!events.length ? <div className="card text-muted">{t('rv.audit.empty')}</div> : (
        <ol className="space-y-2">{events.map((e) => (
          <li key={e.id} className="card !p-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
              <dt className="text-muted">{t('rv.audit.at')}</dt><dd><time dateTime={e.at}>{L.date(e.at)}</time></dd>
              <dt className="text-muted">{t('rv.audit.target')}</dt><dd><span className="font-semibold">{t(`rv.audit.action.${e.action}` as never)}</span> · {target(e)}</dd>
              <dt className="text-muted">{t('rv.audit.change')}</dt><dd>{state(e, e.from)} → {state(e, e.to)}</dd>
              <dt className="text-muted">{t('rv.audit.reason')}</dt><dd>{t(`rv.reason.${e.reason}` as never)}</dd>
              <dt className="text-muted">{t('rv.audit.by')}</dt><dd>{t('rv.audit.reviewer', { id: e.adminId })}</dd>
            </dl>
          </li>))}</ol>)}
    </section>
  )
}
