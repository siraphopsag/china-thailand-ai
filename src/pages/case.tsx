import { useState, type FormEvent, type ReactNode } from 'react'
import { tk, useI18n } from '../i18n'
import { NavLink, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { localDay, type Outcome } from '../domain/match/logic'
import { APPOINTMENTS, CASE_STEPS, DOCS, PERMITS, TESTS, currentStep, stepsDone, trainingsLeft, type Case, type CaseAction, type Training } from '../domain/match/cases'
import { ME, MY_EMPLOYER, type Country, type VerifyKind } from '../domain/match/types'
import { cleanPhone, cleanRegNo, isMobile, isRegNo, oneTimeCode } from '../domain/match/verify'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { useConfirm } from '../components/confirm'
import { AgencyLinks, Empty, Page, Toast, useApplicantName, useGate, useNames } from './match'
import { ScamNote } from './safety'
import { ArrivalBox, DocAttach } from './case-extras'
import { AftercarePanel, arrivalDay } from './aftercare'
import { useSeekerVerified } from './seeker-verify'

/**
 * The case after a match (owner, Oct 2026): nine steps from the employer's confirmation to the worker's arrival. The employer
 * follows the timeline and the departure day, the worker sees what comes next and how many courses are left, and the agency
 * (an administrator in the prototype — anyone in the local demo, labelled as such) ticks the steps. Nothing is uploaded.
 */
type Msg = { tone: 'info' | 'danger'; text: string } | null
export const trainingName = (x: Training, t: (k: never) => string) => (x.name.startsWith('@') ? t(`m.tr.${x.name.slice(1)}` as never) : x.name)

export function CasePage() {
  const { t } = useI18n()
  const { st, agency, caseAct, now, mode, demo } = useMatch()
  const nameOf = useApplicantName()
  const id = useSearchParam('id')
  const caseSeeker = st.cases.find((x) => x.id === id)?.seekerId ?? ME
  // the worker must be verified before the team takes the case: my own record, or (signed in) what the database says about them
  const seekerVerified = useSeekerVerified(caseSeeker)
  const gate = useGate(`case?id=${id}`)
  if (gate) return <Page title={t('m.cs.title')}>{gate}</Page>
  const c = st.cases.find((x) => x.id === id)
  const p = c && st.posts.find((x) => x.id === c.postId)
  if (!c || !p) return <Page title={t('m.cs.nfTitle')}><Empty icon="bell" text={t('m.cs.notFound')} to="notifications" action={t('m.notif.title')} /></Page>
  const isEmployer = p.employerId === MY_EMPLOYER
  const acc = st.acceptances.find((a) => a.id === c.accId)
  const isSeeker = c.seekerId === ME
  // a demo account also plays the C.A.L.L. team on its own case, so it can walk the case to the end alone (owner, 27 Nov 2026; SQL 0022)
  const team = agency || (demo && (isSeeker || isEmployer))
  const after = (isSeeker || isEmployer || agency) && arrivalDay(c)
    ? <AftercarePanel c={c} caseKey={c.id} employerId={p.employerId} country={p.country} province={p.province} today={localDay(new Date(now).toISOString())}
        seekerId={c.seekerId} view={isSeeker ? 'seeker' : 'employer'} team={agency} atNow={new Date(now).toISOString()} />
    : null
  return <CaseView key={c.id} c={c} sub={`${p.position} · ${p.company}`} isSeeker={isSeeker} isEmployer={isEmployer}
    withName={isEmployer && acc ? nameOf(acc) : null} agency={team} act={(a) => caseAct(c.id, a)} extra={after}
    seekerUnverified={(c.seekerId === ME || mode === 'remote') && !c.steps.accepted && !seekerVerified} />
}

/** the case screen itself; the real case page and the demo case (case-demo.tsx) both use it */
export interface CaseViewProps {
  c: Case; sub: string; isSeeker: boolean; isEmployer: boolean
  /** the worker's name the employer sees (null = not shown) */
  withName: string | null
  /** show the C.A.L.L. case team's controls */
  agency: boolean
  act: (a: CaseAction) => Promise<Outcome<unknown>>
  title?: string
  /** shown above the steps (the demo's switcher) */
  top?: ReactNode
  /** where "Check the contract" goes (default: this case on the contract page) */
  contractTo?: string
  /** shown under the steps (the end system after arrival) */
  extra?: ReactNode
  /** where the chat with the other side opens (default: this match) */
  chatTo?: string
  /** v2: the worker has not verified their identity yet — the team cannot accept the case */
  seekerUnverified?: boolean
}
export function CaseView({ c, sub, isSeeker, isEmployer, withName, agency, act, title, top, contractTo, extra, chatTo, seekerUnverified }: CaseViewProps) {
  const { t } = useI18n()
  const N = useNames()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [ask, askDialog] = useConfirm()
  const cur = currentStep(c), n = stepsDone(c)
  const run = async (a: CaseAction, done?: string) => {
    setBusy(true); const r = await act(a); setBusy(false)
    if (r.ok) { setMsg(done ? { tone: 'info', text: done } : null); return true }
    setMsg({ tone: 'danger', text: N.problem(r.problem) }); return false
  }
  const arrive = async () => { if (await ask(t('m.cs.arrive.confirm'), { yes: t('m.cs.arrive') })) void run({ kind: 'arrived' }, t('m.cs.arrive.done')) }

  const col = 'space-y-3 min-w-0 fit:min-h-0 fit:overflow-y-auto fit:pr-1'
  return (
    <Page title={title ?? t('m.cs.title')} sub={sub} fit body="flex flex-col gap-3">
      <Toast msg={msg} />
      {askDialog}
      {top}
      {seekerUnverified && <Warn>{t(isSeeker ? 'sv.needFirst.seeker' : 'sv.needFirst.team')} {isSeeker && <NavLink to="me" className="underline underline-offset-4 font-medium">{t('sv.go')}</NavLink>}</Warn>}
      <div className={`grid gap-4 items-start fit:flex-1 fit:min-h-0 fit:items-stretch ${agency ? 'lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]' : 'lg:grid-cols-2'}`}>
        <div className={col}>
          {/* ---------- where it stands: the nine steps in one card, the current one explained in place ---------- */}
          <section className="card !p-4 space-y-2.5" aria-labelledby="cs-now">
            <div className="flex items-baseline justify-between gap-2"><h2 id="cs-now" className="h2">{t('m.cs.steps')}</h2><span className="text-xs text-muted">{t('m.cs.progress', { n })}</span></div>
            <div className="h-2 rounded-full bg-surface3 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={9} aria-valuenow={n} aria-label={t('m.cs.progress', { n })}>
              <div className="h-full bg-primary" style={{ width: `${(n / 9) * 100}%` }} /></div>
            {withName && <p className="text-xs text-muted">{t('m.cs.with', { n: withName })}</p>}
            <ol className="space-y-0.5">{CASE_STEPS.map((s2, i) => {
              const at = c.steps[s2], current = cur === s2
              return (
                <li key={s2} aria-current={current ? 'step' : undefined} className={`rounded-lg px-1.5 py-1 ${current ? 'bg-brand text-brandfg' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-[0.6875rem] font-bold ${at ? 'bg-ok-fg text-ok-bg' : current ? 'bg-primary text-onprimary' : 'bg-surface3 text-muted'}`}>{at ? <Icon name="check" size={13} /> : i + 1}</span>
                    <span className={`text-sm flex-1 min-w-0 truncate ${current ? 'font-semibold' : at ? '' : 'text-muted'}`}>{t(`m.cs.s.${s2}` as never)}</span>
                    {(at || current) && <span className="text-[0.6875rem] opacity-80 shrink-0">{at ? N.dayTime(Date.parse(at)) : t('m.cs.now')}</span>}
                  </div>
                  {current && <p className="text-xs mt-1 pl-[34px]">{t(`m.cs.d.${s2}` as never)}</p>}
                </li>)
            })}</ol>
            {isSeeker && (cur === 'documents' || cur === 'departure') && <ScamNote where={cur} />}
            {cur === 'submitted' && (isEmployer
              ? <Warn>{t('m.cs.waitVerify.employer')} <NavLink to="me" className="underline underline-offset-4 font-medium">{t('m.cs.goVerify')}</NavLink></Warn>
              : <Warn tone="info">{t('m.cs.waitVerify.seeker')}</Warn>)}
            <ul className="text-sm space-y-1 border-t border-line pt-2">
              {c.steps.arrived ? <li className="flex items-center gap-2 text-ok-fg font-medium"><Icon name="ok" size={16} />{t('m.cs.arrivedOn', { d: N.dayTime(Date.parse(c.steps.arrived)) })}</li>
                : <li className="flex items-center gap-2"><Icon name="plane" size={16} className="text-primary" />{c.departureDate ? t('m.cs.eta', { d: N.day(c.departureDate) }) : t('m.cs.etaNone')}</li>}
              {!c.steps.training && <li className="flex items-center gap-2"><Icon name="culture" size={16} className="text-primary" />{t('m.cs.left', { n: trainingsLeft(c), t: c.trainings.length })}</li>}
            </ul>
            {isSeeker && <p className="text-xs font-medium text-warn-fg flex items-start gap-1.5"><Icon name="warn" size={14} className="mt-0.5 shrink-0" />{t('m.cs.noFee')}</p>}
            {cur === 'arrived' && (isEmployer || agency) && (
              <button type="button" className="btn-primary" disabled={busy} onClick={arrive}><Icon name="ok" size={16} />{busy ? t('m.ask.busy') : t(isEmployer ? 'm.cs.arrive' : 'm.cs.arriveAgency')}</button>)}
            <ArrivalBox c={c} isSeeker={isSeeker} run={run} busy={busy} ask={ask} />
            {(isSeeker || isEmployer) && <NavLink to={chatTo ?? `chat?acc=${c.accId}`} className="text-sm text-primary underline underline-offset-4 inline-flex items-center gap-1 min-h-[24px] mr-3"><Icon name="users" size={14} />{t('ch.open')}</NavLink>}
            {c.steps.submitted && <NavLink to={contractTo ?? `contract?case=${c.id}`} className="text-sm text-primary underline underline-offset-4 inline-flex items-center gap-1 min-h-[24px]"><Icon name="documents" size={14} />{t('c2.open')}</NavLink>}
          </section>
          {isSeeker && c.steps.submitted && !c.steps.arrived && <DocAttach c={c} />}
          {extra}
        </div>

        {/* 1024–1279 px: the case details and the agency share the second column; from 1280 px they get a column each */}
        <div className={`${col} xl:contents`}>
          <div className="space-y-3 min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pr-1"><CaseInfo c={c} /></div>
          {agency && <div className="space-y-3 min-w-0 xl:min-h-0 xl:overflow-y-auto xl:pr-1"><AgencyPanel c={c} run={run} busy={busy} blockAccept={!!seekerUnverified} /></div>}
        </div>
      </div>
    </Page>
  )
}

/** what both sides read about a case, in three tabs so it fits beside the steps: checklists (+ the agency's note), appointments, who handles it */
function CaseInfo({ c }: { c: Case }) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'lists' | 'appt' | 'legal'>('lists')
  return (
    <section className="glass-card p-4 space-y-3" aria-label={t('m.cs.lists')}>
      <div role="tablist" aria-label={t('m.cs.lists')} className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {(['lists', 'appt', 'legal'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[34px] px-3 rounded-lg text-xs sm:text-sm ${tab === k ? 'seg-on' : 'hover:bg-surface3'}`}>{t(k === 'lists' ? 'm.cs.lists' : k === 'appt' ? 'm.cs.appt' : 'm.cs.legal.h')}</button>)}
      </div>
      <div role="tabpanel" className="space-y-3">
        {tab === 'lists' && (<>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Ticks title={t('m.cs.docs')} items={DOCS.map((k) => ({ k, label: t(`m.cs.doc.${k}` as never), on: !!c.docs[k] }))} />
            <Ticks title={t('m.cs.tests')} items={TESTS.map((k) => ({ k, label: t(`m.cs.test.${k}` as never), on: !!c.tests[k] }))} />
            <Ticks title={`${t('m.cs.trainings')} · ${trainingsLeft(c)}/${c.trainings.length}`} items={c.trainings.map((x) => ({ k: x.id, label: trainingName(x, t as never), on: x.done }))} />
            <Ticks title={t('m.cs.permit')} items={PERMITS.map((k) => ({ k, label: t(`m.cs.permit.${k}` as never), on: !!c.permit[k] }))} />
          </div>
          {c.note && <div className="card-i !p-2.5 text-sm"><p className="font-medium text-xs">{t('m.cs.note')}</p><p className="text-muted whitespace-pre-line">{c.note}</p></div>}
        </>)}
        {tab === 'appt' && <Appointments c={c} />}
        {tab === 'legal' && (<>
          <p className="text-sm text-muted">{t('m.cs.legal')}</p>
          <AgencyLinks />
          <NavLink to="terms" className="text-sm text-primary underline underline-offset-4 inline-flex items-center min-h-[24px]">{t('m.tm.title')}</NavLink>
        </>)}
      </div>
    </section>
  )
}

/** the appointment days the agency set (both sides see them; they are also on the calendar) */
function Appointments({ c }: { c: Case }) {
  const { t } = useI18n()
  const N = useNames()
  const rows = [...APPOINTMENTS.map((k) => ({ k, label: t(`m.cs.appt.${k}` as never), day: c.dates[k] })),
    ...c.trainings.filter((x) => !x.done).map((x) => ({ k: `t-${x.id}`, label: t('m.cs.appt.course', { c: trainingName(x, t as never) }), day: x.date ?? undefined }))]
  return (
    <div><h3 className="font-semibold text-sm mb-1 flex items-center justify-between gap-2">{t('m.cs.appt')}<NavLink to="calendar" className="text-xs font-medium text-primary underline underline-offset-4 inline-flex items-center gap-1 min-h-[24px]"><Icon name="calendar" size={13} />{t('m.cs.seeCal')}</NavLink></h3>
      <ul className="text-sm space-y-1">{rows.map((r) => <li key={r.k} className="flex justify-between gap-3"><span className="text-muted">{r.label}</span><span className={r.day ? 'font-medium' : 'text-muted'}>{r.day ? N.day(r.day) : t('m.cs.appt.none')}</span></li>)}</ul></div>
  )
}
function Ticks({ title, items }: { title: string; items: { k: string; label: string; on: boolean }[] }) {
  return (
    <div><h3 className="font-semibold text-sm mb-1">{title}</h3>
      <ul className="text-sm space-y-1">{items.map((x) => (
        <li key={x.k} className={`flex items-center gap-2 ${x.on ? '' : 'text-muted'}`}><Icon name={x.on ? 'squareCheck' : 'square'} size={16} className={x.on ? 'text-ok-fg' : ''} />{x.label}</li>))}</ul></div>
  )
}

/** the agency's controls: only what the current step allows; course list editable until training is done */
function AgencyPanel({ c, run, busy, blockAccept }: { c: Case; run: (a: CaseAction, done?: string) => Promise<boolean>; busy: boolean; blockAccept: boolean }) {
  const { t } = useI18n()
  const { mode, now, demo, agency } = useMatch()
  const [course, setCourse] = useState(''), [date, setDate] = useState(c.departureDate ?? ''), [note, setNote] = useState(c.note)
  const cur = currentStep(c)
  const toggle = (on: boolean, label: string, a: CaseAction) => (
    <li key={label}><button type="button" aria-pressed={on} disabled={busy} onClick={() => void run(a)}
      className={`w-full min-h-[40px] px-3 rounded-lg border flex items-center gap-2 text-left text-sm ${on ? 'border-ok-line bg-ok-bg text-ok-fg font-medium' : 'border-control hover:bg-surface3'}`}>
      <Icon name={on ? 'squareCheck' : 'square'} size={16} />{label}</button></li>)
  const addCourse = async (e: FormEvent) => { e.preventDefault(); if (await run({ kind: 'trainAdd', name: course.trim() }, t('m.cs.saved'))) setCourse('') }
  const editCourses = !!c.steps.submitted && !c.steps.training
  const dated = !!c.steps.submitted && !c.steps.arrived
  const tabs = (['step', ...(editCourses ? ['courses'] : []), ...(dated ? ['dates'] : []), 'note'] as const) as readonly ('step' | 'courses' | 'dates' | 'note')[]
  const [tab, setTab] = useState<'step' | 'courses' | 'dates' | 'note'>('step')
  const shown = tabs.includes(tab) ? tab : 'step'
  return (
    <section className="card !p-4 space-y-3 border-primary" aria-labelledby="cs-ag">
      <h2 id="cs-ag" className="h2 flex items-center gap-2"><Icon name="shield" size={18} className="text-primary" />{t('m.cs.ag.title')}</h2>
      <p className="text-xs text-muted">{t(mode === 'local' ? 'm.cs.ag.demo' : demo && !agency ? 'm.cs.ag.demoAcc' : 'm.cs.ag.admin')}</p>
      <div role="tablist" aria-label={t('m.cs.ag.title')} className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
        {tabs.map((k) => <button key={k} type="button" role="tab" aria-selected={shown === k} onClick={() => setTab(k)} className={`min-h-[34px] px-3 rounded-lg text-xs sm:text-sm ${shown === k ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`m.cs.ag.tab.${k}` as never)}</button>)}
      </div>
      <div role="tabpanel" className="space-y-3">
      {shown === 'step' && (<>
        {cur === 'submitted' && <p className="text-sm text-muted">{t('m.cs.ag.wait')}</p>}
        {cur === 'accepted' && blockAccept && <p className="text-xs text-warn-fg">{t('sv.needFirst.team')}</p>}
        {cur === 'accepted' && <button type="button" className="btn-primary" disabled={busy || blockAccept} onClick={() => void run({ kind: 'accept' }, t('m.cs.saved'))}><Icon name="ok" size={16} />{t('m.cs.ag.accept')}</button>}
        {(cur === 'documents' || cur === 'tests' || cur === 'training' || cur === 'permit') && <p className="text-xs text-muted">{t('m.cs.ag.tick')}</p>}
        {cur === 'documents' && <ul className="space-y-1.5">{DOCS.map((k) => toggle(!!c.docs[k], t(`m.cs.doc.${k}` as never), { kind: 'doc', key: k }))}</ul>}
        {cur === 'tests' && <ul className="space-y-1.5">{TESTS.map((k) => toggle(!!c.tests[k], t(`m.cs.test.${k}` as never), { kind: 'test', key: k }))}</ul>}
        {cur === 'training' && <ul className="space-y-1.5">{c.trainings.map((x) => toggle(x.done, trainingName(x, t as never), { kind: 'train', id: x.id }))}</ul>}
        {cur === 'permit' && <ul className="space-y-1.5">{PERMITS.map((k) => toggle(!!c.permit[k], t(`m.cs.permit.${k}` as never), { kind: 'permit', key: k }))}</ul>}
        {cur === 'departure' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-end">
              <label className="block"><span className="label">{t('m.cs.ag.departDate')}</span><input className="input" type="date" min={localDay(new Date(now).toISOString())} value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <button type="button" className="btn-ghost" disabled={busy || !date} onClick={() => void run({ kind: 'departure', date }, t('m.cs.saved'))}>{t('m.cs.ag.setDate')}</button>
            </div>
            <button type="button" className="btn-primary" disabled={busy || !c.departureDate} onClick={() => void run({ kind: 'departOk' }, t('m.cs.saved'))}><Icon name="plane" size={16} />{t('m.cs.ag.departOk')}</button>
          </div>)}
        {cur === null && <p className="text-sm text-ok-fg font-medium">{t('m.cs.ag.done')}</p>}
      </>)}
      {shown === 'courses' && editCourses && (<>
        <ul className="space-y-1 text-sm">{c.trainings.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{trainingName(x, t as never)}</span>
            <button type="button" className="btn-ghost text-xs text-danger-fg" disabled={busy || c.trainings.length <= 1} aria-label={`${t('m.cs.ag.remove')}: ${trainingName(x, t as never)}`} onClick={() => void run({ kind: 'trainRemove', id: x.id }, t('m.cs.saved'))}><Icon name="trash" size={14} />{t('m.cs.ag.remove')}</button></li>))}</ul>
        <form className="flex flex-wrap gap-2 items-end" onSubmit={addCourse}>
          <label className="block flex-1 min-w-[160px]"><span className="label">{t('m.cs.ag.courseName')}</span><input className="input" maxLength={60} value={course} onChange={(e) => setCourse(e.target.value)} /></label>
          <button type="submit" className="btn-ghost" disabled={busy || course.trim().length < 2}><Icon name="plus" size={15} />{t('m.cs.ag.addCourse')}</button>
        </form>
      </>)}
      {shown === 'dates' && dated && (<>
        <p className="text-xs text-muted">{t('m.cs.appt.d')}</p>
        <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2">
        {[...APPOINTMENTS.map((k) => ({ id: k, label: t(`m.cs.appt.${k}` as never), value: c.dates[k] ?? '', set: (d: string | null) => run({ kind: 'date', key: k, date: d }, t('m.cs.saved')) })),
          ...c.trainings.filter((x) => !x.done).map((x) => ({ id: `t-${x.id}`, label: t('m.cs.appt.course', { c: trainingName(x, t as never) }), value: x.date ?? '', set: (d: string | null) => run({ kind: 'trainDate', id: x.id, date: d }, t('m.cs.saved')) }))]
          .map((row) => (
            <div key={row.id} className="min-w-0">
              <label className="block"><span className="label !text-xs truncate">{row.label}</span>
                <input type="date" className="input" min={localDay(new Date(now).toISOString())} value={row.value} disabled={busy} onChange={(e) => { if (e.target.value) void row.set(e.target.value) }} /></label>
              {row.value && <button type="button" className="text-xs text-muted underline underline-offset-4 min-h-[24px]" disabled={busy} onClick={() => void row.set(null)} aria-label={`${t('m.cs.appt.clear')}: ${row.label}`}>{t('m.cs.appt.clear')}</button>}
            </div>))}
        </div>
      </>)}
      {shown === 'note' && (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void run({ kind: 'note', text: note.trim() }, t('m.cs.saved')) }}>
          <label className="block"><span className="label">{t('m.cs.ag.note')}</span><textarea className="input min-h-[96px]" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button type="submit" className="btn-ghost text-sm" disabled={busy || note.trim() === c.note}>{t('m.cs.ag.saveNote')}</button>
        </form>)}
      </div>
    </section>
  )
}

/** a link to my case from the post page, with how far it has come */
export function CaseLink({ c }: { c: Case }) {
  const { t } = useI18n()
  return <NavLink to={`case?id=${c.id}`} className="btn-ghost text-sm inline-flex"><Icon name="plane" size={15} />{t('m.cs.follow', { n: stepsDone(c) })}</NavLink>
}

/* ================= employer verification ================= */
/** the code is good for 5 minutes and 5 tries; then a new one is needed */
const CODE_LIFE_MS = 5 * 60_000, CODE_TRIES = 5
const pick = (on: boolean) => `min-h-[44px] px-4 rounded-lg border ${on ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`
/**
 * An employer gets verified as a company (registration number) or — without one — as a private person (owner, Oct 2026,
 * option ก): a mobile number confirmed with a one-time code, then the agency approves. Only the last 4 digits leave the browser.
 * In the prototype the code is shown on the screen instead of being sent by SMS (said so next to it).
 */
export function VerifyCard() {
  const { t } = useI18n()
  const N = useNames()
  const { st, mode, requestVerification, requestPersonVerification, decideVerification, demo: demoAcc, demoVerify } = useMatch()
  const ev = st.employerVerify
  const [kind, setKind] = useState<VerifyKind>(ev?.kind ?? 'company')
  const [country, setCountry] = useState<Country>(ev?.country ?? 'TH')
  const [reg, setReg] = useState(''), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState(''), [sent, setSent] = useState<{ code: string; at: number; tries: number } | null>(null), [code, setCode] = useState('')
  const [err, setErr] = useState(''), [msg, setMsg] = useState<Msg>(null)
  const form = !ev || ev.status === 'rejected' || editing
  const done = (ok: boolean, problem?: string) => {
    if (ok) { setErr(''); setReg(''); setPhone(''); setCode(''); setSent(null); setEditing(false); setMsg({ tone: 'info', text: t('m.vf.sent') }) }
    else setMsg({ tone: 'danger', text: problem ?? t('m.err.network') })
  }
  const submitCompany = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    const v = cleanRegNo(reg)
    if (!isRegNo(country, v)) { setErr(N.problem('regNo')); return }
    setBusy(true); const r = await requestVerification(country, v); setBusy(false)
    if (r.ok) done(true)
    else if (r.problem === 'regNo') setErr(N.problem('regNo'))
    else done(false, N.problem(r.problem))
  }
  // a private person: first the number (a code is "sent"), then the code
  const sendCode = (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    if (!isMobile(country, cleanPhone(country, phone))) { setErr(N.problem('phone')); return }
    setErr(''); setCode(''); setSent({ code: oneTimeCode(), at: Date.now(), tries: 0 })
  }
  const confirmCode = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null)
    if (!sent) return
    if (Date.now() - sent.at > CODE_LIFE_MS || sent.tries >= CODE_TRIES) { setErr(t('m.vf.codeOld')); return }
    if (code.trim() !== sent.code) { setSent({ ...sent, tries: sent.tries + 1 }); setErr(N.problem('code')); return }
    setBusy(true); const r = await requestPersonVerification(country, phone); setBusy(false)
    if (r.ok) done(true)
    else if (r.problem === 'phone') { setSent(null); setErr(N.problem('phone')) }
    else done(false, N.problem(r.problem))
  }
  const demo = async (ok: boolean) => { setBusy(true); const d = await decideVerification(null, ok); setBusy(false); setMsg(d ? null : { tone: 'danger', text: t('m.err.network') }) }
  const choose = (k: VerifyKind) => { setKind(k); setErr(''); setSent(null); setCode('') }
  const person = ev?.kind === 'person'
  return (
    <section id="verify" className="card space-y-3" aria-labelledby="vf-h">
      <h2 id="vf-h" className="h2 flex items-center gap-2"><Icon name="shield" size={18} className="text-primary" />{t('m.vf.title')}</h2>
      {ev && (
        <p className="text-sm flex flex-wrap items-center gap-2">
          {ev.status === 'verified' ? <span className="chip bg-ok-bg text-ok-fg border-ok-line"><Icon name={person ? 'personCheck' : 'verified'} size={12} />{t(person ? 'm.vf.verified.person' : 'm.vf.verified')}</span>
            : ev.status === 'pending' ? <span className="chip bg-warn-bg text-warn-fg border-warn-line"><Icon name="hourglass" size={12} />{t('m.vf.pending', { d: N.dayTime(Date.parse(ev.at)) })}</span>
              : <span className="chip bg-danger-bg text-danger-fg border-danger-line"><Icon name="warn" size={12} />{t('m.vf.rejected')}</span>}
          <span className="text-muted">{tk('country', ev.country)} · {person ? t('m.vf.asPerson', { d: ev.phone4 ?? '' }) : <span className="font-mono">{ev.regNo}</span>}</span>
        </p>)}
      {(!ev || ev.status !== 'verified' || form) && <p className="text-sm text-muted">{t(kind === 'person' ? 'm.vf.lead.person' : 'm.vf.lead')}</p>}
      {ev?.status === 'verified' && person && !form && <p className="text-sm text-muted">{t('m.vf.toCompany')}</p>}
      <Toast msg={msg} />
      {/* a demo account: approved at once, as the team would (owner, 27 Nov 2026: the judges try everything alone) */}
      {demoAcc && ev?.status !== 'verified' && !(mode === 'local' && ev?.status === 'pending') && (
        <div className="card-i space-y-2 text-sm"><p className="flex items-start gap-1.5"><Icon name="sim" size={15} className="mt-0.5 shrink-0 text-warn-fg" />{t('dm.vf.lead')}</p>
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={async () => { setBusy(true); const ok = await demoVerify(); setBusy(false); setMsg(ok ? { tone: 'info', text: t('dm.vf.done') } : { tone: 'danger', text: t('m.err.network') }) }}><Icon name="verified" size={15} />{t('dm.vf.go')}</button></div>)}
      {ev?.status === 'pending' && mode === 'local' && (
        <div className="flex flex-wrap gap-2"><button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void demo(true)}>{t('m.vf.demoApprove')}</button>
          <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void demo(false)}>{t('m.vf.demoReject')}</button></div>)}
      {form ? (
        <div className="space-y-3">
          {editing && <Warn>{t('m.vf.changeNote')}</Warn>}
          <fieldset><legend className="label">{t('m.vf.kind')}</legend><div className="flex flex-wrap gap-2">{(['company', 'person'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => choose(k)} className={`${pick(kind === k)} flex items-center gap-2`}><Icon name={k === 'company' ? 'business' : 'user'} size={16} />{t(k === 'company' ? 'm.vf.kind.company' : 'm.vf.kind.person')}</button>))}</div></fieldset>
          <fieldset><legend className="label">{t(kind === 'person' ? 'm.vf.country.person' : 'm.vf.country')}</legend><div className="flex gap-2">{(['TH', 'CN'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={country === k} onClick={() => { setCountry(k); setErr(''); setSent(null) }} className={pick(country === k)}>{tk('country', k)}</button>))}</div></fieldset>
          {kind === 'company' ? (
            <form className="space-y-3" onSubmit={submitCompany} noValidate>
              <div><label className="block"><span className="label">{t('m.vf.reg')}</span>
                <input id="vf-reg" className="input font-mono" maxLength={24} autoComplete="off" spellCheck={false} value={reg} aria-invalid={!!err} aria-describedby={`vf-hint${err ? ' vf-err' : ''}`} onChange={(e) => { setReg(e.target.value); setErr('') }} /></label>
                <span id="vf-hint" className="block text-xs text-muted mt-1">{t(country === 'TH' ? 'm.vf.hint.TH' : 'm.vf.hint.CN')} · {t('m.vf.public')}</span>
                {err && <span id="vf-err" className="block text-sm text-danger-fg mt-1">{err}</span>}</div>
              <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={busy || !reg.trim()}><Icon name="send" size={16} />{busy ? t('m.ask.busy') : t('m.vf.send')}</button>
                {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setErr('') }}>{t('m.vf.cancel')}</button>}</div>
            </form>
          ) : !sent ? (
            <form className="space-y-3" onSubmit={sendCode} noValidate>
              <div><label className="block"><span className="label">{t('m.vf.phone')}</span>
                <input id="vf-phone" className="input font-mono" type="tel" inputMode="tel" maxLength={20} autoComplete="tel" value={phone} aria-invalid={!!err} aria-describedby={`vf-phint${err ? ' vf-err' : ''}`} onChange={(e) => { setPhone(e.target.value); setErr('') }} /></label>
                <span id="vf-phint" className="block text-xs text-muted mt-1">{t(country === 'TH' ? 'm.vf.phone.hint.TH' : 'm.vf.phone.hint.CN')} · {t('m.vf.phone.privacy')}</span>
                {err && <span id="vf-err" className="block text-sm text-danger-fg mt-1">{err}</span>}</div>
              <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={!phone.trim()}><Icon name="phone" size={16} />{t('m.vf.sendCode')}</button>
                {editing && <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setErr('') }}>{t('m.vf.cancel')}</button>}</div>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={confirmCode} noValidate>
              <p role="status" className="text-sm rounded-lg border border-info-line bg-info-bg text-info-fg px-3 py-2 flex items-center gap-2"><Icon name="phone" size={16} />{t('m.vf.codeDemo', { c: sent.code })}</p>
              <div><label className="block"><span className="label">{t('m.vf.code')}</span>
                <input id="vf-code" className="input font-mono tracking-[0.3em] max-w-[12rem]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} aria-invalid={!!err} aria-describedby={err ? 'vf-err' : undefined} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setErr('') }} /></label>
                {err && <span id="vf-err" className="block text-sm text-danger-fg mt-1">{err}</span>}</div>
              <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={busy || code.length !== 6}><Icon name="send" size={16} />{busy ? t('m.ask.busy') : t('m.vf.confirmCode')}</button>
                <button type="button" className="btn-ghost" onClick={() => { setSent(null); setCode(''); setErr('') }}>{t('m.vf.resend')}</button></div>
            </form>
          )}
        </div>
      ) : <button type="button" className="btn-ghost text-sm" onClick={() => { setEditing(true); if (person && ev?.status === 'verified') choose('company') }}><Icon name="edit" size={15} />{t(person ? 'm.vf.toCompanyBtn' : 'm.vf.change')}</button>}
    </section>
  )
}
