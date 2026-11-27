// Owner's review, 24 Nov 2026: contact details typed to get round the check ("name @ gmail.com"); how to say the Chinese terms;
// the job market from outside sources on the board's map (advisers' feedback at the pitch).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CONTACT_RULES, hasContact, maskAfter, maskContact } from './domain/contact'
import { closedBy, newMessage, strikesOf } from './domain/match/chat'
import { seedState } from './domain/match/seed'
import type { MatchState } from './domain/match/types'
import { holdByRules, precheck } from './domain/match/precheck'
import { spamCheck } from './domain/match/spam'
import { employerLevel, endForContact, textProblem } from './domain/match/logic'
import { terms } from './data/culture'
import { pickVoice } from './components/speak'
import { AGENCY_BOARDS, DOE_PROVINCE, ISIC, SOURCES, change, cleanExternal, csvLine, newestCsv, parseDoeIndustries, parseDoeProvinces, parseWorldBank } from './domain/openData'
import snapshot from './data/marketSnapshot.json'
import { v2f } from './locales/v2f'
import { v2g } from './locales/v2g'
import { v2h } from './locales/v2h'
import { seekerLevel } from './pages/seeker-verify'
import { dbProblem } from './domain/match/remote'
import { DATA_ROWS } from './pages/dataMap'
import { GEMINI_MODELS, pickGeminiModels } from './ai/spec'
import { messages } from './locales/index'
import { provinces } from './locales/provinces'

const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

describe('A. contact details in any spelling', () => {
  const caught = ['siraooja @ gmail.com', 'siraooja at gmail dot com', 'siraooja แอท จีเมล ดอท คอม', 'siraooja(at)gmail(dot)com', 'siraooja 艾特 qq 点 com',
    '๐๘๑๒๓๔๕๖๗๘', '０８１２３４５６７８', 'ศูนย์แปดหนึ่ง สองสามสี่ ห้าหกเจ็ดแปด', '零八一二三四五六七八', 'zero eight one two three four five six seven eight',
    '081.234.5678', '(081) 234 5678', '081​234​5678', 'ไลน์ siraooja', 'line: sira_99', 'IG: siraooja', '微信号：abc123', 'wechat sira99',
    '@siraooja', 'bit.ly/abc', 't.me/sira', 'qq 12345678', 'gmail.com']
  const fine = ['ติดต่อผ่านอีเมลผม', 'We stand in line every day; the deadline is Monday; pay 12,000 baht', 'Production line: operators needed',
    'I will be at home. Go there at 9', 'เริ่มงาน 24/11/2026 เวลา 09:00', 'เงินเดือน 15,000 บาท ทำงาน 6 วัน', '月薪五千，工作八小时', 'Use gmail please',
    'ไลน์ผลิต 3 กะ', 'Food Paradise Co., Ltd.', 'No.1 Factory', 'เฟส 2 เริ่ม', 'one of the two jobs', 'Node.js developer', 'ทำงาน 8.00-17.00 น. หยุด 1 วัน']
  it('the owner’s example and the usual ways round the check are hidden whole; ordinary sentences are left alone', () => {
    expect(maskContact('siraooja @ gmail.com')).toEqual({ text: '[•••]', masked: true })
    for (const x of caught) expect(maskContact(x).text, x).toBe('[•••]')
    for (const x of fine) expect(maskContact(x), x).toEqual({ text: x, masked: false })
  })
  it('a number or address sent in pieces is hidden in the message that completes it', () => {
    expect(maskAfter(['โทร 081', '234'], '5678 ครับ')).toEqual({ text: '[•••] ครับ', masked: true })
    expect(maskAfter(['siraooja'], 'gmail.com').masked).toBe(true)
    expect(maskAfter(['เงินเดือน 15000'], 'เริ่ม 1 ธ.ค.').masked).toBe(false)
    const at = (m: number) => new Date(Date.UTC(2026, 10, 24, 1, m)).toISOString()
    let chat = { msgs: [] as never[] } as Parameters<typeof newMessage>[0]
    for (const [i, x] of ['ติดต่อ 081', '234'].entries()) { const r = newMessage(chat, 'seeker', { text: x }, `m${i}`, at(i)); if (r.ok) chat = r.value }
    const last = newMessage(chat, 'seeker', { text: '5678' }, 'm9', at(3))
    expect(last.ok && last.value.msgs.slice(-1)[0]).toMatchObject({ text: '[•••]', masked: true })
    // once the other side has written, or after 30 minutes, earlier pieces no longer count
    const other = newMessage(chat, 'employer', { text: 'ok' }, 'e1', at(3))
    const after = other.ok ? newMessage(other.value, 'seeker', { text: '5678' }, 'm10', at(4)) : null
    expect(after?.ok && after.value.msgs.slice(-1)[0]?.text).toBe('5678')
  })
  it('posts, introductions and notes refuse them too; the database uses the very same rules', () => {
    expect(textProblem('ติดต่อ siraooja @ gmail.com', 0, 300)).toBe('contact')
    expect(textProblem('ไลน์ shop99', 0, 300)).toBe('contact')
    expect(textProblem('ทำงานโรงงาน กะละ 8 ชั่วโมง', 0, 300)).toBeNull()
    expect(hasContact('ศูนย์แปดหนึ่ง สองสามสี่ ห้าหกเจ็ดแปด')).toBe(true)
    const sql = src('../supabase/migrations/0015_contact_rules.sql')
    for (const r of CONTACT_RULES) expect(sql, r).toContain(`b := regexp_replace(b, '${r}', '[•••]', 'gi');`)
    expect(sql).toContain('create or replace function public.no_contact(t text)')
    expect(sql).toContain("if n_all > n_prev + n_new then b := '[•••]'; end if;")
    for (const r of CONTACT_RULES) { expect(r).not.toMatch(/\\[bBwW]/); expect(r).not.toContain("'") } // syntax both sides share
  })
})

describe('B. how to say the terms', () => {
  it('every Chinese term has pinyin, a Thai reading and the words to read out; the Thai term has a Latin reading', () => {
    for (const x of terms) {
      expect(x.orig.startsWith(x.say.split('，')[0]), x.say).toBe(true)
      if (x.lang === 'zh') { expect(x.py).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/); expect(x.th).toMatch(/[ก-๙]/); expect(x.say).not.toMatch(/[A-Za-z]/) }
      else expect(x.roman).toMatch(/^[a-z ]+$/)
    }
  })
  it('the speaker uses the device’s own voice (mainland Chinese first) and is not shown without one', () => {
    expect(pickVoice([{ lang: 'zh-TW' }, { lang: 'zh-CN' }], 'zh')).toEqual({ lang: 'zh-CN' })
    expect(pickVoice([{ lang: 'zh_HK' }], 'zh')).toEqual({ lang: 'zh_HK' })
    expect(pickVoice([{ lang: 'en-US' }], 'th')).toBeNull()
    expect(src('./components/speak.tsx')).toContain('if (!voice) return null')
    expect(src('./pages/info.tsx')).toContain('<TermOriginal x={x} />')
    expect(src('./pages/match.tsx')).toContain('<SayButton text={term.say} lang={term.lang} />')
  })
})

describe('C. the job market from outside sources', () => {
  const head = ['Year', 'Month', ' Total ', ...Object.keys(DOE_PROVINCE)]
  const row = (y: string, m: string, f: (i: number) => string) => [y, m, '', ...Object.keys(DOE_PROVINCE).map((_, i) => f(i))].join(',')
  const provCsv = ['﻿จำนวนตำแหน่งงานจำแนกตามรายจังหวัด,,', head.join(','), row('2026', 'Jan', (i) => String(i + 1)), row('2026', 'Feb', (i) => (i === 0 ? '"1,200"' : '2')), row('2026', 'Mar', () => '0')].join('\r\n')
  it('reads the department’s monthly files: the latest month with figures, the one before, per province and per industry', () => {
    expect(Object.values(DOE_PROVINCE).length).toBe(77)
    expect(new Set(Object.values(DOE_PROVINCE)).size).toBe(77)
    for (const iso of Object.values(DOE_PROVINCE)) expect(provinces, iso).toHaveProperty(`prov.${iso}`)
    const p = parseDoeProvinces(provCsv)!
    expect([p.now.month, p.now.byProvince['TH-10'], p.now.total, p.before?.month, p.before?.byProvince['TH-11']]).toEqual(['2026-02', 1200, 1200 + 76 * 2, '2026-01', 2])
    const ind = parseDoeIndustries(['Year,Month,Total,' + ISIC.join(','), '2026,Jan,10,' + ISIC.map(() => '1').join(','), '2026,Feb," 9,000 ",0,0," 5,000 ",' + ISIC.slice(3).map(() => '-').join(',')].join('\n'))!
    expect(ind.month).toBe('2026-02'); expect(ind.rows[0]).toEqual({ section: 'C', n: 5000 })
    expect(csvLine('a,"1,234",b')).toEqual(['a', '1,234', 'b'])
    expect(parseDoeProvinces('nothing here')).toBeNull()
  })
  it('picks the newest CSV file, reads the World Bank answer, and keeps only clean numbers', () => {
    const pkg = { result: { resources: [{ name: '(CSV)-รายจังหวัด', format: 'CSV', url: 'https://x/old.csv', last_modified: '2026-01-01' }, { name: '(CSV)-รายจังหวัด', format: 'CSV', url: 'https://x/new.csv', last_modified: '2026-03-13' }, { name: 'รายจังหวัด', format: 'XLS', url: 'https://x/n.xls', last_modified: '2026-09-01' }] } }
    expect(newestCsv(pkg, 'รายจังหวัด')).toBe('https://x/new.csv')
    expect(parseWorldBank([{}, [{ countryiso3code: 'THA', date: '2025', value: 0.8 }, { countryiso3code: 'CHN', date: '2024', value: 4.6 }, { countryiso3code: 'CHN', date: '2025', value: null }]])).toEqual({ TH: { year: '2025', value: 0.8 }, CN: { year: '2024', value: 4.6 } })
    expect(cleanExternal({ checkedAt: 'x' })).toBeNull()
    expect(cleanExternal({ checkedAt: '2026-11-24T00:00:00Z', th: { vacancies: { now: { month: '2026-02', byProvince: { 'TH-10': 5, evil: 9, 'TH-11': -1 } } }, seekers: { now: { month: '2026-02', byProvince: {} } }, industries: { rows: [{ section: 'Z', n: 1 }] } }, countries: null }))
      .toEqual({ checkedAt: '2026-11-24T00:00:00Z', th: { vacancies: { now: { month: '2026-02', total: 5, byProvince: { 'TH-10': 5 } }, before: null }, seekers: { now: { month: '2026-02', total: 0, byProvince: {} }, before: null }, industries: { month: '2026-02', rows: [] } }, countries: null })
    expect([change(110, 100), change(5, 0), change(5, null)]).toEqual([10, null, null])
  })
  it('the copy saved in the website is complete: 77 provinces, industries, and both countries', () => {
    const d = cleanExternal(snapshot)!
    expect(Object.keys(d.th!.vacancies.now.byProvince).length).toBe(77)
    expect(d.th!.industries.rows.length).toBeGreaterThan(5)
    expect(Object.keys(d.countries!.TH)).toHaveLength(6); expect(Object.keys(d.countries!.CN)).toHaveLength(6)
  })
  it('open licences and links only; read about once a week on the server; totals only; explained on its own page', () => {
    expect(SOURCES.wb.licence).toBe('CC BY 4.0'); expect(SOURCES.doe.url).toMatch(/^https:\/\/data\.go\.th\//)
    for (const b of AGENCY_BOARDS) expect(b.url).toMatch(/^https?:\/\//)
    const api = src('../api/market.ts')
    expect(api).toContain('s-maxage=${WEEK}'); expect(api).not.toMatch(/request\.(headers|url)|cookie/i) // nothing about the visitor is used
    expect(src('../vercel.json')).toContain('"api/market.ts": { "maxDuration": 60 }')
    expect(src('./pages/board.tsx')).toContain("mSrc === 'open' ? <ExternalPanel")
    expect(src('./App.tsx')).toContain("'open-data': <OpenDataPage />")
    expect(src('./pages/info.tsx')).toContain('<NavLink to="open-data"')
    expect(JSON.stringify(snapshot)).not.toMatch(/@|name|phone|email/i)
  })
})

describe('E. the AI keeps answering when Google is busy', () => {
  it('tries the preferred models Google still offers, then other text flash models, newest first; a busy model is asked twice', () => {
    const gen = ['generateContent']
    const listed = [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: gen }, { name: 'models/gemini-4.0-flash-lite', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.9-flash-image', supportedGenerationMethods: gen }, { name: 'models/text-embedding-005', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: gen }, { name: 'models/gemini-3.6-flash', supportedGenerationMethods: gen }]
    expect(pickGeminiModels(listed, ['', ...GEMINI_MODELS])).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-4.0-flash-lite', 'gemini-3.6-flash'])
    expect(pickGeminiModels(null, ['my-model', ...GEMINI_MODELS])).toEqual(['my-model', ...GEMINI_MODELS])
    expect(GEMINI_MODELS).not.toContain('gemini-2.5-flash') // retired by Google
    const api = src('../api/ai.ts')
    expect(api).toContain('pickGeminiModels(await offeredModels(apiKey)'); expect(api).toContain('if (i % 2 === 1) await pause(1500)')
  })
})

describe('F. all the data on one page', () => {
  it('every kind of stored data has what / why / who / how long; the contract says the full passport lines are kept; both transfer laws are named', () => {
    for (const r of DATA_ROWS) for (const c of ['what', 'why', 'who', 'keep']) expect(v2g).toHaveProperty([`dm2.${r}.${c}`])
    expect(v2g['dm2.contract.what'][2]).toContain('full passport lines')
    expect(v2g['dm2.th'][2]).toContain('28'); expect(v2g['dm2.cn'][2]).toContain('38')
    expect(src('./pages/info.tsx')).toContain('<DataMap /><VerifyOverview />')
    expect(src('./pages/hire.tsx')).toContain('<VerifyOverview side="emp" />'); expect(src('./pages/match.tsx')).toContain('<VerifyOverview side="seek" />')
    for (const [k, [th, zh, en]] of Object.entries(v2g)) { expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).not.toMatch(/[฀-๿一-鿿]/); expect(messages[k as keyof typeof messages]).toEqual([th, zh, en]) }
  })
})

describe('H. fake-job wording and unusually high pay together are held for the team', () => {
  const run = (details: string, max: number, minYears = 0) => {
    const i = { company: 'Sample Border Service', position: 'Customer service', industry: 'hospitality', skills: ['customer_service'], minYears, details, place: { country: 'TH', province: 'TH-63' }, headcount: 5, employment: 'contract', salary: { min: 20000, max, currency: 'THB' }, startDate: '2027-01-10', languages: [{ lang: 'zh', level: 'native' }], education: 'none', benefits: [] } as never
    const sp = spamCheck(i, '2026-11-24T00:00:00Z', [], []), r = precheck(i, '2026-11-24T00:00:00Z')
    return holdByRules({ ...r, errors: [...r.errors, ...sp.errors], warnings: sp.lure ? [...r.warnings, 'lure'] : r.warnings, laws: sp.errors.length ? [] : r.laws })
  }
  const lure = 'งานบริการลูกค้า เงินเดือนสูง ไม่ต้องมีประสบการณ์ ทำงานแถบชายแดน มีที่พักให้', plain = 'งานบริการลูกค้าของโรงแรม ทำงานเป็นกะ มีที่พักและอาหารให้'
  it('the opening scene is held; one sign alone, or an experienced role, is not', () => {
    expect(run(lure, 120000)).toBe(true)
    expect([run(lure, 25000), run(plain, 120000), run(plain, 25000), run(lure, 120000, 3)]).toEqual([false, false, false, false])
  })
  it('the reason is shown, and the texts no longer say that only the AI holds posts', () => {
    expect(src('./pages/hire.tsx')).toContain("t('m.hold.rule')")
    for (const k of ['m.hold.owner', 'm.adm.held', 'm.adm.heldNote', 'm.adm.attn.reports'] as const) expect(messages[k].join(' '), k).not.toContain('AI')
  })
})

describe('G. the lure of fake jobs in either word order', () => {
  it('warns whichever comes first, in three languages; ordinary pay wording is left alone', () => {
    const lure = (details: string) => spamCheck({ company: 'A co', position: 'x', details } as never, '2026-11-24T00:00:00Z', [], []).lure
    for (const d of ['งานบริการลูกค้า เงินเดือนสูง ไม่ต้องมีประสบการณ์ ทำงานแถบชายแดน', '客服工作，高薪，无需经验，边境地区', 'Customer service, high salary, no experience needed']) expect(lure(d), d).toBe(true)
    for (const d of ['เงินเดือนสูงตามประสบการณ์', '有经验者薪资高', 'No experience needed, training given']) expect(lure(d), d).toBe(false)
  })
})

describe('I. verify before posting or pinning (owner’s blueprint)', () => {
  it('levels: approved = full, waiting = partial, nothing or rejected = none; seekers: phone = partial, phone and passport = full', () => {
    const ev = (status: 'pending' | 'verified' | 'rejected') => ({ kind: 'company' as const, country: 'TH' as const, regNo: 'x', status, at: '' })
    expect([employerLevel(ev('verified')), employerLevel(ev('pending')), employerLevel(ev('rejected')), employerLevel(null)]).toEqual(['full', 'partial', 'none', 'none'])
    const phone = { country: 'TH' as const, phone4: '1234', phoneAt: '' }
    expect([seekerLevel(null), seekerLevel(phone), seekerLevel({ ...phone, passport: { last4: '4567', nationality: 'CHN', expiry: '2099-01-01', at: '' } })]).toEqual(['none', 'partial', 'full'])
  })
  it('the forms are replaced by the verification until something is verified; the database refuses too; administrators are not checked', () => {
    expect(src('./pages/hire.tsx')).toContain("empLv === 'none' && !isAdmin && <div className=\"space-y-3\"><Warn tone=\"info\">{t('vl.need.emp')}</Warn><VerifyCard /></div>")
    expect(src('./pages/match.tsx')).toContain("{seekTab === 'new' && mustVerify && <NeedVerifySeeker />}")
    expect(src('./matchData.tsx')).toContain("if (local && employerLevel(st.employerVerify) === 'none') return { ok: false, problem: 'needVerify' }")
    const sql = src('../supabase/migrations/0016_verify_first.sql')
    expect(sql).toContain("if auth.uid() is null or public.is_admin() then return new; end if;")
    expect(sql).toContain("create trigger posts_need_verify before insert on public.posts"); expect(sql).toContain("create trigger pins_need_verify before insert on public.pins")
    expect(dbProblem({ message: 'need_verify' })).toBe('needVerify')
    for (const [k, [th, zh, en]] of Object.entries(v2h)) { expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).not.toMatch(/[฀-๿一-鿿]/); expect(messages[k as keyof typeof messages]).toEqual([th, zh, en]) }
  })
})

describe('J. contact details in the chat: two warnings, then the match ends (owner’s blueprint)', () => {
  const at = (m: number) => new Date(Date.UTC(2026, 10, 27, 1, m)).toISOString()
  it('the 3rd violation of one side locks the chat for both; ordinary messages do not count', () => {
    let c = { msgs: [] } as Parameters<typeof newMessage>[0]
    for (const [i, x] of ['สวัสดีครับ', 'line: sira_99', 'ok', 'siraooja @ gmail.com'].entries()) { const r = newMessage(c, 'employer', { text: x }, 'm' + i, at(i * 40)); if (r.ok) c = r.value }
    expect([strikesOf(c, 'employer'), closedBy(c)]).toEqual([2, null])
    const third = newMessage(c, 'employer', { text: 'โทร 0812345678' }, 'm9', at(400)); if (third.ok) c = third.value
    expect([strikesOf(c, 'employer'), closedBy(c)]).toEqual([3, 'employer'])
    expect(newMessage(c, 'seeker', { phrase: 'hello' }, 'x', at(401))).toEqual({ ok: false, problem: 'closed' })
  })
  it('the match ends (declined, kept as a record), the queue moves up, a started case keeps going; 3 ended matches hold the post', () => {
    const st0 = seedState(Date.parse('2026-11-27T00:00:00Z'))
    const p = st0.posts[0], mk = (id: string, status: 'accepted' | 'reserved') => ({ id, postId: p.id, seekerId: 'seeker-' + id, at: '2026-11-26T00:00:00.000Z', status, intro: '', availableFrom: null })
    let st: MatchState = { ...st0, posts: st0.posts.map((x) => (x.id === p.id ? { ...x, headcount: 1 } : x)), acceptances: [mk('a1', 'accepted'), mk('a2', 'reserved')], cases: [] }
    const r = endForContact(st, 'a1', 'employer', '2026-11-27T01:00:00Z'); expect(r.ok).toBe(true); if (!r.ok) return
    expect(r.value.acceptances.map((x) => [x.id, x.status, x.endedFor ?? ''])).toEqual([['a1', 'rejected', 'contact'], ['a2', 'accepted', '']])
    st = r.value
    for (const id of ['a2', 'a3']) { if (id === 'a3') st = { ...st, acceptances: [...st.acceptances, mk('a3', 'accepted')] }; const x = endForContact(st, id, 'employer', '2026-11-27T02:00:00Z'); if (x.ok) st = x.value }
    expect(st.posts.find((x) => x.id === p.id)?.held).toBe(true)
    const sql = src('../supabase/migrations/0017_chat_strikes.sql')
    expect(sql).toContain("not public.chat_locked(acceptance_id)"); expect(sql).toContain("if n <> 3 then return null; end if;")
    expect(sql).not.toMatch(/delete from public.chat_messages/)
    expect(src('./pages/chat.tsx')).toContain("t('ch.strike', { n: strikes, max: MAX_STRIKES })")
  })
})

describe('D. texts', () => {
  it('every new text has Thai, Chinese and English in the right scripts', () => {
    for (const [k, [th, zh, en]] of Object.entries(v2f)) {
      expect(th, k).toMatch(/[฀-๿]/); expect(zh, k).toMatch(/[一-鿿]/); expect(en, k).toMatch(/[A-Za-z]/)
      expect(en, k).not.toMatch(/[฀-๿一-鿿]/)
      expect(messages[k as keyof typeof messages]).toEqual([th, zh, en])
    }
    for (const s of ISIC) expect(v2f).toHaveProperty(`od.isic.${s}`)
  })
})
