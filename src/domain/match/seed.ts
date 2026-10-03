// Synthetic starting data for the matching prototype: invented sample job seekers and two invented employer posts, so the
// step-by-step release can be demonstrated. No real people, companies, contacts or documents.
import { DAY_MS } from './logic'
import { ME, type MatchState, type Pin, type Seeker } from './types'

const iso = (t: number) => new Date(t).toISOString()
const day = (t: number) => iso(t).slice(0, 10)
const pin = (id: string, country: 'TH' | 'CN', province: string, industry: Pin['industry'], skills: Pin['skills'], at: number): Pin => ({ id, country, province, industry, skills, at: iso(at) })
const seeker = (id: string, name: string, origin: Seeker['origin'], pins: Pin[]): Seeker => ({ id, name, origin, pins, synthetic: true })

/** a fresh seed relative to `now` (post ages decide which release step they are in) */
export function seedState(now = Date.now()): MatchState {
  const t = now - DAY_MS * 3
  return {
    version: 1, role: null, dayOffset: 0, myCompany: '', member: false,
    me: seeker(ME, 'you', null, []),
    seekers: [
      seeker('seeker-a', 'Ploy', { country: 'TH', province: 'TH-10' }, [pin('pa1', 'CN', 'CN-SH', 'hospitality', ['hospitality_management'], t), pin('pa2', 'CN', 'CN-GD', 'hospitality', ['thai_chinese_translation'], t)]),
      seeker('seeker-b', 'Narin', { country: 'TH', province: 'TH-50' }, [pin('pb1', 'CN', 'CN-SH', 'manufacturing', ['quality_control'], t)]),
      seeker('seeker-c', 'Mali', { country: 'TH', province: 'TH-40' }, [pin('pc1', 'CN', 'CN-JS', 'manufacturing', ['mechanical_engineering', 'quality_control'], t)]),
      seeker('seeker-d', 'Krit', { country: 'TH', province: 'TH-20' }, [pin('pd1', 'CN', 'CN-ZJ', 'technology', ['software_engineering'], t), pin('pd2', 'TH', 'TH-10', 'technology', ['data_analysis'], t)]),
      seeker('seeker-e', 'Fah', { country: 'TH', province: 'TH-83' }, [pin('pe1', 'TH', 'TH-83', 'food_service', ['culinary_arts'], t)]),
    ],
    posts: [
      { id: 'post-s1', employerId: 'employer:sample-1', company: 'Sample Riverside Hotels', position: 'Front Office Manager', industry: 'hospitality', skills: ['hospitality_management'], minYears: 3,
        details: 'Sample post for the prototype. Thai and Chinese guests; shift work.', country: 'CN', province: 'CN-SH', createdAt: iso(now - DAY_MS * 1.2), synthetic: true,
        headcount: 2, employment: 'permanent', salary: { min: 9000, max: 12000, currency: 'CNY' }, startDate: day(now + DAY_MS * 30),
        languages: [{ lang: 'zh', level: 'professional' }, { lang: 'th', level: 'native' }], education: 'bachelor', benefits: ['housing', 'meals', 'insurance'] },
      { id: 'post-s2', employerId: 'employer:sample-2', company: 'Example Precision Parts', position: 'Quality Control Engineer', industry: 'manufacturing', skills: ['quality_control'], minYears: 2,
        details: 'Sample post for the prototype. Automotive parts line.', country: 'CN', province: 'CN-JS', createdAt: iso(now - DAY_MS * 0.2), synthetic: true,
        headcount: 3, employment: 'contract', salary: null, startDate: day(now + DAY_MS * 45),
        languages: [{ lang: 'zh', level: 'conversational' }], education: 'vocational', benefits: ['housing', 'workDocs'] },
    ],
    acceptances: [],
  }
}
