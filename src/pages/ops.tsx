import { useMemo, useState } from 'react'
import type { AlertItem, Level, RoadmapStep, StepStatus } from '../types'
import { go, useStore } from '../store'
import { AlertCard, Checklist, DocumentCard, Disclaimer, EmptyState, PageHead, RiskCard, Roadmap, SampleTag, StatusBadge, VerifyBadge, Warn, WorkflowStrip, StepBadge } from '../components/ui'
import { assessRisks, buildDocument, detectNomineeRisk, docToHtml, docTypes, generateRoadmap, type DocType } from '../services/engines'
import { aiService } from '../services/aiService'
import { checklistItems } from '../data/demo'
import { regulations, simulatedReplacement } from '../data/regulations'
import { terms } from '../data/culture'
import { dirInfo, levelStyle, SAMPLE_NOTE } from '../utils/labels'

function useRoadmap() {
  const { profile, stepOverrides } = useStore()
  const steps: RoadmapStep[] = useMemo(() => (profile ? generateRoadmap(profile).map((s) => ({ ...s, status: stepOverrides[s.id] ?? s.status })) : []), [profile, stepOverrides])
  return steps
}

/* ================= DASHBOARD ================= */
export function Dashboard() {
  const { profile, employment, checks, docs, alerts, history, stepOverrides, startDemo } = useStore()
  const steps = useRoadmap()
  if (!profile) return <div><PageHead title="ธุรกิจของฉัน" /><EmptyState /></div>
  const risks = assessRisks(profile, employment)
  const d = dirInfo(profile.direction)
  const nom = detectNomineeRisk(profile)
  const total = steps.length + checklistItems.length
  const done = steps.filter((s) => s.status === 'done').length + checklistItems.filter((c) => checks[c.id]).length
  const pct = Math.round((done / total) * 100)
  const counts = (['HIGH', 'MEDIUM', 'NEEDS_REVIEW', 'LOW'] as Level[]).map((l) => [l, risks.filter((r) => r.level === l).length] as const)
  const order: Level[] = ['HIGH', 'NEEDS_REVIEW', 'MEDIUM', 'LOW']
  const top = [...risks].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level)).slice(0, 3)
  const nextActions = steps.filter((s) => s.status !== 'done').slice(0, 3)
  void stepOverrides
  return (
    <div className="space-y-5">
      <PageHead title="ธุรกิจของฉัน" sub="ภาพรวมการเตรียมความพร้อมและสิ่งที่ต้องทำต่อ"><button className="btn-ghost" onClick={() => { startDemo() }}>รีเซ็ตเป็นข้อมูล Demo</button></PageHead>
      <WorkflowStrip active={3} />
      <div className="grid md:grid-cols-4 gap-3">
        <div className="card md:col-span-2"><div className="text-xs text-slate-500">ธุรกิจของฉัน {profile.isDemo && <SampleTag text="ข้อมูลสมมติเพื่อสาธิต" />}</div><div className="text-xl font-bold text-navy-900">{profile.companyName}</div><div className="text-sm mt-1">ประเทศต้นทาง: {d.fromFlag} {d.from} → ประเทศเป้าหมาย: {d.toFlag} {d.to}</div><div className="text-sm">สถานะ: <span className="font-semibold text-blue-700">กำลังวิเคราะห์</span></div></div>
        <div className="card md:col-span-2"><div className="text-sm font-semibold">ความพร้อมในการขยายธุรกิจ</div><div className="h-3 bg-slate-200 rounded-full mt-2 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="ความพร้อมในการขยายธุรกิจ"><div className="h-3 bg-navy-700" style={{ width: pct + '%' }} /></div><div className="text-sm mt-1">{done} จาก {total} งานเสร็จสิ้น ({pct}%)</div><p className="text-xs text-slate-500 mt-1">เป็นตัวชี้วัดความคืบหน้าของงาน ไม่ใช่คะแนนความถูกต้องทางกฎหมาย</p></div>
      </div>
      {nom.stop && <Warn tone="red"><b>ควรหยุดการดำเนินการในขั้นตอนนี้และตรวจสอบเพิ่มเติม</b> — พบปัจจัยที่ควรตรวจสอบเพิ่มเติมในโครงสร้างผู้ถือหุ้น <button className="underline font-semibold ml-1" onClick={() => go('nominee')}>ดูรายละเอียด</button></Warn>}
      <section><h2 className="h2 mb-2">สรุป Compliance โดยรวม</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{counts.map(([l, n]) => <div key={l} className={`card border ${levelStyle[l]}`}><div className="text-3xl font-bold">{n}</div><StatusBadge level={l} /></div>)}</div></section>
      <section><div className="flex justify-between items-center mb-2"><h2 className="h2">ความเสี่ยงที่ควรดูก่อน</h2><button className="btn-ghost !py-1.5" onClick={() => go('risk')}>ดูทั้งหมด</button></div><div className="grid lg:grid-cols-3 gap-3">{top.map((r) => <RiskCard key={r.id} r={r} />)}</div></section>
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="card"><h2 className="h2 mb-2">สิ่งที่ควรทำต่อ</h2><ul className="space-y-2 text-sm">{nextActions.map((s) => <li key={s.id}><b>ขั้นที่ {s.id} {s.title}</b> <StepBadge s={s.status} /><br /><span className="text-slate-600">{s.next}</span></li>)}</ul><button className="btn-ghost mt-3 !py-1.5" onClick={() => go('roadmap')}>เปิดแผนการดำเนินงาน</button></section>
        <section className="card"><h2 className="h2 mb-2">เอกสาร</h2><p className="text-sm">สร้างแล้ว {Object.values(docs).filter(Boolean).length} จาก {docTypes.length} รายการ</p><button className="btn-ghost mt-3 !py-1.5" onClick={() => go('documents')}>ไปที่ศูนย์จัดการเอกสาร</button>
          <h2 className="h2 mt-4 mb-1">การแจ้งเตือน</h2><p className="text-sm">{alerts.length} รายการ <SampleTag text="ตัวอย่างการทำงานระบบ Monitoring" /></p><button className="btn-ghost mt-2 !py-1.5" onClick={() => go('monitoring')}>ดูการติดตาม Compliance</button></section>
        <section className="card"><h2 className="h2 mb-2">การวิเคราะห์ AI ล่าสุด</h2>{history.length ? <ul className="text-sm space-y-1">{history.map((h, i) => <li key={i}><span className="text-slate-500">{h.at}</span> {h.text}</li>)}</ul> : <p className="text-sm text-slate-500">ยังไม่มีประวัติการวิเคราะห์</p>}</section>
      </div>
      <Disclaimer />
    </div>
  )
}

/* ================= RISK ================= */
export function RiskPage() {
  const { profile, employment } = useStore()
  const [f, setF] = useState<Level | 'ALL'>('ALL')
  if (!profile) return <div><PageHead title="การประเมินความเสี่ยง" /><EmptyState /></div>
  const risks = assessRisks(profile, employment).filter((r) => f === 'ALL' || r.level === f)
  return (
    <div className="space-y-5">
      <PageHead title="การประเมินความเสี่ยง" sub="แสดงเป็นสถานะและเหตุผล ไม่ใช้คะแนนความมั่นใจทางกฎหมายที่อธิบายไม่ได้" />
      <WorkflowStrip active={3} />
      <div className="flex gap-2 flex-wrap" role="group" aria-label="กรองตามสถานะ">{(['ALL', 'HIGH', 'MEDIUM', 'NEEDS_REVIEW', 'LOW'] as const).map((l) => <button key={l} aria-pressed={f === l} onClick={() => setF(l)} className={`px-4 py-2 rounded-full border min-h-[44px] ${f === l ? 'bg-navy-800 text-white border-navy-800' : 'bg-white border-slate-300'}`}>{l === 'ALL' ? 'ทั้งหมด' : l === 'HIGH' ? 'สูง' : l === 'MEDIUM' ? 'ปานกลาง' : l === 'LOW' ? 'ต่ำ' : 'ต้องตรวจสอบ'}</button>)}</div>
      {risks.length ? <div className="grid lg:grid-cols-2 gap-4">{risks.map((r) => <RiskCard key={r.id} r={r} />)}</div> : <EmptyState title="ไม่พบข้อมูล" text="ไม่มีความเสี่ยงในสถานะที่เลือก" />}
      <Disclaimer />
    </div>
  )
}

/* ================= ROADMAP ================= */
export function RoadmapPage() {
  const { profile, stepOverrides, checks, set } = useStore()
  const steps = useRoadmap()
  if (!profile) return <div><PageHead title="แผนการดำเนินงาน" /><EmptyState /></div>
  const done = steps.filter((s) => s.status === 'done').length
  return (
    <div className="space-y-5">
      <PageHead title="แผนการดำเนินงาน" sub="แปลงผลวิเคราะห์เป็นลำดับขั้นตอนที่ทำได้จริง และอัปเดตแดชบอร์ดเมื่อคุณทำงานเสร็จ" />
      <WorkflowStrip active={4} />
      <p className="text-sm">เสร็จแล้ว {done} จาก {steps.length} ขั้นตอน</p>
      <Roadmap steps={steps} onStatus={(id, s: StepStatus) => set({ stepOverrides: { ...stepOverrides, [id]: s } })} />
      <div className="card"><h2 className="h2 mb-2">เช็กลิสต์</h2><Checklist items={checklistItems} done={checks} onToggle={(id) => set({ checks: { ...checks, [id]: !checks[id] } })} /></div>
      <Disclaimer />
    </div>
  )
}

/* ================= DOCUMENTS ================= */
export function DocumentsPage() {
  const { profile, employment, contract, docs, set, log } = useStore()
  const [view, setView] = useState<{ title: string; text: string } | null>(null)
  const [cache, setCache] = useState<Record<string, { title: string; text: string }>>({})
  if (!profile) return <div><PageHead title="ศูนย์จัดการเอกสาร" /><EmptyState /></div>
  const create = async (t: DocType) => { const r = await aiService.generateDocument(t, profile, employment, contract); setCache((c) => ({ ...c, [t]: r })); set({ docs: { ...docs, [t]: true } }); log('สร้างเอกสาร: ' + r.title) }
  const get = (t: DocType) => cache[t] ?? buildDocument(t, profile, employment, contract, terms)
  const download = (t: DocType) => {
    const r = get(t); const url = URL.createObjectURL(new Blob([docToHtml(r.title, r.text)], { type: 'text/html;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${t}-draft.html`; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-5">
      <PageHead title="ศูนย์จัดการเอกสาร" sub="เอกสารทั้งหมดเป็นร่างเพื่อประกอบการตรวจสอบ สร้างจากโปรไฟล์ธุรกิจของคุณ" />
      <WorkflowStrip active={5} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{docTypes.map((d) => <DocumentCard key={d.type} title={d.title} desc={d.desc} generated={!!docs[d.type]} onCreate={() => create(d.type)} onView={() => setView(get(d.type))} onDownload={() => download(d.type)} />)}</div>
      {view && (
        <div role="dialog" aria-modal="true" aria-label={view.title} className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setView(null)} onKeyDown={(e) => e.key === 'Escape' && setView(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3"><h2 className="h2">{view.title}</h2><button autoFocus className="btn-ghost" onClick={() => setView(null)}>ปิด</button></div>
            <pre className="whitespace-pre-wrap font-sans text-sm">{view.text}</pre></div></div>)}
      <Disclaimer />
    </div>
  )
}

/* ================= MONITORING ================= */
export function MonitoringPage() {
  const { profile, alerts, extraAlerts, regChanged, set, log } = useStore()
  if (!profile) return <div><PageHead title="การติดตาม Compliance" /><EmptyState /></div>
  const simulate = () => {
    const a: AlertItem = { id: 'sim' + Date.now(), changed: 'จำลอง: มีเวอร์ชันใหม่ของรายการข้อจำกัดการลงทุนจากต่างประเทศ (ระบบแทนที่ระเบียนเก่าด้วยระเบียนใหม่)', when: new Date().toLocaleString('th-TH') + ' (เหตุการณ์จำลอง)', profile: profile.companyName, sourceId: 'cn-neglist-next', severity: 'NEEDS_REVIEW', impact: 'ผลตรวจประเภทธุรกิจของคุณควรถูกตรวจซ้ำกับเวอร์ชันใหม่', next: 'เปิดแหล่งข้อมูลทางการ เทียบกิจกรรมธุรกิจ แล้วยืนยันผลในแผนงานขั้นที่ 2', isSample: true }
    set({ extraAlerts: [a, ...extraAlerts], regChanged: true }); log('จำลองการเปลี่ยนแปลงกฎระเบียบและสร้างการแจ้งเตือน')
  }
  return (
    <div className="space-y-5">
      <PageHead title="การติดตาม Compliance" sub="ตัวอย่างการทำงานระบบ Monitoring — Prototype นี้ยังไม่ได้เชื่อมต่อแหล่งกฎหมายจริงแบบอัตโนมัติ">
        <button className="btn-primary" onClick={simulate}>จำลองการเปลี่ยนแปลงกฎระเบียบ</button></PageHead>
      <WorkflowStrip active={6} />
      <Warn tone="blue">ตัวอย่างการทำงานระบบ Monitoring: เมื่อฐานข้อมูลกฎระเบียบมีเวอร์ชันใหม่ ระบบจะจับคู่กับโปรไฟล์ธุรกิจและสร้างการแจ้งเตือนเช่นด้านล่าง ข้อมูลทั้งหมดเป็นตัวอย่างและไม่ใช่เหตุการณ์จริง</Warn>
      {alerts.length === 0 ? <div className="card">✓ ไม่มีการเปลี่ยนแปลงสำคัญ</div> : <div className="grid lg:grid-cols-2 gap-4">{alerts.map((a) => <AlertCard key={a.id} a={a} />)}</div>}
      {regChanged && <Warn>เพิ่มระเบียนกฎระเบียบเวอร์ชันใหม่แล้ว ดูการแทนที่เวอร์ชันได้ที่ <button className="underline" onClick={() => go('admin')}>หน้าจัดการฐานข้อมูลกฎระเบียบ</button></Warn>}
      <Disclaimer />
    </div>
  )
}

/* ================= SOURCES / ADMIN ================= */
function RegTable({ admin }: { admin?: boolean }) {
  const { regChanged } = useStore()
  const [c, setC] = useState('ALL')
  const [q, setQ] = useState('')
  const list = [...regulations.map((r) => (regChanged && r.id === 'cn-neglist-2024' ? { ...r, supersededBy: simulatedReplacement.id } : r)), ...(regChanged ? [simulatedReplacement] : [])]
    .filter((r) => (c === 'ALL' || r.country === c) && (r.title + r.authority + r.topic).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="card">
      <div className="flex gap-2 flex-wrap mb-3"><label className="sr-only" htmlFor="sq">ค้นหา</label><input id="sq" className="input max-w-xs" placeholder="ค้นหาแหล่งข้อมูล/หัวข้อ" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="sr-only" htmlFor="sc">ประเทศ</label><select id="sc" className="input max-w-[160px]" value={c} onChange={(e) => setC(e.target.value)}><option value="ALL">ทุกประเทศ</option><option value="TH">ไทย</option><option value="CN">จีน</option></select></div>
      {list.length === 0 ? <p className="text-slate-500">ไม่พบข้อมูล</p> : (
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-slate-100 text-left"><th className="p-2">ประเทศ</th><th className="p-2">หน่วยงาน</th><th className="p-2">หัวข้อ</th><th className="p-2">แหล่งข้อมูล</th><th className="p-2">วันที่</th><th className="p-2">สถานะ</th></tr></thead><tbody>
          {list.map((r) => <tr key={r.id} className="border-b border-slate-100 align-top"><td className="p-2">{r.country === 'TH' ? '🇹🇭 ไทย' : '🇨🇳 จีน'}</td><td className="p-2">{r.authority}</td><td className="p-2"><b>{r.topic}</b><br /><span className="text-slate-600">{r.title}</span>{admin && <p className="text-xs text-slate-500 mt-1">{r.rule}</p>}</td>
            <td className="p-2"><a className="text-navy-600 underline" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">เปิดลิงก์ทางการ ↗</a><br />{r.isSample && <SampleTag />}</td>
            <td className="p-2 text-xs">ประกาศ: {r.publicationDate}<br />มีผล: {r.effectiveDate}<br />ตรวจล่าสุด: {r.lastVerified}</td>
            <td className="p-2 space-y-1"><VerifyBadge v={r.verificationStatus} />{r.supersededBy && <div className="text-xs text-red-700">ข้อมูลนี้อาจไม่ใช่ข้อมูลปัจจุบัน (ถูกแทนที่)</div>}</td></tr>)}</tbody></table></div>)}
    </div>
  )
}
export const SourcesPage = () => (
  <div className="space-y-5"><PageHead title="ศูนย์แหล่งข้อมูล" sub="ทุกข้อกำหนดที่ระบบแสดงต้องอ้างอิงแหล่งทางการ กรุณากดลิงก์เพื่อตรวจสอบฉบับจริงเสมอ" />
    <Warn>{SAMPLE_NOTE}: ระเบียนด้านล่างเป็นการสรุปแบบย่อเพื่อสาธิตโครงสร้างข้อมูล ไม่ใช่ข้อมูลกฎหมายแบบเรียลไทม์ และลิงก์ชี้ไปยังหน้าหลักของหน่วยงาน</Warn><RegTable /><Disclaimer /></div>
)
export const AdminPage = () => {
  const { regChanged, set } = useStore()
  return (
    <div className="space-y-5"><PageHead title="จัดการฐานข้อมูลกฎระเบียบ (Admin จำลอง)" sub="ตัวอย่างหน้าจอสำหรับผู้ดูแลเพื่อตรวจสอบ อัปเดต และแทนที่เวอร์ชันกฎระเบียบ"><button className="btn-ghost" onClick={() => set({ regChanged: !regChanged })}>{regChanged ? 'ย้อนการจำลองเวอร์ชันใหม่' : 'จำลองการแทนที่เวอร์ชันกฎหมาย'}</button></PageHead>
      <Warn tone="blue">หน้านี้เป็นโครงจำลอง ยังไม่มีระบบสิทธิ์ผู้ใช้หรือการเชื่อมต่อแหล่งข้อมูลจริง</Warn><RegTable admin /><Disclaimer /></div>
  )
}

/* ================= PRICING ================= */
export const PricingPage = () => (
  <div className="space-y-5"><PageHead title="แพ็กเกจบริการ" sub="ตัวอย่างโมเดลธุรกิจสำหรับการสาธิต — ไม่มีระบบชำระเงินจริงใน Prototype" />
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{[
      ['Free', 'ฟรี', ['ประเมินเบื้องต้น', 'โปรไฟล์ธุรกิจ 1 รายการ']], ['Pro', 'ตัวอย่าง', ['วิเคราะห์เชิงลึก', 'แผนการดำเนินงาน', 'สร้างเอกสารร่าง']],
      ['Business', 'ตัวอย่าง', ['การติดตาม Compliance', 'หลายโปรไฟล์ธุรกิจ', 'ทุกอย่างใน Pro']], ['Enterprise', 'ติดต่อเรา', ['หลายผู้ใช้', 'API', 'เวิร์กโฟลว์ภายในองค์กร']],
    ].map(([n, p, f]) => <div key={n as string} className="card flex flex-col"><h2 className="h2">{n}</h2><div className="text-slate-500 mb-2">{p}</div><ul className="list-disc ml-5 text-sm flex-1">{(f as string[]).map((x) => <li key={x}>{x}</li>)}</ul><button className="btn-ghost mt-4" onClick={() => alert('ตัวอย่างเท่านั้น: ยังไม่มีระบบชำระเงินใน Prototype')}>สนใจแพ็กเกจนี้</button></div>)}</div>
    <Disclaimer /></div>
)
