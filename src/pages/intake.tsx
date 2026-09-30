import { useMemo, useState } from 'react'
import type { Direction, Holder, Profile } from '../types'
import { go, useStore } from '../store'
import { BusinessProfile, Disclaimer, EmptyState, PageHead, ProgressStepper, Warn, WorkflowStrip } from '../components/ui'
import { dirInfo } from '../utils/labels'

/* ================= LANDING ================= */
export function Landing() {
  const { startDemo } = useStore()
  const steps = [['1', 'บอกข้อมูลธุรกิจ', '📝'], ['2', 'AI วิเคราะห์', '🧠'], ['3', 'ตรวจความเสี่ยง', '🛡️'], ['4', 'สร้างแผนดำเนินงาน', '🗺️'], ['5', 'ติดตาม Compliance', '📡']]
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-navy-900 text-white px-6 py-12 md:px-12 md:py-16">
        <p className="text-navy-200 text-sm mb-3">🇹🇭 ↔ 🇨🇳 แพลตฟอร์ม AI Cross-Border Business Entry & Compliance</p>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight max-w-3xl">AI ผู้ช่วยวางแผนการขยายธุรกิจระหว่างไทย–จีน</h1>
        <p className="mt-4 text-lg text-navy-100 max-w-2xl">วิเคราะห์ข้อกำหนด ความเสี่ยง ภาษา และขั้นตอนที่เกี่ยวข้องกับการขยายธุรกิจข้ามประเทศในระบบเดียว</p>
        <div className="flex flex-wrap gap-3 mt-8">
          <button className="btn bg-white text-navy-900 hover:bg-navy-50" onClick={() => go('direction')}>เริ่มวิเคราะห์ธุรกิจ</button>
          <button className="btn border border-white/60 text-white hover:bg-white/10" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>ดูวิธีการทำงาน</button>
          <button className="btn bg-amber-400 text-navy-900 hover:bg-amber-300" onClick={() => { startDemo(); go('dashboard') }}>ทดลอง Demo</button>
        </div>
        <p className="text-xs text-navy-300 mt-4">Demo ไม่ต้องลงทะเบียน ใช้ข้อมูลสมมติของบริษัทตัวอย่างเท่านั้น</p>
      </section>
      <section id="how" aria-labelledby="how-h">
        <h2 id="how-h" className="h1 text-center mb-6">วิธีการทำงาน 5 ขั้นตอน</h2>
        <ol className="grid grid-cols-2 md:grid-cols-5 gap-3">{steps.map(([n, t, i]) => <li key={n} className="card text-center"><div className="text-3xl" aria-hidden>{i}</div><div className="text-xs text-slate-500 mt-1">ขั้นที่ {n}</div><div className="font-semibold">{t}</div></li>)}</ol>
        <div className="card mt-6"><p className="text-sm text-slate-600 mb-3">ไม่ใช่แชตบอตถามตอบทั่วไป แต่เป็นขั้นตอนที่ใช้โปรไฟล์ธุรกิจเดียวกันตลอดทั้งระบบ:</p><WorkflowStrip /></div>
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        {[['ปัญหา', 'ข้อมูลกระจัดกระจาย ภาษาและกฎหมายต่างกัน ต้องใช้ผู้ให้บริการหลายราย SME จึงไม่รู้ว่าต้องทำอะไรก่อนหลัง'], ['แนวทางของเรา', 'AI ทำงานส่วนที่ทำซ้ำได้: เก็บข้อมูล จัดหมวด ตรวจความเสี่ยง สร้างเช็กลิสต์และร่างเอกสาร ส่วนกรณีเสี่ยงสูงส่งต่อผู้เชี่ยวชาญ (AI-first + human exception)'], ['หลักความโปร่งใส', 'ทุกข้อกำหนดแสดงแหล่งข้อมูลและสถานะการตรวจสอบ ไม่สร้างกฎหมาย โทษ หรือค่าธรรมเนียมขึ้นเอง และไม่ช่วยเลี่ยงกฎหมาย']].map(([t, d]) => <div key={t} className="card"><h3 className="h2">{t}</h3><p className="text-sm text-slate-600 mt-1">{d}</p></div>)}
      </section>
      <Disclaimer />
    </div>
  )
}

/* ================= DIRECTION ================= */
export function DirectionPage() {
  const { set, direction, profile } = useStore()
  const pick = (d: Direction) => { set({ direction: d, profile: profile && profile.direction === d ? profile : null }); go('interview') }
  const cards: [Direction, string][] = [['TH_CN', 'สำหรับธุรกิจไทยที่ต้องการขยายธุรกิจ ลงทุน หรือจ้างงานในจีน'], ['CN_TH', 'สำหรับธุรกิจจีนที่ต้องการขยายธุรกิจ ลงทุน หรือจ้างงานในไทย']]
  return (
    <div>
      <PageHead title="เลือกทิศทางการขยายธุรกิจ" sub="ระบบใช้กฎเกณฑ์ของแต่ละประเทศแยกกัน ไม่ใช้ตรรกะกลางแบบ “กฎหมายอาเซียน”" />
      <div className="grid md:grid-cols-2 gap-5">{cards.map(([d, t]) => { const i = dirInfo(d); return (
        <button key={d} onClick={() => pick(d)} className={`card text-left hover:border-navy-500 hover:shadow-md transition p-8 ${direction === d ? 'ring-2 ring-navy-600' : ''}`}>
          <div className="text-5xl mb-3" aria-hidden>{i.fromFlag} → {i.toFlag}</div><div className="text-2xl font-bold text-navy-900">{i.from} → {i.to}</div><div className="text-slate-500">{i.text}</div><p className="mt-3 text-slate-700">{t}</p><span className="btn-primary mt-4">เลือกทิศทางนี้</span>
        </button>) })}</div>
    </div>
  )
}

/* ================= INTERVIEW ================= */
type A = Record<string, string | string[]>
interface Q { id: string; cat: number; text: (d: Direction) => string; type: 'text' | 'choice' | 'multi' | 'number' | 'pct'; options?: (d: Direction) => string[]; when?: (a: A, d: Direction) => boolean; help?: string; min?: number }
const cats = ['ข้อมูลธุรกิจ', 'การลงทุน', 'โครงสร้างผู้ถือหุ้น', 'การจ้างงาน', 'สินค้า/บริการ', 'พื้นที่ดำเนินงาน', 'กิจกรรมข้ามพรมแดน']
const T = (d: Direction) => dirInfo(d)
const company = (a: A) => (a.forms as string[] | undefined)?.some((f) => f === 'เปิดบริษัท' || f === 'ลงทุน') ?? false
const sideOpts = (d: Direction) => [`ฝั่ง${T(d).from} (ผู้ถือหุ้นต่างชาติในประเทศเป้าหมาย)`, `ฝั่ง${T(d).to} (ผู้ถือหุ้นท้องถิ่น)`, 'ร่วมกัน', 'ยังไม่ทราบ']
const QS: Q[] = [
  { id: 'name', cat: 0, type: 'text', text: () => 'ธุรกิจของคุณชื่ออะไร?', help: 'ใช้เป็นชื่อโปรไฟล์ ไม่จำเป็นต้องเป็นชื่อจดทะเบียนจริง' },
  { id: 'btype', cat: 0, type: 'choice', text: () => 'ธุรกิจของคุณทำเกี่ยวกับอะไร?', options: () => ['ผลิต (Manufacturing)', 'ค้าปลีก/ค้าส่ง', 'บริการ', 'อาหารและเครื่องดื่ม', 'เทคโนโลยี/ซอฟต์แวร์', 'อื่น ๆ'] },
  { id: 'btypeOther', cat: 0, type: 'text', when: (a) => a.btype === 'อื่น ๆ', text: () => 'ช่วยระบุประเภทธุรกิจให้ชัดขึ้นหน่อยได้ไหม?', help: 'ระบบต้องรู้ประเภทกิจกรรมก่อนจึงจะตรวจข้อกำหนดได้' },
  { id: 'activity', cat: 0, type: 'text', text: () => 'กิจกรรมหลักของธุรกิจคืออะไร? (อธิบายสั้น ๆ)', help: 'เช่น ผลิตชิ้นส่วนพลาสติกสำหรับเครื่องใช้ไฟฟ้า' },
  { id: 'activityMore', cat: 0, type: 'text', when: (a) => String(a.activity ?? '').trim().length < 20, text: () => 'ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์ ลูกค้าหลักคือใคร และขายผ่านช่องทางใด?' },
  { id: 'forms', cat: 1, type: 'multi', text: (d) => `คุณต้องการเข้าไปทำธุรกิจใน${T(d).to}ในรูปแบบใด? (เลือกได้หลายข้อ)`, options: (d) => ['เปิดบริษัท', 'ลงทุน', 'ส่งสินค้า', 'จ้างพนักงาน', `ส่งพนักงานจาก${T(d).from}ไปทำงาน`, 'หาพันธมิตรทางธุรกิจ', 'อื่น ๆ'] },
  { id: 'invest', cat: 1, type: 'choice', when: company, text: () => 'วงเงินลงทุนโดยประมาณ?', options: () => ['ต่ำกว่า 10 ล้านบาท', '10–50 ล้านบาท', 'มากกว่า 50 ล้านบาท', 'ยังไม่ทราบ'] },
  { id: 'ownOrigin', cat: 2, type: 'pct', when: company, text: (d) => `ผู้ถือหุ้นฝั่ง${T(d).from}ถือหุ้นกี่เปอร์เซ็นต์? (ที่เหลือเป็นผู้ถือหุ้นฝั่ง${T(d).to})`, help: 'กรอกตัวเลข 0–100' },
  { id: 'funding', cat: 2, type: 'choice', when: company, text: () => 'เงินลงทุนมาจากใคร?', options: (d) => ['ตามสัดส่วนหุ้นของแต่ละฝ่าย', `ผู้ถือหุ้นฝั่ง${T(d).from}เป็นผู้จัดหาเกือบทั้งหมด`, `ผู้ถือหุ้นฝั่ง${T(d).to}เป็นผู้จัดหาเกือบทั้งหมด`, 'ยังไม่ทราบ'] },
  { id: 'realInvestor', cat: 2, type: 'choice', when: company, text: () => 'ใครเป็นผู้ลงทุนจริง?', options: sideOpts },
  { id: 'operator', cat: 2, type: 'choice', when: company, text: () => 'ใครจะเป็นผู้บริหารหรือผู้มีอำนาจควบคุมกิจการจริง?', options: sideOpts },
  { id: 'economic', cat: 2, type: 'choice', when: (a) => company(a) && typeof a.funding === 'string' && !a.funding.startsWith('ตามสัดส่วน') && a.funding !== 'ยังไม่ทราบ', text: () => 'จากที่เงินลงทุนไม่ได้มาตามสัดส่วนหุ้น ผลกำไร/เงินปันผลแบ่งกันอย่างไร?', options: () => ['ตามสัดส่วนหุ้น', 'ฝ่ายที่ออกเงินได้ส่วนแบ่งมากกว่าสัดส่วนหุ้น', 'ยังไม่ทราบ'] },
  { id: 'side', cat: 2, type: 'choice', when: company, text: () => 'มีข้อตกลงอื่นระหว่างผู้ถือหุ้นที่ไม่ได้ระบุในเอกสารจดทะเบียนหรือไม่?', options: () => ['ไม่มี', 'มี', 'ยังไม่ทราบ'], help: 'หากมี ระบบจะแนะนำให้เปิดเผยต่อผู้ตรวจสอบ ไม่ใช่ซ่อนไว้' },
  { id: 'hire', cat: 3, type: 'choice', text: (d) => `คุณต้องการจ้างพนักงานใน${T(d).to}หรือไม่?`, options: () => ['ต้องการ', 'ไม่ต้องการ', 'ยังไม่แน่ใจ'] },
  { id: 'employees', cat: 3, type: 'number', when: (a) => a.hire === 'ต้องการ' || a.hire === 'ยังไม่แน่ใจ', text: () => 'จำนวนพนักงานทั้งหมดที่วางแผนไว้ (คน)?', min: 0 },
  { id: 'crossWorkers', cat: 3, type: 'choice', when: (a) => a.hire !== 'ไม่ต้องการ', text: (d) => `มีการส่งพนักงานจาก${T(d).from}ไปทำงาน หรือจ้างแรงงานต่างสัญชาติร่วมด้วยหรือไม่?`, options: () => ['มี', 'ไม่มี'] },
  { id: 'products', cat: 4, type: 'text', text: () => 'สินค้าหรือบริการหลักคืออะไร?' },
  { id: 'regulated', cat: 4, type: 'choice', text: () => 'สินค้าหรือบริการอยู่ในกลุ่มที่อาจมีการควบคุมเป็นพิเศษหรือไม่?', options: () => ['ไม่มี', 'อาหาร/ยา/เครื่องสำอาง', 'อุปกรณ์ไฟฟ้า/อิเล็กทรอนิกส์', 'กลุ่มอื่นที่อาจต้องขออนุญาต'] },
  { id: 'location', cat: 5, type: 'text', text: (d) => `พื้นที่ดำเนินงานใน${T(d).to}คือที่ไหน? (เมือง/จังหวัด/มณฑล)` },
  { id: 'cross', cat: 6, type: 'multi', text: () => 'มีกิจกรรมข้ามพรมแดนอะไรบ้าง?', options: () => ['นำเข้าวัตถุดิบ', 'ส่งออกสินค้า', 'โอนเงินข้ามประเทศ', 'ไม่มี'] },
]
const pickIdx = (opts: string[], v: string) => opts.indexOf(v)
function buildProfile(a: A, d: Direction): Profile {
  const i = T(d)
  const comp = company(a)
  const origin = comp ? Number(a.ownOrigin ?? 50) : 100
  const partner = 100 - origin
  const f = String(a.funding ?? '')
  const fo = f.startsWith('ผู้ถือหุ้นฝั่ง' + i.from) ? 100 : f.startsWith('ผู้ถือหุ้นฝั่ง' + i.to) ? 0 : origin
  const fundingUnknown = f === 'ยังไม่ทราบ'
  const eco = String(a.economic ?? '')
  const funderIsOrigin = fo === 100
  const ecoOrigin = eco.startsWith('ฝ่ายที่ออกเงิน') ? (funderIsOrigin ? 80 : 20) : origin
  const side = (v: unknown): 'origin' | 'partner' | 'shared' | 'unknown' => { const s = String(v ?? ''); return s.startsWith('ฝั่ง' + i.from) ? 'origin' : s.startsWith('ฝั่ง' + i.to) ? 'partner' : s === 'ร่วมกัน' ? 'shared' : 'unknown' }
  const mk = (id: 'origin' | 'partner', pct: number, cap: number, ecoV: number): Holder => ({ id, label: `ผู้ถือหุ้น${id === 'origin' ? i.from : i.to}`, nationality: (id === 'origin' ? (d === 'TH_CN' ? 'TH' : 'CN') : (d === 'TH_CN' ? 'CN' : 'TH')), percent: pct, capital: cap, voting: pct, board: pct, economic: ecoV })
  const unknownFacts: string[] = []
  if (comp && fundingUnknown) unknownFacts.push('ยังไม่ทราบว่าเงินลงทุนมาจากใคร')
  if (comp && eco === 'ยังไม่ทราบ') unknownFacts.push('ยังไม่ทราบการแบ่งผลกำไร/เงินปันผล')
  const op = side(a.operator)
  return {
    companyName: String(a.name), direction: d, businessType: a.btype === 'อื่น ๆ' ? String(a.btypeOther) : String(a.btype),
    activity: [a.activity, a.activityMore].filter(Boolean).join(' — '), forms: a.forms as string[], investmentRange: String(a.invest ?? ''),
    employees: Number(a.employees ?? 0), crossBorderWorkers: a.crossWorkers === 'มี',
    holders: [mk('origin', origin, fo, ecoOrigin), mk('partner', partner, 100 - fo, 100 - ecoOrigin)],
    realInvestor: side(a.realInvestor), operator: op === 'shared' ? 'joint' : op,
    sideAgreement: a.side === 'มี' ? 'yes' : a.side === 'ไม่มี' ? 'no' : 'unknown',
    products: String(a.products ?? ''), regulatedGoods: String(a.regulated ?? ''), location: String(a.location ?? ''), crossBorder: ((a.cross as string[]) ?? []).filter((x) => x !== 'ไม่มี'), unknownFacts,
  }
}

export function InterviewPage() {
  const { direction, set, log, startDemo } = useStore()
  const [answers, setAnswers] = useState<A>({})
  const [idx, setIdx] = useState(0)
  const [val, setVal] = useState<string | string[]>('')
  const [err, setErr] = useState('')
  const d = direction ?? 'TH_CN'
  const visible = useMemo(() => QS.filter((q) => !q.when || q.when(answers, d)), [answers, d])
  if (!direction) return <div><PageHead title="สัมภาษณ์ธุรกิจด้วย AI" /><EmptyState title="ยังไม่ได้เลือกทิศทาง" text="กรุณาเลือกทิศทางการขยายธุรกิจก่อนเริ่มสัมภาษณ์" /></div>
  const q = visible[Math.min(idx, visible.length - 1)]
  const done = Object.keys(answers)
  const curCat = q.cat
  const opts = q.options?.(d) ?? []
  const submit = () => {
    let v = val
    if (q.type === 'multi') { if (!(v as string[]).length) return setErr('กรุณาเลือกอย่างน้อย 1 ข้อ') }
    else if (!String(v).trim()) return setErr('กรุณาระบุข้อมูลเพิ่มเติมก่อนไปต่อ')
    if (q.type === 'pct' || q.type === 'number') {
      const n = Number(v); if (Number.isNaN(n) || n < (q.min ?? 0) || (q.type === 'pct' && n > 100)) return setErr(q.type === 'pct' ? 'กรุณากรอกตัวเลขระหว่าง 0 ถึง 100' : 'กรุณากรอกจำนวนเป็นตัวเลขที่ไม่ติดลบ'); v = String(Math.round(n))
    }
    if (q.type === 'text' && String(v).trim().length < 2) return setErr('ข้อมูลยังไม่เพียงพอ กรุณาพิมพ์ให้ชัดเจนขึ้น')
    const next = { ...answers, [q.id]: q.type === 'text' ? String(v).trim() : v }
    setAnswers(next); setErr('')
    const nv = QS.filter((x) => !x.when || x.when(next, d))
    const nextIdx = nv.findIndex((x) => x.id === q.id) + 1
    if (nextIdx >= nv.length) {
      const p = buildProfile(next, d); set({ profile: p, employment: { mode: next.hire === 'ไม่ต้องการ' ? '' : p.crossBorderWorkers ? `ส่งพนักงาน${T(d).from}ไป${T(d).to}` : `จ้างคน${T(d).to}ใน${T(d).to}`, nationality: '', location: p.location, duration: '', salary: '', hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' }, analysisDone: false, stepOverrides: {}, docs: {} }); log('สร้างโปรไฟล์ธุรกิจจากการสัมภาษณ์'); return go('profile')
    }
    setIdx(nextIdx); setVal(nv[nextIdx].type === 'multi' ? [] : '')
  }
  const back = () => { if (idx > 0) { setIdx(idx - 1); const pq = visible[idx - 1]; setVal((answers[pq.id] as string | string[]) ?? (pq.type === 'multi' ? [] : '')); setErr('') } }
  return (
    <div>
      <PageHead title="สัมภาษณ์ธุรกิจด้วย AI" sub={`ทิศทาง: ${T(d).fromFlag} ${T(d).text} ${T(d).toFlag} — AI จะถามทีละหมวดและปรับคำถามตามคำตอบก่อนหน้า`}><button className="btn-ghost" onClick={() => { startDemo(); go('profile') }}>ใช้ข้อมูล Demo แทน</button></PageHead>
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="card h-fit"><ProgressStepper steps={cats} current={curCat} /></aside>
        <section className="space-y-3" aria-live="polite">
          {visible.slice(0, idx).map((pq) => <div key={pq.id} className="space-y-1"><div className="bg-navy-50 border border-navy-100 rounded-xl px-4 py-2 text-sm max-w-xl">🤖 {pq.text(d)}</div><div className="bg-navy-800 text-white rounded-xl px-4 py-2 text-sm ml-auto max-w-md w-fit">{Array.isArray(answers[pq.id]) ? (answers[pq.id] as string[]).join(', ') : String(answers[pq.id] ?? '')}{pq.type === 'pct' ? '%' : ''}</div></div>)}
          <div className="card border-navy-300">
            <div className="text-xs text-navy-600 mb-1">หมวด {String.fromCharCode(65 + q.cat)} · {cats[q.cat]} · คำถามที่ {idx + 1}</div>
            <label className="text-lg font-semibold text-navy-900 block" htmlFor="ans">🤖 {q.text(d)}</label>
            {q.help && <p className="text-sm text-slate-500 mb-2">{q.help}</p>}
            <div className="mt-3">
              {(q.type === 'choice' || q.type === 'multi') && <div className="grid sm:grid-cols-2 gap-2" role={q.type === 'choice' ? 'radiogroup' : 'group'} aria-labelledby="ans">{opts.map((o) => { const sel = q.type === 'multi' ? (val as string[]).includes(o) : val === o; return (
                <button type="button" key={o} aria-pressed={sel} onClick={() => { setErr(''); setVal(q.type === 'multi' ? (sel ? (val as string[]).filter((x) => x !== o) : [...(val as string[]), o]) : o) }} className={`text-left px-4 py-3 rounded-lg border min-h-[44px] ${sel ? 'border-navy-700 bg-navy-100 font-semibold' : 'border-slate-300 hover:bg-slate-50'}`}>{q.type === 'multi' ? (sel ? '☑ ' : '☐ ') : sel ? '◉ ' : '○ '}{o}</button>) })}</div>}
              {(q.type === 'text') && <input id="ans" className="input" value={val as string} onChange={(e) => { setVal(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />}
              {(q.type === 'number' || q.type === 'pct') && <input id="ans" type="number" inputMode="numeric" className="input max-w-[180px]" value={val as string} onChange={(e) => { setVal(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />}
            </div>
            {err && <p role="alert" className="text-red-700 text-sm mt-2">{err}</p>}
            <div className="flex gap-2 mt-4"><button className="btn-ghost" onClick={back} disabled={idx === 0}>ย้อนกลับ</button><button className="btn-primary" onClick={submit}>{idx + 1 >= visible.length ? 'สร้างโปรไฟล์ธุรกิจ' : 'ถัดไป'}</button></div>
          </div>
          {done.length > 0 && pickIdx([], '') < 0 && <p className="text-xs text-slate-500">ตอบแล้ว {idx} ข้อ — ข้อมูลที่ให้จะถูกเก็บในเบราว์เซอร์ของคุณเท่านั้นในเวอร์ชัน Prototype</p>}
        </section>
      </div>
    </div>
  )
}

/* ================= PROFILE ================= */
export function ProfilePage() {
  const { profile, set, log } = useStore()
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState<Profile | null>(profile)
  const [err, setErr] = useState('')
  if (!profile || !f) return <div><PageHead title="โปรไฟล์ธุรกิจ" /><EmptyState /></div>
  const save = () => {
    if (!f.companyName.trim() || !f.activity.trim()) return setErr('กรุณาระบุชื่อธุรกิจและกิจกรรมหลัก')
    if (!(f.employees >= 0)) return setErr('จำนวนพนักงานต้องเป็นตัวเลขที่ไม่ติดลบ')
    set({ profile: f, analysisDone: false }); log('แก้ไขโปรไฟล์ธุรกิจ'); setEdit(false); setErr('')
  }
  return (
    <div className="space-y-5">
      <PageHead title="โปรไฟล์ธุรกิจ" sub="ข้อมูลชุดนี้ถูกใช้เป็นบริบทในทุกการวิเคราะห์ ตั้งแต่ความเสี่ยง แผนงาน จนถึงเอกสาร" />
      <WorkflowStrip active={0} />
      {edit ? (
        <div className="card space-y-3">
          <h2 className="h2">แก้ไขข้อมูล</h2>
          {([['companyName', 'ชื่อธุรกิจ'], ['businessType', 'ประเภทธุรกิจ'], ['activity', 'กิจกรรมหลัก'], ['location', 'พื้นที่ดำเนินงาน'], ['products', 'สินค้า/บริการ']] as const).map(([k, l]) => <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
          <div><label className="label" htmlFor="emp">จำนวนพนักงาน</label><input id="emp" type="number" min={0} className="input max-w-[180px]" value={f.employees} onChange={(e) => setF({ ...f, employees: Number(e.target.value) })} /></div>
          <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" className="w-5 h-5" checked={f.crossBorderWorkers} onChange={(e) => setF({ ...f, crossBorderWorkers: e.target.checked })} />มีการจ้างแรงงานข้ามประเทศ</label>
          <p className="text-sm text-slate-500">แก้ไขสัดส่วนหุ้น เงินลงทุน และการควบคุมได้ที่หน้า “วิเคราะห์โครงสร้างผู้ถือหุ้น”</p>
          {err && <p role="alert" className="text-red-700 text-sm">{err}</p>}
          <div className="flex gap-2"><button className="btn-primary" onClick={save}>บันทึก</button><button className="btn-ghost" onClick={() => { setF(profile); setEdit(false); setErr('') }}>ยกเลิก</button></div>
        </div>
      ) : <BusinessProfile p={profile} onEdit={() => { setF(profile); setEdit(true) }} />}
      {profile.unknownFacts && profile.unknownFacts.length > 0 && <Warn>ข้อมูลยังไม่เพียงพอสำหรับบางหัวข้อ: {profile.unknownFacts.join(' · ')}</Warn>}
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('analysis')}>เริ่มให้ AI วิเคราะห์ →</button><button className="btn-ghost" onClick={() => go('dashboard')}>ไปที่ภาพรวม</button></div>
      <Disclaimer />
    </div>
  )
}
