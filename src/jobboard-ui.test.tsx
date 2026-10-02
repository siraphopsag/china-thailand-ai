// P3: simulated personas, simulation notices, Lobby entry points and placeholder pages.
// UI checks render to static HTML with react-dom/server (no DOM in this test setup), so clicks and focus are not exercised here.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr, withLang, type Lang } from './i18n/core'
import { StoreProvider, useStore } from './store'
import { ThemeProvider } from './theme'
import { PersonaProvider, usePersona } from './persona'
import { JobBoardProvider } from './jobboardData'
import { messages, type MsgKey } from './locales/index'
import { jobboard } from './locales/jobboard'
import { JOBBOARD_SEED, SEED_PERSONAS } from './data/seed/jobboard'
import { DEFAULT_PERSONA_KEY, ENTRIES, PERSONAS, currentPersona, entryFor, initialPersonaState, personaKey, personaReducer, resolvePersona } from './domain/jobboard/personas'
import { APPLICATION_STATUS, EDUCATION, INDUSTRIES, JOB_REVIEW, LANG_LEVELS, LANGS as DLANGS, ORG_VERIFICATION, SKILLS } from './domain/jobboard/types'
import { Landing } from './pages/intake'
import { EmployerPage, JobsPage } from './pages/jobboard'
import { Header, PersonaSwitcher } from './components/shell'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const LANGS: Lang[] = ['th', 'zh', 'en']
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
const T = (k: MsgKey, v?: Record<string, string>) => esc(tr(k, v, 'th')) // the providers fall back to Thai when no browser storage exists

/** ThemeProvider reads <html data-theme> once; give it a minimal document during static rendering. */
function html(node: ReactNode, initialKey?: string): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try {
    return renderToStaticMarkup(<ThemeProvider><LanguageProvider><StoreProvider><PersonaProvider initialKey={initialKey}><JobBoardProvider storage={null}>{node}</JobBoardProvider></PersonaProvider></StoreProvider></LanguageProvider></ThemeProvider>)
  } finally { if (had) g.document = prev; else delete g.document }
}
const Probe = () => { const { actor, persona } = usePersona(); return <output data-key={persona.key}>{JSON.stringify(actor)}</output> }

/** route keys of the app router (App.tsx `pages` object) */
const ROUTES = new Set([...src('./App.tsx').slice(src('./App.tsx').indexOf('const pages')).matchAll(/(?:^|[\s{,])(\w+): </g)].map((m) => m[1]).concat(''))

describe('P3 persona state', () => {
  it('lists exactly the seeded personas, derived from SEED_PERSONAS (Visitor, 2 workers, employers, Admin)', () => {
    expect(PERSONAS.map((p) => p.key)).toEqual(SEED_PERSONAS.map((p) => personaKey(p.actor)))
    expect(PERSONAS.map((p) => p.key)).toEqual(expect.arrayContaining(['visitor', 'worker:wkr_0001', 'worker:wkr_0002', 'employer:org_0001', 'employer:org_0002', 'admin:adm_0001']))
    for (const p of PERSONAS) if (p.kind === 'worker' || p.kind === 'employer') expect(p.name, p.key).toMatch(/\S/)
    for (const p of PERSONAS) expect(p.name, p.key).not.toMatch(/Synthetic/) // shown with a localized "fictional" tag instead
  })
  it('selecting a persona updates the current actor', () => {
    const s = personaReducer(initialPersonaState(), { type: 'select', key: 'employer:org_0002' })
    expect(currentPersona(s).actor).toEqual({ kind: 'employer', organizationId: 'org_0002' })
    expect(personaReducer(s, { type: 'select', key: 'worker:wkr_0001' })).toEqual({ key: 'worker:wkr_0001', invalid: false })
  })
  it('the shared context exposes the selected actor to any component', () => {
    expect(html(<Probe />, 'worker:wkr_0002')).toContain(esc(JSON.stringify({ kind: 'worker', workerId: 'wkr_0002' })))
    expect(html(<Probe />)).toContain('data-key="visitor"')
  })
  it('unknown or malformed persona ids are refused safely and keep the current persona', () => {
    const start = personaReducer(initialPersonaState(), { type: 'select', key: 'worker:wkr_0001' })
    for (const bad of ['worker:wkr_9999', 'admin', 'employer:org_0001 ', '__proto__', 'constructor', '', null, undefined, 42, { kind: 'admin' }]) {
      const s = personaReducer(start, { type: 'select', key: bad })
      expect(s, String(bad)).toEqual({ key: 'worker:wkr_0001', invalid: true })
      expect(resolvePersona(bad)).toBeNull()
    }
    expect(initialPersonaState('admin:adm_9999').key).toBe(DEFAULT_PERSONA_KEY) // an invalid start falls back to Visitor, never to Admin
    expect(html(<Probe />, 'admin:adm_9999')).toContain('data-key="visitor"')
  })
  it('reset returns to the default persona (Visitor)', () => {
    const s = personaReducer({ key: 'admin:adm_0001', invalid: true }, { type: 'reset' })
    expect(s).toEqual({ key: 'visitor', invalid: false })
    expect(currentPersona(s).actor).toEqual({ kind: 'visitor' })
  })
  it('the persona is session state only: nothing is written to browser storage', () => {
    expect(src('./persona.tsx')).not.toMatch(/localStorage|sessionStorage|safeSet/)
  })
})

describe('P3 Lobby entry points', () => {
  it('Worker and Employer entries open existing routes with that role\'s default persona; there is no Admin entry', () => {
    expect(Object.keys(ENTRIES).sort()).toEqual(['employer', 'worker'])
    for (const kind of ['worker', 'employer'] as const) {
      const e = entryFor(kind)
      expect(ROUTES.has(e.route), e.route).toBe(true)
      expect(resolvePersona(e.key)!.kind).toBe(kind)
    }
    expect(entryFor('worker').key).toBe('worker:wkr_0001')
    expect(entryFor('employer').key).toBe('employer:org_0001')
  })
  it('entering selects a persona only: no repository, no application is created', () => {
    const before = JSON.stringify(JOBBOARD_SEED)
    entryFor('worker'); entryFor('employer')
    expect(JSON.stringify(JOBBOARD_SEED)).toBe(before)
    // (the /jobs page may submit, but only from its confirmation dialog — checked in jobboard-p4.test.tsx)
    for (const f of ['./persona.tsx', './domain/jobboard/personas.ts', './components/jobboard.tsx']) expect(src(f), f).not.toMatch(/submitApplication|createMemoryRepo|repo\./)
  })
  it('the Lobby shows the two entries with the simulation notice, and keeps every business-planning entry point', () => {
    const page = html(<Landing />)
    for (const k of ['jb.lobby.t', 'jb.lobby.worker.t', 'jb.lobby.employer.t', 'jb.notice.short'] as const) expect(page, k).toContain(T(k))
    expect(page).toContain(T('jb.lobby.worker.d', { name: 'Ploy' }))
    for (const k of ['hero.cta', 'goal.th_cn.t', 'goal.cn_th.t', 'goal.employee.t', 'goal.documents.t', 'goal.example', 'goal.mapAlt'] as const) expect(page, k).toContain(T(k))
  })
})

describe('P3 simulation indicators', () => {
  // (P4 replaced the P3 placeholders with working pages; these checks now cover the real /jobs and /employer pages)
  it('both job-board pages show the simulation notice with every limitation, and fictional tags', () => {
    for (const [Page, kind] of [[JobsPage, 'worker'], [EmployerPage, 'employer']] as const) {
      const page = html(<Page />, entryFor(kind).key)
      for (const k of ['jb.notice.short', 'jb.notice.1', 'jb.notice.2', 'jb.notice.3', 'jb.notice.4', 'jb.data.note'] as const) expect(page, `${kind} ${k}`).toContain(T(k))
      expect(page).toContain(T('persona.fictional'))
      expect(page).not.toContain(T('jb.wrongRole', { role: tr(`persona.role.${kind}`, undefined, 'th') }))
    }
  })
  it('the employer area opened with another persona says so and offers the matching sample persona', () => {
    const page = html(<EmployerPage />, 'worker:wkr_0001')
    expect(page).toContain(T('jb.wrongRole', { role: tr('persona.role.employer', undefined, 'th') }))
    expect(page).toContain(T('jb.switchTo', { role: tr('persona.role.employer', undefined, 'th') }))
    expect(page).toContain(T('persona.note'))
  })
  it('the persona switcher is labelled as a PoC simulation and names the active persona', () => {
    const sw = html(<PersonaSwitcher />, 'employer:org_0002')
    expect(sw).toContain('>PoC<')
    expect(sw).toContain(T('persona.aria', { who: `${tr('persona.role.employer', undefined, 'th')} · Sample Riverside Hotels` }))
    expect(sw).toContain('aria-haspopup="menu"')
  })
  it('the Admin persona is always labelled as simulated, in every language', () => {
    expect(LANGS.map((l) => tr('persona.role.admin', undefined, l))).toEqual(['ผู้ตรวจสอบ (จำลอง)', '审核员（模拟）', 'Reviewer (simulated)'])
  })
  it('notices are scoped to the job-board PoC: business-planning and legal pages do not use them', () => {
    for (const f of ['./pages/ops.tsx', './pages/analysis.tsx', './pages/plan.tsx', './pages/compliance.tsx', './pages/employment.tsx', './pages/start.tsx']) expect(src(f), f).not.toMatch(/SimulationNotice|components\/jobboard/)
  })
})

describe('P3 Demo entry removal', () => {
  it('the header no longer has a "Start demo" button (any language), and still renders its controls', () => {
    const head = html(<Header route="" />)
    for (const l of LANGS) expect(head, l).not.toContain(esc(tr('cta.startDemo', undefined, l)))
    expect(src('./components/shell.tsx')).not.toMatch(/cta\.startDemo|startDemo\(/)
    expect(head).toContain(T('lang.choose'))
    expect(head).toContain('>PoC<')
  })
  it('the legacy demo state and its remaining entry points are kept for the business-planning flows', () => {
    const StoreProbe = () => { const s = useStore(); return <i>{typeof s.startDemo}-{typeof s.exitDemo}-{s.mode}</i> }
    expect(html(<StoreProbe />)).toContain('function-function-real')
    expect(src('./pages/intake.tsx')).toMatch(/startDemo\(\); go\('plan'\)/) // "see a full example" on the Lobby and in the interview
    expect(src('./components/shell.tsx')).toMatch(/t\('demo\.mode'\)/) // the demo-mode banner still labels demo data
  })
})

describe('P3 localization and links', () => {
  it('every new message has Thai, Simplified Chinese and English text', () => {
    for (const [k, [th, zh, en]] of Object.entries(jobboard)) {
      expect(th, k).toMatch(/[฀-๿]/)
      expect(zh, k).toMatch(/[一-鿿]/)
      expect(en, k).toMatch(/[A-Za-z]/)
      expect(messages[k as MsgKey], k).toBe(jobboard[k as keyof typeof jobboard]) // not overridden by another locale file
    }
  })
  it('every message key used by the new and changed UI exists, including computed ones', () => {
    const files = ['./persona.tsx', './components/jobboard.tsx', './pages/jobboard.tsx', './components/shell.tsx', './pages/intake.tsx']
    const used = new Set(files.flatMap((f) => [...src(f).matchAll(/\bt\('([\w.]+)'/g), ...src(f).matchAll(/'((?:jb|persona)\.[\w.]+)'/g)].map((m) => m[1])))
    for (const kind of ['visitor', 'worker', 'employer', 'admin']) used.add(`persona.role.${kind}`)
    for (const kind of ['worker', 'employer']) { used.add(`jb.lobby.${kind}.t`); used.add(`jb.lobby.${kind}.d`) }
    // labels computed from domain values (P4)
    const enums: [string, readonly string[]][] = [['jb.skill', SKILLS], ['jb.industry', INDUSTRIES], ['jb.edu', EDUCATION], ['jb.lang', DLANGS], ['jb.level', [...LANG_LEVELS, 'none']], ['jb.review', JOB_REVIEW],
      ['jb.verif', ORG_VERIFICATION], ['jb.status', APPLICATION_STATUS], ['jb.by', ['worker', 'employer']], ['jb.action', ['under_review', 'shortlisted', 'not_selected', 'closed']]]
    for (const [p, vals] of enums) for (const v of vals) used.add(`${p}.${v}`)
    for (const v of ORG_VERIFICATION) used.add(`jb.verif.${v}.d`)
    for (const k of used) expect(k in messages, k).toBe(true)
    for (const k of Object.keys(jobboard)) expect(used.has(k), `unused key ${k}`).toBe(true)
  })
  it('placeholder pages render in all three languages without missing keys', () => {
    for (const l of LANGS) withLang(l, () => {
      for (const k of Object.keys(jobboard) as MsgKey[]) expect(tr(k, undefined, l)).not.toBe(k)
    })
  })
  it('no new link or navigation points to a missing route', () => {
    for (const f of ['./pages/jobboard.tsx', './pages/intake.tsx', './components/shell.tsx', './persona.tsx']) {
      const s = src(f)
      const targets = [...s.matchAll(/go\('([^']*)'\)/g), ...s.matchAll(/NavLink[^>]*\sto="([^"]*)"/g)].map((m) => m[1])
      for (const r of targets) expect(ROUTES.has(r.split('?')[0]), `${f} → /${r}`).toBe(true)
    }
    for (const r of Object.values(ENTRIES)) expect(ROUTES.has(r), r).toBe(true)
  })
})
