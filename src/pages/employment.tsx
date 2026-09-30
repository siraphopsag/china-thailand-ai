import { useState } from 'react'
import type { ContractInput, EmploymentInput } from '../types'
import { go, useStore } from '../store'
import { AnalysisTabs, Disclaimer, EmptyState, PageHead, SourceCard, StatusBadge, VerifyBadge, Warn } from '../components/ui'
import { analyzeEmployment, contractRequired, DISCLAIMER_DRAFT, generateContract } from '../services/engines'
import { aiService } from '../services/aiService'
import { situations, terms } from '../data/culture'
import { getReg } from '../data/regulations'

const modes = ['จ้างคนจีนในจีน', 'จ้างคนไทยในไทย', 'ส่งพนักงานไทยไปจีน', 'ส่งพนักงานจีนมาไทย', 'นายจ้างอยู่ประเทศหนึ่ง ลูกจ้างทำงานอีกประเทศ']
const empFields: [keyof EmploymentInput, string][] = [['nationality', 'สัญชาติลูกจ้าง'], ['location', 'สถานที่ทำงาน'], ['duration', 'ระยะเวลาจ้าง'], ['salary', 'เงินเดือน'], ['hours', 'ชั่วโมงทำงาน'], ['leave', 'วันลา'], ['socialSecurity', 'ประกันสังคม'], ['workAuth', 'สถานะใบอนุญาตทำงาน'], ['tax', 'ข้อพิจารณาด้านภาษี']]

export function EmploymentPage() {
  const { profile, employment, set, log } = useStore()
  if (!profile) return <div><PageHead title="การวิเคราะห์การจ้างงาน" /><EmptyState /></div>
  const rows = analyzeEmployment(employment, profile)
  const missing = rows.filter((r) => r.note.startsWith('ข้อมูลยังไม่เพียงพอ')).length
  const up = (k: keyof EmploymentInput, v: string) => set({ employment: { ...employment, [k]: v }, analysisDone: false })
  return (
    <div className="space-y-5">
      <PageHead title="การวิเคราะห์การจ้างงาน" sub="ระบบจะไม่สรุปข้อกฎหมายเมื่อข้อเท็จจริงยังไม่ครบ และจะแสดง “ต้องตรวจสอบเพิ่มเติม” แทน" />
      <AnalysisTabs active="employment" />
      <div className="card space-y-3"><h2 className="h2">รูปแบบการจ้างงาน</h2>
        <div role="radiogroup" aria-label="รูปแบบการจ้างงาน" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">{modes.map((m) => <button key={m} role="radio" aria-checked={employment.mode === m} onClick={() => up('mode', m)} className={`px-4 py-3 rounded-lg border text-left min-h-[44px] ${employment.mode === m ? 'border-navy-700 bg-navy-100 font-semibold' : 'border-slate-300 hover:bg-slate-50'}`}>{employment.mode === m ? '◉ ' : '○ '}{m}</button>)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{empFields.map(([k, l]) => <div key={k}><label className="label" htmlFor={'e' + k}>{l}</label><input id={'e' + k} className="input" value={employment[k]} onChange={(e) => up(k, e.target.value)} /></div>)}</div>
      </div>
      {missing > 0 ? <Warn>ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์ {missing} หัวข้อ — กรุณาระบุข้อมูลเพิ่มเติมในช่องด้านบน</Warn> : <Warn tone="blue">ข้อมูลครบเบื้องต้น แต่เงื่อนไขท้องถิ่นยังต้องตรวจสอบกับแหล่งทางการ</Warn>}
      <div className="card overflow-x-auto"><h2 className="h2 mb-2">ผลวิเคราะห์ราย หัวข้อ</h2>
        <table className="w-full text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">หัวข้อ</th><th className="p-2">สถานะ</th><th className="p-2">หมายเหตุ</th><th className="p-2">แหล่งข้อมูล</th></tr></thead><tbody>
          {rows.map((r) => { const g = getReg(r.sourceId); return <tr key={r.area} className="border-b border-slate-100 align-top"><td className="p-2 font-medium">{r.area}</td><td className="p-2"><StatusBadge level={r.status} /></td><td className="p-2 text-slate-600">{r.note}</td><td className="p-2">{g && <a className="text-navy-600 underline" href={g.sourceUrl} target="_blank" rel="noopener noreferrer">{g.authority}</a>}</td></tr> })}</tbody></table></div>
      <div className="grid md:grid-cols-2 gap-3"><SourceCard id={profile.direction === 'TH_CN' ? 'cn-immigration' : 'th-labour'} /><SourceCard id={profile.direction === 'TH_CN' ? 'cn-labor' : 'th-tax'} /></div>
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => { log('บันทึกข้อมูลการจ้างงาน'); go('contract') }}>ต่อไป: ผู้ช่วยสัญญาจ้าง →</button></div>
      <Disclaimer />
    </div>
  )
}

/* ================= CONTRACT ================= */
const cFields: [keyof ContractInput, string, boolean?][] = [['employer', 'นายจ้าง'], ['employee', 'ลูกจ้าง'], ['nationality', 'สัญชาติ'], ['job', 'ตำแหน่งงาน'], ['location', 'สถานที่ทำงาน'], ['startDate', 'วันเริ่มงาน'], ['duration', 'ระยะเวลาสัญญา'], ['salary', 'เงินเดือน/ค่าตอบแทน'], ['benefits', 'สวัสดิการ'], ['hours', 'เวลาทำงาน'], ['leave', 'วันลา'], ['probation', 'ระยะทดลองงาน'], ['other', 'เงื่อนไขอื่นที่ตกลงกัน', true]]
export function ContractPage() {
  const { profile, contract, employment, set, log } = useStore()
  const [out, setOut] = useState<ReturnType<typeof generateContract> | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [lang, setLang] = useState<'th' | 'cn'>('th')
  if (!profile) return <div><PageHead title="ผู้ช่วยสัญญาจ้างไทย–จีน" /><EmptyState /></div>
  const gen = async () => {
    const pre = generateContract(contract, employment.mode)
    if (!pre.ready) { setOut(null); return setErr('กรุณาระบุอย่างน้อย นายจ้าง ลูกจ้าง และตำแหน่งงาน ก่อนสร้างร่างสัญญา') }
    setErr(''); setBusy(true); setOut(await aiService.generateContract(contract, employment.mode)); setBusy(false); log('สร้างร่างสัญญาจ้างเบื้องต้น')
  }
  return (
    <div className="space-y-5">
      <PageHead title="ผู้ช่วยสัญญาจ้างไทย–จีน" sub="กรอกข้อมูล → AI ตรวจฟิลด์ที่ขาด → สร้างโครงร่างสัญญา คำอธิบายภาษาไทย และฉบับภาษาจีน" />
      <AnalysisTabs active="contract" />
      <Warn tone="blue"><b>{DISCLAIMER_DRAFT}</b></Warn>
      <div className="card"><h2 className="h2 mb-3">ข้อมูลสัญญา</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{cFields.map(([k, l, wide]) => <div key={k} className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}><label className="label" htmlFor={'c' + k}>{l}{contractRequired.some((r) => r.k === k) ? ' *' : ''}</label><input id={'c' + k} className="input" value={contract[k]} onChange={(e) => { set({ contract: { ...contract, [k]: e.target.value } }); setOut(null) }} /></div>)}</div>
        {err && <p role="alert" className="text-red-700 text-sm mt-2">{err}</p>}
        <div className="mt-4"><button className="btn-primary" disabled={busy} onClick={gen}>{busy ? 'AI กำลังตรวจและร่างสัญญา...' : 'ให้ AI ตรวจและสร้างร่างสัญญา'}</button></div></div>
      {out && <>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card"><h2 className="h2 mb-2">รายการข้อมูลที่ยังไม่ครบ</h2>{out.missing.length ? <ul className="list-disc ml-5 text-sm">{out.missing.map((m) => <li key={m}>{m} — ต้องตรวจสอบเพิ่มเติม</li>)}</ul> : <p className="text-sm text-green-700">✓ ข้อมูลครบตามรายการขั้นต่ำของระบบ</p>}</div>
          <div className="card"><h2 className="h2 mb-2">ข้อกำหนดที่ควรตรวจสอบ</h2><ul className="space-y-2 text-sm">{out.checks.map((c) => <li key={c.t}>{c.t}<br /><VerifyBadge v={c.v} /> <span className="text-xs text-slate-500">ตัวอย่างสำหรับ Prototype</span></li>)}</ul></div>
        </div>
        <div className="card"><div className="flex flex-wrap justify-between gap-2 mb-2"><h2 className="h2">ร่างสัญญาเบื้องต้น</h2><div className="flex gap-2"><button className={lang === 'th' ? 'btn-primary !py-1.5' : 'btn-ghost !py-1.5'} onClick={() => setLang('th')}>ฉบับภาษาไทย</button><button className={lang === 'cn' ? 'btn-primary !py-1.5' : 'btn-ghost !py-1.5'} onClick={() => setLang('cn')}>ฉบับภาษาจีน</button></div></div>
          <pre lang={lang === 'th' ? 'th' : 'zh'} className="whitespace-pre-wrap text-sm bg-slate-50 border border-slate-200 rounded-lg p-4 font-sans">{lang === 'th' ? out.th : out.cn}</pre>
          <p className="text-sm mt-2"><b>คำอธิบายภาษาไทยแบบง่าย:</b> สัญญานี้ระบุว่าใครจ้างใคร ทำงานอะไร ที่ไหน นานเท่าใด และได้ค่าตอบแทนเท่าไร ช่องที่เป็น “[ยังไม่ระบุ]” หมายถึงข้อมูลที่ต้องเติมก่อนนำไปให้ผู้เชี่ยวชาญตรวจ</p>
          <p className="text-xs font-semibold mt-2">{DISCLAIMER_DRAFT}</p></div>
      </>}
      <Disclaimer />
    </div>
  )
}

/* ================= LANGUAGE & CULTURE ================= */
export function LanguagePage() {
  const { profile } = useStore()
  return (
    <div className="space-y-5">
      <PageHead title="ภาษาและวัฒนธรรมทางธุรกิจ" sub="ศัพท์กฎหมายไม่ควรแปลตรงตัว ระบบจึงแสดงคำอธิบายไทย ศัพท์ต้นฉบับ และบริบทควบคู่กัน" />
      <AnalysisTabs active="language" />
      <div className="card overflow-x-auto"><h2 className="h2 mb-2">ตารางศัพท์ไทย · ต้นฉบับ · ความหมาย/บริบท</h2>
        <table className="w-full text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">คำอธิบายภาษาไทย</th><th className="p-2">ศัพท์ต้นฉบับ (จีน/อังกฤษ)</th><th className="p-2">ความหมาย/บริบท</th></tr></thead><tbody>{terms.map((t) => <tr key={t.th} className="border-b border-slate-100 align-top"><td className="p-2 font-medium">{t.th}</td><td className="p-2" lang="zh">{t.orig}</td><td className="p-2 text-slate-600">{t.mean}</td></tr>)}</tbody></table>
        <div className="mt-2 text-xs text-slate-500">ภาษาที่รองรับ: ไทย · จีน · อังกฤษ (ตัวอย่างคำศัพท์สำหรับ Prototype)</div></div>
      <div className="card"><h2 className="h2">แนวโน้มที่ควรคำนึงถึง ตามสถานการณ์ของคุณ</h2>
        <Warn tone="blue"><span className="block">ข้อมูลนี้เป็นเพียง “แนวโน้มที่ควรคำนึงถึง” ไม่ใช่ข้อสรุปเกี่ยวกับบุคคลหรือคนทั้งกลุ่ม ทุกองค์กรและทุกคนมีความแตกต่างกัน ควรสอบถามและปรับตามสถานการณ์จริง{profile ? ` (ธุรกิจของคุณ: ${profile.companyName})` : ''}</span></Warn>
        <CultureSituations /></div>
      <Disclaimer />
    </div>
  )
}

function CultureSituations() {
  const [i, setI] = useState(0)
  const s = situations[i]
  return (
    <div className="mt-3">
      <div className="flex gap-2 flex-wrap mb-3" role="tablist" aria-label="เลือกสถานการณ์">{situations.map((x, k) => <button key={x.title} role="tab" aria-selected={k === i} onClick={() => setI(k)} className={`px-4 py-2 rounded-full border min-h-[44px] ${k === i ? 'bg-navy-800 text-white border-navy-800' : 'bg-white border-slate-300'}`}>{x.title}</button>)}</div>
      <div className="border border-slate-200 rounded-lg p-4"><p className="font-semibold mb-2">{s.intro}</p>
        <div className="grid md:grid-cols-2 gap-3">{s.points.map((p) => <div key={p.t}><b>{p.t}</b><p className="text-sm text-slate-600">{p.d}</p></div>)}</div></div>
    </div>
  )
}
