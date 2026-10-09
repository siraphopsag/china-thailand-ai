// Synthetic starting data for the matching prototype: invented sample job seekers and invented employer posts at different ages,
// so every release level can be demonstrated. No real people, companies, contacts or documents.
import { DAY_MS, HOUR_MS } from './release'
import { newCase } from './cases'
import { ME, type MatchState, type Pin, type Post, type Seeker } from './types'
import type { Case } from './cases'

const iso = (t: number) => new Date(t).toISOString()
const day = (t: number) => iso(t).slice(0, 10)
const pin = (id: string, country: 'TH' | 'CN', province: string, industry: Pin['industry'], skills: Pin['skills'], at: number): Pin => ({ id, country, province, industry, skills, at: iso(at) })
const seeker = (id: string, name: string, origin: Seeker['origin'], pins: Pin[]): Seeker => ({ id, name, origin, pins, synthetic: true })
const post = (p: Omit<Post, 'synthetic' | 'releasedAt' | 'verified'>, verified = true): Post => ({ ...p, releasedAt: p.createdAt, verified, sample: true, synthetic: true })

/** a fresh seed relative to `now` (post ages decide which release level they are in) */
export function seedState(now = Date.now()): MatchState {
  const t = now - DAY_MS * 3
  return {
    version: 2, role: null, clockHours: 0, myCompany: '', member: false, memberUntil: null, credits: [], employerVerify: null, reports: [],
    me: seeker(ME, 'you', null, []),
    seekers: [
      // pins made at different hours: they form separate level-1 groups (earliest first)
      seeker('seeker-a', 'Ploy', { country: 'TH', province: 'TH-10' }, [pin('pa1', 'CN', 'CN-SH', 'hospitality', ['hospitality_management'], t), pin('pa2', 'CN', 'CN-GD', 'hospitality', ['thai_chinese_translation'], t + HOUR_MS)]),
      seeker('seeker-b', 'Narin', { country: 'TH', province: 'TH-50' }, [pin('pb1', 'CN', 'CN-SH', 'manufacturing', ['quality_control'], t + 2 * HOUR_MS)]),
      seeker('seeker-c', 'Mali', { country: 'TH', province: 'TH-40' }, [pin('pc1', 'CN', 'CN-JS', 'manufacturing', ['mechanical_engineering', 'quality_control'], t + 3 * HOUR_MS)]),
      seeker('seeker-d', 'Krit', { country: 'TH', province: 'TH-20' }, [pin('pd1', 'CN', 'CN-ZJ', 'technology', ['software_engineering'], t + 4 * HOUR_MS), pin('pd2', 'TH', 'TH-10', 'technology', ['data_analysis'], t + 4 * HOUR_MS)]),
      seeker('seeker-e', 'Fah', { country: 'TH', province: 'TH-83' }, [pin('pe1', 'TH', 'TH-83', 'food_service', ['culinary_arts'], t + 5 * HOUR_MS)]),
      seeker('seeker-f', 'Ton', { country: 'TH', province: 'TH-30' }, [pin('pf1', 'CN', 'CN-JS', 'manufacturing', ['quality_control'], t + 6 * HOUR_MS)]),
    ],
    posts: [
      post({ id: 'post-s1', employerId: 'employer:sample-1', company: 'Sample Riverside Hotels', position: 'Front Office Manager', industry: 'hospitality', skills: ['hospitality_management'], minYears: 3,
        details: 'Sample post for the prototype. Thai and Chinese guests; shift work.', country: 'CN', province: 'CN-SH', createdAt: iso(now - DAY_MS * 1.2),
        translations: { src: 'en', th: { position: 'ผู้จัดการแผนกต้อนรับ', details: 'ประกาศตัวอย่างสำหรับต้นแบบ ดูแลแขกชาวไทยและจีน ทำงานเป็นกะ' }, zh: { position: '前台经理', details: '原型示例招聘信息。接待泰国和中国客人，轮班工作。' } },
        headcount: 2, employment: 'permanent', salary: { min: 9000, max: 12000, currency: 'CNY' }, startDate: day(now + DAY_MS * 30),
        languages: [{ lang: 'zh', level: 'professional' }, { lang: 'th', level: 'native' }], education: 'bachelor', benefits: ['housing', 'meals', 'insurance'] }),
      post({ id: 'post-s2', employerId: 'employer:sample-2', company: 'Example Precision Parts', position: 'Quality Control Engineer', industry: 'manufacturing', skills: ['quality_control'], minYears: 2,
        details: 'Sample post for the prototype. Automotive parts line.', country: 'CN', province: 'CN-JS', createdAt: iso(now - HOUR_MS * 0.5),
        translations: { src: 'en', th: { position: 'วิศวกรควบคุมคุณภาพ', details: 'ประกาศตัวอย่างสำหรับต้นแบบ สายการผลิตชิ้นส่วนยานยนต์' }, zh: { position: '质量控制工程师', details: '原型示例招聘信息。汽车零部件生产线。' } },
        headcount: 3, employment: 'contract', salary: null, startDate: day(now + DAY_MS * 45),
        languages: [{ lang: 'zh', level: 'conversational' }], education: 'vocational', benefits: ['housing', 'workDocs'] }, false), // not verified yet: stops at level 2, with a warning
      // nobody took it for over a month: it has reached level 5 (international) and sinks under newer posts
      post({ id: 'post-s3', employerId: 'employer:sample-3', company: 'Sample Eastern Logistics', position: 'Warehouse Coordinator', industry: 'logistics', skills: ['project_management'], minYears: 1,
        details: 'Sample post for the prototype. Cross-border shipments.', country: 'TH', province: 'TH-20', createdAt: iso(now - DAY_MS * 40),
        translations: { src: 'en', th: { position: 'ผู้ประสานงานคลังสินค้า', details: 'ประกาศตัวอย่างสำหรับต้นแบบ ดูแลการขนส่งข้ามพรมแดน' }, zh: { position: '仓库协调员', details: '原型示例招聘信息。负责跨境货运。' } },
        headcount: 1, employment: 'permanent', salary: { min: 18000, max: 25000, currency: 'THB' }, startDate: day(now + DAY_MS * 20),
        languages: [{ lang: 'th', level: 'conversational' }, { lang: 'zh', level: 'basic' }], education: 'secondary', benefits: ['insurance'] }),
    ],
    acceptances: [
      { id: 'acc-s1', postId: 'post-s1', seekerId: 'seeker-a', at: iso(now - DAY_MS * 1.1), status: 'accepted', intro: 'Sample application for the prototype.', availableFrom: day(now + DAY_MS * 30) },
      // a sample case: "you" applied to the logistics post, the employer confirmed, and the agency is at the training step
      { id: 'acc-me', postId: 'post-s3', seekerId: ME, at: iso(now - DAY_MS * 30), status: 'forwarded', intro: 'Sample application for the prototype.', availableFrom: day(now + DAY_MS * 20), decidedAt: iso(now - DAY_MS * 28), forwardedAt: iso(now - DAY_MS * 28) },
    ],
    cases: [sampleCase(now)],
  }
}
/** the sample case, part way: documents and tests done, two of four courses done */
function sampleCase(now: number): Case {
  const c = newCase('case-s1', { id: 'acc-me', postId: 'post-s3', seekerId: ME }, iso(now - DAY_MS * 28), true)
  return { ...c, steps: { ...c.steps, accepted: iso(now - DAY_MS * 27), documents: iso(now - DAY_MS * 20), tests: iso(now - DAY_MS * 12) },
    docs: { passport: true, health: true, contract: true }, tests: { language: true, skill: true },
    trainings: c.trainings.map((x, i) => ({ ...x, done: i < 2, ...(i >= 2 ? { date: day(now + DAY_MS * (i === 2 ? 3 : 8)) } : {}) })), note: 'Sample case for the prototype.',
    dates: { start: day(now + DAY_MS * 45) } }
}
