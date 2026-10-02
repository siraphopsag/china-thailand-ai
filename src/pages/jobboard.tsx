import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { LANGS as UI_LANGS, useI18n } from '../i18n'
import { go, NavLink, useSearchParam } from '../store'
import { usePersona } from '../persona'
import { useJobBoard } from '../jobboardData'
import { PERSONAS, entryFor, stripSynthetic } from '../domain/jobboard/personas'
import { can } from '../domain/jobboard/policy'
import { isId } from '../domain/jobboard/validate'
import { EDUCATION, INDUSTRIES, LANG_LEVELS, LANGS, SKILLS, TRANSITIONS, type ActorKind, type Application, type ApplicationStatus, type Job, type JobReview, type LanguageSkill, type Organization, type OrgVerification, type Skill, type StatusEvent, type WorkerProfile } from '../domain/jobboard/types'
import type { JobInput, RepoErrorCode, Result } from '../domain/jobboard/repo'
import { provinces } from '../locales/provinces'
import { PageHead, TabBar, Warn } from '../components/ui'
import { FictionalTag, SimulationNotice } from '../components/jobboard'
import { Icon } from '../components/icons'

/**
 * Job-board PoC pages (/jobs for workers, /employer for employers). Every read and change goes through the shared JobBoardRepo
 * with the current persona's actor; the repository and policy decide what is allowed. All records are synthetic, nothing leaves
 * the browser, and these screens never represent a real job, application, hiring decision, visa or permit.
 */

/* ---------------- shared helpers ---------------- */
const CN_PROVINCES = Object.keys(provinces).filter((k) => k.startsWith('prov.CN-')).map((k) => k.slice(5))
type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'muted'
const TONE: Record<Tone, string> = { ok: 'bg-ok-bg text-ok-fg border-ok-line', warn: 'bg-warn-bg text-warn-fg border-warn-line', danger: 'bg-danger-bg text-danger-fg border-danger-line', info: 'bg-info-bg text-info-fg border-info-line', muted: 'bg-surface3 text-muted border-line' }
export const Chip = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`chip ${TONE[tone]}`}>{children}</span>
export const REVIEW_TONE: Record<JobReview, Tone> = { draft: 'muted', pending_review: 'warn', approved: 'ok', rejected: 'danger', closed: 'muted' }
export const VERIF_TONE: Record<OrgVerification, Tone> = { unverified: 'muted', pending: 'warn', verified: 'ok', rejected: 'danger' }
const STATUS_TONE: Record<ApplicationStatus, Tone> = { submitted: 'info', under_review: 'info', shortlisted: 'ok', not_selected: 'muted', withdrawn: 'muted', closed: 'muted' }

export function useLabels() {
  const { t, lang } = useI18n()
  const fmt = new Intl.DateTimeFormat(UI_LANGS.find((l) => l.id === lang)!.html, { dateStyle: 'medium', timeStyle: 'short' })
  return {
    skill: (s: Skill) => t(`jb.skill.${s}` as never), industry: (s: string) => t(`jb.industry.${s}` as never), province: (c: string) => t(`prov.${c}` as never),
    review: (s: JobReview) => t(`jb.review.${s}` as never), verif: (s: OrgVerification) => t(`jb.verif.${s}` as never), status: (s: ApplicationStatus) => t(`jb.status.${s}` as never),
    date: (iso: string) => fmt.format(new Date(iso)),
  }
}
/** Repository errors in plain words. Reasons never reveal whether another person's record exists. */
export function useErrorText() {
  const { t } = useI18n()
  return (r: { error: RepoErrorCode; reason: string }) => {
    if (r.error === 'unauthorized') return t('jb.err.unauthorized')
    if (r.error === 'not_found') return t('jb.err.notFound')
    if (r.reason === 'already applied') return t('jb.err.duplicate')
    if (r.reason === 'job is not open') return t('jb.err.notOpen')
    if (r.reason === 'confirmation required') return t('jb.err.confirm')
    if (r.reason.startsWith('transition')) return t('jb.err.transition')
    if (r.reason.endsWith(': contact')) return t('jb.err.contact')
    if (r.reason.endsWith(': length')) return t('jb.err.length')
    return t('jb.err.invalid')
  }
}
type Msg = { tone: 'info' | 'danger'; text: string } | null
type OutcomeState = { msg: Msg; at: React.RefObject<HTMLDivElement | null> }
/**
 * Live region for the outcome of the last action. Focus moves to it after each action, because the control that was used
 * (Apply, Withdraw, a status button) often disappears once the action succeeds.
 */
export const Outcome = ({ o }: { o: OutcomeState }) => <div ref={o.at} tabIndex={-1} role="status" aria-live="polite" className="outline-none">{o.msg && <Warn tone={o.msg.tone}>{o.msg.text}</Warn>}</div>
export function useOutcome() {
  const err = useErrorText()
  const [msg, setMsg] = useState<Msg>(null)
  const at = useRef<HTMLDivElement>(null)
  /** report a mutation result: the given success text, or the localized error */
  const report = <T,>(r: Result<T>, ok: string) => { setMsg(r.ok ? { tone: 'info', text: ok } : { tone: 'danger', text: err(r) }); setTimeout(() => at.current?.focus(), 0); return r }
  return { out: { msg, at } as OutcomeState, report }
}

/** Native modal dialog: focus moves into it, Escape closes it and focus returns to the control that opened it. */
export function ConfirmDialog({ open, title, body, ok, onConfirm, onClose, children, okDisabled = false }: { open: boolean; title: string; body: string; ok: string; onConfirm: () => void; onClose: () => void; children?: ReactNode; okDisabled?: boolean }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  // Escape closes a modal <dialog> natively. In manual testing the browser sent `cancel` but no `close` event, so the parent's
  // state stayed "open" and the dialog could not be opened again. Handle `cancel` (Escape) and `close` directly: the parent's
  // state then closes the dialog, and Escape never runs onConfirm.
  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onCancel = (e: Event) => { e.preventDefault(); closeRef.current() }
    const onNativeClose = () => closeRef.current()
    d.addEventListener('cancel', onCancel)
    d.addEventListener('close', onNativeClose)
    return () => { d.removeEventListener('cancel', onCancel); d.removeEventListener('close', onNativeClose) }
  }, [])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="!m-auto rounded-2xl border border-line bg-surface text-ink p-0 w-[calc(100%-2rem)] max-w-md backdrop:bg-black/50">
      <div className="p-5 space-y-3">
        <h2 id={`${id}-t`} className="h2">{title}</h2>
        <p id={`${id}-d`} className="text-sm">{body}</p>
        {children}
        <div className="flex flex-wrap justify-end gap-2 pt-1"><button type="button" className="btn-ghost" onClick={onClose}>{t('jb.cancel')}</button><button type="button" className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed" disabled={okDisabled} onClick={onConfirm}>{ok}</button></div>
      </div>
    </dialog>
  )
}

/** A section that only makes sense for one role: otherwise explain and offer the matching sample persona. */
export function RoleGate({ kind, children, note }: { kind: Exclude<ActorKind, 'visitor'>; children: ReactNode; note?: string }) {
  const { t } = useI18n()
  const { persona, select } = usePersona()
  const role = t(`persona.role.${kind}` as never)
  if (persona.kind === kind) return <>{children}</>
  // the role's first seeded persona (the same one the Lobby entries use for worker and employer); choosing it changes no records
  const target = PERSONAS.find((p) => p.kind === kind)!
  return (
    <div className="card space-y-2">
      <p>{t('jb.wrongRole', { role })}</p>
      {note && <p className="text-sm text-muted">{note}</p>}
      <button type="button" className="btn-primary" onClick={() => select(target.key)}>{t('jb.switchTo', { role })}</button>
      <p className="text-xs text-muted">{t('persona.note')}</p>
    </div>
  )
}

/** Recovery notice and the demo reset control (client-side demo maintenance, not an admin action). */
export function DataBar() {
  const { t } = useI18n()
  const { recovered, dismissRecovered, resetData } = useJobBoard()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <div className="space-y-2">
      {recovered && <Warn><span>{t('jb.data.recovered')}</span> <button type="button" className="underline font-semibold" onClick={dismissRecovered}>{t('jb.data.dismiss')}</button></Warn>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>{t('jb.data.note')}</span>
        <button type="button" className="underline underline-offset-2 inline-flex items-center min-h-[24px] text-primary" onClick={() => { setDone(false); setOpen(true) }}>{t('jb.data.reset')}</button>
        <span role="status">{done && t('jb.data.done')}</span>
      </div>
      <ConfirmDialog open={open} title={t('jb.data.dlg.t')} body={t('jb.data.dlg.d')} ok={t('jb.data.dlg.ok')} onClose={() => setOpen(false)} onConfirm={() => { resetData(); setOpen(false); setDone(true) }} />
    </div>
  )
}

function Timeline({ events }: { events: StatusEvent[] }) {
  const { t } = useI18n()
  const L = useLabels()
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at))
  return (
    <div><h4 className="text-sm font-semibold">{t('jb.apps.timeline')}</h4>
      <ol className="mt-1 border-l-2 border-line ml-1.5 space-y-1.5">{sorted.map((e) => (
        <li key={e.id} className="pl-3 text-sm relative"><span aria-hidden className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-primary" />
          <time dateTime={e.at} className="text-xs text-muted block">{L.date(e.at)}</time>{t('jb.apps.event', { s: L.status(e.to), by: t(`jb.by.${e.by}` as never) })}</li>))}</ol>
    </div>
  )
}
export function JobFacts({ job }: { job: Job }) {
  const { t } = useI18n()
  const L = useLabels()
  const rows: [string, ReactNode][] = [
    [t('jb.field.province'), L.province(job.province)], [t('jb.field.industry'), L.industry(job.industry)],
    [t('jb.field.skills'), job.skills.map(L.skill).join(', ')], [t('jb.field.minYears'), t('jb.years', { n: job.minYears })], [t('jb.field.contract'), t('jb.months', { n: job.contractMonths })],
  ]
  return <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>)}</dl>
}

/* ---------------- worker: /jobs ---------------- */
type WorkerTab = 'list' | 'profile' | 'applications'
export function JobsPage() {
  const { t } = useI18n()
  const jobParam = useSearchParam('job')
  const view = useSearchParam('view')
  const tab: WorkerTab = view === 'profile' || view === 'applications' ? view : 'list'
  const tabs: { id: WorkerTab; label: string }[] = [{ id: 'list', label: t('jb.tab.list') }, { id: 'profile', label: t('jb.tab.profile') }, { id: 'applications', label: t('jb.tab.apps') }]
  return (
    <div className="space-y-5 max-w-5xl">
      <PageHead title={t('jb.jobs.title')} sub={t('jb.jobs.sub')}><NavLink to="employer" className="btn-ghost text-sm">{t('jb.toEmployer')}</NavLink></PageHead>
      <SimulationNotice compact />
      <DataBar />
      {jobParam ? <JobDetail id={jobParam} /> : <>
        <TabBar label={t('jb.tabs')} value={tab} items={tabs} onChange={(id) => go(id === 'list' ? 'jobs' : `jobs?view=${id}`)} />
        {tab === 'list' && <JobList />}
        {tab === 'profile' && <RoleGate kind="worker"><WorkerProfileView /></RoleGate>}
        {tab === 'applications' && <RoleGate kind="worker"><MyApplications /></RoleGate>}
      </>}
    </div>
  )
}

export function JobList() {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version } = useJobBoard()
  const { actor } = usePersona()
  const res = useMemo(() => repo.listJobs(actor), [repo, version, actor]) // `version` re-reads after every successful change
  const [q, setQ] = useState(''), [prov, setProv] = useState(''), [ind, setInd] = useState(''), [skill, setSkill] = useState('')
  if (!res.ok) return <Warn tone="danger">{t('jb.loadError')}</Warn>
  const jobs = res.value
  const orgName = (id: string) => { const o = repo.getOrganization(actor, id); return o.ok ? stripSynthetic(o.value.name) : '—' }
  const shown = jobs.filter((j) => (!q.trim() || stripSynthetic(j.title).toLowerCase().includes(q.trim().toLowerCase())) && (!prov || j.province === prov) && (!ind || j.industry === ind) && (!skill || j.skills.includes(skill as Skill)))
  const opts = <T extends string,>(vals: T[], label: (v: T) => string) => [...new Set(vals)].sort().map((v) => <option key={v} value={v}>{label(v)}</option>)
  const filtered = q || prov || ind || skill
  if (!jobs.length) return <div className="card text-muted">{t('jb.empty')}</div>
  return (
    <section className="space-y-3" aria-label={t('jb.tab.list')}>
      <div className="card !p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block text-sm"><span className="label">{t('jb.search')}</span><input type="search" className="input" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="block text-sm"><span className="label">{t('jb.f.province')}</span><select className="input" value={prov} onChange={(e) => setProv(e.target.value)}><option value="">{t('jb.f.all')}</option>{opts(jobs.map((j) => j.province), L.province)}</select></label>
        <label className="block text-sm"><span className="label">{t('jb.f.industry')}</span><select className="input" value={ind} onChange={(e) => setInd(e.target.value)}><option value="">{t('jb.f.all')}</option>{opts(jobs.map((j) => j.industry), L.industry)}</select></label>
        <label className="block text-sm"><span className="label">{t('jb.f.skill')}</span><select className="input" value={skill} onChange={(e) => setSkill(e.target.value)}><option value="">{t('jb.f.all')}</option>{opts(jobs.flatMap((j) => j.skills), L.skill)}</select></label>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><p role="status" className="font-semibold">{t('jb.count', { n: shown.length })}</p>
        {filtered && <button type="button" className="underline text-primary inline-flex items-center min-h-[24px]" onClick={() => { setQ(''); setProv(''); setInd(''); setSkill('') }}>{t('jb.f.clear')}</button>}</div>
      {!shown.length ? <div className="card text-muted">{t('jb.noResults')}</div> : (
        <ul className="grid md:grid-cols-2 gap-3">{shown.map((j) => (
          <li key={j.id} className="card !p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-lg">{stripSynthetic(j.title)}</h3><FictionalTag /><Chip tone={REVIEW_TONE[j.review]}>{L.review(j.review)}</Chip></div>
            <p className="text-sm text-muted">{t('jb.field.org')}: {orgName(j.organizationId)}</p>
            <JobFacts job={j} />
            <NavLink to={`jobs?job=${j.id}`} className="btn-ghost text-sm inline-flex">{t('jb.open')}<Icon name="next" size={16} /></NavLink>
          </li>))}</ul>)}
    </section>
  )
}

export function JobDetail({ id }: { id: string }) {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version } = useJobBoard()
  const { actor } = usePersona()
  const head = useRef<HTMLHeadingElement>(null)
  useEffect(() => { head.current?.focus() }, [id])
  const res = useMemo(() => (isId('job', id) ? repo.getJob(actor, id) : null), [repo, version, actor, id])
  const back = <NavLink to="jobs" className="btn-ghost text-sm inline-flex"><Icon name="back" size={16} />{t('jb.backList')}</NavLink>
  if (!res || !res.ok) {
    const text = !res || res.error === 'invalid' ? t('jb.detail.invalid') : res.error === 'not_found' ? t('jb.detail.notFound') : t('jb.detail.denied')
    return <section className="space-y-3"><h2 ref={head} tabIndex={-1} className="h2 outline-none">{text}</h2>{back}</section>
  }
  const job = res.value
  const org = repo.getOrganization(actor, job.organizationId)
  return (
    <section className="space-y-4" aria-labelledby="jb-detail-h">
      {back}
      <article className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h2 id="jb-detail-h" ref={head} tabIndex={-1} className="h2 outline-none">{stripSynthetic(job.title)}</h2><FictionalTag /><Chip tone={REVIEW_TONE[job.review]}>{L.review(job.review)}</Chip></div>
        <p className="text-sm text-muted">{t('jb.field.org')}: {org.ok ? stripSynthetic(org.value.name) : '—'}</p>
        <JobFacts job={job} />
      </article>
      <ApplyBox job={job} />
    </section>
  )
}

function ApplyBox({ job }: { job: Job }) {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version, mutate } = useJobBoard()
  const { actor, select } = usePersona()
  const { out, report } = useOutcome()
  const [open, setOpen] = useState(false)
  const mine = useMemo(() => { const r = repo.listApplications(actor, job.id); return r.ok ? r.value[0] : undefined }, [repo, version, actor, job.id])
  let body: ReactNode
  if (actor.kind !== 'worker') body = <><p>{t('jb.apply.asWorker')}</p><button type="button" className="btn-ghost" onClick={() => select(entryFor('worker').key)}>{t('jb.switchTo', { role: t('persona.role.worker') })}</button></>
  else if (mine) body = <><p>{t('jb.apply.already', { s: L.status(mine.status) })}</p><NavLink to="jobs?view=applications" className="btn-ghost inline-flex">{t('jb.apply.viewApps')}</NavLink></>
  else if (job.review !== 'approved') body = <p>{t('jb.detail.closed')}</p>
  else body = <button type="button" className="btn-primary" onClick={() => setOpen(true)}>{t('jb.apply')}</button>
  return (
    <div className="card space-y-2">
      <div className="flex flex-wrap items-center gap-2">{body}</div>
      <Outcome o={out} />
      {/* the application is created only here, after the worker confirms; `confirmed: true` is what the repository requires */}
      <ConfirmDialog open={open} title={t('jb.apply.dlg.t')} body={t('jb.apply.dlg.d')} ok={t('jb.apply.dlg.ok')} onClose={() => setOpen(false)}
        onConfirm={() => { setOpen(false); const r = mutate((rp) => rp.submitApplication(actor, { jobId: job.id, confirmed: true })); report(r, r.ok ? t('jb.apply.done', { s: L.status(r.value.status) }) : '') }} />
    </div>
  )
}

export function WorkerProfileView() {
  const { t } = useI18n()
  const { repo, version } = useJobBoard()
  const { actor } = usePersona()
  const res = useMemo(() => (actor.kind === 'worker' ? repo.getWorker(actor, actor.workerId) : null), [repo, version, actor])
  if (!res) return null
  if (!res.ok) return <Warn tone="danger">{t('jb.err.unauthorized')}</Warn>
  return <ProfileForm key={`${res.value.id}:${version}`} worker={res.value} />
}
function ProfileForm({ worker }: { worker: WorkerProfile }) {
  const { t } = useI18n()
  const L = useLabels()
  const { mutate } = useJobBoard()
  const { actor } = usePersona()
  const { out, report } = useOutcome()
  const [headline, setHeadline] = useState(worker.headline)
  const [years, setYears] = useState(String(worker.yearsExperience))
  const [education, setEducation] = useState(worker.education)
  const [skills, setSkills] = useState<Skill[]>(worker.skills)
  const [langs, setLangs] = useState<Record<string, string>>(Object.fromEntries(worker.languages.map((l) => [l.lang, l.level])))
  const [provs, setProvs] = useState<string[]>(worker.preferredProvinces)
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const save = (e: FormEvent) => {
    e.preventDefault()
    const languages = LANGS.filter((l) => langs[l]).map((l) => ({ lang: l, level: langs[l] }) as LanguageSkill)
    report(mutate((rp) => rp.updateWorker(actor, worker.id, { headline, yearsExperience: Number(years), education, skills, languages, preferredProvinces: provs })), t('jb.saved'))
  }
  return (
    <form className="card space-y-4" onSubmit={save} aria-labelledby="jb-prof-h">
      <div className="flex flex-wrap items-center gap-2"><h2 id="jb-prof-h" className="h2">{t('jb.prof.t')}: {stripSynthetic(worker.displayName)}</h2><FictionalTag /></div>
      <Warn tone="info">{t('jb.prof.hint')}</Warn>
      <label className="block"><span className="label">{t('jb.prof.headline')}</span><input className="input" value={headline} maxLength={120} onChange={(e) => setHeadline(e.target.value)} /></label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="label">{t('jb.prof.years')}</span><input type="number" className="input" min={0} max={50} step={1} value={years} onChange={(e) => setYears(e.target.value)} /></label>
        <label className="block"><span className="label">{t('jb.prof.edu')}</span><select className="input" value={education} onChange={(e) => setEducation(e.target.value as typeof education)}>{EDUCATION.map((x) => <option key={x} value={x}>{t(`jb.edu.${x}` as never)}</option>)}</select></label>
      </div>
      <fieldset><legend className="label">{t('jb.prof.langs')}</legend>
        <div className="grid sm:grid-cols-3 gap-3">{LANGS.map((l) => (
          <label key={l} className="block text-sm"><span className="block mb-1">{t(`jb.lang.${l}` as never)}</span>
            <select className="input" value={langs[l] ?? ''} onChange={(e) => setLangs({ ...langs, [l]: e.target.value })}><option value="">{t('jb.level.none')}</option>{LANG_LEVELS.map((v) => <option key={v} value={v}>{t(`jb.level.${v}` as never)}</option>)}</select></label>))}</div>
      </fieldset>
      <fieldset><legend className="label">{t('jb.prof.skills')}</legend>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1">{SKILLS.map((s) => <label key={s} className="flex items-center gap-2 text-sm min-h-[32px]"><input type="checkbox" checked={skills.includes(s)} onChange={() => setSkills(toggle(skills, s))} />{L.skill(s)}</label>)}</div>
      </fieldset>
      <fieldset><legend className="label">{t('jb.prof.provinces')}</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 max-h-56 overflow-auto">{CN_PROVINCES.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm min-h-[32px]"><input type="checkbox" checked={provs.includes(c)} disabled={!provs.includes(c) && provs.length >= 5} onChange={() => setProvs(toggle(provs, c))} />{L.province(c)}</label>))}</div>
      </fieldset>
      <p className="text-xs text-muted">{t('jb.prof.updated', { d: L.date(worker.updatedAt) })}</p>
      <button type="submit" className="btn-primary">{t('jb.save')}</button>
      <Outcome o={out} />
    </form>
  )
}

export function MyApplications() {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version, mutate } = useJobBoard()
  const { actor } = usePersona()
  const { out, report } = useOutcome()
  const [target, setTarget] = useState<Application | null>(null)
  const res = useMemo(() => repo.listApplications(actor), [repo, version, actor])
  if (!res.ok) return <Warn tone="danger">{t('jb.err.unauthorized')}</Warn>
  const apps = [...res.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <section className="space-y-3" aria-label={t('jb.tab.apps')}>
      <p className="text-sm text-muted">{t('jb.apps.sim')}</p>
      <Outcome o={out} />
      {!apps.length ? <div className="card text-muted">{t('jb.apps.empty')}</div> : (
        <ul className="space-y-3">{apps.map((a) => {
          const job = repo.getJob(actor, a.jobId)
          const events = repo.listStatusEvents(actor, a.id)
          return (
            <li key={a.id} className="card !p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{job.ok ? stripSynthetic(job.value.title) : t('jb.apps.jobHidden')}</h3><FictionalTag /><Chip tone={STATUS_TONE[a.status]}>{L.status(a.status)}</Chip>
                {job.ok && <NavLink to={`jobs?job=${a.jobId}`} className="text-sm underline text-primary ml-auto inline-flex items-center min-h-[24px]">{t('jb.open')}</NavLink>}
              </div>
              {events.ok && <Timeline events={events.value} />}
              {TRANSITIONS[a.status].withdrawn === 'worker' && <button type="button" className="btn-ghost text-sm" onClick={() => setTarget(a)}>{t('jb.withdraw')}</button>}
            </li>)
        })}</ul>)}
      <ConfirmDialog open={!!target} title={t('jb.withdraw.dlg.t')} body={t('jb.withdraw.dlg.d')} ok={t('jb.withdraw')} onClose={() => setTarget(null)}
        onConfirm={() => { const a = target; setTarget(null); if (a) report(mutate((rp) => rp.transitionApplication(actor, a.id, 'withdrawn')), t('jb.withdraw.done')) }} />
    </section>
  )
}

/* ---------------- employer: /employer ---------------- */
type EmployerTab = 'overview' | 'jobs' | 'applications'
export function EmployerPage() {
  const { t } = useI18n()
  const view = useSearchParam('view')
  const tab: EmployerTab = view === 'jobs' || view === 'applications' ? view : 'overview'
  const tabs: { id: EmployerTab; label: string }[] = [{ id: 'overview', label: t('jb.tab.overview') }, { id: 'jobs', label: t('jb.tab.jobs') }, { id: 'applications', label: t('jb.tab.review') }]
  return (
    <div className="space-y-5 max-w-5xl">
      <PageHead title={t('jb.employer.title')} sub={t('jb.employer.sub')}><NavLink to="jobs" className="btn-ghost text-sm">{t('jb.toJobs')}</NavLink></PageHead>
      <SimulationNotice compact />
      <DataBar />
      <RoleGate kind="employer">
        <TabBar label={t('jb.tabs')} value={tab} items={tabs} onChange={(id) => go(id === 'overview' ? 'employer' : `employer?view=${id}`)} />
        {tab === 'overview' && <OrgOverview />}
        {tab === 'jobs' && <EmployerJobs />}
        {tab === 'applications' && <EmployerApplications />}
      </RoleGate>
    </div>
  )
}
/** the acting employer's own organisation, read through the repository */
function useOwnOrg(): Result<Organization> | null {
  const { repo, version } = useJobBoard()
  const { actor } = usePersona()
  return useMemo(() => (actor.kind === 'employer' ? repo.getOrganization(actor, actor.organizationId) : null), [repo, version, actor])
}

export function OrgOverview() {
  const { t } = useI18n()
  const L = useLabels()
  const { mutate } = useJobBoard()
  const { actor } = usePersona()
  const { out, report } = useOutcome()
  const org = useOwnOrg()
  if (!org) return null
  if (!org.ok) return <Warn tone="danger">{t('jb.err.unauthorized')}</Warn>
  const o = org.value
  return (
    <section className="card space-y-3" aria-labelledby="jb-org-h">
      <div className="flex flex-wrap items-center gap-2"><h2 id="jb-org-h" className="h2">{t('jb.org.t')}: {stripSynthetic(o.name)}</h2><FictionalTag /></div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t('jb.field.industry')}</dt><dd>{L.industry(o.industry)}</dd>
        <dt className="text-muted">{t('jb.field.province')}</dt><dd>{L.province(o.province)}</dd>
        <dt className="text-muted">{t('jb.org.status')}</dt><dd><Chip tone={VERIF_TONE[o.verification]}>{L.verif(o.verification)}</Chip></dd>
      </dl>
      <p className="text-sm">{t(`jb.verif.${o.verification}.d` as never)}</p>
      {can(actor, 'org.requestVerification', { organization: o }) && <button type="button" className="btn-ghost" onClick={() => report(mutate((rp) => rp.requestVerification(actor)), t('jb.org.requested'))}>{t('jb.org.request')}</button>}
      <Outcome o={out} />
    </section>
  )
}

export function EmployerJobs() {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version, mutate } = useJobBoard()
  const { actor } = usePersona()
  const { out, report } = useOutcome()
  const org = useOwnOrg()
  const [editing, setEditing] = useState<'new' | Job | null>(null)
  const [closing, setClosing] = useState<Job | null>(null)
  const res = useMemo(() => repo.listJobs(actor), [repo, version, actor])
  if (!org) return null
  if (!org.ok || !res.ok) return <Warn tone="danger">{t('jb.err.unauthorized')}</Warn>
  const o = org.value
  // the repository already limited this list to what the actor may read; the employer area shows the organisation's own posts
  const own = res.value.filter((j) => j.organizationId === o.id)
  const canCreate = can(actor, 'job.create', { organization: o })
  const blank: JobInput = { title: '', industry: o.industry, skills: [], minYears: 0, province: o.province, contractMonths: 12 }
  return (
    <section className="space-y-3" aria-label={t('jb.tab.jobs')}>
      {o.verification !== 'verified' && <Warn>{t(`jb.verif.${o.verification}.d` as never)}</Warn>}
      {!canCreate ? <Warn tone="danger">{t('jb.ej.cannotCreate')}</Warn>
        : editing === null && <button type="button" className="btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />{t('jb.ej.new')}</button>}
      {editing && <JobForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? blank : editing} isNew={editing === 'new'} onCancel={() => setEditing(null)}
        onSave={(input) => {
          const r = editing === 'new' ? mutate((rp) => rp.createJob(actor, input)) : mutate((rp) => rp.updateJob(actor, editing.id, input))
          report(r, editing === 'new' ? t('jb.ej.created') : t('jb.ej.updated'))
          if (r.ok) setEditing(null)
          return r
        }} />}
      <Outcome o={out} />
      {own.some((j) => j.review === 'pending_review') && <p className="text-sm text-muted">{t('jb.ej.pendingNote')}</p>}
      {!own.length ? <div className="card text-muted">{t('jb.ej.empty')}</div> : (
        <ul className="space-y-3">{own.map((j) => {
          const r = { job: j, organization: o }
          return (
            <li key={j.id} className="card !p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{stripSynthetic(j.title)}</h3><FictionalTag /><Chip tone={REVIEW_TONE[j.review]}>{L.review(j.review)}</Chip></div>
              <JobFacts job={j} />
              <div className="flex flex-wrap gap-2">
                {can(actor, 'job.update', r) && <button type="button" className="btn-ghost text-sm" onClick={() => setEditing(j)}>{t('jb.ej.edit')}</button>}
                {can(actor, 'job.submit', r) && <button type="button" className="btn-ghost text-sm" onClick={() => report(mutate((rp) => rp.submitJob(actor, j.id)), t('jb.ej.submitted'))}>{t('jb.ej.submit')}</button>}
                {can(actor, 'job.close', r) && <button type="button" className="btn-ghost text-sm" onClick={() => setClosing(j)}>{t('jb.ej.close')}</button>}
              </div>
            </li>)
        })}</ul>)}
      <ConfirmDialog open={!!closing} title={t('jb.ej.close.dlg.t')} body={t('jb.ej.close.dlg.d')} ok={t('jb.ej.close')} onClose={() => setClosing(null)}
        onConfirm={() => { const j = closing; setClosing(null); if (j) report(mutate((rp) => rp.closeJob(actor, j.id)), t('jb.ej.closed')) }} />
    </section>
  )
}

function JobForm({ initial, isNew, onSave, onCancel }: { initial: JobInput; isNew: boolean; onSave: (i: JobInput) => Result<Job>; onCancel: () => void }) {
  const { t } = useI18n()
  const L = useLabels()
  const id = useId()
  const [title, setTitle] = useState(initial.title)
  const [industry, setIndustry] = useState(initial.industry)
  const [skills, setSkills] = useState<Skill[]>(initial.skills)
  const [minYears, setMinYears] = useState(String(initial.minYears))
  const [province, setProvince] = useState(initial.province)
  const [months, setMonths] = useState(String(initial.contractMonths))
  const submit = (e: FormEvent) => { e.preventDefault(); onSave({ title: title.trim(), industry, skills, minYears: Number(minYears), province, contractMonths: Number(months) }) }
  return (
    <form className="card space-y-3 border-primary/40" onSubmit={submit} aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-center gap-2"><h2 id={`${id}-h`} className="h2">{isNew ? t('jb.ej.new') : t('jb.ej.edit')}</h2><FictionalTag /></div>
      <label className="block"><span className="label">{t('jb.ej.title')}</span><input className="input" required minLength={3} maxLength={120} value={title} aria-describedby={`${id}-hint`} onChange={(e) => setTitle(e.target.value)} />
        <span id={`${id}-hint`} className="block text-xs text-muted mt-1">{t('jb.ej.titleHint')}</span></label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="label">{t('jb.field.industry')}</span><select className="input" value={industry} onChange={(e) => setIndustry(e.target.value as JobInput['industry'])}>{INDUSTRIES.map((x) => <option key={x} value={x}>{L.industry(x)}</option>)}</select></label>
        <label className="block"><span className="label">{t('jb.field.province')}</span><select className="input" value={province} onChange={(e) => setProvince(e.target.value)}>{CN_PROVINCES.map((c) => <option key={c} value={c}>{L.province(c)}</option>)}</select></label>
        <label className="block"><span className="label">{t('jb.ej.minYears')}</span><input type="number" className="input" min={0} max={50} step={1} value={minYears} onChange={(e) => setMinYears(e.target.value)} /></label>
        <label className="block"><span className="label">{t('jb.ej.contract')}</span><input type="number" className="input" min={1} max={60} step={1} value={months} onChange={(e) => setMonths(e.target.value)} /></label>
      </div>
      <fieldset><legend className="label">{t('jb.field.skills')}</legend>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1">{SKILLS.map((s) => <label key={s} className="flex items-center gap-2 text-sm min-h-[32px]"><input type="checkbox" checked={skills.includes(s)} onChange={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])} />{L.skill(s)}</label>)}</div>
      </fieldset>
      <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary">{isNew ? t('jb.ej.create') : t('jb.ej.update')}</button><button type="button" className="btn-ghost" onClick={onCancel}>{t('jb.cancel')}</button></div>
    </form>
  )
}

export function EmployerApplications() {
  const { t } = useI18n()
  const L = useLabels()
  const { repo, version, mutate } = useJobBoard()
  const { actor } = usePersona()
  const { out, report } = useOutcome()
  const [jobFilter, setJobFilter] = useState('')
  const res = useMemo(() => repo.listApplications(actor), [repo, version, actor])
  if (!res.ok) return <Warn tone="danger">{t('jb.err.unauthorized')}</Warn>
  const apps = [...res.value].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const jobs = new Map(apps.map((a) => [a.jobId, repo.getJob(actor, a.jobId)] as const))
  const title = (jobId: string) => { const j = jobs.get(jobId); return j?.ok ? stripSynthetic(j.value.title) : t('jb.apps.jobHidden') }
  const shown = apps.filter((a) => !jobFilter || a.jobId === jobFilter)
  return (
    <section className="space-y-3" aria-label={t('jb.tab.review')}>
      <p className="text-sm text-muted">{t('jb.rv.note')}</p>
      <Outcome o={out} />
      {!apps.length ? <div className="card text-muted">{t('jb.rv.empty')}</div> : <>
        <label className="block text-sm max-w-sm"><span className="label">{t('jb.rv.filter')}</span>
          <select className="input" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}><option value="">{t('jb.f.all')}</option>{[...jobs.keys()].map((id) => <option key={id} value={id}>{title(id)}</option>)}</select></label>
        <ul className="space-y-3">{shown.map((a) => {
          // the applicant's profile is reachable only through this application to one of the employer's own jobs
          const w = repo.getApplicant(actor, a.id)
          const events = repo.listStatusEvents(actor, a.id)
          const moves = (Object.entries(TRANSITIONS[a.status]) as [ApplicationStatus, string][]).filter(([, by]) => by === 'employer').map(([to]) => to)
          return (
            <li key={a.id} className="card !p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{title(a.jobId)}</h3><FictionalTag /><Chip tone={STATUS_TONE[a.status]}>{L.status(a.status)}</Chip></div>
              {w.ok ? <Applicant w={w.value} /> : <p className="text-sm text-muted">{t('jb.rv.hidden')}</p>}
              {events.ok && <Timeline events={events.value} />}
              {!!moves.length && <div className="flex flex-wrap gap-2">{moves.map((to) => (
                <button key={to} type="button" className="btn-ghost text-sm" onClick={() => report(mutate((rp) => rp.transitionApplication(actor, a.id, to)), t('jb.rv.updated', { s: L.status(to) }))}>{t(`jb.action.${to}` as never)}</button>))}</div>}
            </li>)
        })}</ul>
      </>}
    </section>
  )
}
function Applicant({ w }: { w: WorkerProfile }) {
  const { t } = useI18n()
  const L = useLabels()
  return (
    <div className="rounded-xl border border-line p-3 text-sm space-y-1">
      <p className="font-medium flex flex-wrap items-center gap-2">{t('jb.rv.applicant')}: {stripSynthetic(w.displayName)} <FictionalTag /></p>
      {w.headline && <p>{w.headline}</p>}
      <p className="text-muted">{t('jb.years', { n: w.yearsExperience })} · {t(`jb.edu.${w.education}` as never)} · {w.skills.map(L.skill).join(', ')}</p>
      <p className="text-muted">{w.languages.map((l) => `${t(`jb.lang.${l.lang}` as never)}: ${t(`jb.level.${l.level}` as never)}`).join(' · ')}</p>
    </div>
  )
}
