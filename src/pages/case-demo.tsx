// v2 model (owner, Nov 2026: "the new systems must be easy to see"): a sample case that has reached the departure day, so the
// arrival confirmed by both sides, the late-arrival alert, the document scans, the contract check and then the whole end system
// (check-ins, secret word, review, complaints through C.A.L.L. and the team's view) can be shown without an account or a real match.
// Nothing reaches the system: the case lives in this browser tab (sessionStorage) and "Start again" clears it. Buttons move the
// demo's day forward so day 7 and day 30 can be shown on stage.
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useMatch } from '../matchData'
import { DOCS, applyCaseAction, newCase, parseCase, type Case, type CaseAction } from '../domain/match/cases'
import { localDay, type Outcome } from '../domain/match/logic'
import { dueDay, type CheckDay } from '../domain/match/aftercare'
import { ME } from '../domain/match/types'
import { removeFile } from '../caseFiles'
import { clearAftercare } from '../aftercareStore'
import { clearChat } from '../chatStore'
import { Warn } from '../components/ui'
import { Icon } from '../components/icons'
import { CaseView } from './case'
import { AftercarePanel, arrivalDay } from './aftercare'

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()
const KEY = 'call.demoCase.v1'
/** the employer of the demo case (its anonymous review total shows on the demo page) */
export const DEMO_EMPLOYER = 'emp-demo'
/** days ago the worker left in the demo: more than the 2-day grace, so the alert shows until both sides confirm */
export const DEMO_DEPARTED_DAYS_AGO = 3
/** the demo case: every step up to the departure done, the worker on the way, nobody has confirmed the arrival yet */
export function demoCase(now: number): Case {
  const c = newCase('demo', { id: 'acc-demo', postId: 'post-demo', seekerId: ME }, iso(now - DAY * 40), true)
  const left = now - DAY * DEMO_DEPARTED_DAYS_AGO
  return {
    ...c,
    steps: { ...c.steps, accepted: iso(now - DAY * 39), documents: iso(now - DAY * 30), tests: iso(now - DAY * 22), training: iso(now - DAY * 12), permit: iso(now - DAY * 6), departure: iso(left) },
    docs: { passport: true, health: true, contract: true }, tests: { language: true, skill: true }, permit: { workPermit: true, visa: true },
    trainings: c.trainings.map((x) => ({ ...x, done: true })),
    departureDate: localDay(iso(left)),
  }
}
const loadDemo = (now: number): Case => { try { const v = parseCase(JSON.parse(sessionStorage.getItem(KEY) ?? 'null')); return v ?? demoCase(now) } catch { return demoCase(now) } }

export function CaseDemoPage() {
  const { t } = useI18n()
  const { now } = useMatch()
  const [c, setC] = useState(() => loadDemo(now))
  const [as, setAs] = useState<'seeker' | 'employer'>('seeker')
  const [jump, setJump] = useState<CheckDay | 10 | null>(null)
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(c)) } catch { /* private mode: the demo still runs */ } }, [c])
  const arrival = arrivalDay(c)
  // the demo's "today": the real day, or a day after arrival picked with the buttons
  const today = arrival && jump ? dueDay(arrival, (jump === 10 ? 10 : jump) as CheckDay) : localDay(iso(now))
  const atNow = `${today}T09:00:00.000Z` > iso(now) ? `${today}T09:00:00.000Z` : iso(now)
  const act = async (a: CaseAction): Promise<Outcome<unknown>> => {
    const r = applyCaseAction(c, a, iso(now), localDay(iso(now)))
    if (r.ok) setC(r.value)
    return r.ok ? r : { ok: false, problem: r.problem === 'name' ? 'caseText' : r.problem === 'available' ? 'departDate' : r.problem === 'contact' ? 'contact' : 'state' }
  }
  const restart = () => { for (const d of DOCS) removeFile('demo', d); clearAftercare('demo'); clearChat('acc-demo'); try { sessionStorage.removeItem(KEY) } catch { /* ignore */ } setC(demoCase(now)); setAs('seeker'); setJump(null) }
  const pick = (k: 'seeker' | 'employer') => (
    <button key={k} type="button" role="tab" aria-selected={as === k} onClick={() => setAs(k)}
      className={`min-h-[36px] px-3 rounded-lg text-sm ${as === k ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`dm.as.${k}` as never)}</button>)
  const top = (
    <div className="space-y-2">
      <Warn tone="info">{t('dm.note')}</Warn>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('dm.as')}</span>
        <div role="tablist" aria-label={t('dm.as')} className="flex gap-1 rounded-xl border border-line bg-surface p-1">{pick('seeker')}{pick('employer')}</div>
        <button type="button" className="btn-ghost text-sm" onClick={restart}><Icon name="renew" size={15} />{t('dm.reset')}</button>
      </div>
      {arrival && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('dm.jump')}>
          <span className="text-sm font-medium flex items-center gap-1.5"><Icon name="fastForward" size={15} />{t('dm.jump')}</span>
          {([null, 3, 7, 10, 15, 30] as const).map((d) => (
            <button key={String(d)} type="button" aria-pressed={jump === d} onClick={() => setJump(d)} className={`min-h-[34px] px-3 rounded-lg border text-sm ${jump === d ? 'seg-on border-primary' : 'border-line hover:bg-surface3'}`}>{t(d === null ? 'dm.jump.today' : `dm.jump.${d}` as never)}</button>))}
        </div>)}
    </div>)
  const after = arrival
    ? <AftercarePanel c={c} caseKey="demo" employerId={DEMO_EMPLOYER} country="TH" province="TH-10" today={today} view={as} team atNow={atNow} />
    : null
  return <CaseView key={as} c={c} sub={`${t('c2.sample.position')} · ${t('c2.sample.company')}`} title={t('dm.title')} top={top}
    isSeeker={as === 'seeker'} isEmployer={as === 'employer'} withName={null} agency={false} act={act} contractTo="contract" chatTo="chat?acc=acc-demo" extra={after} />
}
