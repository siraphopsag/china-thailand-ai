import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LANGS, dv, tk, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { go, useStore } from '../store'
import { dirInfo } from '../utils/labels'
import { tourRoutes } from '../data/culture'
import { SampleTag } from './ui'
import { CountryBadge, Icon, type IconName } from './icons'

type NavItem = { route: string; key: string; icon: IconName; sub: string[] }
/** Six plain-language destinations. Everything else lives under "More". */
export const PRIMARY: NavItem[] = [
  { route: 'dashboard', key: 'nav.overview', icon: 'overview', sub: ['profile', 'direction', 'interview', 'analysis'] },
  { route: 'ownership', key: 'nav.ownershipCheck', icon: 'ownership', sub: ['nominee'] },
  { route: 'employment', key: 'nav.employmentCheck', icon: 'employment', sub: ['contract'] },
  { route: 'risk', key: 'nav.riskCheck', icon: 'risk', sub: [] },
  { route: 'roadmap', key: 'nav.plan', icon: 'plan', sub: [] },
  { route: 'documents', key: 'nav.documents', icon: 'documents', sub: [] },
]
export const MORE: NavItem[] = [
  { route: 'analysis', key: 'nav.analysis', icon: 'ai', sub: [] },
  { route: 'monitoring', key: 'nav.monitoring', icon: 'monitor', sub: [] },
  { route: 'sources', key: 'nav.sources', icon: 'sources', sub: [] },
  { route: 'language', key: 'tabs.language', icon: 'culture', sub: [] },
  { route: 'pricing', key: 'nav.pricing', icon: 'business', sub: [] },
  { route: 'privacy', key: 'nav.privacy', icon: 'info', sub: [] },
  { route: 'admin', key: 'nav.admin', icon: 'settings', sub: [] },
]
const isActive = (route: string, n: NavItem) => route === n.route || n.sub.includes(route)

export function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 34 34" aria-hidden><circle cx="9" cy="17" r="7" fill="#fbbf24" /><circle cx="25" cy="17" r="7" fill="#f87171" /><path d="M13 17h8" stroke="#0f1e38" strokeWidth="2.5" strokeLinecap="round" /><path d="M19 13l4 4-4 4" stroke="#0f1e38" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
const ctrl = 'h-10 whitespace-nowrap rounded-lg border border-white/25 text-onheader hover:bg-white/10 transition active:scale-95 flex items-center justify-center gap-1.5 text-sm'

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
function Menu({ label, icon, children, align = 'right', buttonClass = '', kind = 'menu' }: { label: ReactNode; icon?: IconName; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; buttonClass?: string; kind?: 'menu' | 'disclosure' }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useOutside(open, close)
  const btn = useRef<HTMLButtonElement>(null)
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
    <div ref={ref} className="relative" onKeyDown={onKey}>
      <button ref={btn} onClick={() => setOpen(!open)} aria-haspopup={kind === 'menu' ? 'menu' : undefined} aria-expanded={open} className={`${ctrl} px-3 ${buttonClass}`}>{icon && <Icon name={icon} size={17} />}{label}<Icon name="down" size={14} /></button>
      {open && <div data-menu-panel className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-56 bg-surface text-ink border border-line rounded-xl shadow-lg p-1 z-50`}>{children(close)}</div>}
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

export function Header({ route }: { route: string }) {
  const { t } = useI18n()
  const { startDemo } = useStore()
  const [menu, setMenu] = useState(false)
  const menuBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menu) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); menuBtn.current?.focus() } }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [menu])
  return (
    <header className="bg-header text-onheader sticky top-0 z-40 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        <button onClick={() => go('')} className="flex items-center gap-2 text-left shrink-0" aria-label={t('nav.home')}>
          <Logo /><span className="leading-tight hidden min-[420px]:block"><span className="block text-sm font-semibold">{t('app.name')}</span><span className="block text-[11px] opacity-70">{t('app.tagline')}</span></span>
        </button>
        <nav aria-label={t('nav.main')} className="hidden xl:flex gap-0.5 ml-3 flex-1 min-w-0">
          {PRIMARY.map((n) => (
            <button key={n.route} onClick={() => go(n.route)} aria-current={isActive(route, n) ? 'page' : undefined} className={`px-2.5 py-2 rounded-lg text-sm min-h-[40px] whitespace-nowrap transition-colors flex items-center gap-1.5 ${isActive(route, n) ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'}`}><Icon name={n.icon} size={16} />{t(n.key as never)}</button>))}
          <Menu label={t('nav.more')} buttonClass="border-transparent" kind="disclosure">
            {(close) => <ul>{MORE.map((m) => <li key={m.route}><button className={`${item} ${route === m.route ? 'bg-brand text-brandfg font-semibold' : ''}`} onClick={() => { go(m.route); close() }}><Icon name={m.icon} size={17} />{t(m.key as never)}</button></li>)}</ul>}
          </Menu>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher /><ThemeSwitcher />
          <button className="btn-accent !py-1.5 !min-h-[40px] text-sm hidden sm:inline-flex" onClick={() => { startDemo(); go('profile') }}>{t('cta.startDemo')}</button>
          <button ref={menuBtn} className={`xl:hidden ${ctrl} w-10`} aria-expanded={menu} aria-label={t('nav.menu')} onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
        </div>
      </div>
      {menu && (
        <div className="xl:hidden bg-header px-3 pb-3 border-t border-white/10 max-h-[70vh] overflow-auto">
          <button className="btn-accent w-full my-2 text-sm" onClick={() => { startDemo(); go('profile'); setMenu(false) }}>{t('cta.startDemo')}</button>
          <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-1">
            {[...PRIMARY, ...MORE].map((n) => <li key={n.route}><button onClick={() => { go(n.route); setMenu(false) }} className={`w-full text-left px-3 py-3 rounded-lg hover:bg-white/10 flex items-center gap-2.5 ${isActive(route, n) ? 'bg-white/15 font-semibold' : ''}`}><Icon name={n.icon} size={17} />{t(n.key as never)}</button></li>)}
          </ul>
        </div>)}
    </header>
  )
}

/** Compact "which business is the AI analysing" bar + guided-demo strip. */
export function ContextStack({ route }: { route: string }) {
  const { t } = useI18n()
  const { profile, tour, set, mode, exitDemo } = useStore()
  const hideCtx = ['', 'direction', 'interview', 'privacy', 'pricing'].includes(route)
  const showTour = tour !== null && tour < tourRoutes.length
  const demo = mode === 'demo'
  if ((hideCtx || !profile) && !showTour && !demo) return null
  const d = profile ? dirInfo(profile.direction) : null
  return (
    <div className="md:sticky md:top-16 z-30">
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
  return (
    <nav aria-label={t('nav.mobile')} className="xl:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line grid grid-cols-5 z-40">
      {PRIMARY.filter((n) => n.route !== 'documents').map((n) => (
        <button key={n.route} onClick={() => go(n.route)} aria-current={isActive(route, n) ? 'page' : undefined} className={`py-2 text-[11px] min-h-[56px] flex flex-col items-center gap-0.5 leading-tight px-0.5 ${isActive(route, n) ? 'text-primary font-semibold' : 'text-muted'}`}>
          <Icon name={n.icon} size={21} /><span className="truncate max-w-full">{t(n.key as never)}</span>
        </button>))}
    </nav>
  )
}
