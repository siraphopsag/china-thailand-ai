// The end system on the case page (v2 model, owner Nov 2026): check-ins on the arrival day, day 7 and day 30, a secret word that
// raises a silent alert, the employer review after day 30, and complaints that C.A.L.L. files for the worker after checking them.
// The employer sees none of the worker's answers. The team's box (alerts and complaint actions) shows to the C.A.L.L. team only;
// in the prototype it is also shown on the demo case so the whole flow can be presented.
import { useState } from 'react'
import { useI18n } from '../i18n'
import { localDay } from '../domain/match/logic'
import type { Case } from '../domain/match/cases'
import type { Country } from '../domain/match/types'
import { EVIDENCE, PROBLEMS, officeSearch, type ProblemKind } from '../domain/match/reportPack'
import {
  REVIEW_BAD, REVIEW_GOOD, actComplaint, canReview, checkinFlags, checkinStates, credLevel, fileComplaint, mapLinkOf, hasSecret, reviewSummary, teamAlerts,
  type CheckDay, type CheckIn, type Complaint, type ComplaintAction, type EmployerReview,
} from '../domain/match/aftercare'
import { useAftercare, useReviews, type Aftercare } from '../aftercareStore'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { useNames } from './match'

/** the arrival day: the earlier of the two confirmations */
export function arrivalDay(c: Case): string | null {
  const xs = [c.seekerArrived, c.steps.arrived].filter((x): x is string => !!x).sort()
  return xs.length ? localDay(xs[0]) : null
}
const flagsOf = (a: Aftercare) => a.checkins.flatMap(checkinFlags)

export function AftercarePanel({ c, caseKey, seekerId, employerId, country, province, today, view, team, atNow }: {
  c: Case; caseKey: string; seekerId?: string; employerId: string; country: Country; province: string; today: string
  view: 'seeker' | 'employer'; team: boolean; atNow: string
}) {
  const { t } = useI18n()
  const N = useNames()
  const [a, save, problem] = useAftercare(caseKey, seekerId)
  const [sent, setSent] = useState(false)
  const arrival = arrivalDay(c)
  if (!arrival) return null
  const states = checkinStates(arrival, a.checkins, today)
  const open = states.find((s) => s.state === 'open')
  const act = (id: string, x: ComplaintAction) => { const cm = a.complaints.find((y) => y.id === id); const n = cm && actComplaint(cm, x, atNow); if (n) save({ ...a, complaints: a.complaints.map((y) => (y.id === id ? n : y)) }) }
  return (
    <section className="card !p-4 space-y-4 ac-panel" aria-labelledby="ac-h">
      <div><h2 id="ac-h" className="h2 flex items-center gap-2"><Icon name="shield" size={18} className="text-primary" />{t('ac.h')}</h2>
        <p className="text-xs text-muted mt-1">{t(view === 'seeker' ? 'ac.sub.seeker' : 'ac.sub.employer')}</p></div>
      {problem && <Warn>{t(problem === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</Warn>}
      {/* the three check-ins as a timeline (not for the employer: even a missed check-in is the worker's business) */}
      {view === 'seeker' && <ol className="grid grid-cols-3 gap-2" aria-label={t('ac.timeline')}>{states.map((s) => (
        <li key={s.day} className={`ac-node ac-${s.state}`}>
          <span className="ac-dot">{s.state === 'done' ? <Icon name="check" size={15} /> : s.state === 'missed' ? <Icon name="warn" size={14} /> : s.day}</span>
          <span className="block text-sm font-semibold">{t(`ac.day.${s.day}` as never)}</span>
          <span className="block text-[11px] opacity-80">{N.day(s.due)} · {t(`ac.st.${s.state}` as never)}</span>
        </li>))}</ol>}

      {view === 'seeker' ? (<>
        {sent && !open && <p className="text-sm text-ok-fg flex items-center gap-1.5" role="status"><Icon name="ok" size={16} />{t('ac.thanks')}</p>}
        {open ? <CheckinForm key={open.day} day={open.day} onDone={(ci) => { save({ ...a, checkins: [...a.checkins, { ...ci, silent: hasSecret(ci.note, a.secret) }] }); setSent(true) }} atNow={atNow} />
          : states.every((s) => s.state === 'done') ? <p className="text-sm text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('ac.allDone')}</p>
          : <p className="text-sm text-muted">{t('ac.next', { d: N.day(states.find((s) => s.state === 'upcoming')?.due ?? today) })}</p>}
        <SecretWord secret={a.secret} onSet={(secret) => save({ ...a, secret })} />
        {canReview(a.checkins) && <ReviewBox review={a.review} employerId={employerId} atNow={atNow} onSave={(review) => save({ ...a, review })} />}
        <ComplaintBox a={a} caseKey={caseKey} country={country} province={province} atNow={atNow} onFile={(cm) => save({ ...a, complaints: [cm, ...a.complaints] })}
          onAct={act} hasCase arrived />
      </>) : (<>
        <Warn tone="info">{t('ac.employer.note')}</Warn>
        <EmployerRating employerId={employerId} />
      </>)}

      {team && <TeamBox arrival={arrival} a={a} today={today} onAct={act} />}
    </section>
  )
}

/* ---------- one check-in ---------- */
function CheckinForm({ day, onDone, atNow }: { day: CheckDay; onDone: (c: CheckIn) => void; atNow: string }) {
  const { t } = useI18n()
  const [v, setV] = useState<Omit<CheckIn, 'day' | 'at'>>({ paid: day === 1 ? 'notYet' : 'yes', passport: 'me', hours: 'ok', safe: 'yes', note: '' })
  const [sent, setSent] = useState(false)
  const q = <K extends 'paid' | 'passport' | 'hours' | 'safe'>(k: K, opts: CheckIn[K][]) => (
    <fieldset className="space-y-1"><legend className="text-sm font-medium">{t(`ac.q.${k}` as never)}</legend>
      <div className="flex flex-wrap gap-1.5">{opts.map((o) => (
        <label key={o} className={`chip cursor-pointer min-h-[34px] px-3 ${v[k] === o ? 'seg-on' : 'bg-surface border-line'}`}>
          <input type="radio" className="sr-only" name={`ac-${k}`} checked={v[k] === o} onChange={() => setV((x) => ({ ...x, [k]: o }))} />{t(`ac.a.${k}.${o}` as never)}</label>))}</div></fieldset>)
  if (sent) return <p className="text-sm text-ok-fg flex items-center gap-1.5" role="status"><Icon name="ok" size={16} />{t('ac.thanks')}</p>
  return (
    <form className="rounded-xl border border-primary/50 bg-brand/40 p-3 space-y-3" onSubmit={(e) => { e.preventDefault(); onDone({ ...v, day, at: atNow }); setSent(true) }}>
      <p className="font-semibold text-sm flex items-center gap-2"><Icon name="bell" size={16} />{t('ac.form.h', { d: t(`ac.day.${day}` as never) })}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {q('paid', day === 1 ? ['yes', 'notYet', 'no'] : ['yes', 'no'])}
        {q('passport', ['me', 'employer', 'other'])}
        {q('hours', ['ok', 'over'])}
        {q('safe', ['yes', 'no'])}
      </div>
      <label className="block space-y-1 text-sm"><span className="font-medium">{t('ac.note')}</span>
        <input className="input w-full" maxLength={200} value={v.note} onChange={(e) => setV((x) => ({ ...x, note: e.target.value }))} placeholder={t('ac.note.ph')} /></label>
      <div className="flex justify-end"><button type="submit" className="btn-primary"><Icon name="send" size={16} />{t('ac.send')}</button></div>
    </form>
  )
}

/** the word that, written in a check-in note, quietly tells the team the worker is not safe */
function SecretWord({ secret, onSet }: { secret?: string; onSet: (s: string) => void }) {
  const { t } = useI18n()
  const [v, setV] = useState('')
  return (
    <details className="rounded-xl border border-line p-3 text-sm">
      <summary className="cursor-pointer font-medium flex items-center gap-2"><Icon name="lock" size={15} />{t('ac.secret.h')}{secret && <span className="chip bg-ok-bg text-ok-fg border-ok-line text-xs ml-1">{t('ac.secret.set')}</span>}</summary>
      <p className="text-xs text-muted mt-2">{t('ac.secret.d')}</p>
      <form className="flex flex-wrap gap-2 mt-2" onSubmit={(e) => { e.preventDefault(); if (v.trim().length >= 3) { onSet(v.trim()); setV('') } }}>
        <input className="input flex-1 min-w-[10rem]" type="password" autoComplete="off" value={v} onChange={(e) => setV(e.target.value)} placeholder={t('ac.secret.ph')} aria-label={t('ac.secret.h')} />
        <button type="submit" className="btn-ghost" disabled={v.trim().length < 3}>{t(secret ? 'ac.secret.change' : 'ac.secret.save')}</button>
      </form>
    </details>
  )
}

/* ---------- employer review ---------- */
function ReviewBox({ review, employerId, atNow, onSave }: { review?: EmployerReview; employerId: string; atNow: string; onSave: (r: EmployerReview) => void }) {
  const { t } = useI18n()
  const [stars, setStars] = useState(0), [good, setGood] = useState<string[]>([]), [bad, setBad] = useState<string[]>([])
  if (review) return (
    <div className="rounded-xl border border-ok-line bg-ok-bg/50 p-3 space-y-2 text-sm">
      <p className="font-semibold text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('er.done')}</p>
      <p className="text-xs text-muted">{t('er.onPosts')}</p><EmployerRating employerId={employerId} />
    </div>)
  const toggle = (xs: string[], set: (v: string[]) => void, k: string) => set(xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k])
  return (
    <div className="rounded-xl border border-line p-3 space-y-3 text-sm">
      <p className="font-semibold flex items-center gap-2"><Icon name="star" size={16} />{t('er.h')}</p>
      <p className="text-xs text-muted">{t('er.d')}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={t('er.stars')}>{[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t('er.starN', { n })} onClick={() => setStars(n)} className={`er-star ${n <= stars ? 'on' : ''}`}><Icon name="star" size={26} /></button>))}</div>
      {(['good', 'bad'] as const).map((g) => (
        <div key={g} className="space-y-1"><p className="text-xs font-medium">{t(`er.${g}` as never)}</p>
          <div className="flex flex-wrap gap-1.5">{(g === 'good' ? REVIEW_GOOD : REVIEW_BAD).map((k) => { const on = (g === 'good' ? good : bad).includes(k); return (
            <button key={k} type="button" aria-pressed={on} onClick={() => (g === 'good' ? toggle(good, setGood, k) : toggle(bad, setBad, k))}
              className={`chip min-h-[32px] px-3 ${on ? (g === 'good' ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-warn-bg text-warn-fg border-warn-line') : 'bg-surface border-line'}`}>{t(`er.p.${k}` as never)}</button>) })}</div></div>))}
      <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!stars} onClick={() => onSave({ employerId, at: atNow, stars, good, bad })}>{t('er.send')}</button></div>
    </div>
  )
}
/** the anonymous total shown on the employer's posts */
export function EmployerRating({ employerId, compact = false }: { employerId: string; compact?: boolean }) {
  const { t } = useI18n()
  const s = reviewSummary(useReviews(employerId))
  if (!s) return compact ? null : <p className="text-xs text-muted">{t('er.none')}</p>
  return (
    <div className={`er-sum ${compact ? 'inline-flex' : 'flex'} flex-wrap items-center gap-1.5 text-sm`} aria-label={t('er.sum', { avg: s.avg, n: s.n })}>
      <span className="inline-flex items-center gap-1 font-bold"><Icon name="star" size={16} className="er-gold" />{s.avg.toFixed(1)}</span>
      <span className="text-xs text-muted">{t('er.count', { n: s.n })}</span>
      {!compact && s.good.map((k) => <span key={k} className="chip bg-ok-bg text-ok-fg border-ok-line text-xs">{t(`er.p.${k}` as never)}</span>)}
      {!compact && s.bad.map((k) => <span key={k} className="chip bg-warn-bg text-warn-fg border-warn-line text-xs">{t(`er.p.${k}` as never)}</span>)}
    </div>
  )
}

/* ---------- complaints through C.A.L.L. ---------- */
function ComplaintBox({ a, caseKey, country, province, atNow, onFile, onAct, hasCase, arrived }: {
  a: Aftercare; caseKey: string; country: Country; province: string; atNow: string; hasCase: boolean; arrived: boolean
  onFile: (c: Complaint) => void; onAct: (id: string, x: ComplaintAction) => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState<ProblemKind | null>(null), [have, setHave] = useState<string[]>([]), [note, setNote] = useState('')
  const file = () => {
    if (!problem) return
    onFile(fileComplaint({ id: `cm-${Date.parse(atNow)}-${a.complaints.length}`, caseId: caseKey, problem, country, province, note, evidence: have, at: atNow, hasCase, arrived, flags: flagsOf(a) }))
    setOpen(false); setProblem(null); setHave([]); setNote('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-sm">{t('cr.h')}</h3>
        {!open && <button type="button" className="btn-soft text-sm" onClick={() => setOpen(true)}><Icon name="send" size={15} />{t('cr.new')}</button>}</div>
      {open && (
        <div className="rounded-xl border border-line p-3 space-y-3 text-sm">
          <p className="text-xs text-muted">{t('cr.d')}</p>
          <div className="flex flex-wrap gap-1.5">{PROBLEMS.map((p) => (
            <label key={p} className={`chip cursor-pointer min-h-[34px] px-3 ${problem === p ? 'seg-on' : 'bg-surface border-line'}`}>
              <input type="radio" className="sr-only" name="cr-problem" checked={problem === p} onChange={() => { setProblem(p); setHave([]) }} />{t(`rp.p.${p}` as never)}</label>))}</div>
          {problem && <EvidenceList problem={problem} have={have} setHave={setHave} />}
          <label className="block space-y-1"><span className="font-medium">{t('rp.pack.note')}</span><textarea className="input w-full min-h-[70px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t('cr.cancel')}</button>
            <button type="button" className="btn-primary" disabled={!problem} onClick={file}><Icon name="send" size={16} />{t('cr.send')}</button></div>
        </div>)}
      {a.complaints.map((cm) => <ComplaintCard key={cm.id} cm={cm} viewer="worker" onAct={(x) => onAct(cm.id, { ...x, flags: flagsOf(a), hasCase, arrived } as ComplaintAction)} />)}
    </div>
  )
}
function EvidenceList({ problem, have, setHave }: { problem: ProblemKind; have: string[]; setHave: (f: (h: string[]) => string[]) => void }) {
  const { t } = useI18n()
  return (
    <fieldset className="space-y-1"><legend className="text-xs font-medium">{t('rp.pack.evidence')}</legend>
      {EVIDENCE[problem].map((e) => (
        <label key={e} className="flex items-start gap-2 min-h-[26px]"><input type="checkbox" className="mt-1" checked={have.includes(e)} onChange={(x) => setHave((h) => (x.target.checked ? [...h, e] : h.filter((y) => y !== e)))} /><span>{t(`rp.ev.${e}` as never)}</span></label>))}
    </fieldset>
  )
}

const FLOW = ['sent', 'checking', 'forwarded', 'acknowledged'] as const
/** a complaint's progress; the team sees the credibility score and acts, the worker adds evidence when asked */
export function ComplaintCard({ cm, viewer, onAct }: { cm: Complaint; viewer: 'worker' | 'team'; onAct: (x: Omit<ComplaintAction, 'flags' | 'hasCase' | 'arrived'> | ComplaintAction) => void }) {
  const { t } = useI18n()
  const N = useNames()
  const [more, setMore] = useState<string[]>([]), [note, setNote] = useState('')
  const at = cm.status === 'acknowledged' ? 3 : cm.status === 'forwarded' ? 2 : 1
  const lvl = credLevel(cm.score)
  return (
    <div className={`rounded-xl border p-3 space-y-2.5 text-sm ${cm.urgent ? 'border-danger-line' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{t(`rp.p.${cm.problem}` as never)}</span>
        <span className="text-xs text-muted">{N.dayTime(Date.parse(cm.at))}</span>
        {cm.urgent && <span className="chip bg-danger-bg text-danger-fg border-danger-line text-xs">{t('cr.urgent')}</span>}</div>
      <ol className="grid grid-cols-4 gap-1">{FLOW.map((s, i) => (
        <li key={s} className={`rounded-lg px-1.5 py-1.5 text-center text-[11px] leading-tight border ${i < at || (i === at && cm.status !== 'needMore') || i === 0 ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-line text-muted'} ${i === 1 && cm.status === 'needMore' ? '!border-warn-line !bg-warn-bg !text-warn-fg' : ''}`}>
          {t(i === 1 && cm.status === 'needMore' ? 'cr.st.needMore' : `cr.st.${s}` as never)}</li>))}</ol>
      {cm.loc && <p className="text-xs flex flex-wrap items-center gap-1.5"><Icon name="target" size={13} /><span className="text-muted">{t('cr.loc')}</span><span className="tabular-nums">{cm.loc.lat}, {cm.loc.lng}</span><a className="text-primary underline" href={mapLinkOf(cm.loc, cm.country)} target="_blank" rel="noopener noreferrer">{t('hp.loc.map')}</a></p>}
      <p className="text-xs flex flex-wrap items-center gap-1.5"><span className="text-muted">{t('cr.agency')}</span><span className="font-medium">{t(`rp.ag.${cm.agency}` as never)}</span>
        <a className="text-primary underline inline-flex items-center gap-1" href={officeSearch(cm.country, N.prov(cm.province), t(`rp.ag.${cm.agency}` as never))} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={12} />{t('cr.office')}</a></p>
      {viewer === 'team' && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2"><span className="text-xs text-muted">{t('cr.score')}</span>
            <span className={`cr-meter cr-${lvl}`}><span style={{ width: `${cm.score}%` }} /></span><span className="text-xs font-semibold tabular-nums">{cm.score}/100 · {t(`cr.lvl.${lvl}` as never)}</span></div>
          <p className="flex flex-wrap gap-1">{cm.reasons.map((r) => <span key={r} className="chip bg-surface3 border-line text-[11px]">{t(`cr.why.${r}` as never)}</span>)}</p>
          {cm.urgent && <p className="text-xs text-danger-fg">{t('cr.urgent.d')}</p>}
          <div className="flex flex-wrap gap-2">
            {cm.status === 'checking' && <><button type="button" className="btn-primary text-sm" onClick={() => onAct({ kind: 'forward' })}><Icon name="send" size={14} />{t('cr.team.forward')}</button>
              <button type="button" className="btn-ghost text-sm" onClick={() => onAct({ kind: 'askMore' })}>{t('cr.team.askMore')}</button></>}
            {cm.status === 'forwarded' && <button type="button" className="btn-soft text-sm" onClick={() => onAct({ kind: 'acknowledge' })}><Icon name="sim" size={14} />{t('cr.agency.ack')}</button>}
          </div>
        </div>)}
      {viewer === 'worker' && cm.status === 'needMore' && (
        <div className="rounded-lg border border-warn-line bg-warn-bg/60 p-2.5 space-y-2">
          <p className="text-warn-fg font-medium">{t('cr.needMore.d')}</p>
          <EvidenceList problem={cm.problem} have={[...cm.evidence, ...more]} setHave={(f) => setMore(f([...cm.evidence, ...more]).filter((x) => !cm.evidence.includes(x)))} />
          <input className="input w-full" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('cr.more.ph')} />
          <div className="flex justify-end"><button type="button" className="btn-primary text-sm" onClick={() => onAct({ kind: 'addEvidence', evidence: more, note: note.trim() ? `${cm.note}\n${note.trim()}` : '' } as never)}>{t('cr.resend')}</button></div>
        </div>)}
      {viewer === 'worker' && cm.status !== 'needMore' && <p className="text-xs text-muted">{t(`cr.say.${cm.status}` as never)}</p>}
    </div>
  )
}

/** what only the C.A.L.L. team sees: alerts from check-ins and the complaints to act on */
function TeamBox({ arrival, a, today, onAct }: { arrival: string; a: Aftercare; today: string; onAct: (id: string, x: ComplaintAction) => void }) {
  const { t } = useI18n()
  const alerts = teamAlerts(arrival, a.checkins, today)
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary/60 p-3 space-y-2.5">
      <p className="font-semibold text-sm flex items-center gap-2"><Icon name="shield" size={16} className="text-primary" />{t('ac.team.h')}</p>
      <p className="text-xs text-muted">{t('ac.team.d')}</p>
      {alerts.length === 0 ? <p className="text-sm text-ok-fg">{t('ac.team.none')}</p> : (
        <ul className="space-y-1.5">{alerts.map((x, i) => (
          <li key={i} className={`rounded-lg border px-2.5 py-2 text-sm flex items-start gap-2 ${x.kind === 'flag' && (x.flag === 'silent' || x.flag === 'unsafe') ? 'border-danger-line bg-danger-bg text-danger-fg' : 'border-warn-line bg-warn-bg text-warn-fg'}`}>
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" /><span>{x.kind === 'missed' ? t('ac.alert.missed', { d: t(`ac.day.${x.day}` as never) }) : t(`ac.alert.${x.flag}` as never, { d: t(`ac.day.${x.day}` as never) })}</span></li>))}</ul>)}
      {a.complaints.length > 0 && <p className="text-xs font-medium pt-1">{t('ac.team.complaints')}</p>}
      {a.complaints.map((cm) => <ComplaintCard key={cm.id} cm={cm} viewer="team" onAct={(x) => onAct(cm.id, x as ComplaintAction)} />)}
    </div>
  )
}
