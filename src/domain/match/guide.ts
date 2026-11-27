// "What happens now" for a match and its case (owner, 27 Nov 2026: after matching, a friend did not know the next step, nor how
// and when to go about the documents and the training). Pure: which step, who acts on it, what to do, and where to go — the
// page turns it into words. No legal promises: the C.A.L.L. team checks every document; dates come from the team's appointments.
import { currentStep, trainingsLeft, type Case, type CaseStep } from './cases'
import type { Acceptance } from './types'

export type Who = 'you' | 'team' | 'employer' | 'worker'
export type GuideLink = 'chat' | 'contract' | 'docs' | 'calendar' | 'verify' | 'board' | 'sos'
export interface Guide {
  /** the step this is about ('apply…' before a case exists, 'done' after arrival) */
  key: CaseStep | 'applied' | 'queue' | 'declined' | 'done'
  who: Who[]
  /** where the person can act now */
  links: GuideLink[]
  /** the step after this one (null = none) */
  next: CaseStep | 'case' | 'checkins' | null
  /** appointment days that matter now (yyyy-mm-dd), by kind */
  dates: { kind: 'documents' | 'language' | 'skill' | 'start' | 'departure' | 'training'; day: string; name?: string }[]
  /** courses still to finish (training step) */
  left?: number
}
const NEXT: Partial<Record<CaseStep, CaseStep | 'checkins'>> = { submitted: 'accepted', accepted: 'documents', documents: 'tests', tests: 'training', training: 'permit', permit: 'departure', departure: 'arrived', arrived: 'checkins' }

/** before a case: the application itself */
export function applicationGuide(a: Acceptance): Guide {
  if (a.status === 'reserved') return { key: 'queue', who: ['employer'], links: ['board'], next: 'case', dates: [] }
  if (a.status === 'rejected') return { key: 'declined', who: ['you'], links: ['board'], next: null, dates: [] }
  return { key: 'applied', who: ['employer'], links: ['chat'], next: 'case', dates: [] }
}

/** inside a case: the current step for the worker ('seeker') or the employer */
export function caseGuide(c: Case, view: 'seeker' | 'employer'): Guide {
  const cur = currentStep(c)
  const seeker = view === 'seeker'
  if (!cur) return { key: 'done', who: [seeker ? 'you' : 'worker'], links: seeker ? ['sos'] : ['chat'], next: null, dates: [] }
  const dates: Guide['dates'] = []
  const add = (kind: Guide['dates'][number]['kind'], day?: string | null, name?: string) => { if (day) dates.push({ kind, day, ...(name ? { name } : {}) }) }
  const base = { key: cur, next: NEXT[cur] ?? null, dates }
  switch (cur) {
    case 'opened': case 'submitted': // waiting for the employer's verification before the team gets the case
      return { ...base, key: 'submitted', next: 'accepted', who: [seeker ? 'employer' : 'you'], links: seeker ? ['chat'] : ['verify', 'chat'] }
    case 'accepted':
      return { ...base, who: ['team'], links: seeker ? ['docs', 'chat'] : ['contract', 'chat'] }
    case 'documents':
      add('documents', c.dates.documents)
      return { ...base, who: seeker ? ['you', 'team'] : ['you', 'worker'], links: seeker ? ['docs', 'contract'] : ['contract', 'chat'] }
    case 'tests':
      add('language', c.dates.language); add('skill', c.dates.skill)
      return { ...base, who: seeker ? ['you', 'team'] : ['team'], links: ['calendar'] }
    case 'training':
      for (const x of c.trainings) if (!x.done) add('training', x.date, x.name)
      return { ...base, who: seeker ? ['you', 'team'] : ['worker'], links: ['calendar'], left: trainingsLeft(c) }
    case 'permit':
      return { ...base, who: ['team'], links: ['calendar'] }
    case 'departure':
      add('departure', c.departureDate); add('start', c.dates.start)
      return { ...base, who: seeker ? ['team', 'you'] : ['team', 'you'], links: ['calendar', 'chat'] }
    case 'arrived':
      add('start', c.dates.start)
      return { ...base, who: seeker ? ['you', 'employer'] : ['you'], links: ['chat'] }
  }
}
