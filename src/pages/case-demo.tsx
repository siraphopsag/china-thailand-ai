// v2 model (owner, Nov 2026: "the new systems must be easy to see"): a sample case that has reached the departure day, so the
// arrival confirmed by both sides, the late-arrival alert, the document scans and the contract check can be shown without an
// account or a real match. Nothing is saved: the case lives in this page only and starts again when the page opens.
import { useState } from 'react'
import { useI18n } from '../i18n'
import { useMatch } from '../matchData'
import { DOCS, applyCaseAction, newCase, type Case, type CaseAction } from '../domain/match/cases'
import { removeFile } from '../caseFiles'
import { localDay, type Outcome } from '../domain/match/logic'
import { ME } from '../domain/match/types'
import { Warn } from '../components/ui'
import { Icon } from '../components/icons'
import { CaseView } from './case'

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()
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

export function CaseDemoPage() {
  const { t } = useI18n()
  const { now } = useMatch()
  const [c, setC] = useState(() => demoCase(now))
  const [as, setAs] = useState<'seeker' | 'employer'>('seeker')
  const act = async (a: CaseAction): Promise<Outcome<unknown>> => {
    const r = applyCaseAction(c, a, new Date(now).toISOString(), localDay(new Date(now).toISOString()))
    if (r.ok) setC(r.value)
    return r.ok ? r : { ok: false, problem: r.problem === 'name' ? 'caseText' : r.problem === 'available' ? 'departDate' : r.problem === 'contact' ? 'contact' : 'state' }
  }
  const pick = (k: 'seeker' | 'employer') => (
    <button key={k} type="button" role="tab" aria-selected={as === k} onClick={() => setAs(k)}
      className={`min-h-[36px] px-3 rounded-lg text-sm ${as === k ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`dm.as.${k}` as never)}</button>)
  const top = (
    <div className="space-y-2">
      <Warn tone="info">{t('dm.note')}</Warn>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('dm.as')}</span>
        <div role="tablist" aria-label={t('dm.as')} className="flex gap-1 rounded-xl border border-line bg-surface p-1">{pick('seeker')}{pick('employer')}</div>
        <button type="button" className="btn-ghost text-sm" onClick={() => { for (const d of DOCS) removeFile('demo', d); setC(demoCase(now)); setAs('seeker') }}><Icon name="renew" size={15} />{t('dm.reset')}</button>
      </div>
    </div>)
  return <CaseView key={as} c={c} sub={`${t('c2.sample.position')} · ${t('c2.sample.company')}`} title={t('dm.title')} top={top}
    isSeeker={as === 'seeker'} isEmployer={as === 'employer'} withName={null} agency={false} act={act} contractTo="contract" />
}
