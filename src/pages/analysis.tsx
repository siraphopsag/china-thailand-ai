import { useEffect, useRef, useState } from 'react'
import type { AIResponse, Holder, Profile } from '../types'
import { go, useStore } from '../store'
import { AIMessage, AnalysisTabs, Disclaimer, EmptyState, OwnershipChart, PageHead, SourceCard, StatusBadge, VerifyBadge, Warn, WorkflowStrip } from '../components/ui'
import { aiService } from '../services/aiService'
import { compliantOptions, consequences, detectNomineeRisk, ownershipDims, verifyAnalysis, targetCountry, holdersSum } from '../services/engines'
import { levelStyle } from '../utils/labels'
import { getReg } from '../data/regulations'

const modules = [
  ['กฎหมาย', 'กำลังตรวจสอบประเภทธุรกิจ...'], ['การลงทุน', 'กำลังตรวจสอบข้อกำหนดการลงทุน...'], ['โครงสร้างผู้ถือหุ้น', 'กำลังวิเคราะห์โครงสร้างผู้ถือหุ้น...'],
  ['ความเสี่ยงนอมินี', 'กำลังตรวจปัจจัยที่ควรตรวจสอบเพิ่มเติม...'], ['การจ้างงาน', 'กำลังตรวจสอบข้อกำหนดด้านการจ้างงาน...'], ['ภาษี', 'กำลังตรวจข้อพิจารณาด้านภาษี...'],
  ['ภาษา', 'กำลังเตรียมศัพท์และคำแปล...'], ['วัฒนธรรมองค์กร', 'กำลังเตรียมแนวโน้มด้านการสื่อสาร...'],
]

/* ================= ANALYSIS CENTER ================= */
export function AnalysisCenter() {
  const { profile, employment, analysisDone, set, log } = useStore()
  const [step, setStep] = useState(analysisDone ? modules.length : -1)
  const [q, setQ] = useState('')
  const [resp, setResp] = useState<AIResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [qErr, setQErr] = useState('')
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearInterval(timer.current), [])
  if (!profile) return <div><PageHead title="AI วิเคราะห์" /><EmptyState /></div>
  const vr = verifyAnalysis(profile, employment)
  const run = () => {
    setStep(0); window.clearInterval(timer.current)
    let i = 0
    timer.current = window.setInterval(() => { i++; setStep(i); if (i >= modules.length) { window.clearInterval(timer.current); set({ analysisDone: true }); log('AI วิเคราะห์ครบ 8 โมดูล') } }, 650)
  }
  const ask = async () => {
    if (q.trim().length < 4) return setQErr('กรุณาพิมพ์คำถามให้ชัดเจนขึ้น (อย่างน้อย 4 ตัวอักษร)')
    setQErr(''); setBusy(true); setResp(await aiService.orchestrate(q, profile)); setBusy(false)
  }
  const running = step >= 0 && step < modules.length
  return (
    <div className="space-y-5">
      <PageHead title="ศูนย์วิเคราะห์ด้วย AI" sub={`วิเคราะห์ “${profile.companyName}” โดยใช้โปรไฟล์ธุรกิจเป็นบริบท`}>
        <button className="btn-primary" onClick={run} disabled={running}>{analysisDone || step >= modules.length ? 'วิเคราะห์ใหม่' : 'เริ่มวิเคราะห์'}</button>
      </PageHead>
      <AnalysisTabs active="analysis" />
      <WorkflowStrip active={step >= modules.length ? 3 : 1} />
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card">
          <h2 className="h2 mb-3">โมดูลการวิเคราะห์</h2>
          {step < 0 ? <p className="text-slate-600 text-sm">กด “เริ่มวิเคราะห์” เพื่อให้ AI ตรวจ 8 โมดูลตามโปรไฟล์ธุรกิจของคุณ</p> : (
            <ul className="space-y-2" aria-live="polite">{modules.map(([m, msg], i) => (
              <li key={m} className="flex items-center gap-3 text-sm"><span className={`w-6 h-6 rounded-full grid place-items-center text-xs ${i < step ? 'bg-green-600 text-white' : i === step ? 'bg-navy-700 text-white animate-pulse' : 'bg-slate-200'}`}>{i < step ? '✓' : i === step ? '…' : '○'}</span><span className="font-medium w-36">{m}</span><span className="text-slate-500">{i === step ? msg : i < step ? 'เสร็จสิ้น' : 'รอคิว'}</span></li>))}</ul>)}
          {step >= modules.length && <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => go('ownership')}>ดูวิเคราะห์โครงสร้างผู้ถือหุ้น →</button><button className="btn-ghost" onClick={() => go('risk')}>ไปที่การประเมินความเสี่ยง</button></div>}
        </div>
        <div className="card">
          <h2 className="h2 mb-1">ชั้นตรวจสอบ (Verification Layer)</h2>
          <p className="text-sm text-slate-500 mb-3">ผลวิเคราะห์ต้องผ่านการตรวจก่อนแสดงผลเสมอ หากไม่ผ่านจะ RECHECK ไม่แสดงคำตอบแรกทันที</p>
          {step < modules.length ? <p className="text-sm text-slate-500">จะทำงานหลังจากการวิเคราะห์เสร็จ</p> : <>
            <ul className="space-y-2">{vr.steps.map((s) => <li key={s.name} className="text-sm flex gap-2"><span>{s.ok ? '✅' : '⚠️'}</span><span><b>{s.name}</b><br /><span className="text-slate-600">{s.note}</span></span></li>)}</ul>
            {vr.recheck && <div className="mt-3"><Warn tone="red">ตรวจพบความไม่สอดคล้องของข้อมูล — ระบบส่งกลับไป RECHECK ก่อนแสดงผลสุดท้าย</Warn></div>}
            <div className="mt-3 flex items-center gap-2 text-sm">สถานะสุดท้าย: <VerifyBadge v={vr.final} /></div></>}
        </div>
      </div>
      <div className="card space-y-3">
        <h2 className="h2">ถาม AI เฉพาะประเด็น (Orchestrator)</h2>
        <p className="text-sm text-slate-500">ระบบเลือกโมดูลที่เกี่ยวข้องเท่านั้น และตอบในรูปแบบ 5 ส่วน ตัวอย่าง: “บริษัทไทยต้องการส่งพนักงานไปทำงานที่จีน”</p>
        <div className="flex gap-2 flex-wrap"><label htmlFor="q" className="sr-only">คำถาม</label>
          <input id="q" className="input flex-1 min-w-[220px]" value={q} placeholder="พิมพ์คำถามเกี่ยวกับธุรกิจของคุณ" onChange={(e) => { setQ(e.target.value); setQErr('') }} onKeyDown={(e) => e.key === 'Enter' && ask()} />
          <button className="btn-primary" disabled={busy} onClick={ask}>{busy ? 'กำลังวิเคราะห์...' : 'ถาม'}</button></div>
        <div className="flex gap-2 flex-wrap text-sm">{['บริษัทไทยต้องการส่งพนักงานไปทำงานที่จีน', 'ผู้ถือหุ้นต้องมีเอกสารอะไรบ้าง', 'อยากหาคนมาถือหุ้นแทนเพื่อเลี่ยงข้อจำกัด'].map((s) => <button key={s} className="px-3 py-1.5 rounded-full border border-slate-300 hover:bg-slate-100 min-h-[36px]" onClick={() => setQ(s)}>{s}</button>)}</div>
        {qErr && <p role="alert" className="text-red-700 text-sm">{qErr}</p>}
        {resp && <AIMessage r={resp} />}
      </div>
      <Disclaimer />
    </div>
  )
}

/* ================= OWNERSHIP ================= */
const num = (v: string) => Math.max(0, Math.min(100, Number(v) || 0))
export function OwnershipPage() {
  const { profile, set, log } = useStore()
  if (!profile) return <div><PageHead title="วิเคราะห์โครงสร้างผู้ถือหุ้น" /><EmptyState /></div>
  const upd = (id: Holder['id'], k: keyof Holder, v: number) => {
    const hs = profile.holders.map((h) => (h.id === id ? { ...h, [k]: v } : h))
    if (k === 'percent') { const o = hs.find((h) => h.id !== id)!; o.percent = 100 - v }
    set({ profile: { ...profile, holders: hs }, analysisDone: false })
  }
  const dims = ownershipDims(profile)
  const sum = holdersSum(profile)
  const chg = (patch: Partial<Profile>) => { set({ profile: { ...profile, ...patch } }); log('ปรับข้อมูลการควบคุมกิจการ') }
  const sel = (label: string, v: string, key: 'realInvestor' | 'operator') => (
    <div><label className="label" htmlFor={key}>{label}</label><select id={key} className="input" value={v} onChange={(e) => chg({ [key]: e.target.value } as Partial<Profile>)}>
      <option value="origin">{profile.holders[0].label}</option><option value="partner">{profile.holders[1].label}</option><option value={key === 'operator' ? 'joint' : 'shared'}>ร่วมกัน</option><option value="unknown">ยังไม่ทราบ</option></select></div>)
  return (
    <div className="space-y-5">
      <PageHead title="วิเคราะห์โครงสร้างผู้ถือหุ้น" sub="ระบบไม่ตัดสินความถูกต้องจากสัดส่วนหุ้นอย่างเดียว แต่ดูเงินลงทุน การควบคุม กรรมการ และสิทธิประโยชน์ร่วมกัน" />
      <AnalysisTabs active="ownership" />
      <div className="card"><h2 className="h2 mb-3">แผนผังผู้ถือหุ้น</h2><OwnershipChart holders={profile.holders} />
        {Math.round(sum) !== 100 && <div className="mt-3"><Warn tone="red">สัดส่วนหุ้นรวมเป็น {sum}% ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์ (ควรรวมเป็น 100%)</Warn></div>}</div>
      <Warn tone="blue"><b>แยกพิจารณา 4 เรื่อง:</b> ความเป็นเจ้าของ (หุ้น) · เงินลงทุน · อำนาจควบคุม · ความเสี่ยงด้านนอมินี — สัดส่วนหุ้นที่ดูเหมือนถูกต้อง (เช่น 51/49) ไม่ได้แปลว่าโครงสร้าง “ปลอดภัย” โดยอัตโนมัติ</Warn>
      <div className="card"><h2 className="h2 mb-1">ปรับข้อมูลเพื่อทดลองวิเคราะห์ใหม่</h2><p className="text-sm text-slate-500 mb-3">เปลี่ยนตัวเลขแล้วดูผลทันที เพื่อเข้าใจว่าปัจจัยใดทำให้สถานะเปลี่ยน</p>
        <div className="grid md:grid-cols-2 gap-4">{profile.holders.map((h) => (
          <fieldset key={h.id} className="border border-slate-200 rounded-lg p-3"><legend className="font-semibold px-1">{h.label}</legend>
            <div className="grid grid-cols-2 gap-2">{([['percent', 'สัดส่วนหุ้น %'], ['capital', 'เงินลงทุนที่จัดหา %'], ['voting', 'สิทธิออกเสียง %'], ['board', 'กรรมการที่แต่งตั้ง %'], ['economic', 'สิทธิประโยชน์เศรษฐกิจ %']] as const).map(([k, l]) => (
              <div key={k}><label className="label" htmlFor={h.id + k}>{l}</label><input id={h.id + k} type="number" min={0} max={100} className="input" value={h[k]} onChange={(e) => upd(h.id, k, num(e.target.value))} /></div>))}</div></fieldset>))}</div></div>
      <div className="card"><h2 className="h2 mb-3">การวิเคราะห์โครงสร้างการควบคุม</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {sel('ใครเป็นผู้ลงทุนจริง?', profile.realInvestor, 'realInvestor')}{sel('ใครมีอำนาจบริหารจริง?', profile.operator, 'operator')}
          <div><label className="label" htmlFor="side">มีข้อตกลงอื่นระหว่างผู้ถือหุ้นนอกเอกสารจดทะเบียนหรือไม่?</label><select id="side" className="input" value={profile.sideAgreement} onChange={(e) => chg({ sideAgreement: e.target.value as Profile['sideAgreement'] })}><option value="no">ไม่มี</option><option value="yes">มี</option><option value="unknown">ยังไม่ทราบ</option></select></div></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left bg-slate-100"><th className="p-2">มิติ</th><th className="p-2">สถานะ</th><th className="p-2">หมายเหตุ</th></tr></thead><tbody>
          {dims.map((d) => <tr key={d.key} className="border-b border-slate-100"><td className="p-2 font-medium">{d.title}</td><td className="p-2"><StatusBadge level={d.status} /></td><td className="p-2 text-slate-600">{d.note}</td></tr>)}</tbody></table></div></div>
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('nominee')}>ตรวจความเสี่ยงด้านนอมินี →</button></div>
      <Disclaimer />
    </div>
  )
}

/* ================= NOMINEE ================= */
export function NomineePage() {
  const { profile } = useStore()
  if (!profile) return <div><PageHead title="ตรวจสอบความเสี่ยงด้านโครงสร้างผู้ถือหุ้น" /><EmptyState /></div>
  const r = detectNomineeRisk(profile)
  const tc = targetCountry(profile)
  const conc = consequences(profile)
  return (
    <div className="space-y-5">
      <PageHead title="ตรวจสอบความเสี่ยงด้านโครงสร้างผู้ถือหุ้น" sub="ระบบจะตรวจหาปัจจัยที่ควรตรวจสอบเพิ่มเติม ไม่ใช่ตัดสินทางกฎหมายแทนหน่วยงานรัฐหรือผู้เชี่ยวชาญ" />
      <AnalysisTabs active="nominee" />
      <div className={`card border-2 ${levelStyle[r.level]}`}>
        <div className="flex flex-wrap items-center gap-3"><StatusBadge level={r.level} /><h2 className="h2">{r.headline}</h2></div>
        <div className="mt-3 text-sm space-y-1"><p><b>คำตอบ:</b> {r.answer}</p><p><b>เหตุผล:</b> {r.reason}</p><p><b>แหล่งข้อมูล:</b> {tc === 'CN' ? 'NDRC / MOFCOM' : 'DBD'} (ข้อมูลตัวอย่างสำหรับ Prototype)</p></div>
        <p className="text-xs text-slate-500 mt-3">หมายเหตุ: ผลนี้ไม่ได้ตัดสินจากสัดส่วนหุ้นอย่างเดียว และไม่ใช่การรับรองหรือการวินิจฉัยทางกฎหมาย</p>
        {r.stop && <div className="mt-3"><Warn tone="red"><b>ควรหยุดการดำเนินการในขั้นตอนนี้และตรวจสอบเพิ่มเติม</b> — แผนงานขั้นที่ 7 ถูกพักไว้ชั่วคราว</Warn></div>}
      </div>
      {r.indicators.length > 0 && <div className="space-y-3"><h2 className="h2">ปัจจัยที่ควรตรวจสอบเพิ่มเติม</h2>{r.indicators.map((i) => (
        <div key={i.key} className="card border-l-8 border-l-orange-400 text-sm space-y-1"><p className="font-semibold">🚩 ตรวจพบ: {i.text}</p><p><b>ทำไมจึงสำคัญ (WHY):</b> {i.why}</p><p><b>ข้อมูลที่ยังขาด:</b> {i.missing}</p><p><b>สิ่งที่ต้องตรวจสอบ:</b> {i.verify}</p><p><b>ผู้ใช้ควรทำต่อ:</b> {i.next}</p></div>))}</div>}
      {r.unknowns.length > 0 && <div className="card"><h2 className="h2 mb-1">ข้อมูลยังไม่เพียงพอสำหรับการวิเคราะห์</h2><ul className="list-disc ml-5 text-sm">{r.unknowns.map((u) => <li key={u}>{u}</li>)}</ul><p className="text-sm text-slate-500 mt-2">กรุณาตอบข้อมูลเหล่านี้ที่หน้า “โครงสร้างผู้ถือหุ้น” เพื่อให้ระบบประเมินได้ครบถ้วน</p></div>}
      <div className="card"><h2 className="h2 mb-2">สิ่งที่ควรทำต่อ (WHAT SHOULD YOU DO NEXT)</h2><ol className="list-decimal ml-5 text-sm space-y-1">{r.next.map((n) => <li key={n}>{n}</li>)}</ol></div>
      {r.level !== 'LOW' && <div className="card"><h2 className="h2 mb-1">ผลกระทบที่อาจเกี่ยวข้อง</h2><p className="text-xs text-slate-500 mb-3">ระบบไม่ระบุโทษหรือบทลงโทษที่ยังตรวจสอบไม่ได้ และไม่เดาตัวเลขหรือระยะเวลา</p>
        <div className="space-y-3">{conc.map((c) => (
          <div key={c.issue} className="border border-slate-200 rounded-lg p-3 text-sm space-y-1">
            <p className="font-semibold">ประเด็น: {c.issue}</p><p><b>กฎหมาย/ระเบียบที่เกี่ยวข้อง:</b> {c.law} (<a className="text-navy-600 underline" href={getReg(c.regId)?.sourceUrl} target="_blank" rel="noopener noreferrer">แหล่งทางการ ↗</a>)</p>
            <p><b>ผลทางกฎหมายที่อาจเกี่ยวข้อง:</b> {c.consequence}</p><p><b>เหตุผลที่อาจเกี่ยวข้อง:</b> {c.why}</p><p><b>สถานะการตรวจสอบ:</b> <VerifyBadge v={c.v} /></p><p><b>ขั้นตอนที่แนะนำ:</b> {c.next}</p></div>))}</div></div>}
      {r.level !== 'LOW' && <div><h2 className="h2 mb-2">ทางเลือกที่ชอบด้วยกฎหมายเพื่อไปต่อ</h2><div className="grid sm:grid-cols-2 gap-3">{compliantOptions.map((o) => <div key={o.k} className="card"><div className="text-xs text-navy-600 font-bold">OPTION {o.k}</div><div className="font-semibold">{o.t}</div><p className="text-sm text-slate-600">{o.d}</p></div>)}</div>
        <div className="mt-3"><Warn tone="blue">ระบบจะไม่ให้คำแนะนำเรื่องการปกปิดความเป็นเจ้าของหรือการเลี่ยงข้อจำกัดการลงทุน หากมีข้อสงสัยควรเปิดเผยข้อเท็จจริงทั้งหมดต่อผู้เชี่ยวชาญ/หน่วยงาน</Warn></div><div className="mt-3"><button className="btn-primary" onClick={() => go('documents')}>เตรียมเอกสารสรุปสำหรับผู้เชี่ยวชาญ</button></div></div>}
      <div><h2 className="h2 mb-2">แหล่งข้อมูลอ้างอิง</h2><div className="grid md:grid-cols-2 gap-3"><SourceCard id={tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'} /><SourceCard id={tc === 'CN' ? 'cn-fil' : 'th-dbd-reg'} /></div></div>
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('employment')}>ต่อไป: การจ้างงาน →</button><button className="btn-ghost" onClick={() => go('roadmap')}>ดูแผนการดำเนินงาน</button></div>
      <Disclaimer />
    </div>
  )
}
