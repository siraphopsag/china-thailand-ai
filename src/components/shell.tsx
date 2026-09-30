import { useEffect, useRef, useState } from 'react'
import { LANGS, dv, tk, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { go, useStore } from '../store'
import { dirInfo } from '../utils/labels'
import { tourRoutes } from '../data/culture'
import { SampleTag } from './ui'

export const NAV: [route: string, key: string, icon: string, sub: string[]][] = [
  ['', 'home', '🏠', []],
  ['dashboard', 'business', '🏢', ['profile', 'direction', 'interview']],
  ['analysis', 'analysis', '🧠', ['ownership', 'nominee', 'employment', 'contract', 'language']],
  ['risk', 'risk', '🛡️', []],
  ['roadmap', 'roadmap', '🗺️', []],
  ['documents', 'documents', '📄', []],
  ['monitoring', 'monitoring', '📡', []],
  ['sources', 'sources', '🔗', ['admin']],
]
export const isActive = (route: string, k: string, sub: string[]) => route === k || sub.includes(route)

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden><circle cx="9" cy="17" r="7" fill="#fbbf24" /><circle cx="25" cy="17" r="7" fill="#f87171" /><path d="M13 17h8" stroke="#0f1e38" strokeWidth="2.5" strokeLinecap="round" /><path d="M19 13l4 4-4 4" stroke="#0f1e38" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  )
}

export function ThemeSwitcher() {
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const dark = theme === 'dark'
  return (
    <button onClick={toggle} aria-label={dark ? t('theme.toLight') : t('theme.toDark')} title={dark ? t('theme.toLight') : t('theme.toDark')}
      className="w-10 h-10 rounded-xl border border-white/30 text-onheader grid place-items-center hover:bg-white/10 transition active:scale-95 text-lg"><span aria-hidden>{dark ? '🌙' : '🌞'}</span></button>
  )
}

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', out); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc) }
  }, [open])
  const cur = LANGS.find((l) => l.id === lang)!
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label={t('lang.choose')}
        className="h-10 px-3 rounded-xl border border-white/30 text-onheader flex items-center gap-1.5 hover:bg-white/10 transition active:scale-95 text-sm"><span aria-hidden>🌐</span><span>{cur.flag}</span><span className="hidden sm:inline">{cur.label}</span><span aria-hidden className="text-xs">▾</span></button>
      {open && (
        <ul role="listbox" aria-label={t('lang.choose')} className="absolute right-0 mt-2 w-44 bg-surface text-ink border border-line rounded-xl shadow-lg p-1 z-50">
          {LANGS.map((l) => (
            <li key={l.id} role="option" aria-selected={l.id === lang}>
              <button onClick={() => { setLang(l.id); setOpen(false) }} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 min-h-[44px] hover:bg-surface3 ${l.id === lang ? 'bg-brand text-brandfg font-semibold' : ''}`}>
                <span aria-hidden>{l.flag}</span>{l.label}{l.id === lang && <span className="ml-auto" aria-hidden>✓</span>}
              </button>
            </li>))}
        </ul>)}
    </div>
  )
}

export function Header({ route }: { route: string }) {
  const { t } = useI18n()
  const { startDemo } = useStore()
  const [menu, setMenu] = useState(false)
  const items = [...NAV.map(([k, n]) => [k, 'nav.' + n] as const), ['pricing', 'nav.pricing'] as const, ['privacy', 'nav.privacy'] as const, ['admin', 'nav.admin'] as const]
  return (
    <header className="bg-header text-onheader sticky top-0 z-40 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        <button onClick={() => go('')} className="flex items-center gap-2 text-left shrink-0" aria-label={t('nav.home')}>
          <Logo /><span className="leading-tight hidden min-[420px]:block"><span className="block text-sm font-bold">{t('app.name')}</span><span className="block text-[11px] opacity-70">{t('app.tagline')}</span></span>
        </button>
        <nav aria-label={t('nav.main')} className="hidden lg:flex gap-0.5 ml-2 flex-1 min-w-0">
          {NAV.map(([k, n, , sub]) => <button key={k} onClick={() => go(k)} aria-current={isActive(route, k, sub) ? 'page' : undefined} className={`px-2.5 py-2 rounded-lg text-sm min-h-[44px] whitespace-nowrap transition-colors ${isActive(route, k, sub) ? 'bg-white/15 font-semibold' : 'hover:bg-white/10'}`}>{t(('nav.' + n) as never)}</button>)}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher /><ThemeSwitcher />
          <button className="btn-accent !py-1.5 !min-h-[40px] text-sm hidden sm:inline-flex" onClick={() => { startDemo(); go('profile') }}>{t('cta.startDemo')}</button>
          <button className="lg:hidden h-10 px-3 rounded-xl border border-white/30 text-sm" aria-expanded={menu} onClick={() => setMenu(!menu)}>{t('nav.menu')}</button>
        </div>
      </div>
      {menu && (
        <div className="lg:hidden bg-header px-3 pb-3 grid grid-cols-2 gap-1 border-t border-white/10">
          <button className="btn-accent col-span-2 text-sm" onClick={() => { startDemo(); go('profile'); setMenu(false) }}>{t('cta.startDemo')}</button>
          {items.map(([k, key]) => <button key={k} onClick={() => { go(k); setMenu(false) }} className="text-left px-3 py-3 rounded-lg hover:bg-white/10">{t(key as never)}</button>)}
        </div>)}
    </header>
  )
}

/** Compact "which business is the AI analysing" bar + guided-demo strip, sticky below the header. */
export function ContextStack({ route }: { route: string }) {
  const { t } = useI18n()
  const { profile, tour, set } = useStore()
  const hideCtx = ['', 'direction', 'interview', 'privacy', 'pricing'].includes(route)
  const showTour = tour !== null && tour < tourRoutes.length
  if ((hideCtx || !profile) && !showTour) return null
  const d = profile ? dirInfo(profile.direction) : null
  return (
    <div className="md:sticky md:top-16 z-30">
      {!hideCtx && profile && d && (
        <div className="bg-surface border-b border-line" role="region" aria-label={t('ctx.aria')}>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-x-4 gap-y-1 flex-wrap text-sm">
            <span className="font-semibold truncate max-w-[60vw]">{dv(profile.companyName)}</span>
            <span className="flex items-center gap-1.5" aria-label={t(`dir.${profile.direction}` as never)}><span aria-hidden>{d.fromFlag}</span>{tk('country', d.from)}<span aria-hidden className="text-primary">⟶</span><span aria-hidden>{d.toFlag}</span>{tk('country', d.to)}</span>
            <span className="text-muted hidden sm:inline">{profile.businessType === 'other' && profile.businessTypeOther ? profile.businessTypeOther : tk('opt.btype', profile.businessType)}</span>
            {profile.isDemo && <SampleTag text={t('c.demoTag')} />}
            <span className="ml-auto text-xs text-muted hidden md:inline"><span className="inline-block w-2 h-2 rounded-full bg-ok-fg mr-1 align-middle" />{t('ctx.analyzing')}</span>
          </div>
        </div>)}
      {showTour && tour !== null && (
        <div role="region" aria-label={t('tour.aria')} className="bg-warn-bg border-b border-warn-line text-warn-fg">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-semibold">{t('tour.label')} · {t('tour.step', { n: tour + 1, total: tourRoutes.length })}: {t(`tour.${tour}.t` as never)}</span>
            <span className="hidden md:block flex-1 min-w-[200px] text-ink">{t(`tour.${tour}.c` as never)}</span>
            <details className="md:hidden w-full text-ink"><summary className="cursor-pointer text-xs underline">{t('ui.show')}</summary><p className="mt-1">{t(`tour.${tour}.c` as never)}</p></details>
            <span className="flex gap-2">
              <button className="btn-ghost !py-1 !min-h-[36px]" disabled={tour === 0} onClick={() => { set({ tour: tour - 1 }); go(tourRoutes[tour - 1]) }}>{t('c.prev')}</button>
              <button className="btn-primary !py-1 !min-h-[36px]" onClick={() => { if (tour + 1 < tourRoutes.length) { set({ tour: tour + 1 }); go(tourRoutes[tour + 1]) } else set({ tour: null }) }}>{tour + 1 < tourRoutes.length ? t('c.next') : t('tour.finish')}</button>
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
    <nav aria-label={t('nav.mobile')} className="lg:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-line grid grid-cols-5 z-40">
      {NAV.slice(0, 5).map(([k, n, i, sub]) => (
        <button key={k} onClick={() => go(k)} aria-current={isActive(route, k, sub) ? 'page' : undefined} className={`py-2 text-[11px] min-h-[56px] flex flex-col items-center leading-tight px-0.5 ${isActive(route, k, sub) ? 'text-primary font-bold' : 'text-muted'}`}>
          <span className="text-lg" aria-hidden>{i}</span><span className="truncate max-w-full">{t(('nav.' + n) as never)}</span>
        </button>))}
    </nav>
  )
}
