import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { PreparePage } from './pages/match'
import { calendarEvents, KINDS_FOR } from './domain/match/calendar'
import { seedState } from './domain/match/seed'
import { DAY_MS } from './domain/match/release'
import { MY_EMPLOYER, type MatchState } from './domain/match/types'
import { PREP, dayPick, prepSeen, markPrepSeen } from './prepare'
import { registry } from './data/legal/registry'
import { messages } from './locales'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
function html(node: ReactNode, st: MatchState): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, removeAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}
const th = (k: string) => (messages[k as keyof typeof messages] as readonly string[])[0]

describe('Prepare hub (owner, 13 Oct 2026: it looked like a filing cabinet, so people skipped it)', () => {
  it('the AI assistant is the main tool, with a question box and examples right on the hub', () => {
    const page = html(<PreparePage />, { ...seedState(), role: 'seeker' })
    expect(page).toContain('id="prep-ai-h"')
    expect(page).toContain('href="/ask"') // still a plain link for people who do not want to type
    // round 2 (owner, 13 Oct 2026): the AI page's own pill, only longer — its send button is the one main action
    expect(page).toContain('class="mo-hub-pill"'); expect(page).toContain('class="mo-field"'); expect(page).toContain('class="mo-send"')
    expect(page).not.toContain('class="btn-primary')
    expect(page).toContain(th('ai.ask.ex1'))
    expect(page).toContain(th('m.prep.ai.meta').replace('{n}', String(registry.length)))
  })
  it('the other tools show real content: warning signs + a call button, a term of the day, the registry in numbers', () => {
    const page = html(<PreparePage />, { ...seedState(), role: 'seeker' })
    for (const k of ['1', '2', '3']) expect(page).toContain(th(`m.sc.f${k}.h`))
    expect(page).toContain('href="tel:1694"')
    expect(page).toContain(th('m.prep.cu.term'))
    expect(page).toContain('href="/language?sit=0"') // the real situations, each opens its own tab
    expect(page).toContain(th('m.prep.lg.h').replace('{n}', String(registry.length)))
    for (const to of ['safety', 'language', 'sources']) expect(page).toContain(`href="/${to}"`)
  })
  it('the card that matters most for your role is marked and comes first', () => {
    const seeker = html(<PreparePage />, { ...seedState(), role: 'seeker' })
    const employer = html(<PreparePage />, { ...seedState(), role: 'employer' })
    // the first card's label colour: warning = how to spot a job scam, ok = the legal information
    const first = (p: string) => p.slice(p.indexOf('<ul class="grid md:grid-cols-3 gap-2 md:gap-3 items-stretch')).match(/<span class="(text-[a-z]+-fg)">/)?.[1]
    expect(first(seeker)).toBe('text-warn-fg')
    expect(first(employer)).toBe('text-ok-fg')
    expect(seeker).toContain(th('m.prep.rec'))
  })
  it('the checklist and the question carried to the AI page live in the browser only (never the address)', () => {
    expect(PREP).toEqual(['ask', 'safety', 'language', 'sources'])
    expect([...prepSeen()]).toEqual([]) // no storage here: an empty checklist, no crash
    markPrepSeen('board') // not one of the four: ignored
    const p = src('./prepare.ts')
    expect(p).toContain('sessionStorage.setItem(ASK_KEY')
    expect(src('./pages/match.tsx')).toContain("const askNow = (text: string) => { setAskPrefill(text.trim()); go('ask') }")
    expect(src('./pages/ask.tsx')).toContain('initialValue={prefill}')
    expect(src('./App.tsx')).toContain('useEffect(() => { markPrepSeen(r) }, [r])')
    const day = Date.parse('2026-10-13T05:00:00Z')
    expect(dayPick(7, day)).toBe(dayPick(7, day + 3 * 3600_000)) // the same word all day
  })
})

describe('Calendar: the days people plan around (owner, 13 Oct 2026)', () => {
  const now = Date.parse('2026-10-13T05:00:00Z')
  const iso = (d: number) => new Date(now + d * DAY_MS).toISOString()
  const ymd = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
  it('employer: a week-before warning, the end of each post, and when posts come back', () => {
    const st = { ...seedState(now), role: 'employer' as const, cases: [], credits: [{ kind: 'post' as const, at: iso(-2) }] }
    st.posts = st.posts.map((p) => (p.id === 'post-s1' ? { ...p, employerId: MY_EMPLOYER, releasedAt: iso(-1), createdAt: iso(-1) } : p))
    const ev = calendarEvents(st, false, now)
    expect(ev.map((e) => e.kind).sort()).toEqual(['expiring', 'expiry', 'postQuota'])
    const q = ev.find((e) => e.kind === 'postQuota')!
    expect(q.day).toBe(ymd(now + 5 * DAY_MS)) // 7 days after the first use of this cycle
    expect(q.to).toBe('hire')
    expect(ev.find((e) => e.kind === 'expiring')!.day).toBe(ymd(now + (182 - 1 - 7) * DAY_MS))
  })
  it('job seeker: when each pin ends (it opens "my pins") and when pins come back', () => {
    const st = { ...seedState(now), role: 'seeker' as const, cases: [], credits: [{ kind: 'pin' as const, at: iso(-3) }] }
    st.me = { ...st.me, pins: [{ id: 'p1', country: 'TH', province: 'TH-50', industry: 'manufacturing', skills: ['quality_control'], at: iso(-3) }] }
    const ev = calendarEvents(st, false, now)
    expect(ev.map((e) => e.kind).sort()).toEqual(['pinEnd', 'pinQuota'])
    const end = ev.find((e) => e.kind === 'pinEnd')!
    expect(end.day).toBe(ymd(now + 27 * DAY_MS)); expect(end.to).toBe('seek?tab=mine'); expect(end.pin?.province).toBe('TH-50')
    expect(src('./pages/match.tsx')).toContain("useState<'new' | 'mine'>(tabAsked === 'mine' ? 'mine' : 'new')")
  })
  it('both sides: when a membership ends; nothing extra without uses or a membership', () => {
    const member = { ...seedState(now), role: 'seeker' as const, cases: [], member: true, memberUntil: iso(20) }
    expect(calendarEvents(member, false, now).map((e) => e.kind)).toEqual(['memberEnd'])
    expect(calendarEvents({ ...seedState(now), role: 'seeker', cases: [] }, false, now)).toEqual([])
  })
  it('each side’s legend lists only its kinds, in three languages', () => {
    expect(KINDS_FOR.seeker).not.toContain('postQuota'); expect(KINDS_FOR.employer).not.toContain('pinEnd')
    for (const k of ['expiring', 'postQuota', 'pinEnd', 'pinQuota', 'memberEnd']) {
      const v = messages[`m.cal.k.${k}` as keyof typeof messages] as readonly string[]
      expect(v.length, k).toBe(3)
      expect(src('./index.css'), k).toContain(`.cal-${k}`)
    }
  })
})

describe('Prepare hub on phones (owner, 13 Oct 2026: easy to scan, easy to use, little scrolling)', () => {
  it('tool cards fold to one-row headings (an accordion; the recommended one starts open; the hotline stays visible)', () => {
    const m = src('./pages/match.tsx')
    expect(m).toContain("const m = window.matchMedia('(max-width: 767px)')")
    expect(m).toContain('aria-expanded={open} aria-controls={`prep-${k}-body`}')
    expect(m).toContain('const openTool = openState === undefined ? recommended : openState')
    expect(m).toContain('{(open || stripAlways) && strip}')
    expect(src('./index.css')).toContain('.prep-toggle { width: 100%; display: flex; align-items: center; gap: .75rem; min-height: 56px')
  })
  it('the AI card keeps the pill and the examples (one sideways line), with a short privacy note', () => {
    const m = src('./pages/match.tsx')
    expect(m).toContain("t(narrow ? 'm.prep.ai.noteShort' : 'ai.ask.privacy')")
    expect(m).toContain('flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x md:grid')
    expect(th('m.prep.ai.noteShort')).toContain('อย่าใส่ข้อมูลส่วนตัว')
  })
})
