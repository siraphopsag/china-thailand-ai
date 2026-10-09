import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { postIssues, makePost, sampleApplicant, type PostInput } from './domain/match/logic'
import { precheck } from './domain/match/precheck'
import { seedState } from './domain/match/seed'
import { MY_EMPLOYER, type Post } from './domain/match/types'
import { isNetworkError } from './ErrorBoundary'
import { messages } from './locales'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const AT = '2026-10-09T09:00:00.000Z'
const good: PostInput = { place: { country: 'TH', province: 'TH-10' }, company: 'Sample Co', position: 'Clerk', industry: 'trade', skills: ['customs_brokerage'], minYears: 0, details: '',
  headcount: 1, employment: 'permanent', salary: null, startDate: '2026-11-01', languages: [{ lang: 'th', level: 'native' }], education: 'none', benefits: [] }

describe('QA round, Oct 2026 — group 1: the main tasks', () => {
  it('the post form gets every problem at once, in form order (it took one try per problem)', () => {
    const bad = { ...good, company: '', position: '', skills: [], startDate: '', languages: [] }
    expect(postIssues(bad, AT).map((x) => x.field)).toEqual(['company', 'position', 'skills', 'startDate', 'languages'])
    expect(precheck(bad, AT).errors).toEqual(['company', 'position', 'skills', 'startDate', 'languages'])
    // a contact detail is marked on the field where it was typed
    expect(postIssues({ ...good, company: 'mail me a@b.co' }, AT)).toEqual([{ field: 'company', problem: 'contact' }])
    // makePost still answers with the first problem
    expect(makePost(bad, 'x', MY_EMPLOYER, AT)).toEqual({ ok: false, problem: 'company' })
    expect(postIssues(good, AT)).toEqual([])
  })
  it('the hire page shows them under their fields, and a field being fixed clears only its own message', () => {
    const hire = src('./pages/hire.tsx')
    expect(hire).toContain('const issues = postIssues(i, at)')
    expect(hire).toContain('fe.setMany(marked)')
    expect(hire).toContain("setCompany(e.target.value); clear('emp-company')")
    const [th] = messages['m.err.fields'] as readonly string[]
    expect(th).toContain('{n}')
  })
  it('the province list makes room on phones instead of running under the menu bar', () => {
    const ls = src('./components/listselect.tsx')
    expect(ls).toContain("document.querySelector('nav.mn-h')")
    expect(ls).toContain('style={{ maxHeight: fitH ?? maxHeight }}')
  })
  it('no pins left: the pin form says why and links to the plans; no posts left: renewing points to the plans', () => {
    const m = src('./pages/match.tsx')
    expect(m).toContain("{pq.left <= 0 && <div id=\"pin-limit\">")
    const post = src('./pages/post.tsx')
    expect(post).toContain('if (!canPost(st, limitNow)) { showNoPosts(); return }')
    expect(post).toContain("<NavLink to=\"member\" className=\"font-semibold underline underline-offset-2\">{t('m.plan.see')}</NavLink>")
  })
})

describe('QA round, Oct 2026 — group 2: large text, keyboard, contrast', () => {
  it('phones keep the visitor\'s text size; the header wraps; invalid fields are outlined', () => {
    const css = src('./index.css')
    expect(css).not.toContain('html { font-size: 15px }')
    expect(css).toContain('.input[aria-invalid="true"]')
    expect(src('./components/shell.tsx')).toContain('min-h-16 py-2 md:py-0 flex flex-wrap')
  })
  it('focus lands on the next step instead of the page', () => {
    expect(src('./pages/hire.tsx')).toContain('setForm(true); setMsg(null); focusHead.current = true')
    expect(src('./pages/post.tsx')).toContain("void act(() => decide(a.id, true), t('m.em.confirmed'), 'em-apps')")
    expect(src('./pages/safety.tsx')).toContain('id={`rp-done-${postId}`} tabIndex={-1}')
    expect(src('./components/shell.tsx')).toContain('<Menu refocus icon="language"')
    expect(src('./components/listselect.tsx')).toContain("'bg-surface3 ring-2 ring-inset ring-primary'")
  })
})

describe('QA round, Oct 2026 — group 3: the demo and errors', () => {
  it('a sample job seeker can apply to my own post in the local demo, once each', () => {
    const st = seedState(Date.parse(AT))
    const mine = { ...makePost(good, 'mine-1', MY_EMPLOYER, AT), } as { ok: true; value: Post }
    const s0 = { ...st, posts: [mine.value, ...st.posts] }
    const r = sampleApplicant(s0, 'mine-1', 'acc-x', AT)
    expect(r.ok && r.value.status).toBe('accepted')
    expect(r.ok && r.value.seekerId).toBe(st.seekers[0].id)
    // headcount 1: the next one joins the queue
    const s1 = r.ok ? { ...s0, acceptances: [...s0.acceptances, r.value] } : s0
    const r2 = sampleApplicant(s1, 'mine-1', 'acc-y', AT)
    expect(r2.ok && r2.value.status).toBe('reserved')
    expect(r2.ok && r2.value.seekerId).toBe(st.seekers[1].id)
    // not my post
    expect(sampleApplicant(s0, 'post-s1', 'acc-z', AT).ok).toBe(false)
  })
  it('a page that could not download offers "try again", not a data wipe', () => {
    expect(isNetworkError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js'))).toBe(true)
    expect(isNetworkError(new Error('Cannot read properties of undefined'))).toBe(false)
    const eb = src('./ErrorBoundary.tsx')
    expect(eb).toContain("{tr('err.retry')}")
    const [th] = messages['err.net'] as readonly string[]
    expect(th).toContain('การเชื่อมต่อ')
  })
})

describe('QA round, Oct 2026 — group 4: one main button, one chosen look, readable disabled buttons', () => {
  it('chosen tabs and pills use the tint, not the solid primary; cards carry one tinted action', () => {
    for (const f of ['./pages/board.tsx', './pages/market.tsx', './pages/analytics.tsx', './pages/case.tsx', './pages/match.tsx'])
      expect(src(f), f).not.toMatch(/\? 'bg-primary text-onprimary font-semibold/)
    const css = src('./index.css')
    expect(css).toContain('.seg-on {')
    expect(css).toContain('.btn-soft {')
    expect(css).not.toContain('disabled:opacity-50')
    expect(css).toContain('.btn-primary:disabled, .btn-accent:disabled, .btn-soft:disabled { background: rgb(var(--surface3))')
    expect(src('./pages/board.tsx')).toContain('className="btn-soft text-sm justify-center !rounded-full')
  })
  it('panel tabs move with the arrow keys', () => {
    const m = src('./pages/match.tsx')
    expect(m).toContain("tabIndex={value === x.k ? 0 : -1}")
    expect(m).toContain("e.key === 'ArrowRight' ? (i + 1) % n")
  })
})

describe('QA round, Oct 2026 — groups 5–6: ready to share, design rules', () => {
  it('the page describes itself in English as well, with sharing details and a maskable icon', () => {
    const page = src('../index.html')
    expect(page).toContain('Thailand and China')
    expect(page).toContain('<meta property="og:url"')
    expect(page).toContain('<meta property="og:locale:alternate" content="zh_CN" />')
    expect(page).toContain('<div id="root"><p class="boot">C.A.L.L.</p></div>')
    expect(src('../public/manifest.webmanifest')).toContain('"purpose": "maskable"')
    const [, zh, en] = messages['app.desc'] as readonly string[]
    expect(zh).toContain('中泰'); expect(en).toContain('Thailand and China')
  })
  it('sample posts read in the visitor\'s language, labelled as sample text', () => {
    const st = seedState(Date.parse(AT))
    expect(st.posts.every((p) => p.translations?.th && p.translations?.zh && p.translations.src === 'en')).toBe(true)
    expect(src('./pages/match.tsx')).toContain("t(post.sample ? 'm.tr.noteSample' : 'm.tr.note'")
  })
  it('the allowance never reads more than its limit; one word for applying', () => {
    expect(src('./domain/match/release.ts')).toContain('used: Math.min(n, limit)')
    expect((messages['m.ap.go'] as readonly string[])[0]).toBe('สมัครงาน')
  })
  it('DESIGN.md holds the rules and the named sizes exist', () => {
    const d = src('../DESIGN.md')
    for (const w of ['btn-primary', 'btn-soft', 'seg-on', 'rounded-control', 'min-h-touch', 'setMany']) expect(d, w).toContain(w)
    expect(src('../tailwind.config.js')).toContain("borderRadius: { control: '0.75rem', card: '1rem', panel: '1.5rem' }")
  })
})
