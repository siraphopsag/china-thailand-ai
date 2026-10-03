import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { NavLink, go } from '../store'
import { useMatch } from '../matchData'
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
export function sideItems(role: 'seeker' | 'employer' | null, admin: boolean): Item[] {
  const items: Item[] = [
    { to: '', key: 'm.home', icon: 'home', match: [''] },
    { to: 'me', key: 'm.profile', icon: 'user', match: ['me'] },
    { to: 'notifications', key: 'm.notif', icon: 'bell', match: ['notifications'] },
  ]
  if (role === 'seeker') items.push({ to: 'seek', key: 'm.pins', icon: 'pin', match: ['seek'] })
  if (role === 'employer') items.push({ to: 'hire', key: 'm.posts', icon: 'posts', match: ['hire'] })
  items.push({ to: 'prepare', key: 'm.prepare', icon: 'culture', match: ['prepare', 'language', 'sources'] }, { to: 'settings', key: 'm.settings', icon: 'settings', match: ['settings'] }, { to: 'help', key: 'm.help', icon: 'help', match: ['help'] })
  if (admin) items.push({ to: 'backoffice', key: 'm.admin', icon: 'shield', match: ['backoffice'] })
  return items
}

/**
 * Side menu: an icon rail on large screens (labels appear when opened with the menu button), a drawer on small screens.
 * Icons are line symbols with accessible names.
 */
export function SideNav({ route, open, onClose }: { route: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { st, isAdmin } = useMatch()
  const unread = useUnread()
  const items = sideItems(st.role, isAdmin)
  useEffect(() => { onClose() }, [route]) // eslint-disable-line react-hooks/exhaustive-deps -- a new page closes the drawer
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])
  // small screens: the drawer is modal (WCAG 2.4.3, 2.4.11) — the page behind it is inert, focus moves into the drawer and,
  // unless a link was followed (the new page focuses its heading), returns to the menu button when the drawer closes
  const drawer = useRef<HTMLElement>(null)
  const followed = useRef(false)
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)')
    if (!open || wide.matches) return
    const body = document.getElementById('page-body')
    body?.setAttribute('inert', '')
    followed.current = false
    drawer.current?.querySelector<HTMLElement>('a[href]')?.focus()
    const resize = () => { if (wide.matches) onClose() }
    wide.addEventListener('change', resize)
    return () => {
      wide.removeEventListener('change', resize)
      body?.removeAttribute('inert')
      if (!followed.current) document.querySelector<HTMLElement>('[data-menu-button]')?.focus()
    }
  }, [open, onClose])
  const follow = () => { followed.current = true; onClose() }
  const list = (wide: boolean) => (
    <ul className="space-y-1">{items.map((n) => {
      const on = n.match.includes(route)
      const badge = n.key === 'm.notif' && unread > 0
      return (
        <li key={n.key}>
          <NavLink to={n.to} onNavigate={follow} aria-current={on ? 'page' : undefined} aria-label={badge ? `${t(n.key as never)} · ${t('m.unread', { n: unread })}` : t(n.key as never)}
            className={`relative flex items-center rounded-xl transition-colors ${wide ? 'gap-3 px-3 min-h-[44px]' : 'flex-col justify-center gap-0.5 w-[72px] mx-auto min-h-[56px] px-1 py-1.5 text-center'} ${on ? 'bg-brand text-brandfg font-semibold' : 'hover:bg-surface3 text-ink'}`}>
            {/* WCAG 1.4.1 / 1.4.11: the current page also gets a solid bar, not only a pale fill */}
            {on && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" aria-hidden />}
            <Icon name={n.icon} size={20} />
            {/* the label is always visible, also in the narrow rail */}
            <span className={wide ? 'text-sm' : 'text-[11px] leading-tight'}>{t(n.key as never)}</span>
            {badge && <span className={`absolute ${wide ? 'right-3' : 'top-1 right-3'} min-w-[18px] h-[18px] px-1 rounded-full bg-danger-fg text-page text-[11px] font-bold grid place-items-center`} aria-hidden>{unread}</span>}
          </NavLink>
        </li>)
    })}</ul>
  )
  return (
    <>
      {/* large screens: always-visible rail, widened when opened */}
      <nav aria-label={t('m.side')} className={`hidden lg:block fixed left-0 top-16 bottom-0 z-30 border-r border-line bg-surface/80 backdrop-blur-xl py-3 overflow-y-auto transition-[width] ${open ? 'w-56 px-2' : 'w-20'}`}>{list(open)}</nav>
      {/* small screens: drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 top-16 z-40">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('m.menu')} onClick={onClose} tabIndex={-1} />
          <nav ref={drawer} aria-label={t('m.side')} className="relative h-full w-64 max-w-[80vw] bg-surface border-r border-line p-3 overflow-auto">{list(true)}</nav>
        </div>)}
    </>
  )
}

/** Header button: "Log in" (administrator sign-in for now) or the signed-in state with log out. */
export function LoginButton() {
  const { t } = useI18n()
  const { isAdmin, login, logout } = useMatch()
  const [open, setOpen] = useState(false)
  const [id, setId] = useState(''), [pw, setPw] = useState('')
  const [bad, setBad] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const uidp = useId()
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
    const cancel = (e: Event) => { e.preventDefault(); setOpen(false) }
    d.addEventListener('cancel', cancel); return () => d.removeEventListener('cancel', cancel)
  }, [open])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (login(id, pw)) { setOpen(false); setPw(''); setBad(false); go('backoffice') } else setBad(true)
  }
  if (isAdmin) return (
    <div className="flex items-center gap-1.5">
      <NavLink to="backoffice" aria-label={t('m.admin')} title={t('m.admin')} className="h-10 px-3 rounded-lg border border-control text-sm flex items-center gap-1.5 hover:bg-surface3"><Icon name="shield" size={17} /><span className="hidden sm:inline">{t('m.admin')}</span></NavLink>
      <button type="button" className="h-10 w-10 rounded-lg border border-control grid place-items-center hover:bg-surface3" onClick={() => { logout(); go('') }} aria-label={t('m.logout')} title={t('m.logout')}><Icon name="logout" size={17} /></button>
    </div>)
  return (
    <>
      <button type="button" className="h-10 px-3 rounded-lg bg-primary text-onprimary text-sm font-medium flex items-center gap-1.5 hover:opacity-95" onClick={() => { setBad(false); setOpen(true) }}><Icon name="login" size={17} /><span className="hidden sm:inline">{t('m.login')}</span><span className="sr-only sm:hidden">{t('m.login')}</span></button>
      <dialog ref={ref} aria-labelledby={`${uidp}-t`} className="!m-auto rounded-2xl border border-line bg-surface text-ink p-0 w-[calc(100%-2rem)] max-w-sm backdrop:bg-black/50" onClose={() => setOpen(false)}>
        <form className="p-5 space-y-3" onSubmit={submit}>
          <h2 id={`${uidp}-t`} className="h2">{t('m.login.t')}</h2>
          <p className="text-sm text-muted">{t('m.login.d')}</p>
          <label className="block"><span className="label">{t('m.login.id')}</span><input className="input" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} required /></label>
          <label className="block"><span className="label">{t('m.login.pw')}</span><input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
          <div role="alert">{bad && <p className="text-sm text-danger-fg">{t('m.login.bad')}</p>}</div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t('jb.cancel')}</button><button type="submit" className="btn-primary">{t('m.login.go')}</button></div>
        </form>
      </dialog>
    </>
  )
}
