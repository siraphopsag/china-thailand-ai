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
  const { st, isAdmin } = useMatch()
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
