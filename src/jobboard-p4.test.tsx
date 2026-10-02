// P4: Worker and Employer workflows. Static rendering (react-dom/server) checks what each persona sees; clicks, dialogs and focus
// are not exercised here (no DOM in this test setup) and were checked manually in a browser instead.
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { StoreProvider, go } from './store'
import { PersonaProvider } from './persona'
import { JobBoardProvider } from './jobboardData'
import { createPersistentRepo } from './domain/jobboard/persist'
import { JOBBOARD_SEED } from './data/seed/jobboard'
import type { Actor } from './domain/jobboard/types'
import { EmployerApplications, EmployerJobs, JobDetail, JobList, MyApplications, OrgOverview, WorkerProfileView } from './pages/jobboard'
import type { MsgKey } from './locales'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
const html = (node: ReactNode, persona?: string) => renderToStaticMarkup(<LanguageProvider><StoreProvider><PersonaProvider initialKey={persona}><JobBoardProvider storage={null}>{node}</JobBoardProvider></PersonaProvider></StoreProvider></LanguageProvider>)
const title = (id: string) => JOBBOARD_SEED.jobs.find((j) => j.id === id)!.title.replace(' (Synthetic)', '')
const ploy: Actor = { kind: 'worker', workerId: 'wkr_0001' }
const narin: Actor = { kind: 'worker', workerId: 'wkr_0002' }
const empA: Actor = { kind: 'employer', organizationId: 'org_0001' }
const empB: Actor = { kind: 'employer', organizationId: 'org_0002' }

describe('P4 worker: job list and detail', () => {
  it('lists only jobs the policy lets the persona read, each tagged fictional', () => {
    for (const p of [undefined, 'worker:wkr_0001']) {
      const page = html(<JobList />, p)
      for (const id of ['job_0001', 'job_0004', 'job_0006']) expect(page, `${p} ${id}`).toContain(esc(title(id)))
      for (const id of ['job_0002', 'job_0003', 'job_0005', 'job_0007']) expect(page, `${p} ${id}`).not.toContain(esc(title(id)))
      expect(page).toContain(T('jb.count', { n: 3 }))
      expect(page.split(T('persona.fictional')).length - 1).toBeGreaterThanOrEqual(3)
      expect(page).not.toContain('(Synthetic)')
      expect(page).toContain('href="/jobs?job=job_0001"')
    }
  })
  it('invalid, unknown and inaccessible job ids are handled without showing the job', () => {
    expect(html(<JobDetail id="job 1; drop" />)).toContain(T('jb.detail.invalid'))
    expect(html(<JobDetail id="" />)).toContain(T('jb.detail.invalid'))
    expect(html(<JobDetail id="job_9999" />)).toContain(T('jb.detail.notFound'))
    const draft = html(<JobDetail id="job_0003" />, 'worker:wkr_0001') // org A's draft
    expect(draft).toContain(T('jb.detail.denied'))
    expect(draft).not.toContain(esc(title('job_0003')))
    expect(html(<JobDetail id="job_0003" />, 'employer:org_0001')).toContain(esc(title('job_0003'))) // its own employer may see it
    for (const p of [undefined, 'worker:wkr_0001', 'employer:org_0001']) expect(html(<JobDetail id="job_0002" />, p)).toContain(p === 'employer:org_0001' ? esc(title('job_0002')) : T('jb.detail.denied'))
  })
  it('the apply box: visitors are asked to switch, open jobs offer a confirmation, applied and closed jobs say so', () => {
    expect(html(<JobDetail id="job_0004" />)).toContain(T('jb.apply.asWorker'))
    const open = html(<JobDetail id="job_0004" />, 'worker:wkr_0001')
    expect(open).toContain(T('jb.apply'))
    expect(open).toContain('<dialog') // the confirmation exists but is closed until the worker clicks
    expect(open).toContain(T('jb.apply.dlg.d'))
    expect(html(<JobDetail id="job_0001" />, 'worker:wkr_0001')).toContain(T('jb.apply.already', { s: tr('jb.status.under_review', undefined, 'th') }))
    expect(html(<JobDetail id="job_0006" />, 'worker:wkr_0002')).toContain(T('jb.detail.closed'))
  })
  it('an application is created only from the confirmation dialog, with the explicit confirmed flag', () => {
    const s = src('./pages/jobboard.tsx')
    const calls = [...s.matchAll(/submitApplication\(/g)]
    expect(calls).toHaveLength(1)
    const before = s.slice(0, calls[0].index)
    expect(before.slice(before.lastIndexOf('<ConfirmDialog'))).toMatch(/onConfirm=\{\(\) => \{ setOpen\(false\); const r = mutate\(\(rp\) => rp\.$/)
    expect(s.slice(calls[0].index!, calls[0].index! + 80)).toContain('confirmed: true')
    expect(s).not.toMatch(/useEffect\([^)]*submitApplication/)
  })
})

describe('P4 worker: profile and applications', () => {
  it('the profile form edits only structured, permitted fields, with no identity or document fields', () => {
    const page = html(<WorkerProfileView />, 'worker:wkr_0001')
    expect(page).toContain(T('jb.prof.hint'))
    expect(page).toContain('Ploy')
    expect(page).not.toMatch(/type="file"|passport|email|phone|tel:/i)
    expect(page).toContain(T('jb.save'))
    expect(html(<WorkerProfileView />, 'employer:org_0001')).toBe('') // not a worker: nothing is read
  })
  it('a worker sees only their own applications, with status history', () => {
    const page = html(<MyApplications />, 'worker:wkr_0001')
    expect(page).toContain(esc(title('job_0001'))) // app_0001
    expect(page).toContain(esc(title('job_0006'))) // app_0004
    expect(page).not.toContain(esc(title('job_0004'))) // Narin's application
    expect(page).toContain(T('jb.apps.timeline'))
    expect(page).toContain(T('jb.apps.sim'))
    const n = html(<MyApplications />, 'worker:wkr_0002')
    expect(n).toContain(esc(title('job_0004')))
    expect(n).not.toContain(esc(title('job_0006')))
  })
  it('withdraw is offered only where the worker may withdraw, and only for their own application', () => {
    const page = html(<MyApplications />, 'worker:wkr_0001').replace(/<dialog[\s\S]*?<\/dialog>/g, '') // ignore the (closed) confirmation dialog
    expect(page.split(`>${T('jb.withdraw')}</button>`).length - 1).toBe(1) // app_0001 (under review) yes; app_0004 (not selected) no
    const { repo } = createPersistentRepo(null)
    expect(repo.transitionApplication(narin, 'app_0001', 'withdrawn').ok).toBe(false)
    expect(repo.transitionApplication(ploy, 'app_0001', 'withdrawn').ok).toBe(true)
    const again = repo.transitionApplication(ploy, 'app_0001', 'withdrawn')
    expect(again.ok ? 'ok' : again.error).toBe('invalid') // already withdrawn
  })
  it('duplicate, unconfirmed and closed-job applications are refused', () => {
    const { repo } = createPersistentRepo(null)
    const codes = [repo.submitApplication(ploy, { jobId: 'job_0001', confirmed: true }), repo.submitApplication(ploy, { jobId: 'job_0004' } as never), repo.submitApplication(narin, { jobId: 'job_0006', confirmed: true }), repo.submitApplication(empA, { jobId: 'job_0004', confirmed: true })]
      .map((r) => (r.ok ? 'ok' : r.error))
    expect(codes).toEqual(['conflict', 'invalid', 'conflict', 'unauthorized'])
  })
})

describe('P4 employer', () => {
  it('the organisation overview shows only the actor\'s own organisation and its simulated status', () => {
    const page = html(<OrgOverview />, 'employer:org_0003')
    expect(page).toContain('Placeholder Data Studio')
    expect(page).toContain(T('jb.verif.pending'))
    expect(page).not.toContain('Example Precision Parts')
    expect(page).not.toContain(T('jb.org.request')) // already pending
  })
  it('the jobs tab lists only the organisation\'s own posts (including drafts), not other employers\' posts', () => {
    const page = html(<EmployerJobs />, 'employer:org_0001')
    for (const id of ['job_0001', 'job_0002', 'job_0003']) expect(page, id).toContain(esc(title(id)))
    for (const id of ['job_0004', 'job_0005', 'job_0006', 'job_0007']) expect(page, id).not.toContain(esc(title(id)))
    expect(page).toContain(T('jb.ej.new'))
    expect(page).toContain(T('jb.ej.pendingNote'))
    expect(page).not.toContain('<form') // opening the page never starts or creates a post
  })
  it('organisation status rules: a pending organisation may draft but not submit; a rejected one may not create', () => {
    const page = html(<EmployerJobs />, 'employer:org_0003')
    expect(page).toContain(esc(title('job_0007')))
    expect(page).toContain(T('jb.ej.edit'))
    expect(page).not.toContain(`>${T('jb.ej.submit')}<`)
    expect(page).toContain(T('jb.verif.pending.d'))
    const { repo } = createPersistentRepo(null)
    const sub = repo.submitJob({ kind: 'employer', organizationId: 'org_0003' }, 'job_0007')
    expect(sub.ok ? 'ok' : sub.error).toBe('unauthorized')
    const make = repo.createJob({ kind: 'employer', organizationId: 'org_0004' }, { title: 'Clerk (Synthetic)', industry: 'logistics', skills: ['marketing'], minYears: 0, province: 'CN-ZJ', contractMonths: 6 })
    expect(make.ok ? 'ok' : make.error).toBe('unauthorized')
  })
  it('applications: only those for the organisation\'s own jobs, applicant shown through the application, only allowed moves', () => {
    const a = html(<EmployerApplications />, 'employer:org_0001')
    expect(a).toContain('Ploy'); expect(a).toContain('Narin') // both applied to job_0001
    expect(a).not.toContain(esc(title('job_0004')))
    expect(a).toContain(T('jb.action.shortlisted')) // app_0001 is under review
    expect(a).toContain(T('jb.action.closed')) // app_0003 is shortlisted
    expect(a).toContain(T('jb.rv.note'))
    const b = html(<EmployerApplications />, 'employer:org_0002')
    expect(b).not.toContain(esc(title('job_0001')))
    expect(b).toContain(esc(title('job_0004')))
  })
  it('the repository blocks cross-employer reads and applicant profiles without a relationship', () => {
    const { repo } = createPersistentRepo(null)
    const code = (r: { ok: boolean; error?: string }) => (r.ok ? 'ok' : r.error)
    expect(code(repo.getApplication(empB, 'app_0001'))).toBe('unauthorized')
    expect(code(repo.getApplicant(empB, 'app_0001'))).toBe('unauthorized')
    expect(code(repo.getApplicant(empA, 'app_0001'))).toBe('ok')
    expect(code(repo.getApplicant(narin, 'app_0001'))).toBe('unauthorized')
    expect(code(repo.getWorker(empA, 'wkr_0001'))).toBe('unauthorized') // only through the application
    expect(code(repo.transitionApplication(empA, 'app_0001', 'closed'))).toBe('invalid')
    expect(code(repo.transitionApplication(empB, 'app_0001', 'shortlisted'))).toBe('unauthorized')
  })
})

describe('P4 navigation and scope', () => {
  const g = globalThis as { window?: unknown }
  afterEach(() => { delete g.window })
  it('go() navigates when only the query string changes, and not when nothing changes', () => {
    const pushed: string[] = []
    const loc = { pathname: '/jobs', search: '?job=job_0001' }
    g.window = { location: loc, history: { pushState: (_: unknown, __: string, u: string) => { pushed.push(u); const [p, q] = u.split('?'); loc.pathname = p; loc.search = q ? `?${q}` : '' } }, dispatchEvent: () => true, scrollTo: () => {} }
    go('jobs'); go('jobs'); go('jobs?view=profile'); go('dashboard')
    expect(pushed).toEqual(['/jobs', '/jobs?view=profile', '/dashboard'])
  })
  it('legacy routes are all still registered next to the job-board routes', () => {
    const app = src('./App.tsx')
    for (const r of ['start', 'direction', 'interview', 'profile', 'dashboard', 'analysis', 'ownership', 'nominee', 'employment', 'contract', 'language', 'plan', 'navigator', 'employee', 'risk', 'roadmap', 'documents', 'monitoring', 'sources', 'pricing', 'privacy', 'admin', 'jobs', 'employer'])
      expect(app, r).toMatch(new RegExp(`[\\s{,]${r}: <`))
  })
  it('no document upload, payment, external request or government submission was introduced', () => {
    for (const f of ['./pages/jobboard.tsx', './jobboardData.tsx', './domain/jobboard/persist.ts', './components/jobboard.tsx', './persona.tsx']) {
      const s = src(f)
      expect(s, f).not.toMatch(/type="file"|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|https?:\/\/|payment|checkout|stripe/i)
    }
  })
})
