import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LANGS, dv, tk, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { go, NavLink, useStore } from '../store'
import { dirInfo } from '../utils/labels'
import { tourRoutes } from '../data/culture'
import { SampleTag } from './ui'
import { BRAND } from '../brand'
import { CountryBadge, Icon, type IconName } from './icons'
import { usePersona } from '../persona'
import { usePersonaLabel } from './jobboard'
import { LoginButton } from './sidenav'

type NavItem = { route: string; key: string; icon: IconName; sub: string[] }
/** The business-planning tool's own areas (secondary part of C.A.L.L.). Shown as a sub-navigation only inside business-planning routes. */
export const PRIMARY: NavItem[] = [
  { route: 'dashboard', key: 'nav.overview', icon: 'overview', sub: [] },
  { route: 'profile', key: 'nav.business', icon: 'business', sub: ['start', 'direction', 'interview'] },
  { route: 'analysis', key: 'nav.analysisHub', icon: 'ai', sub: ['ownership', 'nominee', 'employment', 'contract', 'navigator', 'employee'] },
  { route: 'plan', key: 'nav.plan', icon: 'plan', sub: ['roadmap', 'risk'] },
  { route: 'documents', key: 'nav.documents', icon: 'documents', sub: [] },
]
/** Every route that belongs to the business-planning tool (map, interview, analysis, plans, documents). */
export const BUSINESS_ROUTES = PRIMARY.flatMap((n) => [n.route, ...n.sub])
export const isBusinessRoute = (route: string) => BUSINESS_ROUTES.includes(route)
type MainItem = { key: string; icon: IconName; to: (hasProfile: boolean) => string; match: string[] }
/** Main navigation, employment first: jobs, employers, preparation (language & culture), legal information, then business planning. */
export const MAIN_NAV: MainItem[] = [
  { key: 'nav.jobs', icon: 'employment', to: () => 'jobs', match: ['jobs'] },
  { key: 'nav.employerArea', icon: 'business', to: () => 'employer', match: ['employer'] },
  { key: 'tabs.language', icon: 'culture', to: () => 'language', match: ['language'] },
  { key: 'nav.legalInfo', icon: 'legal', to: () => 'sources', match: ['sources', 'monitoring'] },
  // business planning opens its overview when a business case exists, otherwise its first step (the map)
  { key: 'nav.bizPlanning', icon: 'globe', to: (p) => (p ? 'dashboard' : 'start'), match: BUSINESS_ROUTES },
]
const isActive = (route: string, n: NavItem) => route === n.route || n.sub.includes(route)

/** C.A.L.L. mark: two linked rings (two sides of a border, two languages) joined by one line. Follows the theme. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <circle cx="12.5" cy="16" r="6" fill="none" strokeWidth="2.2" className="stroke-onprimary" />
      <circle cx="19.5" cy="16" r="6" fill="none" strokeWidth="2.2" className="stroke-onprimary" opacity="0.75" />
    </svg>
  )
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open, close])
  return ref
}
const ctrl = 'h-10 whitespace-nowrap rounded-lg border border-control text-onheader hover:bg-surface3 transition active:scale-95 flex items-center justify-center gap-1.5 text-sm'

export function ThemeSwitcher() {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const dark = theme === 'dark'
  return (
    <button onClick={toggle} aria-label={dark ? t('theme.toLight') : t('theme.toDark')} title={dark ? t('theme.toLight') : t('theme.toDark')} className={`${ctrl} w-10`}>
      <Icon name={dark ? 'dark' : 'light'} />
    </button>
  )
}

/** Dropdown: Escape closes and returns focus, ArrowUp/Down/Home/End move between items, Tab leaves the menu. */
function Menu({ label, icon, children, align = 'right', buttonClass = '', kind = 'menu', ariaLabel, panelClass = 'w-56', refocus = false, rootClass = '' }: { label: ReactNode; icon?: IconName; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; buttonClass?: string; kind?: 'menu' | 'disclosure'; ariaLabel?: string; panelClass?: string; refocus?: boolean; rootClass?: string }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useOutside(open, close)
  const btn = useRef<HTMLButtonElement>(null)
  /** closing after a choice; with `refocus` the focus returns to the menu button instead of being lost */
  const choose = useCallback(() => { setOpen(false); if (refocus) btn.current?.focus() }, [refocus])
  useEffect(() => { if (open) ref.current?.querySelector<HTMLElement>('[data-menu-panel] button')?.focus() }, [open, ref])
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[data-menu-panel] button') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); close(); btn.current?.focus() }
    else if (e.key === 'Tab') close()
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
  }
  return (
    <div ref={ref} className={`relative ${rootClass}`} onKeyDown={onKey}>
      <button ref={btn} onClick={() => setOpen(!open)} aria-haspopup={kind === 'menu' ? 'menu' : undefined} aria-expanded={open} aria-label={ariaLabel} className={`${ctrl} px-3 ${buttonClass}`}>{icon && <Icon name={icon} size={17} />}{label}<Icon name="down" size={14} /></button>
      {open && <div data-menu-panel className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 ${panelClass} bg-surface text-ink border border-line rounded-xl shadow-lg p-1 z-50`}>{children(choose)}</div>}
    </div>
  )
}
const item = 'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 min-h-[44px] md:min-h-[40px] hover:bg-surface3 text-sm'

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  const cur = LANGS.find((l) => l.id === lang)!
  return (
    <div role="group" aria-label={t('lang.choose')}>
      <Menu icon="language" label={<span aria-label={t('lang.choose')}>{cur.short}</span>}>
        {(close) => (
          <ul role="menu" aria-label={t('lang.choose')}>
            {LANGS.map((l) => (
              <li key={l.id} role="none">
                <button role="menuitemradio" aria-checked={l.id === lang} lang={l.html} onClick={() => { setLang(l.id); close() }} className={`${item} ${l.id === lang ? 'bg-brand text-brandfg font-semibold' : ''}`}>{l.label}{l.id === lang && <Icon name="check" size={16} className="ml-auto" />}</button>
              </li>))}
          </ul>)}
      </Menu>
    </div>
  )
}

/**
 * Job-board PoC persona switcher. A simulation control, not a login: it only changes which synthetic persona the
 * demo pages act as. The selection lives in session state (see persona.tsx).
 */
export function PersonaSwitcher({ bar = false }: { bar?: boolean }) {
  const { t } = useI18n()
  const { persona, personas, select, reset, invalid } = usePersona()
  const label = usePersonaLabel()
  const who = label(persona)
  // `bar`: full-width row under the header on narrow screens, where the header row has no room for another control
  const text = bar
    ? <span className="flex-1 min-w-0 truncate text-left">{t('persona.current', { who })}</span>
    : <><span className="hidden md:inline max-w-[11rem] truncate">{who}</span><span className="md:hidden max-w-[6rem] truncate">{t(`persona.role.${persona.kind}` as never)}</span></>
  return (
    <div role="group" aria-label={t('persona.label')} className={bar ? 'w-full' : ''}>
      <Menu icon="management" refocus ariaLabel={t('persona.aria', { who })} panelClass="w-72 max-w-[calc(100vw-1.5rem)]" align={bar ? 'left' : 'right'}
        rootClass={bar ? 'w-full' : ''} buttonClass={bar ? 'w-full !justify-start' : ''}
        label={<><span className="text-[10px] font-bold rounded px-1 bg-warn-bg text-warn-fg" lang="en">PoC</span>{text}</>}>
        {(close) => (<>
          <p className="px-3 pt-2 pb-1 text-xs text-muted">{t('persona.note')}</p>
          <p className="px-3 pb-2 text-xs text-muted">{t('jb.notice.short')}</p>
          {invalid && <p role="status" className="px-3 pb-2 text-xs text-danger-fg">{t('persona.invalid')}</p>}
          <ul role="menu" aria-label={t('persona.label')}>
            {personas.map((p) => (
              <li key={p.key} role="none">
                <button role="menuitemradio" aria-checked={p.key === persona.key} onClick={() => { select(p.key); close() }} className={`${item} ${p.key === persona.key ? 'bg-brand text-brandfg font-semibold' : ''}`}>
                  <span className="min-w-0"><span className="block">{t(`persona.role.${p.kind}` as never)}</span>{p.name && <span className="block text-xs opacity-80 truncate">{p.name} · {t('persona.fictional')}</span>}</span>
                  {p.key === persona.key && <Icon name="check" size={16} className="ml-auto" />}
                </button>
              </li>))}
            {/* the simulated review workspace is offered only once the simulated reviewer persona is chosen (it is not a real admin link) */}
            {persona.kind === 'admin' && <li role="none" className="border-t border-line mt-1 pt-1"><button role="menuitem" className={item} onClick={() => { close(); go('review') }}><Icon name="risk" size={16} />{t('persona.toReview')}</button></li>}
            <li role="none" className="border-t border-line mt-1 pt-1"><button role="menuitem" className={item} onClick={() => { reset(); close() }}><Icon name="back" size={16} />{t('persona.reset')}</button></li>
          </ul>
        </>)}
      </Menu>
    </div>
  )
}

/**
 * Header: the side-menu button and the C.A.L.L. mark on the left (the mark is not a link — "home" is in the side menu),
 * language, theme and log-in on the right. No top navigation and no simulated-role control.
 */
export function Header({ menuOpen, onMenu }: { route?: string; menuOpen?: boolean; onMenu?: () => void }) {
  const { t } = useI18n()
  return (
    <header className="bg-header/90 backdrop-blur-md text-onheader sticky top-0 z-40 border-b border-line">
      <div className="px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        <button type="button" className={`${ctrl} w-10 shrink-0`} data-menu-button aria-expanded={!!menuOpen} aria-label={t('m.menu')} title={t('m.menu')} onClick={onMenu}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
        <div className="flex items-center gap-2 shrink-0" lang="en">
          <Logo /><span className="leading-tight"><span className="block text-base font-bold tracking-[0.12em]">{BRAND.name}</span><span className="hidden min-[420px]:block text-[11px] opacity-70 tracking-wide">{BRAND.full}</span></span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher /><ThemeSwitcher /><LoginButton />
        </div>
      </div>
    </header>
  )
}

/** The business-planning tool's own sub-navigation (desktop), shown only inside that tool once a business case exists. */
function BusinessSubNav({ route }: { route: string }) {
  const { t } = useI18n()
  return (
    <div className="hidden xl:block bg-surface2 border-b border-line">
      <nav aria-label={t('nav.bizTools')} className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-1">
        <span className="text-xs font-semibold text-muted mr-2 inline-flex items-center gap-1.5"><Icon name="globe" size={14} />{t('nav.bizTools')}</span>
        {PRIMARY.map((n) => (
          <NavLink key={n.route} to={n.route} aria-current={isActive(route, n) ? 'page' : undefined} className={`px-2.5 py-1.5 rounded-lg text-sm min-h-[36px] whitespace-nowrap flex items-center gap-1.5 ${isActive(route, n) ? 'bg-brand text-brandfg font-semibold' : 'hover:bg-surface3'}`}><Icon name={n.icon} size={15} />{t(n.key as never)}</NavLink>))}
      </nav>
    </div>
  )
}

/** Compact "which business is the AI analysing" bar + guided-demo strip. */
export function ContextStack({ route }: { route: string }) {
  const { t } = useI18n()
  const { profile, tour, set, mode, exitDemo } = useStore()
  // everything here belongs to the business-planning tool, so it stays inside that tool's routes (not on the job board or the home page)
  const biz = isBusinessRoute(route)
  const hideCtx = !biz || ['start', 'direction', 'interview'].includes(route)
  const showTour = biz && tour !== null && tour < tourRoutes.length
  const demo = biz && mode === 'demo'
  const sub = biz && !!profile
  if ((hideCtx || !profile) && !showTour && !demo && !sub) return null
  const d = profile ? dirInfo(profile.direction) : null
  return (
    <div className="md:sticky md:top-16 z-30">
      {sub && <BusinessSubNav route={route} />}
      {demo && (
        <div className="bg-info-bg text-info-fg border-b border-info-line" role="status">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><Icon name="info" size={14} /><span className="flex-1 min-w-[200px]">{t('demo.mode')}</span>
            <button className="underline font-semibold" onClick={() => { exitDemo(); go('') }}>{t('demo.exit')}</button></div>
        </div>)}
      {!hideCtx && profile && d && (
        <div className="bg-surface border-b border-line" role="region" aria-label={t('ctx.aria')}>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
            <span className="font-semibold truncate max-w-[60vw] inline-flex items-center gap-1.5"><Icon name="business" size={16} className="text-primary" />{dv(profile.companyName)}</span>
            <span className="flex items-center gap-1.5" aria-label={t(`dir.${profile.direction}` as never)}><CountryBadge c={d.from} />{tk('country', d.from)}<Icon name="next" size={14} className="text-primary" /><CountryBadge c={d.to} />{tk('country', d.to)}</span>
            <span className="text-muted hidden sm:inline">{profile.businessType === 'other' && profile.businessTypeOther ? profile.businessTypeOther : tk('opt.btype', profile.businessType)}</span>
            {profile.isDemo && <SampleTag text={t('c.demoTag')} />}
            <span className="ml-auto text-xs text-muted hidden md:inline-flex items-center gap-1.5"><Icon name="ai" size={13} className="text-primary" />{t('ctx.analyzing')}</span>
          </div>
        </div>)}
      {showTour && tour !== null && (
        <div role="region" aria-label={t('tour.aria')} className="bg-warn-bg border-b border-warn-line text-warn-fg">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-semibold">{t('tour.label')} · {t('tour.step', { n: tour + 1, total: tourRoutes.length })}: {t(`tour.${tour}.t` as never)}</span>
            <span className="hidden md:block flex-1 min-w-[200px] text-ink">{t(`tour.${tour}.c` as never)}</span>
            <details className="md:hidden w-full text-ink"><summary className="cursor-pointer text-xs underline">{t('ui.show')}</summary><p className="mt-1">{t(`tour.${tour}.c` as never)}</p></details>
            <span className="flex gap-2">
              <button className="btn-ghost !py-1 !min-h-[36px]" disabled={tour === 0} onClick={() => { set({ tour: tour - 1 }); go(tourRoutes[tour - 1]) }}><Icon name="back" size={15} />{t('c.prev')}</button>
              <button className="btn-primary !py-1 !min-h-[36px]" onClick={() => { if (tour + 1 < tourRoutes.length) { set({ tour: tour + 1 }); go(tourRoutes[tour + 1]) } else set({ tour: null }) }}>{tour + 1 < tourRoutes.length ? t('c.next') : t('tour.finish')}{tour + 1 < tourRoutes.length && <Icon name="next" size={15} />}</button>
              <button className="btn-ghost !py-1 !min-h-[36px]" onClick={() => set({ tour: null })}>{t('tour.exit')}</button>
            </span>
          </div>
        </div>)}
    </div>
  )
}

export function BottomNav({ route }: { route: string }) {
  const { t } = useI18n()
  const { profile } = useStore()
  if (!profile || !isBusinessRoute(route)) return null // the business tool's own tabs; other areas use the header menu
  return (
    <nav aria-label={t('nav.bizTools')} className="xl:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line grid grid-cols-5 z-40">
      {PRIMARY.map((n) => (
        <NavLink key={n.route} to={n.route} aria-current={isActive(route, n) ? 'page' : undefined} className={`py-2 text-[11px] min-h-[56px] flex flex-col items-center gap-0.5 leading-tight px-0.5 ${isActive(route, n) ? 'text-primary font-semibold' : 'text-muted'}`}>
          <Icon name={n.icon} size={21} /><span className="line-clamp-2 max-w-full text-center">{t(n.key as never)}</span>
        </NavLink>))}
    </nav>
  )
}
