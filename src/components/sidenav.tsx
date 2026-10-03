import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink, go } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { Modal } from './modal'
import { offersFor } from '../domain/match/logic'
import { MY_EMPLOYER } from '../domain/match/types'
import { Icon, type IconName } from './icons'

/** Unread count for the bell: open offers for a seeker, acceptances of my posts for an employer. */
export function useUnread(): number {
  const { st, now } = useMatch()
  if (st.role === 'seeker') return offersFor(st, st.me, now).filter((p) => !st.acceptances.some((a) => a.postId === p.id && a.seekerId === 'me')).length
  if (st.role === 'employer') { const mine = new Set(st.posts.filter((p) => p.employerId === MY_EMPLOYER).map((p) => p.id)); return st.acceptances.filter((a) => mine.has(a.postId)).length }
  return 0
}

type Item = { to: string; key: string; icon: IconName; match: string[] }
/** menu order (owner, Oct 2026): home, my pins / my posts, notifications, prepare, settings, help, back office (admin), profile last */
export function sideItems(role: 'seeker' | 'employer' | null, admin: boolean): Item[] {
  const items: Item[] = [{ to: '', key: 'm.home', icon: 'home', match: [''] }]
  if (role === 'seeker') items.push({ to: 'seek', key: 'm.pins', icon: 'pin', match: ['seek'] })
  if (role === 'employer') items.push({ to: 'hire', key: 'm.posts', icon: 'posts', match: ['hire'] })
  items.push({ to: 'notifications', key: 'm.notif', icon: 'bell', match: ['notifications'] }, { to: 'prepare', key: 'm.prepare', icon: 'culture', match: ['prepare', 'language', 'sources'] }, { to: 'settings', key: 'm.settings', icon: 'settings', match: ['settings'] }, { to: 'help', key: 'm.help', icon: 'help', match: ['help'] })
  if (admin) items.push({ to: 'backoffice', key: 'm.admin', icon: 'shield', match: ['backoffice'] })
  items.push({ to: 'me', key: 'm.profile', icon: 'profile', match: ['me'] })
  return items
}
/** on phones the bottom bar keeps 5 main places; these go under "More" so the bar does not cover the screen */
export const MORE_KEYS = ['m.settings', 'm.help', 'm.admin']

/**
 * Menu (owner, Oct 2026, after a reference he liked): a floating capsule of icons — on the left for computers and tablets
 * (768 px and wider), at the bottom for phones. Icons only; the page heading shows the name once you arrive. The current page
 * sits on a solid indigo pill (≥ 3:1, plus aria-current). Phones show 5 places + "More" (settings, help, back office).
 */
export function SideNav({ route }: { route: string }) {
  const { t } = useI18n()
  const { st } = useMatch()
  const { isAdmin } = useAuth()
  const unread = useUnread()
  const items = sideItems(st.role, isAdmin)
  const main = items.filter((n) => !MORE_KEYS.includes(n.key)), more = items.filter((n) => MORE_KEYS.includes(n.key))
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtn = useRef<HTMLButtonElement>(null), moreList = useRef<HTMLUListElement>(null)
  useEffect(() => { setMoreOpen(false) }, [route])
  useEffect(() => {
    if (!moreOpen) return
    moreList.current?.querySelector<HTMLElement>('a[href]')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoreOpen(false); moreBtn.current?.focus() } }
    const away = (e: PointerEvent) => { const tg = e.target as Node; if (!moreList.current?.contains(tg) && !moreBtn.current?.contains(tg)) setMoreOpen(false) }
    document.addEventListener('keydown', esc); document.addEventListener('pointerdown', away)
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('pointerdown', away) }
  }, [moreOpen])
  const name = (n: Item) => (n.key === 'm.notif' && unread > 0 ? `${t(n.key as never)} · ${t('m.unread', { n: unread })}` : t(n.key as never))
  const iconLink = (n: Item, size: 'lg' | 'sm') => {
    const on = n.match.includes(route)
    return (
      <NavLink to={n.to} aria-current={on ? 'page' : undefined} aria-label={name(n)}
        className={`nav-item ${size === 'lg' ? 'w-12 h-12' : 'w-11 h-11'} ${on ? 'nav-on' : ''}`}>
        <Icon name={n.icon} size={size === 'lg' ? 22 : 21} />
        {n.key === 'm.notif' && unread > 0 && <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-danger-fg text-page text-[10px] font-bold grid place-items-center" aria-hidden>{unread}</span>}
      </NavLink>)
  }
  const moreOn = more.some((n) => n.match.includes(route))
  return (
    <>
      {/* computers and tablets: floating capsule on the left, vertically centred */}
      <nav aria-label={t('m.side')} className="nav-pill hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1.5 p-2 rounded-full">
        <ul className="flex flex-col gap-1.5">{items.map((n) => <li key={n.key}>{iconLink(n, 'lg')}</li>)}</ul>
      </nav>
      {/* phones: floating capsule at the bottom — 5 places + More */}
      <nav aria-label={t('m.side')} className="nav-pill md:hidden fixed inset-x-3 z-40 rounded-full px-2 py-1.5" style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <ul className="flex items-center justify-around">
          {main.map((n) => <li key={n.key}>{iconLink(n, 'sm')}</li>)}
          <li>
            <button ref={moreBtn} type="button" aria-label={t('m.more')} aria-expanded={moreOpen} aria-controls="nav-more" onClick={() => setMoreOpen((o) => !o)}
              className={`nav-item w-11 h-11 ${moreOn ? 'nav-on' : ''}`}><Icon name="more" size={21} /></button>
          </li>
        </ul>
      </nav>
      {/* the "More" list sits outside the capsule so its own glass can blur the page (a glass element cannot blur through
          another glass element); it comes right after the More button in the reading and Tab order */}
      <ul ref={moreList} id="nav-more" hidden={!moreOpen} className="glass-pop md:hidden fixed right-3 z-40 w-52 rounded-3xl p-1.5"
        style={{ bottom: 'calc(max(0.75rem, env(safe-area-inset-bottom)) + 4.5rem)' }}>
        {more.map((n) => { const on = n.match.includes(route); return (
          <li key={n.key}><NavLink to={n.to} aria-current={on ? 'page' : undefined}
            className={`nav-item !flex !justify-start gap-3 !rounded-2xl px-3 min-h-[44px] text-sm ${on ? 'nav-on font-semibold' : ''}`}><Icon name={n.icon} size={18} />{t(n.key as never)}</NavLink></li>) })}
      </ul>
    </>
  )
}

/**
 * Header account control (owner, Oct 2026: Google sign-in first). Signed out: "Log in" opens a short notice of what is kept
 * (PDPA) and continues to Google. Signed in: the picture (or initial) opens a menu with the name, profile, back office for
 * administrators and log out. Without a configured sign-in service nothing is shown; if the service is down, the notice says so.
 */
export function LoginButton() {
  const { t } = useI18n()
  const { status, user, isAdmin, failed, signIn, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const btn = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => {
    if (!menu) return
    list.current?.querySelector<HTMLElement>('a[href], button')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); btn.current?.focus() } }
    const away = (e: PointerEvent) => { const tg = e.target as Node; if (!list.current?.contains(tg) && !btn.current?.contains(tg)) setMenu(false) }
    document.addEventListener('keydown', esc); document.addEventListener('pointerdown', away)
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('pointerdown', away) }
  }, [menu])
  if (status === 'off') return null
  if (status === 'loading') return <span className="h-10 w-10 rounded-full bg-surface3 animate-pulse" aria-hidden />
  if (status === 'signedIn' && user) {
    const item = 'w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2.5 min-h-[44px] hover:bg-surface3 text-sm'
    return (
      <div className="relative">
        <button ref={btn} type="button" aria-label={t('m.auth.menu', { name: user.name })} aria-expanded={menu} aria-controls="account-menu" onClick={() => setMenu((m) => !m)}
          className="h-10 w-10 rounded-full overflow-hidden border border-control bg-brand text-brandfg grid place-items-center font-semibold hover:opacity-90">
          {user.avatar ? <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <span aria-hidden>{user.name.slice(0, 1).toUpperCase()}</span>}
        </button>
        <div ref={list} id="account-menu" hidden={!menu} className="glass-pop absolute right-0 top-12 z-50 w-64 rounded-2xl p-1.5">
          <div className="px-3 py-2"><p className="font-semibold truncate">{user.name}</p><p className="text-xs text-muted truncate">{user.email}</p>
            {isAdmin && <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><Icon name="shield" size={13} />{t('m.auth.admin')}</p>}</div>
          <NavLink to="me" className={item} onNavigate={() => setMenu(false)}><Icon name="profile" size={17} />{t('m.profile')}</NavLink>
          {isAdmin && <NavLink to="backoffice" className={item} onNavigate={() => setMenu(false)}><Icon name="shield" size={17} />{t('m.admin')}</NavLink>}
          <button type="button" className={item} onClick={async () => { setMenu(false); await signOut(); go('') }}><Icon name="logout" size={17} />{t('m.logout')}</button>
        </div>
      </div>
    )
  }
  return (
    <>
      <button type="button" className="h-10 px-3 rounded-lg bg-primary text-onprimary text-sm font-medium flex items-center gap-1.5 hover:opacity-95" onClick={() => setOpen(true)}>
        <Icon name="login" size={17} /><span className="sr-only sm:not-sr-only">{t('m.login')}</span>
      </button>
      <Modal open={open} onClose={close}>{(id) => (<>
        <h2 id={id} className="h2">{t('m.auth.google')}</h2>
        <p className="text-sm">{t('m.auth.d')}</p>
        <ul className="text-xs text-muted space-y-1 list-disc pl-5"><li>{t('m.auth.optional')}</li><li>{t('m.auth.china')}</li></ul>
        <NavLink to="privacy" className="text-sm font-medium text-primary underline underline-offset-4 inline-flex min-h-[24px] items-center" onNavigate={close}>{t('m.auth.privacy')}</NavLink>
        <div role="status">{failed && <p className="text-sm text-danger-fg">{t('m.auth.fail')}</p>}</div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={close}>{t('jb.cancel')}</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); await signIn(); setBusy(false) }}>
            <GoogleMark />{t('m.auth.google')}</button>
        </div>
      </>)}</Modal>
    </>
  )
}
/** Google "G" mark (Google sign-in branding), drawn inline so no image is fetched from Google before the visitor agrees */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="bg-white rounded-full p-0.5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.6 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C1 16.5 0 20.1 0 24s1 7.5 2.7 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
