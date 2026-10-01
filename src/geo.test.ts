import { describe, expect, it } from 'vitest'
import { ACTIVE, GEO, HOME, SOON, arcPoint, checkDestination, clampView, codeOfIso, directionOf, lerpView, viewForBox, type GeoCode } from './geo'
import capitals from './data/geo/capitals.json'
import region from './data/geo/region-asean-china.json'
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
})

describe('2D map view', () => {
  it('never zooms out past the fitted region and never pans the region off screen', () => {
    const v = clampView({ k: 0.2, x: 9999, y: -9999 }, 800, 500)
    expect(v.k).toBe(1); expect(v.x).toBeLessThanOrEqual(200); expect(v.y).toBeGreaterThanOrEqual(-125)
  })
  it('frames a country box in the middle of the map', () => {
    const v = viewForBox([[300, 200], [340, 260]], 800, 500, 0.75, 8)
    expect(v.k).toBeGreaterThan(1)
    expect(v.x + v.k * 320).toBeCloseTo(400, 0); expect(v.y + v.k * 230).toBeCloseTo(250, 0)
  })
  it('animations land exactly on the target; the route arc starts at the origin and ends at the destination', () => {
    const to = { k: 4, x: -300, y: -120 }
    expect(lerpView(HOME, to, 1)).toEqual(to)
    const a: [number, number] = [100, 300], b: [number, number] = [400, 100]
    expect(arcPoint(a, b, 0)).toMatchObject({ x: 100, y: 300 }); expect(arcPoint(a, b, 1)).toMatchObject({ x: 400, y: 100 })
    const mid = arcPoint(a, b, 0.5); expect(Math.hypot(mid.x - 250, mid.y - 200)).toBeGreaterThan(10) // it bends, it is not a straight line
  })
})

describe('geographic data is taken from Natural Earth, not invented', () => {
  type C = { country: string; ne_id: number; name: string; lon: number; lat: number }
  const cs = capitals as C[]
  it('exactly one capital per country on the map, each with its Natural Earth id and real coordinates', () => {
    expect(cs.map((c) => c.country).sort()).toEqual([...ACTIVE, ...SOON].sort())
    for (const c of cs) { expect(c.ne_id).toBeGreaterThan(0); expect(c.lon).toBeGreaterThan(90); expect(c.lon).toBeLessThan(130); expect(Math.abs(c.lat)).toBeLessThan(45) }
    const byC = Object.fromEntries(cs.map((c) => [c.country, c.name]))
    expect(byC).toMatchObject({ TH: 'Bangkok', CN: 'Beijing', VN: 'Hanoi', LA: 'Vientiane', MM: 'Naypyidaw', SG: 'Singapore' })
    const bkk = cs.find((c) => c.name === 'Bangkok')!; expect(bkk.lon).toBeCloseTo(100.5, 0); expect(bkk.lat).toBeCloseTo(13.75, 0)
  })
  it('the regional map contains every selectable country (incl. Singapore) and no province layer', () => {
    const t = region as unknown as { objects: Record<string, { geometries: { id?: string }[] }> }
    expect(Object.keys(t.objects)).toEqual(['countries'])
    const ids = new Set(t.objects.countries.geometries.map((g) => g.id))
    for (const c of [...ACTIVE, ...SOON]) expect(ids.has(GEO[c].iso), c).toBe(true)
  })
  it('nothing outside China + ASEAN exists in the map data (no India, Japan, Korea, Taiwan, Mongolia, Russia, Australia…)', () => {
    const t2 = region as unknown as { objects: Record<string, { geometries: { id?: string }[] }> }
    // Hong Kong and Macao are drawn as part of China; Papua New Guinea (598) is background land only, so New Guinea is not cut at Indonesia's border
    const allowed = new Set([...[...ACTIVE, ...SOON].map((c) => GEO[c].iso), '344', '446', '598'])
    for (const g of t2.objects.countries.geometries) expect(allowed.has(String(g.id)), String(g.id)).toBe(true)
    for (const iso of ['356', '392', '410', '158', '496', '643', '036']) expect(t2.objects.countries.geometries.some((g) => g.id === iso), iso).toBe(false)
  })
  it('Papua New Guinea is background only: not a selectable country, no name, not used to frame the map', () => {
    expect(codeOfIso('598')).toBeUndefined()
    expect(Object.values(GEO).some((g) => g.iso === '598')).toBe(false)
  })
  it('every country and capital shown has a name in Thai, Chinese and English', () => {
    const m = messages as Record<string, readonly string[]>
    for (const c of [...ACTIVE, ...SOON]) expect(m[`geo.c.${c}`]?.every((s) => s.length > 0), c).toBe(true)
    for (const c of cs) expect(m[`geo.city.${c.name.replace(/\s/g, '')}`]?.length, c.name).toBe(3)
  })
})

describe('provinces and the shared Business Context', () => {
  it('every Thai and Chinese first-level division has a name in Thai, Chinese and English, keyed by its ISO 3166-2 code', async () => {
    const t = (await import('./data/geo/admin1-th-cn.json')) as unknown as { default?: unknown }
    const topo = (t.default ?? t) as { objects: Record<string, { geometries: { properties: { iso_3166_2: string } }[] }> }
    const codes = Object.values(topo.objects)[0].geometries.map((g) => g.properties.iso_3166_2).filter((c) => !c.includes('~'))
    expect(codes.filter((c) => c.startsWith('TH-')).length).toBe(77)
    const m = messages as Record<string, readonly string[]>
    for (const c of codes) expect(m[`prov.${c}`]?.every((s) => s.length > 0), c).toBe(true)
  })
  it('a destination province chosen on the map answers the interview question about location, so it is not asked again', async () => {
    const { visibleQs, isAnswered } = await import('./interview')
    const a = { name: 'Acme', btype: 'manufacturing', forms: ['company'], location: 'Shanghai' }
    expect(visibleQs(a).filter((q) => !isAnswered(a, q)).some((q) => q.id === 'location')).toBe(false)
  })
  it('stored provinces are validated: only real-looking TH/CN ISO codes survive', async () => {
    const { sanitizeState } = await import('./store')
    const s = sanitizeState({ direction: 'TH_CN', originProvince: 'TH-20', destinationProvince: '<script>' })
    expect(s.originProvince).toBe('TH-20'); expect(s.destinationProvince).toBeNull()
    expect(sanitizeState({}).originProvince).toBeNull()
  })
})
