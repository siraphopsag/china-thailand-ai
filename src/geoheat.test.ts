import { describe, expect, it } from 'vitest'
import { heatShade, heatSteps } from './components/geomap'

// the board's map shades provinces by a number (owner, 27 Nov 2026: the bubbles piled up and hid Bangkok)
describe('province shades', () => {
  it('steps by rank, so one large province does not wash out the rest', () => {
    const v = [88, 97, 131, 143, 181, 182, 187, 206, 269, 385, 395, 402, 5000]
    const s = heatSteps(v)
    expect(s).toHaveLength(5); expect(s[s.length - 1]).toBe(5000)
    expect(heatShade(88, s)).toBe(0); expect(heatShade(5000, s)).toBe(4)
    expect(heatShade(402, s)).toBeGreaterThan(heatShade(143, s)) // not all pale next to the outlier
  })
  it('few or repeated values still use the full range; zero and empty are safe', () => {
    expect(heatSteps([])).toEqual([]); expect(heatSteps([0, 0])).toEqual([])
    const one = heatSteps([3, 3, 3]); expect(one).toEqual([3]); expect(heatShade(3, one)).toBe(4)
    const two = heatSteps([1, 1, 1, 2]); expect(two).toEqual([1, 2]); expect(heatShade(1, two)).toBe(0); expect(heatShade(2, two)).toBe(4)
    expect(heatShade(7, [])).toBe(0)
  })
})
