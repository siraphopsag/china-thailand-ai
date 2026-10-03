import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { go, NavLink, StoreProvider, useRoute } from './store'
import { LanguageProvider, useI18n } from './i18n'
import { ThemeProvider } from './theme'
import { PersonaProvider } from './persona'
import { JobBoardProvider } from './jobboardData'
import { MatchProvider } from './matchData'
import { SideNav } from './components/sidenav'
import { ErrorBoundary } from './ErrorBoundary'
import { BRAND } from './brand'
import { pageTitle } from './utils/labels'
import { BackButton, BottomNav, ContextStack, Header } from './components/shell'
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
const PlanPage = lazy(() => import('./pages/plan').then((m) => ({ default: m.PlanPage })))
const NavigatorPage = lazy(() => import('./pages/compliance').then((m) => ({ default: m.NavigatorPage })))
const EmployeeCheckPage = lazy(() => import('./pages/compliance').then((m) => ({ default: m.EmployeeCheckPage })))
const PrivacyPage = lazy(() => import('./pages/ops').then((m) => ({ default: m.PrivacyPage })))
const JobsPage = lazy(() => import('./pages/jobboard').then((m) => ({ default: m.JobsPage })))
const EmployerPage = lazy(() => import('./pages/jobboard').then((m) => ({ default: m.EmployerPage })))
const ReviewPage = lazy(() => import('./pages/review').then((m) => ({ default: m.ReviewPage })))
const SeekPage = lazy(() => import('./pages/match').then((m) => ({ default: m.SeekPage })))
const HirePage = lazy(() => import('./pages/match').then((m) => ({ default: m.HirePage })))
const NotificationsPage = lazy(() => import('./pages/match').then((m) => ({ default: m.NotificationsPage })))
const MePage = lazy(() => import('./pages/match').then((m) => ({ default: m.MePage })))
const PreparePage = lazy(() => import('./pages/match').then((m) => ({ default: m.PreparePage })))
const SettingsPage = lazy(() => import('./pages/match').then((m) => ({ default: m.SettingsPage })))
const HelpPage = lazy(() => import('./pages/match').then((m) => ({ default: m.HelpPage })))
const BackofficePage = lazy(() => import('./pages/match').then((m) => ({ default: m.BackofficePage })))
const ChooseRolePage = lazy(() => import('./pages/choose').then((m) => ({ default: m.ChooseRolePage })))

/** footer targets are at least 24 px high (WCAG 2.5.8) */
const FOOT = 'underline inline-flex items-center min-h-[24px]'
function Shell({ route, children }: { route: string; children: ReactNode }) {
  const { t } = useI18n()
  const first = useRef(true)
  // Every view gets its own title (its h1 + the product name), and after a route change focus moves to that h1 so
  // keyboard and screen-reader users start at the new content and hear which page opened. Pages load lazily, so wait for the h1.
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    const moveFocus = !first.current
    first.current = false
    let focused = false
    const apply = () => {
      const h1 = main.querySelector('h1')
      document.title = pageTitle(h1?.innerText || h1?.textContent || '', BRAND.name, t('app.title')) // innerText keeps the space a line break makes
      if (h1 && moveFocus && !focused) { focused = true; h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }) }
    }
    apply()
    const mo = new MutationObserver(apply)
    mo.observe(main, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [route, t])
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:bg-surface focus:text-ink focus:p-2 z-50">{t('nav.skip')}</a>
      <Header route={route} />
      <SideNav route={route} />
      {/* room for the menu capsule: on the left from 768 px, below the content on phones */}
      <div id="page-body" className="flex-1 flex flex-col md:pl-24">
      <ContextStack route={route} />
      <main id="main" tabIndex={-1} className="outline-none flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-6 pb-28 md:pb-10"><BackButton route={route} /><ErrorBoundary key={route} compact><Suspense fallback={<p className="py-16 text-center text-muted" role="status">{t('c.loading')}</p>}>{children}</Suspense></ErrorBoundary></main>
      <footer className="bg-surface border-t border-line text-xs text-muted px-4 py-6 mb-20 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-x-5 gap-y-2 items-center">
          <span className="font-semibold text-ink" lang="en">{BRAND.title}</span><span>{t('foot.note')}</span>
          <NavLink to="privacy" className={FOOT}>{t('nav.privacy')}</NavLink>
        </div>
      </footer>
      </div>
      <BottomNav route={route} />
    </div>
  )
}

function Router() {
  const r = useRoute()
  const { t } = useI18n()
  const pages: Record<string, ReactNode> = {
    '': <Landing />, start: <StartPage />, direction: <DirectionPage />, interview: <InterviewPage />, profile: <ProfilePage />, dashboard: <Dashboard />, analysis: <AnalysisCenter />,
    ownership: <OwnershipPage />, nominee: <NomineePage />, employment: <EmploymentPage />, contract: <ContractPage />, language: <LanguagePage />, plan: <PlanPage />, navigator: <NavigatorPage />, employee: <EmployeeCheckPage />, risk: <RiskPage />,
    roadmap: <RoadmapPage />, documents: <DocumentsPage />, monitoring: <MonitoringPage />, sources: <SourcesPage />, pricing: <PricingPage />, privacy: <PrivacyPage />, admin: <AdminPage />,
    jobs: <JobsPage />, employer: <EmployerPage />, review: <ReviewPage />, 'choose-role': <ChooseRolePage />, // earlier job-board PoC pages (no longer linked)
    seek: <SeekPage />, hire: <HirePage />, notifications: <NotificationsPage />, me: <MePage />, prepare: <PreparePage />, settings: <SettingsPage />, help: <HelpPage />, backoffice: <BackofficePage />, // matching prototype
  }
  return <Shell route={r}>{r in pages ? pages[r] : <div className="card text-center"><h1 className="h1">{t('err.notFound')}</h1><button className="btn-primary mt-4" onClick={() => go('')}>{t('err.home')}</button></div>}</Shell>
}
export default function App() { return <ThemeProvider><LanguageProvider><StoreProvider><PersonaProvider><JobBoardProvider><MatchProvider><Router /></MatchProvider></JobBoardProvider></PersonaProvider></StoreProvider></LanguageProvider></ThemeProvider> }
