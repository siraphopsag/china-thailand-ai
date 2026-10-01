import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { go, StoreProvider, useRoute, useStore } from './store'
import { LanguageProvider, useI18n } from './i18n'
import { ThemeProvider } from './theme'
import { ErrorBoundary } from './ErrorBoundary'
import { BRAND } from './brand'
import { BottomNav, ContextStack, Header } from './components/shell'
import { Landing, DirectionPage, InterviewPage, ProfilePage } from './pages/intake'
// Landing/interview load immediately; the analysis, employment and operations pages load on demand.
const StartPage = lazy(() => import('./pages/start').then((m) => ({ default: m.StartPage })))
const AnalysisCenter = lazy(() => import('./pages/analysis').then((m) => ({ default: m.AnalysisCenter })))
const OwnershipPage = lazy(() => import('./pages/analysis').then((m) => ({ default: m.OwnershipPage })))
const NomineePage = lazy(() => import('./pages/analysis').then((m) => ({ default: m.NomineePage })))
const EmploymentPage = lazy(() => import('./pages/employment').then((m) => ({ default: m.EmploymentPage })))
const ContractPage = lazy(() => import('./pages/employment').then((m) => ({ default: m.ContractPage })))
const LanguagePage = lazy(() => import('./pages/employment').then((m) => ({ default: m.LanguagePage })))
const Dashboard = lazy(() => import('./pages/ops').then((m) => ({ default: m.Dashboard })))
const RiskPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.RiskPage })))
const RoadmapPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.RoadmapPage })))
const DocumentsPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.DocumentsPage })))
const MonitoringPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.MonitoringPage })))
const SourcesPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.SourcesPage })))
const AdminPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.AdminPage })))
const PricingPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.PricingPage })))
const NavigatorPage = lazy(() => import('./pages/compliance').then((m) => ({ default: m.NavigatorPage })))
const EmployeeCheckPage = lazy(() => import('./pages/compliance').then((m) => ({ default: m.EmployeeCheckPage })))
const PrivacyPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.PrivacyPage })))

function Shell({ route, children }: { route: string; children: ReactNode }) {
  const { t } = useI18n()
  const { profile, reset } = useStore()
  useEffect(() => { document.title = t('app.title') }, [t])
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-surface focus:text-ink focus:p-2 z-50">{t('nav.skip')}</a>
      <Header route={route} />
      <ContextStack route={route} />
      <main id="main" className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-6 pb-28 xl:pb-10"><ErrorBoundary key={route} compact><Suspense fallback={<p className="py-16 text-center text-muted" role="status">{t('c.loading')}</p>}>{children}</Suspense></ErrorBoundary></main>
      <footer className="bg-surface border-t border-line text-xs text-muted px-4 py-6 mb-16 xl:mb-0">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-x-5 gap-y-1 items-center">
          <span className="font-semibold text-ink" lang="en">{BRAND.title}</span><span>{t('foot.note')}</span>
          <button className="underline" onClick={() => go('privacy')}>{t('nav.privacy')}</button><button className="underline" onClick={() => go('pricing')}>{t('nav.pricing')}</button><button className="underline" onClick={() => go('admin')}>{t('nav.admin')}</button>
          {profile && <button className="underline" onClick={() => { if (confirm(t('foot.confirm'))) { reset(); go('') } }}>{t('foot.clear')}</button>}
        </div>
      </footer>
      <BottomNav route={route} />
    </div>
  )
}

function Router() {
  const r = useRoute()
  const { t } = useI18n()
  const pages: Record<string, ReactNode> = {
    '': <Landing />, start: <StartPage />, direction: <DirectionPage />, interview: <InterviewPage />, profile: <ProfilePage />, dashboard: <Dashboard />, analysis: <AnalysisCenter />,
    ownership: <OwnershipPage />, nominee: <NomineePage />, employment: <EmploymentPage />, contract: <ContractPage />, language: <LanguagePage />, navigator: <NavigatorPage />, employee: <EmployeeCheckPage />, risk: <RiskPage />,
    roadmap: <RoadmapPage />, documents: <DocumentsPage />, monitoring: <MonitoringPage />, sources: <SourcesPage />, pricing: <PricingPage />, privacy: <PrivacyPage />, admin: <AdminPage />,
  }
  return <Shell route={r}>{r in pages ? pages[r] : <div className="card text-center"><h1 className="h1">{t('err.notFound')}</h1><button className="btn-primary mt-4" onClick={() => go('')}>{t('err.home')}</button></div>}</Shell>
}
export default function App() { return <ThemeProvider><LanguageProvider><StoreProvider><Router /></StoreProvider></LanguageProvider></ThemeProvider> }
