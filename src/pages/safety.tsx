// Staying safe from job scams (owner, Oct 2026): a page under "Prepare", short warnings where the risk is highest (applying,
// documents, departure), and the report dialog for a suspicious post. Links open official websites only.
import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason } from '../domain/match/reports'
import { Icon } from '../components/icons'
import { Modal } from '../components/modal'
import { Warn } from '../components/ui'
import { Page, useNames } from './match'

const DOE = 'https://www.doe.go.th/'
const FLAGS = ['1', '2', '3', '4', '5', '6', '7'] as const
const STEPS = ['1', '2', '3', '4'] as const

export function SafetyPage() {
  const { t } = useI18n()
  return (
    <Page title={t('m.sc.title')} sub={t('m.sc.sub')}>
      <Warn tone="danger">{t('m.sc.key')}</Warn>
      <section className="card space-y-3" aria-labelledby="sc-flags">
        <h2 id="sc-flags" className="h2">{t('m.sc.flags')}</h2>
        <ul className="space-y-2 text-sm">{FLAGS.map((k) => (
          <li key={k} className="flex items-start gap-2"><Icon name="warn" size={16} className="text-warn-fg mt-0.5 shrink-0" /><span><b>{t(`m.sc.f${k}.h` as never)}</b> — {t(`m.sc.f${k}.t` as never)}</span></li>))}</ul>
      </section>
      <section className="card space-y-3" aria-labelledby="sc-do">
        <h2 id="sc-do" className="h2">{t('m.sc.do')}</h2>
        <ol className="space-y-2 text-sm list-decimal pl-5">{STEPS.map((k) => <li key={k}>{t(`m.sc.d${k}` as never)}</li>)}</ol>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a className="text-primary underline inline-flex items-center gap-1 min-h-[24px]" href={DOE} target="_blank" rel="noopener noreferrer">{t('m.agency.doe')}<Icon name="external" size={13} /></a>
          <a className="text-primary underline inline-flex items-center gap-1 min-h-[24px]" href="tel:1694">{t('m.sc.call')}</a>
        </div>
      </section>
      <section className="glass-card p-5 space-y-2 text-sm" aria-labelledby="sc-emp">
        <h2 id="sc-emp" className="h2">{t('m.sc.emp.h')}</h2>
        <p className="text-muted">{t('m.sc.emp.t')}</p>
        <NavLink to="terms" className="text-primary underline underline-offset-4 inline-flex items-center min-h-[24px]">{t('m.tm.title')}</NavLink>
      </section>
    </Page>
  )
}

/** a short warning where the risk is highest */
export function ScamNote({ where }: { where: 'apply' | 'documents' | 'departure' }) {
  const { t } = useI18n()
  return (
    <Warn>{t(`m.sc.note.${where}` as never)} <NavLink to="safety" className="underline underline-offset-4 font-medium">{t('m.sc.more')}</NavLink></Warn>
  )
}

/** report a suspicious post: a reason, an optional note only administrators read */
export function ReportButton({ postId }: { postId: string }) {
  const { t } = useI18n()
  const N = useNames()
  const { st, report } = useMatch()
  const [open, setOpen] = useState(false), [reason, setReason] = useState<ReportReason | null>(null), [note, setNote] = useState('')
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(false)
  if (st.reports.some((r) => r.postId === postId)) return <p role="status" className="text-sm text-muted flex items-start gap-1.5"><Icon name="ok" size={15} className="text-ok-fg mt-0.5" />{t(done ? 'm.rpt.done' : 'm.rpt.already')}</p>
  const close = () => { setOpen(false); setErr('') }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason) { setErr(t('m.rpt.pick')); return }
    setBusy(true); const r = await report(postId, reason, note); setBusy(false)
    if (r.ok) { setDone(true); setOpen(false); setReason(null); setNote(''); return }
    setErr(N.problem(r.problem))
  }
  return (<>
    <button type="button" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-danger-fg underline underline-offset-4 min-h-[24px]" onClick={() => setOpen(true)}><Icon name="alert" size={15} />{t('m.rpt.button')}</button>
    <Modal open={open} onClose={close} wide>{(titleId) => (
      <form className="p-5 sm:p-6 space-y-4" onSubmit={submit} noValidate>
        <h2 id={titleId} className="h2">{t('m.rpt.title')}</h2>
        <p className="text-sm text-muted">{t('m.rpt.lead')}</p>
        <fieldset aria-describedby={err ? 'rp-err' : undefined}><legend className="label">{t('m.rpt.reason')}</legend>
          <div className="space-y-1.5">{REPORT_REASONS.map((k) => (
            <label key={k} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer text-sm ${reason === k ? 'border-primary bg-brand text-brandfg' : 'border-control hover:bg-surface3'}`}>
              <input type="radio" name="rp-reason" className="mt-1" checked={reason === k} onChange={() => { setReason(k); setErr('') }} />
              <span><span className="font-medium block">{t(`m.rpt.r.${k}` as never)}</span><span className="text-xs opacity-80">{t(`m.rpt.r.${k}.d` as never)}</span></span>
            </label>))}</div></fieldset>
        <div><label className="block"><span className="label">{t('m.rpt.note')} <span className="font-normal text-muted">({t('m.opt')})</span></span>
          <textarea className="input min-h-[80px]" maxLength={REPORT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="rp-note-hint" /></label>
          <span id="rp-note-hint" className="block text-xs text-muted mt-1">{t('m.rpt.noteHint', { n: REPORT_NOTE_MAX })}</span></div>
        {err && <p id="rp-err" role="alert" className="text-sm text-danger-fg">{err}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={close}>{t('m.ask.no')}</button>
          <button type="submit" className="btn-primary" disabled={busy}><Icon name="send" size={16} />{busy ? t('m.ask.busy') : t('m.rpt.send')}</button>
        </div>
      </form>)}</Modal>
  </>)
}
