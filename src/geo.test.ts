import { describe, expect, it } from 'vitest'
import { ACTIVE, GEO, SOON, REGION_VIEW, WORLD_VIEW, checkDestination, codeOfIso, directionOf, lerpCamera, type GeoCode } from './geo'
import places from './data/geo/places.json'
import { messages } from './locales/index'

describe('geographic onboarding rules', () => {
  it('only Thailand and China are routes today, and they map onto the existing Business Context direction', () => {
    expect(ACTIVE).toEqual(['TH', 'CN'])
    expect(directionOf('CN', 'TH')).toBe('CN_TH'); expect(directionOf('TH', 'CN')).toBe('TH_CN')
    expect(directionOf('TH', 'TH')).toBeNull(); expect(directionOf('CN', 'CN')).toBeNull()
    expect(directionOf('TH', 'VN')).toBeNull(); expect(directionOf(null, 'TH')).toBeNull()
  })
  it('the same country can never be both origin and destination; planned countries are "coming soon", not errors', () => {
    expect(checkDestination('TH', 'TH')).toBe('same'); expect(checkDestination('CN', 'CN')).toBe('same')
    expect(checkDestination('CN', 'TH')).toBe('ok'); expect(checkDestination('TH', 'CN')).toBe('ok')
    for (const c of ['VN', 'MM', 'LA', 'SG'] as GeoCode[]) expect(checkDestination('TH', c)).toBe('soon')
  })
  it('countries resolve from Natural Earth ISO numeric ids (with or without leading zeros)', () => {
    expect(codeOfIso('764')).toBe('TH'); expect(codeOfIso('156')).toBe('CN'); expect(codeOfIso(96)).toBe('BN'); expect(codeOfIso('250')).toBeUndefined()
    expect(new Set(Object.values(GEO).map((g) => g.iso)).size).toBe(Object.keys(GEO).length)
  })
  it('camera moves the short way round and lands exactly on the target', () => {
    const end = lerpCamera(WORLD_VIEW, REGION_VIEW, 1)
    expect(end.rotate[0]).toBeCloseTo(REGION_VIEW.rotate[0] + 0, 5); expect(end.k).toBeCloseTo(REGION_VIEW.k, 5)
    const mid = lerpCamera({ rotate: [170, 0], k: 1 }, { rotate: [-170, 0], k: 1 }, 0.5)
    expect(Math.abs(mid.rotate[0])).toBeGreaterThan(170) // crosses the antimeridian (20°), not the long way (340°)
  })
})

describe('geographic data is taken from Natural Earth, not invented', () => {
  type P = { ne_id: number; country: string; name: string; capital: boolean; lon: number; lat: number }
  const ps = places as P[]
  it('every place keeps its Natural Earth id and real-world coordinates; each active country has exactly one capital', () => {
    for (const p of ps) { expect(p.ne_id).toBeGreaterThan(0); expect(Math.abs(p.lon)).toBeLessThanOrEqual(180); expect(Math.abs(p.lat)).toBeLessThanOrEqual(90) }
    expect(ps.filter((p) => p.country === 'TH' && p.capital).map((p) => p.name)).toEqual(['Bangkok'])
    expect(ps.filter((p) => p.country === 'CN' && p.capital).map((p) => p.name)).toEqual(['Beijing'])
    const bkk = ps.find((p) => p.name === 'Bangkok')!; expect(bkk.lon).toBeCloseTo(100.5, 0); expect(bkk.lat).toBeCloseTo(13.75, 0)
  })
  it('every country and city shown has a name in Thai, Chinese and English', () => {
    const m = messages as Record<string, readonly string[]>
    for (const c of [...ACTIVE, ...SOON]) expect(m[`geo.c.${c}`]?.every((s) => s.length > 0), c).toBe(true)
    for (const p of ps) expect(m[`geo.city.${p.name.replace(/\s/g, '')}`]?.length, p.name).toBe(3)
  })
})
