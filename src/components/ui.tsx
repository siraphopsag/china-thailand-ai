import type { ReactNode } from 'react'
import type { AIResponse, ActionItem, AlertItem, Level, Profile, RiskCardData, RoadmapStep, StepStatus, Verification, Holder } from '../types'
import { DISCLAIMER, SAMPLE_NOTE, dirInfo, levelBar, levelIcon, levelLabel, levelStyle, stepLabel, stepStyle, verifyLabel, verifyStyle } from '../utils/labels'
import { getReg } from '../data/regulations'
import { go, useStore } from '../store'

export const StatusBadge = ({ level }: { level: Level }) => (
  <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-xs font-semibold max-w-full ${levelStyle[level]}`}><span aria-hidden>{levelIcon[level]}</span>{levelLabel[level]}</span>
)
export const VerifyBadge = ({ v }: { v: Verification }) => (
  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${verifyStyle[v]}`}>{verifyLabel[v]}</span>
)
export const StepBadge = ({ s }: { s: StepStatus }) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stepStyle[s]}`}>{stepLabel[s]}</span>

export const Disclaimer = () => <p className="text-xs text-slate-500 border-t border-slate-200 pt-3 mt-6">{DISCLAIMER}</p>
export const SampleTag = ({ text = SAMPLE_NOTE }: { text?: string }) => <span className="inline-block text-[11px] bg-slate-200 text-slate-700 rounded px-1.5 py-0.5">{text}</span>

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div><h1 className="h1">{title}</h1>{sub && <p className="text-slate-600 mt-1 max-w-3xl">{sub}</p>}</div>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  )
}

export function EmptyState({ title = 'ไม่พบข้อมูล', text = 'ยังไม่มีโปรไฟล์ธุรกิจให้ระบบวิเคราะห์ กรุณาสัมภาษณ์ธุรกิจหรือทดลอง Demo ก่อน' }: { title?: string; text?: string }) {
  const { startDemo } = useStore()
  return (
    <div className="card text-center py-12 max-w-xl mx-auto">
      <div className="text-4xl mb-3" aria-hidden>🗂️</div>
      <h2 className="h2">{title}</h2><p className="text-slate-600 mt-2">{text}</p>
      <div className="flex gap-2 justify-center mt-5 flex-wrap">
        <button className="btn-primary" onClick={() => go('direction')}>เริ่มวิเคราะห์ธุรกิจ</button>
        <button className="btn-ghost" onClick={() => { startDemo(); go('profile') }}>ทดลอง Demo</button>
      </div>
    </div>
  )
}

export function Warn({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'red' | 'blue' }) {
  const t = { amber: 'bg-amber-50 border-amber-300 text-amber-900', red: 'bg-red-50 border-red-300 text-red-900', blue: 'bg-sky-50 border-sky-300 text-sky-900' }[tone]
  return <div role="note" className={`border rounded-lg px-4 py-3 text-sm ${t}`}>{children}</div>
}

/* ---- Workflow (พิสูจน์ว่าไม่ใช่แชตบอต) ---- */
export const flowSteps = ['ข้อมูลธุรกิจ', 'AI วิเคราะห์', 'ตรวจสอบกฎหมาย', 'ประเมินความเสี่ยง', 'แผนดำเนินงาน', 'เอกสาร', 'ติดตาม']
export function WorkflowStrip({ active = -1 }: { active?: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-2 text-sm" aria-label="ขั้นตอนการทำงานของระบบ">
      {flowSteps.map((s, i) => (
        <li key={s} className="flex items-center">
          <span className={`px-3 py-1.5 rounded-full border ${i === active ? 'bg-navy-800 text-white border-navy-800' : i < active ? 'bg-navy-100 text-navy-800 border-navy-200' : 'bg-white text-slate-600 border-slate-300'}`}>{i + 1}. {s}</span>
          {i < flowSteps.length - 1 && <span className="mx-1 text-slate-400" aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  )
}

export function ProgressStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="space-y-1" aria-label="ความคืบหน้าการสัมภาษณ์">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? 'step' : undefined} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${i === current ? 'bg-navy-100 text-navy-900 font-semibold' : 'text-slate-600'}`}>
          <span className={`w-6 h-6 rounded-full grid place-items-center text-xs ${i < current ? 'bg-green-600 text-white' : i === current ? 'bg-navy-800 text-white' : 'bg-slate-200'}`}>{i < current ? '✓' : i === current ? '→' : '○'}</span>{s}
        </li>
      ))}
    </ol>
  )
}

/* ---- AI message in 5-part format ---- */
export function AIMessage({ r, compact }: { r: AIResponse; compact?: boolean }) {
  return (
    <div className={`rounded-xl border ${r.blocked ? 'border-red-300 bg-red-50' : 'border-navy-200 bg-navy-50'} p-4 space-y-2 text-sm`}>
      <div className="flex flex-wrap gap-1.5 items-center text-xs text-slate-600"><span className="font-semibold">🤖 โมดูลที่ถูกเรียก:</span>{r.modules.map((m) => <span key={m} className="bg-white border border-slate-200 rounded px-2 py-0.5">{m}</span>)}</div>
      <p><b>คำตอบ:</b> {r.answer}</p>
      {!compact && <p><b>เหตุผล:</b> {r.reason}</p>}
      <p><b>แหล่งข้อมูล:</b> {r.sources.length ? r.sources.map((s) => { const g = getReg(s); return g ? `${g.authority}: ${g.title}` : '' }).filter(Boolean).join(' / ') + ' (' + SAMPLE_NOTE + ')' : 'ยังไม่พบแหล่งข้อมูลที่เกี่ยวข้อง'}</p>
      <p><b>ความเสี่ยง:</b> <StatusBadge level={r.risk} /></p>
      <p><b>สิ่งที่ควรทำต่อ:</b> {r.next}</p>
    </div>
  )
}

export function SourceCard({ id }: { id: string }) {
  const r = getReg(id)
  if (!r) return <div className="text-sm text-slate-500">ไม่สามารถตรวจสอบแหล่งข้อมูลได้ (SOURCE NOT FOUND)</div>
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white text-sm space-y-1">
      <div className="flex flex-wrap gap-2 items-center justify-between"><b>{r.country === 'TH' ? '🇹🇭' : '🇨🇳'} {r.authority}</b><VerifyBadge v={r.verificationStatus} /></div>
      <div className="text-slate-800">{r.title}</div><p className="text-slate-600">{r.rule}</p>
      {r.originalTerm && <p className="text-slate-500">ศัพท์ต้นฉบับ: {r.originalTerm}</p>}
      <div className="text-xs text-slate-500 flex flex-wrap gap-x-4">
        <span>ประกาศ: {r.publicationDate}</span><span>มีผล: {r.effectiveDate}</span><span>ตรวจล่าสุด: {r.lastVerified}</span>
      </div>
      {r.supersededBy && <Warn>ข้อมูลนี้อาจไม่ใช่ข้อมูลปัจจุบัน — มีระเบียนใหม่มาแทนที่</Warn>}
      <div className="flex items-center gap-2">{r.isSample && <SampleTag />}<a className="text-navy-600 underline" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">เปิดแหล่งข้อมูลทางการ ↗</a></div>
    </div>
  )
}

export function RiskCard({ r }: { r: RiskCardData }) {
  return (
    <article className={`card border-l-8 ${levelBar[r.level]} space-y-2`}>
      <div className="flex flex-wrap justify-between gap-2 items-center"><h3 className="h2">{r.category}</h3><StatusBadge level={r.level} /></div>
      <p className="text-sm"><b>เหตุผล:</b> {r.why}</p>
      <div className="text-sm"><b>แหล่งข้อมูล:</b>{' '}{r.sourceIds.length ? r.sourceIds.map((s) => { const g = getReg(s); return g ? <a key={s} href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-navy-600 underline mr-2">{g.authority}</a> : null }) : 'ไม่มีแหล่งกฎหมายโดยตรง'} <SampleTag /></div>
      {r.check.length > 0 && <div className="text-sm"><b>สิ่งที่ควรตรวจสอบ:</b><ul className="list-disc ml-5">{r.check.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
      <p className="text-sm"><b>ขั้นตอนถัดไป:</b> {r.next}</p>
      <VerifyBadge v={r.verification} />
    </article>
  )
}

export function BusinessProfile({ p, onEdit }: { p: Profile; onEdit?: () => void }) {
  const d = dirInfo(p.direction)
  const rows: [string, string][] = [
    ['ชื่อธุรกิจ', p.companyName], ['ประเทศต้นทาง', `${d.fromFlag} ประเทศ${d.from}`], ['ประเทศเป้าหมาย', `${d.toFlag} ประเทศ${d.to}`], ['ประเภทธุรกิจ', p.businessType],
    ['กิจกรรมหลัก', p.activity], ['รูปแบบการขยาย', p.forms.join(', ') || '-'], ['วงเงินลงทุนโดยประมาณ', p.investmentRange || '-'], ['จำนวนพนักงาน', String(p.employees)],
    ['มีการจ้างแรงงานข้ามประเทศ', p.crossBorderWorkers ? 'ใช่' : 'ไม่ใช่'], ['โครงสร้างผู้ถือหุ้น', p.holders.map((h) => `${h.nationality === 'TH' ? 'ไทย' : 'จีน'} ${h.percent}%`).join(' / ')],
    ['สินค้า/บริการ', p.products || '-'], ['ตลาดเป้าหมาย', p.targetMarket || '-'], ['สินค้าควบคุม', p.regulatedGoods || '-'], ['พื้นที่ดำเนินงาน', p.location || '-'], ['กิจกรรมข้ามพรมแดน', p.crossBorder.join(', ') || '-'],
  ]
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3"><h2 className="h2">โปรไฟล์ธุรกิจ {p.isDemo && <SampleTag text="ข้อมูลสมมติเพื่อสาธิต" />}</h2>{onEdit && <button className="btn-ghost" onClick={onEdit}>แก้ไขข้อมูล</button>}</div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">{rows.map(([k, v]) => <div key={k} className="border-b border-slate-100 pb-1"><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
    </div>
  )
}

export function OwnershipChart({ holders }: { holders: Holder[] }) {
  const col = ['bg-navy-700', 'bg-sky-500']
  return (
    <div>
      <div className="flex h-14 rounded-lg overflow-hidden border border-slate-300" role="img" aria-label={holders.map((h) => `${h.label} ${h.percent}%`).join(' ')}>
        {holders.map((h, i) => <div key={h.id} style={{ width: `${Math.max(h.percent, 0)}%` }} className={`${col[i]} text-white grid place-items-center text-sm font-semibold`}>{h.percent > 8 ? `${h.label} ${h.percent}%` : ''}</div>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">{holders.map((h, i) => (
        <div key={h.id} className="border border-slate-200 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold"><span className={`w-3 h-3 rounded-sm ${col[i]}`} />{h.label} ({h.nationality === 'TH' ? '🇹🇭' : '🇨🇳'}) — {h.percent}%</div>
          {[['เงินลงทุนที่จัดหา', h.capital], ['สิทธิออกเสียง', h.voting], ['กรรมการที่แต่งตั้ง', h.board], ['สิทธิประโยชน์ทางเศรษฐกิจ', h.economic]].map(([k, v]) => {
            const diff = Math.abs((v as number) - h.percent) >= 25
            return <div key={k as string} className="mt-1.5"><div className="flex justify-between"><span>{k}</span><span className={diff ? 'text-orange-700 font-semibold' : ''}>{v}%{diff ? ' ⚠ ต่างจากหุ้น' : ''}</span></div><div className="h-2 bg-slate-100 rounded"><div className={`h-2 rounded ${diff ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${v}%` }} /></div></div>
          })}
        </div>))}</div>
    </div>
  )
}

export function Checklist({ items, done, onToggle }: { items: { id: string; group: string; text: string }[]; done: Record<string, boolean>; onToggle: (id: string) => void }) {
  const groups = [...new Set(items.map((i) => i.group))]
  return (
    <div className="space-y-4">{groups.map((g) => (
      <fieldset key={g}><legend className="font-semibold text-navy-900 mb-1">{g}</legend>
        {items.filter((i) => i.group === g).map((i) => (
          <label key={i.id} className="flex gap-3 items-start py-2 min-h-[44px] cursor-pointer"><input type="checkbox" className="mt-1.5 w-5 h-5 accent-navy-700" checked={!!done[i.id]} onChange={() => onToggle(i.id)} /><span className={done[i.id] ? 'line-through text-slate-500' : ''}>{i.text}</span></label>
        ))}
      </fieldset>))}
    </div>
  )
}

export function Roadmap({ steps, onStatus }: { steps: RoadmapStep[]; onStatus: (id: number, s: StepStatus) => void }) {
  return (
    <ol className="space-y-4">{steps.map((s) => (
      <li key={s.id} className={`card border-l-8 ${s.status === 'fix' ? 'border-l-red-500' : s.status === 'done' ? 'border-l-green-500' : s.status === 'review' ? 'border-l-amber-400' : s.status === 'doing' ? 'border-l-blue-500' : 'border-l-slate-300'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="h2">ขั้นที่ {s.id} · {s.title}</h3>
          <div className="flex items-center gap-2"><StepBadge s={s.status} />
            <select aria-label={`เปลี่ยนสถานะขั้นที่ ${s.id}`} className="input !w-auto !py-1.5 text-sm" value={s.status} onChange={(e) => onStatus(s.id, e.target.value as StepStatus)}>
              {(Object.keys(stepLabel) as StepStatus[]).map((k) => <option key={k} value={k}>{stepLabel[k]}</option>)}</select></div></div>
        <p className="mt-1 text-sm">{s.description}</p>
        {s.note && <div className="mt-2"><Warn tone={s.status === 'fix' ? 'red' : 'amber'}>{s.note}</Warn></div>}
        <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm"><div><b>เอกสารที่ต้องใช้</b><ul className="list-disc ml-5">{s.docs.map((d) => <li key={d}>{d}</li>)}</ul></div><div><b>ทำไมสำคัญ</b><p>{s.why}</p></div><div><b>สิ่งที่ควรทำต่อ</b><p>{s.next}</p></div></div>
      </li>))}</ol>
  )
}

export function DocumentCard({ title, desc, generated, onCreate, onView, onDownload }: { title: string; desc: string; generated: boolean; onCreate: () => void; onView: () => void; onDownload: () => void }) {
  return (
    <div className="card flex flex-col gap-2"><h3 className="h2 text-base">{title}</h3><p className="text-sm text-slate-600 flex-1">{desc}</p>
      <div className="flex flex-wrap gap-2"><button className="btn-primary !py-2" onClick={onCreate}>{generated ? 'สร้างใหม่' : 'สร้างเอกสาร'}</button>
        <button className="btn-ghost !py-2" disabled={!generated} onClick={onView}>ดูเอกสาร</button><button className="btn-ghost !py-2" disabled={!generated} onClick={onDownload}>ดาวน์โหลด</button></div>
    </div>
  )
}

export function AlertCard({ a }: { a: AlertItem }) {
  const g = getReg(a.sourceId)
  return (
    <article className={`card border-l-8 ${levelBar[a.severity]} text-sm space-y-1`}>
      <div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">⚠ พบข้อมูลใหม่ที่เกี่ยวข้องกับธุรกิจของคุณ</h3>{a.isSample && <SampleTag text="ตัวอย่างการทำงานระบบติดตาม (ไม่ใช่ข้อมูลสด)" />}</div>
      <p><b>สิ่งที่เปลี่ยน:</b> {a.changed}</p><p><b>เมื่อไร:</b> {a.when}</p><p><b>ประเทศ / หัวข้อ:</b> {a.country === 'TH' ? '🇹🇭 ไทย' : '🇨🇳 จีน'} · {a.topic}</p><p><b>โปรไฟล์ที่ได้รับผลกระทบ:</b> {a.profile}</p>
      <p><b>แหล่งข้อมูล:</b> {g ? <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-navy-600 underline">{g.authority} ↗</a> : '-'}</p>
      <p><b>ผลกระทบที่อาจเกิดขึ้น:</b> {a.impact}</p><p><b>สิ่งที่ควรทำต่อ:</b> {a.next}</p>
    </article>
  )
}

export function AnalysisTabs({ active }: { active: string }) {
  const tabs = [['analysis', 'ศูนย์วิเคราะห์'], ['ownership', 'โครงสร้างผู้ถือหุ้น'], ['nominee', 'ความเสี่ยงด้านนอมินี'], ['employment', 'การจ้างงาน'], ['contract', 'สัญญาจ้าง'], ['language', 'ภาษาและวัฒนธรรม']]
  return (
    <nav aria-label="หมวดการวิเคราะห์" className="flex gap-2 overflow-x-auto pb-2 mb-4">
      {tabs.map(([k, t]) => <button key={k} onClick={() => go(k)} aria-current={active === k ? 'page' : undefined} className={`px-4 py-2 rounded-full border whitespace-nowrap min-h-[44px] ${active === k ? 'bg-navy-800 text-white border-navy-800' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'}`}>{t}</button>)}
    </nav>
  )
}

export function ActionList({ actions, onStatus }: { actions: ActionItem[]; onStatus: (id: string, s: StepStatus) => void }) {
  if (!actions.length) return <div className="card text-sm text-green-700">✓ ไม่มีงานที่เกิดจากความเสี่ยงในขณะนี้</div>
  return (
    <ul className="space-y-2">{actions.map((a) => (
      <li key={a.id} className="card !p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm"><div className={a.status === 'done' ? 'line-through text-slate-500' : 'font-medium'}>{a.title}</div><div className="text-xs text-slate-500">เกิดจากความเสี่ยง: {a.riskLabel} · ผู้รับผิดชอบ: {a.owner}</div></div>
        <div className="flex items-center gap-2"><StepBadge s={a.status} />
          <select aria-label={'สถานะงาน ' + a.title} className="input !w-auto !py-1.5 text-sm" value={a.status} onChange={(e) => onStatus(a.id, e.target.value as StepStatus)}>{(Object.keys(stepLabel) as StepStatus[]).map((k) => <option key={k} value={k}>{stepLabel[k]}</option>)}</select></div>
      </li>))}</ul>
  )
}
