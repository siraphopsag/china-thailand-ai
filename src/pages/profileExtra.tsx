// The employer's shop or company and the job seeker's work history on the profile page, and what the other side sees (owner's
// blueprint, 27 Nov 2026). Data: profileStore.ts; rules: domain/profileExtra.ts.
import { useState } from 'react'
import { useI18n } from '../i18n'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { INDUSTRIES, type Industry } from '../domain/match/types'
import { MAX_ABOUT, MAX_JOBS, MAX_ROLE, MAX_SHOWCASE, SIZES, businessProblem, hasBusiness, hasWork, totalYears, workProblem, type Business, type Job, type Size, type Work } from '../domain/profileExtra'
import { useApplicantWork, useEmployerAbout, useMyBusiness, useMyWork } from '../profileStore'
import { useNames } from './match'

function Saved({ problem, done }: { problem: string | null; done: boolean }) {
  const { t } = useI18n()
  if (problem) return <p className="text-sm text-danger-fg" role="alert">{problem}</p>
  return done ? <p className="text-sm text-ok-fg flex items-center gap-1.5" role="status"><Icon name="ok" size={15} />{t('pe.saved')}</p> : null
}

/** the employer edits the shop or company description */
export function BusinessCard() {
  const { t } = useI18n()
  const N = useNames()
  const [saved, save, sync] = useMyBusiness()
  const [b, setB] = useState<Business | null>(null)
  const cur = b ?? saved
  const [err, setErr] = useState<string | null>(null), [done, setDone] = useState(false)
  const set = (p: Partial<Business>) => { setB({ ...cur, ...p }); setDone(false) }
  const submit = async () => {
    const p = businessProblem(cur); if (p) { setErr(t(p === 'contact' ? 'm.err.contact' : 'pe.err.length')); return }
    const s = await save(cur); setErr(s ? t(s === 'dbOld' ? 'sh.dbOld' : 'sh.network') : null); setDone(!s); if (!s) setB(null)
  }
  return (
    <section className="card space-y-3" aria-labelledby="pe-b-h">
      <h2 id="pe-b-h" className="h2 flex items-center gap-2"><Icon name="business" size={18} className="text-primary" />{t('pe.b.h')}</h2>
      <p className="text-xs text-muted">{t('pe.b.d')}</p>
      {sync && <Warn>{t(sync === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</Warn>}
      <div className="grid sm:grid-cols-3 gap-2 text-sm">
        <label className="space-y-1"><span className="font-medium">{t('pe.b.industry')}</span>
          <select className="input w-full" value={cur.industry} onChange={(e) => set({ industry: e.target.value as Industry | '' })}><option value="">—</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{N.industry(i)}</option>)}</select></label>
        <label className="space-y-1"><span className="font-medium">{t('pe.b.size')}</span>
          <select className="input w-full" value={cur.size} onChange={(e) => set({ size: e.target.value as Size | '' })}><option value="">—</option>{SIZES.map((s) => <option key={s} value={s}>{t('pe.b.people', { n: s })}</option>)}</select></label>
        <label className="space-y-1"><span className="font-medium">{t('pe.b.since')}</span>
          <input className="input w-full" inputMode="numeric" maxLength={4} value={cur.since ?? ''} onChange={(e) => { const n = Number(e.target.value); set({ since: e.target.value && Number.isInteger(n) ? n : null }) }} placeholder="2015" /></label>
      </div>
      <label className="block space-y-1 text-sm"><span className="font-medium">{t('pe.b.about')}</span>
        <textarea className="input w-full min-h-[80px]" maxLength={MAX_ABOUT} value={cur.about} onChange={(e) => set({ about: e.target.value })} placeholder={t('pe.b.aboutHint')} /></label>
      <div className="flex flex-wrap items-center justify-between gap-2"><Saved problem={err} done={done} />
        <button type="button" className="btn-primary ml-auto" disabled={!b} onClick={() => void submit()}>{t('pe.save')}</button></div>
    </section>
  )
}

/** the job seeker edits past work and what they can show */
export function WorkCard() {
  const { t } = useI18n()
  const N = useNames()
  const [saved, save, sync] = useMyWork()
  const [w, setW] = useState<Work | null>(null)
  const cur = w ?? saved
  const [err, setErr] = useState<string | null>(null), [done, setDone] = useState(false)
  const setJob = (i: number, p: Partial<Job>) => { setW({ ...cur, jobs: cur.jobs.map((j, k) => (k === i ? { ...j, ...p } : j)) }); setDone(false) }
  const submit = async () => {
    const clean = { ...cur, jobs: cur.jobs.filter((j) => j.role.trim()) }
    const p = workProblem(clean); if (p) { setErr(t(p === 'contact' ? 'm.err.contact' : 'pe.err.length')); return }
    const s = await save(clean); setErr(s ? t(s === 'dbOld' ? 'sh.dbOld' : 'sh.network') : null); setDone(!s); if (!s) setW(null)
  }
  return (
    <section className="card space-y-3" aria-labelledby="pe-w-h">
      <h2 id="pe-w-h" className="h2 flex items-center gap-2"><Icon name="employment" size={18} className="text-primary" />{t('pe.w.h')}</h2>
      <p className="text-xs text-muted">{t('pe.w.d')}</p>
      {sync && <Warn>{t(sync === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</Warn>}
      <ul className="space-y-2">{cur.jobs.map((j, i) => (
        <li key={i} className="grid sm:grid-cols-[1fr_7rem_6rem_auto] gap-2 items-end text-sm">
          <label className="space-y-1"><span className="font-medium">{t('pe.w.role')}</span><input className="input w-full" maxLength={MAX_ROLE} value={j.role} onChange={(e) => setJob(i, { role: e.target.value })} /></label>
          <label className="space-y-1"><span className="font-medium">{t('pe.w.country')}</span><select className="input w-full" value={j.country} onChange={(e) => setJob(i, { country: e.target.value === 'CN' ? 'CN' : 'TH' })}>{(['TH', 'CN'] as const).map((c) => <option key={c} value={c}>{N.country(c)}</option>)}</select></label>
          <label className="space-y-1"><span className="font-medium">{t('pe.w.years')}</span><input className="input w-full" type="number" min={0} max={50} step={0.5} value={j.years} onChange={(e) => setJob(i, { years: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} /></label>
          <button type="button" className="btn-ghost text-sm" aria-label={t('pe.w.remove', { n: j.role || i + 1 })} onClick={() => { setW({ ...cur, jobs: cur.jobs.filter((_, k) => k !== i) }); setDone(false) }}><Icon name="close" size={15} /></button>
        </li>))}</ul>
      {cur.jobs.length < MAX_JOBS && <button type="button" className="btn-soft text-sm" onClick={() => { setW({ ...cur, jobs: [...cur.jobs, { role: '', country: 'TH', years: 1, industry: '' }] }); setDone(false) }}><Icon name="plus" size={15} />{t('pe.w.add')}</button>}
      <label className="block space-y-1 text-sm"><span className="font-medium">{t('pe.w.showcase')}</span>
        <textarea className="input w-full min-h-[70px]" maxLength={MAX_SHOWCASE} value={cur.showcase} onChange={(e) => { setW({ ...cur, showcase: e.target.value }); setDone(false) }} placeholder={t('pe.w.showcaseHint')} /></label>
      <div className="flex flex-wrap items-center justify-between gap-2"><Saved problem={err} done={done} />
        <button type="button" className="btn-primary ml-auto" disabled={!w} onClick={() => void submit()}>{t('pe.save')}</button></div>
    </section>
  )
}

/** what job seekers see about an employer on a post */
export function EmployerAbout({ employerId }: { employerId: string }) {
  const { t } = useI18n()
  const N = useNames()
  const b = useEmployerAbout(employerId)
  if (!hasBusiness(b)) return null
  return (
    <div className="rounded-xl border border-line p-3 space-y-1 text-sm">
      <p className="font-semibold flex items-center gap-1.5"><Icon name="business" size={15} className="text-primary" />{t('pe.b.h')}</p>
      <p className="flex flex-wrap gap-1.5">{b.industry && <span className="chip bg-surface3 border-line text-xs">{N.industry(b.industry)}</span>}{b.size && <span className="chip bg-surface3 border-line text-xs">{t('pe.b.people', { n: b.size })}</span>}{b.since && <span className="chip bg-surface3 border-line text-xs">{t('pe.b.sinceN', { y: b.since })}</span>}</p>
      {b.about && <p className="text-muted whitespace-pre-wrap">{b.about}</p>}
    </div>
  )
}

/** what an employer sees about an applicant: past work in one line, the rest on demand */
export function ApplicantWork({ seekerId }: { seekerId: string }) {
  const { t } = useI18n()
  const N = useNames()
  const w = useApplicantWork(seekerId)
  if (!hasWork(w)) return null
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-primary">{t('pe.w.summary', { n: w.jobs.length, y: totalYears(w) })}</summary>
      <ul className="mt-1 space-y-0.5 pl-4 list-disc">{w.jobs.map((j, i) => <li key={i}>{j.role} · {N.country(j.country)} · {t('pe.w.yearsN', { n: j.years })}</li>)}</ul>
      {w.showcase && <p className="mt-1 text-muted whitespace-pre-wrap">{w.showcase}</p>}
    </details>
  )
}
