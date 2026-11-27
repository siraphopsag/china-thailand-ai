import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink, go } from '../store'
import { useMatch } from '../matchData'
import { SUPABASE_URL, useAuth, demoNumber } from '../auth'
import { addAnother, forgetAccount, forgetAllAccounts, switchTo, updateAccount, useAccounts, type SavedAccount } from '../accounts'
import { inbox } from '../domain/match/logic'
import { useChatUnread } from '../chatUnread'
import { Icon, type IconName } from './icons'
import { Meniscus, type Hue, type Slot } from './meniscus'

/** Count for the bell: exactly what the notifications page lists (see inbox in domain/match/logic.ts) */
export function useUnread(): number {
  const { st, now, pool, counts } = useMatch()
  return inbox(st, pool, now, (id) => counts[id]?.reserved ?? 0).count
}

type Item = { to: string; key: string; icon: IconName; match: string[] }
/** menu order (owner, Oct 2026): home, my pins / my posts, board, notifications, prepare, settings, help, back office (admin), profile last;
 *  v2 (owner, Nov 2026: the new systems must be easy to find): the contract check and the help page come after the calendar */
export function sideItems(role: 'seeker' | 'employer' | null, admin: boolean): Item[] {
  const items: Item[] = [{ to: '', key: 'm.home', icon: 'home', match: [''] }]
  if (role === 'seeker') items.push({ to: 'seek', key: 'm.pins', icon: 'pin', match: ['seek'] })
  if (role === 'employer') items.push({ to: 'hire', key: 'm.posts', icon: 'posts', match: ['hire'] })
  items.push({ to: 'board', key: 'm.board', icon: 'store', match: ['board', 'post'] }, { to: 'notifications', key: 'm.notif', icon: 'bell', match: ['notifications'] }, { to: 'chats', key: 'm.nav.chats', icon: 'chat', match: ['chats', 'chat'] }, { to: 'calendar', key: 'm.cal', icon: 'calendar', match: ['calendar'] }, { to: 'contract', key: 'm.nav.contract', icon: 'documents', match: ['contract'] }, { to: 'sos', key: 'm.nav.sos', icon: 'phone', match: ['sos'] },{ to: 'prepare', key: 'm.prepare', icon: 'culture', match: ['prepare', 'language', 'sources', 'ask'] }, { to: 'settings', key: 'm.settings', icon: 'settings', match: ['settings'] }, { to: 'help', key: 'm.help', icon: 'help', match: ['help'] })
  items.push({ to: 'member', key: 'm.member', icon: 'crown', match: ['member'] })
  if (admin) items.push({ to: 'backoffice', key: 'm.admin', icon: 'shield', match: ['backoffice'] }, { to: 'analytics', key: 'm.an.nav', icon: 'chart', match: ['analytics'] })
  items.push({ to: 'me', key: 'm.profile', icon: 'profile', match: ['me'] })
  return items
}
/** on phones the bottom bar keeps 5 main places; these go under "More" so the bar does not cover the screen */
export const MORE_KEYS = ['m.cal', 'm.nav.contract', 'm.nav.sos', 'm.prepare', 'm.member', 'm.settings', 'm.help', 'm.admin', 'm.an.nav', 'm.profile'] // profile: also behind the picture in the header
/**
 * Each place has its own colour (owner, Oct 2026: as in the reference): a bright bead (its icon in near-black, ≥ 7:1) and a label
 * colour that reads on the light (600–700 shades) and the dark (300–400 shades) plate.
 */
export const HUES: Record<string, Hue> = {
  'm.home': { bead: '#c9f24a', light: '#4d7c0f', dark: '#d9f99d' },
  'm.pins': { bead: '#fbbf24', light: '#b45309', dark: '#fcd34d' },
  'm.posts': { bead: '#fbbf24', light: '#b45309', dark: '#fcd34d' },
  'm.board': { bead: '#fb923c', light: '#c2410c', dark: '#fdba74' },
  'm.notif': { bead: '#fb7185', light: '#be123c', dark: '#fda4af' },
  'm.nav.chats': { bead: '#4ade80', light: '#15803d', dark: '#86efac' },
  'm.cal': { bead: '#38bdf8', light: '#0369a1', dark: '#7dd3fc' },
  'm.nav.contract': { bead: '#60a5fa', light: '#1d4ed8', dark: '#93c5fd' },
  'm.nav.sos': { bead: '#f87171', light: '#b91c1c', dark: '#fca5a5' },
  'm.prepare': { bead: '#2dd4bf', light: '#0f766e', dark: '#5eead4' },
  'm.settings': { bead: '#a78bfa', light: '#6d28d9', dark: '#c4b5fd' },
  'm.help': { bead: '#34d399', light: '#047857', dark: '#6ee7b7' },
  'm.member': { bead: '#facc15', light: '#a16207', dark: '#fde047' },
  'm.admin': { bead: '#818cf8', light: '#4338ca', dark: '#a5b4fc' },
  'm.an.nav': { bead: '#22d3ee', light: '#0e7490', dark: '#67e8f9' },
  'm.profile': { bead: '#e879f9', light: '#a21caf', dark: '#f0abfc' },
  'm.more': { bead: '#cbd5e1', light: '#475569', dark: '#cbd5e1' },
}
/** the "general" group of the capsule, set apart by a thin line from the places people work in */
const GENERAL = ['m.prepare', 'm.settings', 'm.help', 'm.member', 'm.admin', 'm.an.nav', 'm.profile']

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
  const chatUnread = useChatUnread()
  const items = sideItems(st.role, isAdmin)
  const main = items.filter((n) => !MORE_KEYS.includes(n.key)), more = items.filter((n) => MORE_KEYS.includes(n.key))
  const [moreOpen, setMoreOpen] = useState(false)
  const moreBtn = useRef<HTMLButtonElement>(null), moreList = useRef<HTMLUListElement>(null)
  useEffect(() => { setMoreOpen(false) }, [route])
  useEffect(() => {
    if (!moreOpen) return
    moreList.current?.querySelector<HTMLElement>('a[href]')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMoreOpen(false); moreBtn.current?.focus() } }
    // the bead sits on "More" while the list is open: a tap on it toggles the list there, so it is not "away"
    const away = (e: PointerEvent) => { const tg = e.target as Node; if (!moreList.current?.contains(tg) && !moreBtn.current?.contains(tg) && !(tg instanceof Element && tg.closest('.mn-bead'))) setMoreOpen(false) }
    document.addEventListener('keydown', esc); document.addEventListener('pointerdown', away)
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('pointerdown', away) }
  }, [moreOpen])
  const badgeOf = (n: Item) => (n.key === 'm.notif' ? unread : n.key === 'm.nav.chats' ? chatUnread : 0)
  const name = (n: Item) => (badgeOf(n) > 0 ? `${t(n.key as never)} · ${t('m.unread', { n: badgeOf(n) })}` : t(n.key as never))
  const moreOn = more.some((n) => n.match.includes(route))
  const slot = (n: Item, i: number, list: Item[]): Slot => ({ key: n.key, label: t(n.key as never), aria: name(n), icon: n.icon, hue: HUES[n.key] ?? HUES['m.more'], current: n.match.includes(route),
    to: n.to, badge: badgeOf(n) > 0 ? badgeOf(n) : undefined, split: GENERAL.includes(n.key) && !GENERAL.includes(list[i - 1]?.key ?? '') })
  const railSlots = items.map((n, i) => slot(n, i, items))
  const barSlots: Slot[] = [...main.map((n, i) => ({ ...slot(n, i, main), split: false })),
    { key: 'm.more', label: t('m.more'), aria: t('m.more'), icon: 'more', hue: HUES['m.more'], current: moreOpen || moreOn, focus: moreOpen, onPress: () => setMoreOpen((o) => !o), expanded: moreOpen, controls: 'nav-more', btnRef: moreBtn }]
  // dropping the bead on an item: go there (or open "More")
  const select = (s: Slot) => { if (s.to !== undefined) { setMoreOpen(false); go(s.to) } else s.onPress?.() }
  return (
    <>
      {/* computers and tablets: the rail on the left, centred in the space under the header; the bead flows up and down */}
      <Meniscus vertical slots={railSlots} label={t('m.side')} onSelect={select} className="nav-rail hidden md:block fixed left-4 top-[calc(50%+2rem)] -translate-y-1/2 z-30" />
      {/* phones: the bar at the bottom — 5 places + More; the bead flows sideways */}
      <Meniscus slots={barSlots} label={t('m.side')} onSelect={select} className="md:hidden fixed inset-x-3 z-40" style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }} />
      {/* the "More" list sits outside the capsule so its own glass can blur the page (a glass element cannot blur through
          another glass element); it comes right after the More button in the reading and Tab order */}
      <ul ref={moreList} id="nav-more" hidden={!moreOpen} className="glass-pop md:hidden fixed right-3 z-40 w-52 rounded-3xl p-1.5"
        style={{ bottom: 'calc(max(0.75rem, env(safe-area-inset-bottom)) + 6rem)' }}>
        {more.map((n) => { const on = n.match.includes(route); return (
          <li key={n.key}><NavLink to={n.to} aria-current={on ? 'page' : undefined}
            className={`nav-item !flex !justify-start gap-3 !rounded-2xl px-3 min-h-[44px] text-sm ${on ? 'nav-on font-semibold' : ''}`}><Icon name={n.icon} size={18} />{t(n.key as never)}</NavLink></li>) })}
      </ul>
    </>
  )
}

/**
 * Header account control. Signed out: "Log in" opens the sign-in page (e-mail + password or Google). Signed in: the picture (or
 * initial) opens a menu with the name, profile, back office for administrators and log out. Hidden when accounts are not set up
 * or the service is unreachable (the site then runs in its local demo mode).
 */
export function LoginButton() {
  const { t } = useI18n()
  const { status, online, user, isAdmin, signOut } = useAuth()
  const { st, mode } = useMatch()
  const accounts = useAccounts()
  const [menu, setMenu] = useState(false)
  const btn = useRef<HTMLButtonElement>(null), list = useRef<HTMLDivElement>(null)
  // the switcher shows each account with its role, learnt once the profile has loaded
  useEffect(() => { if (user && mode === 'remote') updateAccount(user.id, { name: user.name, role: st.role }) }, [user, mode, st.role])
  useEffect(() => {
    if (!menu) return
    list.current?.querySelector<HTMLElement>('a[href], button')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); btn.current?.focus() } }
    const away = (e: PointerEvent) => { const tg = e.target as Node; if (!list.current?.contains(tg) && !btn.current?.contains(tg)) setMenu(false) }
    document.addEventListener('keydown', esc); document.addEventListener('pointerdown', away)
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('pointerdown', away) }
  }, [menu])
  if (status === 'off' || (online === false && status !== 'signedIn')) return null
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
          <div className="px-3 py-2"><p className="font-semibold truncate">{demoNumber(user.name) ? t('m.demo.name', { n: demoNumber(user.name)! }) : user.name}</p>{user.email && <p className="text-xs text-muted truncate">{user.email}</p>}
            {isAdmin && <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><Icon name="shield" size={13} />{t('m.auth.admin')}</p>}</div>
          <NavLink to="me" className={item} onNavigate={() => setMenu(false)}><Icon name="profile" size={17} />{t('m.profile')}</NavLink>
          {isAdmin && <NavLink to="backoffice" className={item} onNavigate={() => setMenu(false)}><Icon name="shield" size={17} />{t('m.admin')}</NavLink>}
          <AccountList accounts={accounts.filter((a) => a.id !== user.id)} item={item} />
          <button type="button" className={item} onClick={() => { setMenu(false); addAnother(SUPABASE_URL) }}><Icon name="plus" size={17} />{t('ac2.add')}</button>
          <button type="button" className={item} onClick={async () => { setMenu(false); await signOut(); go('') }}><Icon name="logout" size={17} />{t('m.logout')}</button>
          {accounts.length > 1 && <button type="button" className={item} onClick={async () => { setMenu(false); forgetAllAccounts(); await signOut(); go('') }}><Icon name="logout" size={17} />{t('ac2.logoutAll')}</button>}
          <p className="px-3 pt-1 pb-2 text-[0.6875rem] text-muted leading-snug">{t('ac2.shared')}</p>
        </div>
      </div>
    )
  }
  return (
    <NavLink to="login" className="h-10 px-3 rounded-lg bg-primary text-onprimary text-sm font-medium flex items-center gap-1.5 hover:opacity-95">
      <Icon name="login" size={17} /><span className="sr-only sm:not-sr-only">{t('m.login')}</span>
    </NavLink>
  )
}

/** a remembered account's name as the menus show it (demo accounts by their number, in the reader's language) */
export function accountName(a: Pick<SavedAccount, 'name' | 'email'>, t: ReturnType<typeof useI18n>['t']) {
  const n = demoNumber(a.name); return n ? t('m.demo.name', { n }) : a.name || a.email
}
/** the other accounts remembered on this device: tap one to switch (owner, 23 Nov 2026), or remove it from the device */
export function AccountList({ accounts, item, title = true }: { accounts: SavedAccount[]; item: string; title?: boolean }) {
  const { t } = useI18n()
  if (!accounts.length) return null
  return (
    <div className="border-y border-line my-1 py-1" role="group" aria-label={t('ac2.switch')}>
      {title && <p className="px-3 pt-1 text-xs font-medium text-muted">{t('ac2.switch')}</p>}
      {accounts.map((a) => (
        <div key={a.id} className="flex items-center gap-1">
          <button type="button" className={`${item} flex-1 min-w-0`} onClick={() => { if (!switchTo(a.id, SUPABASE_URL)) forgetAccount(a.id) }}>
            <span aria-hidden className="h-7 w-7 shrink-0 rounded-full bg-brand text-brandfg grid place-items-center text-xs font-semibold">{accountName(a, t).slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{accountName(a, t)}</span>
              <span className="block truncate text-[0.6875rem] text-muted">{t(a.role ? (`m.role.${a.role}` as never) : 'ac2.role.none')}{a.email ? ` · ${a.email}` : ''}</span></span>
          </button>
          <button type="button" className="h-9 w-9 shrink-0 grid place-items-center rounded-lg text-muted hover:bg-surface3" aria-label={t('ac2.remove', { n: accountName(a, t) })} title={t('ac2.remove', { n: accountName(a, t) })} onClick={() => forgetAccount(a.id)}><Icon name="close" size={15} /></button>
        </div>))}
    </div>
  )
}
