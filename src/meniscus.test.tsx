// The "meniscus" menu (owner, Oct 2026, from a reference video): one plate with a socket under a coloured bead that flows between
// items on a spring; the trailing shoulder draws out. Geometry and colours are checked here; the motion was checked in a browser.
// sizes: a shoulder radius of 16 and a bowl of 31 (bead 46 + 8 gap); the rail is 64 wide, the phone bar 60 high.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { clampNotch, platePath, reach, shoulders, springStep } from './components/meniscus'
import { HUES } from './components/sidenav'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
const cr = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('the socket', () => {
  it('each shoulder touches both the edge and the bowl (|C1C2| = s + rb), so the outline has no corner', () => {
    const s = 16, rb = 31, dc = -1
    const u = 150, uL = u - reach(s, rb, dc)
    // shoulder centre (uL, s) inside the plate; bowl centre (u, dc) outside it
    expect(Math.hypot(u - uL, dc - s)).toBeCloseTo(s + rb, 6)
  })
  it('the plate path: a socket on the top edge (phones) or the right edge (computers); none when no item is current', () => {
    const flat = platePath(false, 360, 84, 24, 30, null)
    expect(flat.match(/ A /g)?.length).toBe(4) // just the four rounded corners
    const dipped = platePath(false, 360, 84, 24, 30, { u: 150, dc: -1, rb: 31, sL: 16, sR: 16 })
    expect(dipped.match(/ A /g)?.length).toBe(7) // + two shoulders and the bowl
    expect(dipped).toContain(' A 31 31 0 0 0 ') // the bowl is concave (it bends the other way)
    const rail = platePath(true, 88, 500, 24, 32, { u: 200, dc: -1, rb: 31, sL: 16, sR: 16 })
    expect(rail.startsWith('M 32 0 L 32 0 A 32 32 0 0 1 64 32 L 64 ')).toBe(true) // down the right edge of a 64 px rail
    expect(rail.match(/ A /g)?.length).toBe(7)
  })
  it('the first and last items: the bead stays on the item and the socket curls round the end of the bar (owner, Oct 2026)', () => {
    // bug: the socket was pushed off the rounded ends and the bead went with it, onto the next item
    const n = { dc: -1, rb: 31, sL: 16, sR: 16 }
    expect(clampNotch({ ...n, u: 42 }, 514).u).toBe(42)
    expect(clampNotch({ ...n, u: 472 }, 514).u).toBe(472)
    for (const [vertical, w, h, u] of [[true, 88, 514, 42], [true, 88, 514, 472], [false, 351, 84, 48], [false, 351, 84, 303], [false, 351, 84, 20]] as const) {
      const d = platePath(vertical, w, h, 24, vertical ? 32 : 30, { ...n, u })
      expect(d).not.toMatch(/NaN|Infinity/)
      expect(d.match(/ A /g)?.length).toBe(6) // that end's shoulder is now its corner
    }
    // a shoulder that only just reaches the edge looks the same as one that turns the corner: no jump as the bead moves
    const u0 = 16 + reach(16, 31, -1)
    const at = (u: number) => platePath(false, 351, 84, 24, 30, { ...n, u }).split(' A 31 31 ')[0].split(' ').slice(-2).map(Number) // where the left shoulder meets the bowl
    const [x1, y1] = at(u0 - 0.01), [x2, y2] = at(u0 + 0.01)
    expect(Math.hypot(x1 - x2, y1 - y2)).toBeLessThan(0.2)
  })
  it('moving, the trailing shoulder draws out and the leading one tightens; at rest they match', () => {
    expect(shoulders(16, 0)).toEqual([16, 16])
    const [l, r] = shoulders(16, 10) // moving right: the left shoulder trails
    expect(l).toBeGreaterThan(16); expect(r).toBeLessThan(16)
    const [l2, r2] = shoulders(16, -10)
    expect(r2).toBeGreaterThan(16); expect(l2).toBeLessThan(16)
    expect(Math.min(...shoulders(16, 999), ...shoulders(16, -999))).toBeGreaterThanOrEqual(8) // never collapses
  })
  it('the spring settles exactly on the item, with only a small overshoot, in well under a second', () => {
    const s = { u: 0, v: 0, target: 200 }
    let frames = 0, peak = 0
    while ((s.u !== s.target || s.v !== 0) && frames < 600) { springStep(s); peak = Math.max(peak, s.u); frames++ }
    expect(s.u).toBe(200)
    expect(frames).toBeLessThan(60) // < 1 s at 60 frames a second
    expect(peak - 200).toBeLessThan(200 * 0.12) // a gentle bounce
  })
})

describe('colours and behaviour', () => {
  it('every place has its own colour: the icon on the bead and the label on the plate stay readable in both themes', () => {
    const keys = Object.keys(HUES)
    expect(new Set(keys.map((k) => HUES[k].bead)).size).toBeGreaterThanOrEqual(11)
    for (const k of keys) {
      const h = HUES[k]
      expect(cr(h.bead, '#111318'), `${k} icon on bead`).toBeGreaterThanOrEqual(4.5) // icons need 3:1; kept at text level
      expect(cr(h.light, '#ffffff'), `${k} label, light`).toBeGreaterThanOrEqual(4.5)
      expect(cr(h.dark, '#1b1c23'), `${k} label, dark`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('the bead can be dragged and drops on the nearest item; reduced motion and hidden pages jump instead of flowing', () => {
    const m = src('./components/meniscus.tsx')
    expect(m).toContain('onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}')
    expect(m).toContain('if (!slots[i].current) onSelect(slots[i])')
    expect(m).toContain('if (s.u < 0 || reduced() || document.hidden || last.current === active)')
    const css = src('./index.css')
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { .mn-bead, .mn-label, .mn-icon { transition: none } }')
    expect(css).toMatch(/\.mn-bead \{[^}]*touch-action: none/)
  })
})
