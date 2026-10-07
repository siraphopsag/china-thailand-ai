import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { LANGS, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { go, goBack, NavLink } from '../store'
import { useMatch } from '../matchData'
import { BRAND } from '../brand'
import { Icon, type IconName } from './icons'
import { LoginButton } from './sidenav'
import { Wordmark } from './logo'

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
const ctrl = 'h-10 whitespace-nowrap rounded-xl border border-control bg-surface text-onheader hover:bg-surface3 shadow-[var(--elev-hi),var(--elev-1)] transition active:scale-95 flex items-center justify-center gap-1.5 text-sm'

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
 * Header: the C.A.L.L. mark on the left (not a link — "home" is in the menu capsule), language, theme and log-in on the right.
 * No top navigation, no menu button and no simulated-role control.
 */
/** search the board from anywhere (computers and tablets): Enter opens the board filtered; Ctrl/⌘ K jumps here */
function HeaderSearch() {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus() } }
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key)
  }, [])
  return (
    <form role="search" aria-label={t('m.hd.search')} className="max-w-sm" onSubmit={(e) => { e.preventDefault(); go(`board${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); setQ(''); input.current?.blur() }}>
      <label className="relative block"><span className="sr-only">{t('m.hd.search')}</span>
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('m.hd.searchHint')} className="h-10 w-full rounded-xl border border-control bg-surface pl-9 pr-16 text-sm text-ink placeholder:text-muted shadow-[var(--elev-hi),var(--elev-1)]" />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted border border-line rounded-md px-1.5 py-0.5" aria-hidden>Ctrl K</kbd></label>
    </form>
  )
}
/** which side you are on right now (opens the role choice) */
function RoleChip() {
  const { t } = useI18n()
  const { st } = useMatch()
  if (!st.role) return null
  const r = t(st.role === 'seeker' ? 'm.role.seeker' : 'm.role.employer')
  return <NavLink to="choose-role" className="hidden lg:inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line text-xs font-medium text-onheader hover:bg-surface3" aria-label={t('m.hd.role', { r })}>
    <Icon name={st.role === 'seeker' ? 'user' : 'business'} size={14} />{r}</NavLink>
}

export function Header(_: { route?: string }) {
  return (
    <header className="bg-header/75 backdrop-blur-xl backdrop-saturate-150 text-onheader sticky top-0 z-40 border-b border-line shadow-[0_1px_0_rgb(255_255_255/.04),0_8px_24px_-16px_rgb(0_0_0/.25)]">
      <div className="px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        {/* no menu button: the menu capsule is always visible (left on computers and tablets, bottom on phones) */}
        <div className="flex items-center gap-2 shrink-0" lang="en">
          {/* the logo (owner, Oct 2026): the name itself, its C a speech bubble */}
          <span className="leading-tight"><Wordmark title={BRAND.name} className="h-7 w-auto block" /><span className="hidden sm:block text-[11px] opacity-70 tracking-wide mt-0.5">{BRAND.full}</span></span>
        </div>
        {/* computers and tablets: "Back" sits in the header, so pages keep their height for content */}
        {_.route ? <div className="hidden md:block md:pl-3"><BackButton route={_.route} compact /></div> : null}
        <div className="hidden md:block md:pl-3 lg:pl-6 flex-1 min-w-0"><HeaderSearch /></div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <RoleChip /><LanguageSwitcher /><ThemeSwitcher /><LoginButton />
        </div>
      </div>
    </header>
  )
}

/** where "Back" leads when the page was opened directly (no earlier in-app page to return to) */
const PARENT: Record<string, string> = { seek: 'choose-role', hire: 'choose-role', post: 'board', board: '', member: '', case: 'notifications', terms: '', safety: 'prepare', calendar: '', analytics: 'backoffice', language: 'prepare', sources: 'prepare', privacy: '', register: 'login', forgot: 'login', 'reset-password': 'login' }
/** "Back" on every page except the Lobby, so nobody has to return to the Lobby to go one step back */
export function BackButton({ route, compact }: { route: string; compact?: boolean }) {
  const { t } = useI18n()
  if (!route) return null
  return (
    <button type="button" onClick={() => goBack(PARENT[route] ?? '')}
      className={`${compact ? 'h-10 px-3 rounded-xl border border-control bg-surface' : 'mb-2 -ml-1 px-2 min-h-[36px] rounded-lg'} inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink hover:bg-surface3 transition-colors`}>
      <Icon name="back" size={16} />{t('m.back')}
    </button>
  )
}
