import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { go, NavLink, useRoute } from './store'
import { LanguageProvider, useI18n } from './i18n'
import { ThemeProvider } from './theme'
import { MatchProvider } from './matchData'
import { AuthProvider, CONFIG_PROBLEM, useAuth } from './auth'
import { trackVisit } from './visit'
import { SideNav } from './components/sidenav'
import { ErrorBoundary } from './ErrorBoundary'
import { BRAND } from './brand'
import { pageTitle } from './utils/labels'
import { BackButton, Header } from './components/shell'
import { Icon } from './components/icons'
import { Landing } from './pages/home'
// the home page loads immediately; every other page loads on demand
const LanguagePage = lazy(() => import('./pages/info').then((m) => ({ default: m.LanguagePage })))
const SourcesPage = lazy(() => import('./pages/info').then((m) => ({ default: m.SourcesPage })))
const PrivacyPage = lazy(() => import('./pages/info').then((m) => ({ default: m.PrivacyPage })))
const LoginPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.RegisterPage })))
const ForgotPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.ForgotPage })))
const ResetPasswordPage = lazy(() => import('./pages/auth').then((m) => ({ default: m.ResetPasswordPage })))
const SeekPage = lazy(() => import('./pages/match').then((m) => ({ default: m.SeekPage })))
const HirePage = lazy(() => import('./pages/hire').then((m) => ({ default: m.HirePage })))
const PostPage = lazy(() => import('./pages/post').then((m) => ({ default: m.PostPage })))
const BoardPage = lazy(() => import('./pages/board').then((m) => ({ default: m.BoardPage })))
const MemberPage = lazy(() => import('./pages/member').then((m) => ({ default: m.MemberPage })))
const NotificationsPage = lazy(() => import('./pages/match').then((m) => ({ default: m.NotificationsPage })))
const MePage = lazy(() => import('./pages/match').then((m) => ({ default: m.MePage })))
const PreparePage = lazy(() => import('./pages/match').then((m) => ({ default: m.PreparePage })))
const SettingsPage = lazy(() => import('./pages/match').then((m) => ({ default: m.SettingsPage })))
const HelpPage = lazy(() => import('./pages/match').then((m) => ({ default: m.HelpPage })))
const BackofficePage = lazy(() => import('./pages/match').then((m) => ({ default: m.BackofficePage })))
const CasePage = lazy(() => import('./pages/case').then((m) => ({ default: m.CasePage })))
const AnalyticsPage = lazy(() => import('./pages/analytics').then((m) => ({ default: m.AnalyticsPage })))
const CalendarPage = lazy(() => import('./pages/calendar').then((m) => ({ default: m.CalendarPage })))
const SafetyPage = lazy(() => import('./pages/safety').then((m) => ({ default: m.SafetyPage })))
const TermsPage = lazy(() => import('./pages/terms').then((m) => ({ default: m.TermsPage })))
const AskPage = lazy(() => import('./pages/ask').then((m) => ({ default: m.AskPage })))
const ChooseRolePage = lazy(() => import('./pages/choose').then((m) => ({ default: m.ChooseRolePage })))

/** pages read top to bottom keep the footer on computers; app pages fit the screen and leave it out (its links are also in Help) */
const READING = ['', 'privacy', 'terms', 'sources', 'language', 'safety', 'help']
/** footer targets are at least 24 px high (WCAG 2.5.8) */
const FOOT = 'underline inline-flex items-center min-h-[24px]'
function Shell({ route, children }: { route: string; children: ReactNode }) {
  const { t } = useI18n()
  const shown = useRef(route)
  // Every view gets its own title (its h1 + the product name), and after a route change focus moves to that h1 so
  // keyboard and screen-reader users start at the new content and hear which page opened. Pages load lazily, so wait for the h1.
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    const moveFocus = shown.current !== route // a new page (not the first one, not a language change)
    shown.current = route
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
      <div id="page-body" className="flex-1 flex flex-col md:pl-28">
      <main id="main" tabIndex={-1} className="outline-none flex-1 max-w-6xl fit:max-w-[1400px] w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 md:pb-10 fit:py-4"><DemoNotice /><div className="md:hidden"><BackButton route={route} /></div><ErrorBoundary key={route} compact><Suspense fallback={<p className="py-16 text-center text-muted" role="status">{t('c.loading')}</p>}>{children}</Suspense></ErrorBoundary></main>
      </div>
      {/* the footer band runs to both screen edges; its text keeps clear of the menu capsule */}
      <footer className={`bg-surface border-t border-line text-xs text-muted px-4 md:pl-32 py-6 mb-24 md:mb-0 ${READING.includes(route) ? '' : 'fit:hidden'}`}>
        <div className="max-w-7xl mx-auto flex flex-wrap gap-x-5 gap-y-2 items-center">
          <span className="font-semibold text-ink" lang="en">{BRAND.title}</span><span>{t('foot.note')}</span>
          <NavLink to="terms" className={FOOT}>{t('m.tm.title')}</NavLink>
          <NavLink to="privacy" className={FOOT}>{t('nav.privacy')}</NavLink>
        </div>
      </footer>
    </div>
  )
}

/** accounts are set up but cannot be reached right now: the site runs on local demo data — say so on every page */
function DemoNotice() {
  const { t } = useI18n()
  const { status, online } = useAuth()
  const bad = status === 'off' && CONFIG_PROBLEM
  if (!bad && (status === 'off' || online !== false)) return null
  return <p role="status" className="mb-4 rounded-xl border border-warn-line bg-warn-bg text-warn-fg px-4 py-2.5 text-sm flex items-start gap-2"><Icon name="warn" size={16} className="shrink-0 mt-0.5" />{t(bad ? 'm.demo.config' : 'm.demo.banner')}</p>
}

function Router() {
  const r = useRoute()
  const { t } = useI18n()
  const { status } = useAuth()
  useEffect(() => { if (status !== 'off' && status !== 'loading') trackVisit() }, [status]) // one anonymous visit per browser per day
  const pages: Record<string, ReactNode> = {
    '': <Landing />, language: <LanguagePage />, sources: <SourcesPage />, privacy: <PrivacyPage />,
    login: <LoginPage />, register: <RegisterPage />, forgot: <ForgotPage />, 'reset-password': <ResetPasswordPage />,
    'choose-role': <ChooseRolePage />,
    seek: <SeekPage />, hire: <HirePage />, post: <PostPage />, board: <BoardPage />, member: <MemberPage />, notifications: <NotificationsPage />, me: <MePage />, prepare: <PreparePage />, settings: <SettingsPage />, help: <HelpPage />, backoffice: <BackofficePage />, case: <CasePage />, terms: <TermsPage />, safety: <SafetyPage />, calendar: <CalendarPage />, analytics: <AnalyticsPage />, ask: <AskPage />, // matching prototype
  }
  return <Shell route={r}>{r in pages ? pages[r] : <div className="card text-center"><h1 className="h1">{t('err.notFound')}</h1><button className="btn-primary mt-4" onClick={() => go('')}>{t('err.home')}</button></div>}</Shell>
}
export default function App() { return <ThemeProvider><LanguageProvider><AuthProvider><MatchProvider><Router /></MatchProvider></AuthProvider></LanguageProvider></ThemeProvider> }
