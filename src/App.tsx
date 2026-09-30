import { useState, type ReactNode } from 'react'
import { go, StoreProvider, useRoute, useStore } from './store'
import { Landing, DirectionPage, InterviewPage, ProfilePage } from './pages/intake'
import { AnalysisCenter, OwnershipPage, NomineePage } from './pages/analysis'
import { EmploymentPage, ContractPage, LanguagePage } from './pages/employment'
import { Dashboard, RiskPage, RoadmapPage, DocumentsPage, MonitoringPage, SourcesPage, AdminPage, PricingPage } from './pages/ops'

const nav: [string, string, string, string[]][] = [
  ['', 'หน้าแรก', '🏠', []],
  ['dashboard', 'ธุรกิจของฉัน', '🏢', ['profile', 'direction', 'interview']],
  ['analysis', 'AI วิเคราะห์', '🧠', ['ownership', 'nominee', 'employment', 'contract', 'language']],
  ['risk', 'ความเสี่ยง', '🛡️', []],
  ['roadmap', 'แผนดำเนินงาน', '🗺️', []],
  ['documents', 'เอกสาร', '📄', []],
  ['monitoring', 'ติดตาม Compliance', '📡', []],
  ['sources', 'แหล่งข้อมูล', '🔗', ['admin']],
]

function Shell({ route, children }: { route: string; children: ReactNode }) {
  const { startDemo, profile, reset } = useStore()
  const [menu, setMenu] = useState(false)
  const active = (k: string, sub: string[]) => route === k || sub.includes(route)
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-white focus:p-2 z-50">ข้ามไปยังเนื้อหา</a>
      <header className="bg-navy-900 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => go('')} className="font-bold text-left leading-tight"><span className="block text-sm md:text-base">ไทย–จีน AI</span><span className="block text-[11px] text-navy-200 font-normal">Business Entry & Compliance</span></button>
          <nav aria-label="เมนูหลัก" className="hidden lg:flex gap-1 ml-4 flex-1">{nav.map(([k, t, , sub]) => <button key={k} onClick={() => go(k)} aria-current={active(k, sub) ? 'page' : undefined} className={`px-3 py-2 rounded-lg text-sm min-h-[44px] ${active(k, sub) ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'}`}>{t}</button>)}</nav>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn bg-amber-400 text-navy-900 hover:bg-amber-300 !py-1.5 text-sm" onClick={() => { startDemo(); go('dashboard') }}>เริ่ม Demo</button>
            <button className="lg:hidden btn border border-white/40 !py-1.5 text-sm" aria-expanded={menu} onClick={() => setMenu(!menu)}>เมนู</button>
          </div>
        </div>
        {menu && <div className="lg:hidden bg-navy-800 px-4 pb-3 grid grid-cols-2 gap-1">{[...nav.map(([k, t]) => [k, t]), ['pricing', 'แพ็กเกจ'], ['admin', 'จัดการกฎระเบียบ']].map(([k, t]) => <button key={k} onClick={() => { go(k); setMenu(false) }} className="text-left px-3 py-3 rounded hover:bg-white/10">{t}</button>)}</div>}
      </header>
      <main id="main" className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 pb-28 lg:pb-10">{children}</main>
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 px-4 py-6 mb-16 lg:mb-0">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-x-5 gap-y-1 items-center">
          <span>Prototype สำหรับสาธิต — ข้อมูลกฎหมายเป็นข้อมูลตัวอย่าง ไม่ใช่ข้อมูลเรียลไทม์</span>
          <button className="underline" onClick={() => go('pricing')}>แพ็กเกจ</button><button className="underline" onClick={() => go('admin')}>จัดการกฎระเบียบ</button>
          {profile && <button className="underline" onClick={() => { if (confirm('ล้างข้อมูลโปรไฟล์ที่บันทึกในเบราว์เซอร์นี้?')) { reset(); go('') } }}>ล้างข้อมูลในเบราว์เซอร์</button>}
        </div>
      </footer>
      <nav aria-label="เมนูมือถือ" className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-5 z-40">
        {[nav[0], nav[1], nav[2], nav[3], nav[4]].map(([k, t, i, sub]) => <button key={k} onClick={() => go(k)} aria-current={active(k, sub) ? 'page' : undefined} className={`py-2 text-[11px] min-h-[56px] flex flex-col items-center ${active(k, sub) ? 'text-navy-800 font-bold' : 'text-slate-500'}`}><span className="text-lg" aria-hidden>{i}</span>{t}</button>)}
      </nav>
    </div>
  )
}

function Router() {
  const r = useRoute()
  const pages: Record<string, ReactNode> = {
    '': <Landing />, direction: <DirectionPage />, interview: <InterviewPage />, profile: <ProfilePage />, dashboard: <Dashboard />, analysis: <AnalysisCenter />,
    ownership: <OwnershipPage />, nominee: <NomineePage />, employment: <EmploymentPage />, contract: <ContractPage />, language: <LanguagePage />, risk: <RiskPage />,
    roadmap: <RoadmapPage />, documents: <DocumentsPage />, monitoring: <MonitoringPage />, sources: <SourcesPage />, pricing: <PricingPage />, admin: <AdminPage />,
  }
  return <Shell route={r}>{r in pages ? pages[r] : <div className="card text-center"><h1 className="h1">ไม่พบหน้าที่ต้องการ</h1><button className="btn-primary mt-4" onClick={() => go('')}>กลับหน้าแรก</button></div>}</Shell>
}
export default function App() { return <StoreProvider><Router /></StoreProvider> }
