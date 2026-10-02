// P5: simulated review workspace (/review) and audit history. Static rendering (react-dom/server) checks what each persona sees;
// clicking, dialogs, Escape and focus are not exercised here (no DOM in this test setup) and were checked manually in a browser.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { StoreProvider } from './store'
import { PersonaProvider } from './persona'
import { JobBoardProvider } from './jobboardData'
import { JOBBOARD_KEY, createPersistentRepo, type KV } from './domain/jobboard/persist'
import { createMemoryRepo } from './domain/jobboard/repo'
import { JOBBOARD_SEED } from './data/seed/jobboard'
import { REVIEW_REASONS, AUDIT_ACTIONS, ORG_VERIFICATION, JOB_REVIEW, type Actor } from './domain/jobboard/types'
import { messages, type MsgKey } from './locales/index'
import { review } from './locales/review'
import { AuditLog, ReviewPage, ReviewWorkspace, isReviewReason } from './pages/review'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string | number>) => esc(tr(k, v, 'th'))
const mem = (text?: string): KV => { const m = new Map<string, string>(text ? [[JOBBOARD_KEY, text]] : []); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) }, removeItem: (k) => { m.delete(k) } } }
const html = (node: ReactNode, persona?: string, storage: KV | null = null) => renderToStaticMarkup(<LanguageProvider><StoreProvider><PersonaProvider initialKey={persona}><JobBoardProvider storage={storage}>{node}</JobBoardProvider></PersonaProvider></StoreProvider></LanguageProvider>)
const ADMIN = 'admin:adm_0001'
const admin: Actor = { kind: 'admin', adminId: 'adm_0001' }
const ORG3 = 'Placeholder Data Studio', JOB2 = 'Production Planning Lead'
const code = (r: { ok: boolean; error?: string }) => (r.ok ? 'ok' : r.error)

describe('P5 route and the legacy /admin page', () => {
  const app = src('./App.tsx')
  it('/review is a separate route; /admin still renders the legal-status AdminPage from pages/ops', () => {
    expect(app).toMatch(/review: <ReviewPage \/>/)
    expect(app).toMatch(/import\('\.\/pages\/review'\)/)
    expect(app).toMatch(/admin: <AdminPage \/>/)
    expect(app).toMatch(/const AdminPage = lazy\(\(\) => import\('\.\/pages\/ops'\)/)
    expect(src('./pages/review.tsx')).not.toMatch(/pages\/ops|AdminPage|adm\./)
    expect(src('./pages/ops.tsx')).toMatch(/export function AdminPage\(\)[\s\S]*t\('adm\.title'\)/)
    expect(src('./pages/ops.tsx')).not.toMatch(/from '\.\/(jobboard|review)'|components\/jobboard|jobboardData|domain\/jobboard/) // the legal page was not mixed with the simulation
  })
  it('the page always shows the simulation notice (compact, with every limitation in its details) and the "not real verification" disclaimer', () => {
    for (const p of [undefined, 'worker:wkr_0001', ADMIN]) {
      const page = html(<ReviewPage />, p)
      for (const k of ['rv.title', 'jb.notice.short', 'jb.notice.1', 'jb.notice.3', 'jb.notice.4', 'rv.disclaimer'] as const) expect(page, `${p} ${k}`).toContain(T(k))
      expect(page).toContain('href="/jobs"'); expect(page).toContain('href="/"')
    }
  })
})

describe('P5 access through the persona and the repository', () => {
  it('visitors, workers and employers see no queues and no history, only how to switch to the simulated reviewer', () => {
    for (const p of [undefined, 'worker:wkr_0001', 'worker:wkr_0002', 'employer:org_0001', 'employer:org_0003']) {
      const page = html(<ReviewPage />, p)
      expect(page, p).toContain(T('rv.gate'))
      expect(page, p).toContain(T('jb.switchTo', { role: tr('persona.role.admin', undefined, 'th') }))
      for (const s of [T('rv.org.h'), T('rv.job.h'), T('rv.audit.h'), ORG3, esc(JOB2)]) expect(page, `${p} ${s}`).not.toContain(s)
    }
  })
  it('the repository refuses the queue and the history to every non-admin actor', () => {
    const repo = createMemoryRepo()
    for (const a of [{ kind: 'visitor' }, { kind: 'worker', workerId: 'wkr_0001' }, { kind: 'employer', organizationId: 'org_0001' }, { kind: 'admin', adminId: 'adm_9999' }] as Actor[]) {
      expect(code(repo.listReviewQueue(a)), a.kind).toBe('unauthorized')
      expect(code(repo.listAuditEvents(a)), a.kind).toBe('unauthorized')
    }
  })
  it('with the simulated reviewer the workspace shows both queues and the history', () => {
    const page = html(<ReviewPage />, ADMIN)
    expect(page).not.toContain(T('rv.gate'))
    for (const s of [T('rv.org.h'), T('rv.job.h'), T('rv.audit.h'), ORG3, esc(JOB2), T('rv.audit.count', { n: JOBBOARD_SEED.auditEvents.length })]) expect(page, s).toContain(s)
  })
  it('the queues are exactly what the repository authorises: pending organisations and jobs waiting for review', () => {
    const q = createMemoryRepo().listReviewQueue(admin)
    expect(q.ok && q.value.organizations.map((o) => o.id)).toEqual(['org_0003'])
    expect(q.ok && q.value.jobs.map((j) => j.id)).toEqual(['job_0002'])
    const page = html(<ReviewWorkspace />, ADMIN).replace(/<dialog[\s\S]*?<\/dialog>/g, '')
    for (const id of ['job_0001', 'job_0003', 'job_0004', 'job_0005', 'job_0006', 'job_0007']) expect(page, id).not.toContain(esc(JOBBOARD_SEED.jobs.find((j) => j.id === id)!.title.replace(' (Synthetic)', '')) + '</h3>')
    for (const n of ['Example Precision Parts</h3>', 'Sample Riverside Hotels</h3>', 'Fictional Trading House</h3>']) expect(page, n).not.toContain(n)
    expect(page.split(`>${T('rv.decision.reject')}</button>`).length - 1).toBe(2) // one per queued item
  })
})

describe('P5 decisions: confirmation and reason codes', () => {
  const s = src('./pages/review.tsx')
  it('reviewOrganization and reviewJob are called only from the confirm handler, after the reason check', () => {
    expect([...s.matchAll(/reviewOrganization\(/g)]).toHaveLength(1)
    expect([...s.matchAll(/reviewJob\(/g)]).toHaveLength(1)
    const handler = s.slice(s.indexOf('const confirm = () => {'), s.indexOf('const name = pending'))
    expect(handler).toMatch(/if \(!p \|\| busy\.current \|\| !isReviewReason\(reason\)\) return/)
    expect(handler).toContain('reviewOrganization(')
    expect(handler).toContain('reviewJob(')
    expect(s).toMatch(/onConfirm=\{confirm\}/)
    expect(s).toMatch(/okDisabled=\{!isReviewReason\(reason\)\}/) // the confirm button stays disabled without a reason
  })
  it('cancel / Escape (the dialog onClose) only closes the dialog; opening resets the reason', () => {
    expect(s).toMatch(/const close = \(\) => setPending\(null\) \/\/ cancel/)
    expect(s).toMatch(/onClose=\{close\}/)
    expect(s).toMatch(/const open = \(p: Pending\) => \{ setReason\(''\); setPending\(p\) \}/)
  })
  it('the shared dialog follows Escape itself (regression: it could not be reopened after Escape)', () => {
    const jb = src('./pages/jobboard.tsx')
    const dlg = jb.slice(jb.indexOf('export function ConfirmDialog'), jb.indexOf('export function RoleGate'))
    expect(dlg).toMatch(/addEventListener\('cancel', onCancel\)/)
    expect(dlg).toMatch(/const onCancel = \(e: Event\) => \{ e\.preventDefault\(\); closeRef\.current\(\) \}/) // Escape → parent's close, never onConfirm
    expect(dlg).toMatch(/addEventListener\('close', onNativeClose\)/)
    expect(dlg).not.toMatch(/onConfirm\(\)|closeRef\.current = onConfirm/)
  })
  it('only the predefined reason codes count as a reason; free text never does', () => {
    for (const r of REVIEW_REASONS) expect(isReviewReason(r)).toBe(true)
    for (const bad of ['', 'Looks fine to me', 'information_consistent ', 'OTHER', null, undefined, 1]) expect(isReviewReason(bad)).toBe(false)
    const repo = createMemoryRepo()
    expect(code(repo.reviewOrganization(admin, 'org_0003', 'verify', 'approved after a call' as never))).toBe('invalid')
    expect(code(repo.reviewJob(admin, 'job_0002', 'approve', '' as never))).toBe('invalid')
    expect(repo.listReviewQueue(admin).ok && repo.snapshot().auditEvents.length).toBe(JOBBOARD_SEED.auditEvents.length)
    expect(s).not.toMatch(/<textarea|type="text"/) // the dialog offers radio buttons only
  })
  it('invalid or unauthorized decisions are refused by the repository (and the page maps them to messages)', () => {
    const repo = createMemoryRepo()
    expect(code(repo.reviewJob(admin, 'job_0001', 'approve', 'other'))).toBe('unauthorized') // already approved
    expect(code(repo.reviewOrganization(admin, 'org_0001', 'reject', 'other'))).toBe('unauthorized') // already verified
    expect(code(repo.reviewJob(admin, 'job_9999', 'approve', 'other'))).toBe('not_found')
    expect(code(repo.reviewJob(admin, 'job 2', 'approve', 'other'))).toBe('invalid')
    expect(code(repo.reviewJob({ kind: 'employer', organizationId: 'org_0001' }, 'job_0002', 'approve', 'other'))).toBe('unauthorized')
    expect(code(repo.reviewJob(admin, 'job_0002', 'publish' as never, 'other'))).toBe('invalid')
    expect(s).toMatch(/report\(r, t\(`rv\.done/) // failures go through the shared localized error text
  })
})

describe('P5 successful decisions update the queues and the audit history', () => {
  it('approving the organisation and rejecting the job empties both queues and appends two audit events', () => {
    const kv = mem()
    const { repo } = createPersistentRepo(kv)
    expect(code(repo.reviewOrganization(admin, 'org_0003', 'verify', 'information_consistent'))).toBe('ok')
    expect(code(repo.reviewJob(admin, 'job_0002', 'reject', 'information_incomplete'))).toBe('ok')
    const q = repo.listReviewQueue(admin)
    expect(q.ok && [q.value.organizations.length, q.value.jobs.length]).toEqual([0, 0])
    const log = repo.listAuditEvents(admin)
    expect(log.ok && log.value.slice(-2).map((e) => [e.action, e.target.id, e.from, e.to, e.reason, e.adminId])).toEqual([
      ['org.verify', 'org_0003', 'pending', 'verified', 'information_consistent', 'adm_0001'],
      ['job.reject', 'job_0002', 'pending_review', 'rejected', 'information_incomplete', 'adm_0001'],
    ])
    // the saved data, as the page would load it after a reload
    const page = html(<ReviewWorkspace />, ADMIN, kv)
    expect(page).toContain(T('rv.org.empty'))
    expect(page).toContain(T('rv.job.empty'))
    expect(page).toContain(T('rv.audit.count', { n: JOBBOARD_SEED.auditEvents.length + 2 }))
    const first = page.indexOf(T('rv.audit.action.job.reject')), seedEntry = page.indexOf(T('rv.audit.action.job.approve'))
    expect(first).toBeGreaterThan(-1); expect(first).toBeLessThan(seedEntry) // newest first
    expect(page).toContain(T('rv.reason.information_incomplete'))
  })
  it('an organisation that becomes verified can then submit its draft, which joins the job queue', () => {
    const { repo } = createPersistentRepo(null)
    repo.reviewOrganization(admin, 'org_0003', 'verify', 'information_consistent')
    expect(code(repo.submitJob({ kind: 'employer', organizationId: 'org_0003' }, 'job_0007'))).toBe('ok')
    const q = repo.listReviewQueue(admin)
    expect(q.ok && q.value.jobs.map((j) => j.id).sort()).toEqual(['job_0002', 'job_0007'])
  })
})

describe('P5 audit display and data boundaries', () => {
  it('the history is read-only: no edit/delete controls, and the repository has no audit mutation', () => {
    const log = html(<AuditLog />, ADMIN)
    expect(log).not.toMatch(/<button|<input|<select|<textarea|contenteditable/)
    expect(log.split('<li').length - 1).toBe(JOBBOARD_SEED.auditEvents.length)
    expect(Object.keys(createMemoryRepo()).filter((k) => /audit/i.test(k))).toEqual(['listAuditEvents'])
    expect(src('./pages/review.tsx')).not.toMatch(/auditEvents\s*[.=[]|localStorage|snapshot\(/)
  })
  it('localized labels replace internal ids for actions, statuses and reasons', () => {
    const log = html(<AuditLog />, ADMIN)
    for (const raw of ['org.verify', 'job.approve', 'pending_review', 'information_consistent']) expect(log, raw).not.toContain(`>${raw}<`)
    expect(log).toContain(T('rv.audit.action.org.verify'))
    expect(log).toContain(esc(`${tr('jb.verif.pending', undefined, 'th')} → ${tr('jb.verif.verified', undefined, 'th')}`))
  })
  it('the review page never reads or shows worker profiles or applications', () => {
    const s = src('./pages/review.tsx')
    expect(s).not.toMatch(/listApplications|getApplication|getApplicant|getWorker|listStatusEvents|transitionApplication/)
    const page = html(<ReviewPage />, ADMIN)
    for (const w of ['Ploy', 'Narin', 'Quality control engineer, automotive parts']) expect(page, w).not.toContain(w)
    const repo = createMemoryRepo()
    expect(code(repo.getWorker(admin, 'wkr_0001'))).toBe('unauthorized')
    expect(code(repo.getApplication(admin, 'app_0001'))).toBe('unauthorized')
    expect(code(repo.listApplications(admin))).toBe('unauthorized')
  })
  it('opening the page or switching personas records nothing', () => {
    const kv = mem()
    html(<ReviewPage />, ADMIN, kv); html(<ReviewPage />, 'worker:wkr_0001', kv)
    expect(kv.getItem(JOBBOARD_KEY)).toBeNull()
  })
})

describe('P5 localization and navigation', () => {
  it('every review message has Thai, Simplified Chinese and English text and is not overridden', () => {
    for (const [k, [th, zh, en]] of Object.entries(review)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as MsgKey], k).toBe(review[k as keyof typeof review])
    }
  })
  it('every key used on the review page exists, and every review key is used', () => {
    const s = src('./pages/review.tsx')
    const used = new Set([...s.matchAll(/\bt\('([\w.]+)'/g)].map((m) => m[1]))
    for (const d of ['verify', 'approve', 'reject']) { used.add(`rv.decision.${d}`); used.add(`rv.dlg.${d}`) }
    for (const r of REVIEW_REASONS) used.add(`rv.reason.${r}`)
    for (const a of AUDIT_ACTIONS) { used.add(`rv.audit.action.${a}`); used.add(`rv.done.${a}`) }
    for (const v of ORG_VERIFICATION) used.add(`jb.verif.${v}`)
    for (const v of JOB_REVIEW) used.add(`jb.review.${v}`)
    for (const k of used) expect(k in messages, k).toBe(true)
    for (const k of Object.keys(review)) expect(used.has(k), `unused ${k}`).toBe(true)
  })
  it('the review link appears only in the persona menu for the simulated reviewer; the footer keeps the legal /admin link', () => {
    const shell = src('./components/shell.tsx')
    expect(shell).toMatch(/persona\.kind === 'admin' && <li[^>]*><button role="menuitem"[^>]*onClick=\{\(\) => \{ close\(\); go\('review'\) \}\}/)
    expect(src('./App.tsx')).toMatch(/<NavLink to="admin"/)
    expect(src('./App.tsx')).not.toMatch(/to="review"/)
  })
})
