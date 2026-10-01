import { describe, expect, it } from 'vitest'
import { restaurantProfile } from './data/demo'
import { buildPlan, emptyEmployeeCheck, missingInfo, orderRequirements, type EmployeeCheck } from './services/compliance'
import type { Requirement } from './data/legal/kb'
import { buildProfile, QS } from './interview'
import { messages } from './locales/index'
import type { Profile, StepStatus } from './types'

const M = messages as Record<string, readonly string[]>
const ec = (x: Partial<EmployeeCheck> = {}): EmployeeCheck => ({ ...emptyEmployeeCheck, ...x })
const byReq = (items: ReturnType<typeof buildPlan>) => Object.fromEntries(items.map((i) => [i.requirementId, i]))

describe('end-to-end scenario: a Thai SME opens a restaurant in China', () => {
  const p: Profile = { ...restaurantProfile, destProvince: undefined }
  it('retrieves the restaurant requirements and orders them by what must come first', () => {
    const plan = byReq(buildPlan(p, ec(), {}, {}, 'en'))
    expect(plan['cn.company_registration'].step).toBe(1)
    expect(plan['cn.food_license'].step).toBe(2)
    expect(plan['cn.food_license'].dependsOn.map((d) => d.id)).toEqual(['cn.company_registration'])
    expect(plan['cn.residence_permit'].step).toBe(plan['cn.work_permit'].step + 1)
    expect(plan['cn.local_premises'].sourceStatus).toBe('DRAFT'); expect(plan['cn.local_premises'].sources).toEqual([])
    expect(Object.keys(plan).every((id) => id.startsWith('cn.'))).toBe(true)
  })
  it('a licence is something you receive, never something you are told to prepare for the same step', () => {
    for (const i of buildPlan(p, ec(), {}, {}, 'en')) for (const d of i.receives) expect(i.documents.map((x) => x.id), i.requirementId).not.toContain(d.id)
    const reg = byReq(buildPlan(p, ec(), {}, {}, 'en'))['cn.company_registration']
    expect(reg.documents).toEqual([]); expect(reg.receives.map((d) => d.id)).toEqual(['cn_business_license'])
  })
  it('nothing in the plan is shown as verified, and the food licence cites the food safety law at the agency page only', () => {
    const items = buildPlan(p, ec(), {}, {}, 'en')
    expect(items.some((i) => i.sourceStatus === 'ACTIVE')).toBe(false)
    const food = items.find((i) => i.requirementId === 'cn.food_license')!
    expect(food.sources).toEqual([expect.objectContaining({ id: 'cn-food-safety', url: 'https://www.samr.gov.cn/', isOfficialText: false })])
  })
  it('the next step follows the real state: prerequisite → documents → office → procedure → done', () => {
    let food = byReq(buildPlan(p, ec(), {}, {}, 'en'))['cn.food_license']
    expect(food.next).toMatch(/Finish/)
    const st: Record<string, StepStatus> = { 'act-req-cn.company_registration': 'done' }
    food = byReq(buildPlan(p, ec(), st, {}, 'en'))['cn.food_license']
    expect(food.next).toMatch(/Prepare: Business licence/); expect(food.receives.map((d) => d.id)).toEqual(['cn_food_license'])
    expect(food.documents.map((d) => d.id)).toEqual(['cn_business_license'])
    food = byReq(buildPlan(p, ec(), st, { cn_business_license: 'have' }, 'en'))['cn.food_license']
    expect(food.next).toMatch(/which office/) // no city yet → office unresolved
    food = byReq(buildPlan({ ...p, destProvince: 'CN-SH' }, ec(), st, { cn_business_license: 'have' }, 'en'))['cn.food_license']
    expect(food.office.resolved).toBe(true); expect(food.office.text).toMatch(/Shanghai/); expect(food.next).toMatch(/Check the document list/)
    food = byReq(buildPlan(p, ec(), { ...st, 'act-req-cn.food_license': 'done' }, {}, 'en'))['cn.food_license']
    expect(food.next).toMatch(/^Done/)
  })
  it('what is still missing is listed with a reason: the city decides the office; a foreign employee needs the employee check', () => {
    expect(missingInfo(p, ec()).map((m) => m.id)).toEqual(['province', 'employee'])
    expect(missingInfo({ ...p, destProvince: 'CN-SH' }, ec({ nationality: 'TH' })).map((m) => m.id)).toEqual([])
    for (const id of ['province', 'employee', 'ownership', 'activity']) for (const k of ['t', 'why']) expect(M[`plan.mi.${id}.${k}`]?.length, id + k).toBe(3)
  })
  it('the reverse direction works too: a Chinese restaurant in Thailand gets the Thai food-premises check (draft, no source)', () => {
    const th = byReq(buildPlan({ ...restaurantProfile, direction: 'CN_TH', destProvince: undefined }, ec(), {}, {}, 'th'))
    expect(th['th.food_premises'].sourceStatus).toBe('DRAFT'); expect(th['th.company_registration'].step).toBe(1)
    expect(Object.keys(th).every((id) => id.startsWith('th.'))).toBe(true)
  })
})

describe('goal-based entry and progressive questions', () => {
  it('the employee goal needs no interview: a minimal hiring context plus a foreign employee brings the work-permit steps', () => {
    const { profile } = buildProfile({ forms: ['hire'], btype: 'other' }, 'CN_TH')
    const ids = buildPlan(profile, ec({ nationality: 'CN' }), {}, {}, 'en').map((i) => i.requirementId)
    expect(ids).toContain('th.work_permit'); expect(ids).not.toContain('th.company_registration')
  })
  it('every question explains why it is asked, in Thai, Chinese and English', () => {
    for (const q of QS) expect(M[`q.${q.id}.why`]?.every((s) => s.length > 5), q.id).toBe(true)
  })
  it('dependency ordering never hangs on bad data (a cycle)', () => {
    const a: Requirement = { id: 'x.a', country: 'TH', domain: 'tax', triggers: [], authority: 'th-rd', documents: [], sources: [], after: ['x.b'] }
    const b: Requirement = { ...a, id: 'x.b', after: ['x.a'] }
    const lv = orderRequirements([a, b])
    expect(lv.size).toBe(2)
  })
})
