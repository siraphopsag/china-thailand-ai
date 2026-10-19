// Owner, 18 Oct 2026 (recording the demo video): a pin just made did not show in My pins ("Active pins: 0 / No pins yet") and
// x/5 did not count it for 35–60 s, even after a reload. The device's clock ran 35 s behind the server, which stamps the rows,
// so the new pin looked "made in the future". Here the device runs 60 s behind.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LanguageProvider } from './i18n'
import { tr } from './i18n/core'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider } from './auth'
import { activePins, pinQuota } from './domain/match/logic'
import { pinActive } from './domain/match/release'
import { buildState, fromServer, statsToPool, statsUpTo, type PinStatRow } from './domain/match/remote'
import type { MatchState } from './domain/match/types'
import { PinList } from './pages/match'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')
function html(node: ReactNode, st: MatchState): string {
  const g = globalThis as { document?: unknown }
  const had = 'document' in g, prev = g.document
  g.document = { documentElement: { getAttribute: () => null, setAttribute: () => {}, lang: 'th' } }
  try { return renderToStaticMarkup(<ThemeProvider><LanguageProvider><AuthProvider enabled={false}><MatchProvider initial={st}>{node}</MatchProvider></AuthProvider></LanguageProvider></ThemeProvider>) }
  finally { if (had) g.document = prev; else delete g.document }
}

const DEVICE = Date.parse('2026-10-18T09:00:00.000Z') // this device's clock
const SERVER = new Date(DEVICE + 60_000).toISOString() // the server is 60 s ahead: it stamps the new pin with its own time
const loaded = () => buildState({ uid: 'u1', name: 'Demo', clockHours: 0, posts: [], acceptances: [],
  profile: { user_type: 'seeker', company: null, origin_country: 'TH', origin_province: 'TH-10', member: false },
  pins: [{ id: 'p1', seeker_id: 'u1', country: 'TH', province: 'TH-50', industry: 'trade', skills: ['customs_brokerage'], created_at: SERVER }],
  credits: [{ kind: 'pin', created_at: SERVER }] })

describe('a device clock 60 s behind the server', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(DEVICE) })
  afterEach(() => { vi.useRealTimers() })

  it('before the fix: the pin just made was "in the future" — not active and not counted', () => {
    const raw = loaded()
    expect(activePins(raw.me, DEVICE)).toHaveLength(0)
    expect(pinQuota(raw, DEVICE).used).toBe(0)
  })
  it('loaded from the database, the new pin is active at once and counts 1 of 5', () => {
    const st = fromServer(loaded(), Date.now())
    expect(activePins(st.me, DEVICE).map((p) => p.id)).toEqual(['p1'])
    expect(pinQuota(st, DEVICE)).toMatchObject({ used: 1, limit: 5, left: 4 })
    // it moved by the clock difference only: still a month to go, and it stays active a moment later
    expect(Date.parse(st.me.pins[0].at)).toBe(DEVICE)
    expect(activePins(st.me, DEVICE + 5_000)).toHaveLength(1)
  })
  it('times that are not in the future stay exactly as the database sent them', () => {
    const old = new Date(DEVICE - 3 * 86_400_000).toISOString()
    const st = fromServer(buildState({ uid: 'u1', name: 'Demo', clockHours: 0, posts: [], acceptances: [], profile: null,
      pins: [{ id: 'p0', seeker_id: 'u1', country: 'TH', province: 'TH-50', industry: 'trade', skills: ['customs_brokerage'], created_at: old }] }), DEVICE)
    expect(st.me.pins[0].at).toBe(old)
  })
  it("others' anonymous pin counts in this hour are not dropped either", () => {
    const rows: PinStatRow[] = [{ country: 'TH', province: 'TH-50', industry: 'trade', skills: ['customs_brokerage'], hour: SERVER, n: 2 }]
    expect(statsToPool(rows).filter((p) => pinActive(p, DEVICE))).toHaveLength(0)
    expect(statsToPool(statsUpTo(rows, DEVICE)).filter((p) => pinActive(p, DEVICE))).toHaveLength(1)
  })
  it('My pins shows the new pin, not "No pins yet"', () => {
    const page = html(<PinList onNew={() => {}} />, fromServer(loaded(), Date.now()))
    expect(page).not.toContain(esc(tr('m.pin.none', undefined, 'th')))
    expect(page).toContain(esc(tr('m.pin.new', undefined, 'th')))
  })
  it('the site loads database times through the fix, and a list still waiting for a change says "Loading…"', () => {
    const data = src('./matchData.tsx'), page = src('./pages/match.tsx')
    expect(data).toContain('setRemote(fromServer(buildState(')
    expect(data).toContain('statsUpTo(pinStats.data as PinStatRow[], real)')
    expect(data).toContain('syncing: writing > 0')
    expect(page).toContain("if (!pins.length && syncing) return <p className=\"text-muted py-10 text-center\" role=\"status\">{t('c.loading')}</p>")
  })
})
