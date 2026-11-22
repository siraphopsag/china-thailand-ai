// v2 model (owner, Nov 2026) parts of the case page: arrival confirmed by both sides (with the alert when one side is late) and
// the worker's document scans, kept on the worker's own device.
import { useState, type ChangeEvent } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { localDay } from '../domain/match/logic'
import { DOCS, arrivalAlert, arrivalPending, type Case, type CaseAction, type Doc } from '../domain/match/cases'
import { attachFile, caseFiles, previewOf, removeFile, type CaseFile } from '../caseFiles'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { useNames } from './match'

/** the two arrival confirmations, the worker's button and the alert */
export function ArrivalBox({ c, isSeeker, run, busy, ask }: { c: Case; isSeeker: boolean; run: (a: CaseAction, done?: string) => Promise<boolean>; busy: boolean; ask: (q: string, o: { yes: string }) => Promise<boolean> }) {
  const { t } = useI18n()
  const N = useNames()
  const { now } = useMatch()
  if (!c.steps.departure) return null
  const pending = arrivalPending(c)
  const alert = arrivalAlert(c, localDay(new Date(now).toISOString()))
  const confirm = async () => { if (await ask(t('ar.seeker.ask'), { yes: t('ar.seeker.yes') })) void run({ kind: 'seekerArrived' }, t('ar.seeker.done')) }
  return (
    <div className="space-y-2 border-t border-line pt-2" aria-labelledby="ar-h">
      <h3 id="ar-h" className="font-semibold text-sm">{t('ar.h')}</h3>
      <ul className="text-sm space-y-1">
        <li className={`flex items-center gap-2 ${c.seekerArrived ? 'text-ok-fg' : 'text-muted'}`}><Icon name={c.seekerArrived ? 'squareCheck' : 'square'} size={16} />{c.seekerArrived ? t('ar.seeker.on', { d: N.dayTime(Date.parse(c.seekerArrived)) }) : t('ar.seeker.wait')}</li>
        <li className={`flex items-center gap-2 ${c.steps.arrived ? 'text-ok-fg' : 'text-muted'}`}><Icon name={c.steps.arrived ? 'squareCheck' : 'square'} size={16} />{c.steps.arrived ? t('ar.employer.on', { d: N.dayTime(Date.parse(c.steps.arrived)) }) : t('ar.employer.wait')}</li>
      </ul>
      {!pending && <p className="text-sm font-medium text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('ar.both')}</p>}
      {alert && <Warn tone="danger"><b>{t('ar.alert.h')}</b> {t(`ar.alert.${alert}` as never)} {isSeeker && <NavLink to="sos" className="underline underline-offset-4 font-medium">{t('hp.open')}</NavLink>}</Warn>}
      {isSeeker && !c.seekerArrived && <button type="button" className="btn-primary" disabled={busy} onClick={confirm}><Icon name="ok" size={16} />{busy ? t('m.ask.busy') : t('ar.seeker.yes')}</button>}
    </div>
  )
}

/** the worker attaches a scan or photo of each document; it stays on this device (only the name is remembered) */
export function DocAttach({ c }: { c: Case }) {
  const { t } = useI18n()
  const N = useNames()
  const { now } = useMatch()
  const [files, setFiles] = useState(() => caseFiles(c.id))
  const [err, setErr] = useState<string | null>(null)
  const pick = (doc: Doc) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const p = attachFile(c.id, doc, f, new Date(now).toISOString())
    setErr(p ? t(`att.err.${p}` as never) : null); setFiles(caseFiles(c.id))
  }
  const drop = (doc: Doc) => { removeFile(c.id, doc); setFiles(caseFiles(c.id)) }
  const size = (f: CaseFile) => `${Math.max(1, Math.round(f.size / 1024))} KB`
  return (
    <section className="card !p-4 space-y-2.5" aria-labelledby="att-h">
      <h2 id="att-h" className="h2">{t('att.h')}</h2>
      <p className="text-xs text-muted">{t('att.note')}</p>
      <ul className="space-y-2">{DOCS.map((d) => {
        const f = files[d], url = previewOf(c.id, d)
        return (
          <li key={d} className="flex flex-wrap items-center gap-2 text-sm">
            <Icon name={f ? 'squareCheck' : 'square'} size={16} className={f ? 'text-ok-fg' : 'text-muted'} />
            <span className="font-medium min-w-[7rem]">{t(`m.cs.doc.${d}` as never)}</span>
            {f ? <span className="text-xs text-muted flex-1 min-w-0 truncate">{f.name} · {size(f)} · {N.dayTime(Date.parse(f.at))}{url && <> · <a className="text-primary underline" href={url} target="_blank" rel="noopener noreferrer">{t('att.view')}</a></>}</span>
              : <span className="text-xs text-muted flex-1">{t('att.none')}</span>}
            <label className="btn-ghost text-xs cursor-pointer">{t(f ? 'att.replace' : 'att.add')}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pick(d)} /></label>
            {f && <button type="button" className="btn-ghost text-xs" onClick={() => drop(d)}>{t('att.remove')}</button>}
          </li>)
      })}</ul>
      {err && <p className="text-sm text-danger-fg" role="alert">{err}</p>}
    </section>
  )
}
