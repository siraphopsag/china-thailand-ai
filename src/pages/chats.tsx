// All my conversations in one place (owner, 23 Nov 2026: a real chat mode — before this a chat could only be found from the
// applicants list, the notifications or the case page). One row per application that is still open, newest activity first, with
// the last message and how many messages from the other side are unread. Signed in, the list comes from the database (shared.ts).
import { useMemo } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { loadChat } from '../chatStore'
import { ME, MY_EMPLOYER } from '../domain/match/types'
import type { Side } from '../domain/match/chat'
import { unreadOf, useChatSummaries, useReadMarks } from '../shared'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { Empty, Page, useApplicantName, useGate, useNames } from './match'

const OPEN = ['accepted', 'confirmed', 'forwarded']

export function ChatsPage() {
  const { t } = useI18n()
  const N = useNames()
  const gate = useGate('chats')
  const { st, mode } = useMatch()
  const { user } = useAuth()
  const nameOf = useApplicantName()
  const remote = mode === 'remote'
  const { list, problem } = useChatSummaries(remote)
  const marks = useReadMarks()
  const rows = useMemo(() => st.acceptances.filter((a) => OPEN.includes(a.status)).flatMap((a) => {
    const p = st.posts.find((x) => x.id === a.postId)
    if (!p || (a.seekerId !== ME && p.employerId !== MY_EMPLOYER)) return []
    const mySide: Side = a.seekerId === ME ? 'seeker' : 'employer'
    const s = list.find((x) => x.accId === a.id)
    const local = remote ? null : loadChat(a.id, p.id).msgs.slice(-1)[0] ?? null
    const last = s?.lastAt ? { at: s.lastAt, from: s.lastSide, text: s.lastText, phrase: s.lastPhrase } : local ? { at: local.at, from: local.from, text: local.text, phrase: local.phrase ?? null } : null
    const unread = remote && s && user ? unreadOf(s, user.id, marks) : 0
    return [{ a, p, mySide, last, unread, sort: last?.at ?? a.at }]
  }).sort((x, y) => (x.sort < y.sort ? 1 : -1)), [st.acceptances, st.posts, list, remote, user, marks])
  if (gate) return <Page title={t('sh.list.title')}>{gate}</Page>
  return (
    <Page title={t('sh.list.title')} sub={t('sh.list.sub')}>
      {remote && problem && <Warn>{t(problem === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</Warn>}
      {rows.length === 0 ? <Empty icon="chat" text={t(st.role === 'employer' ? 'sh.list.emptyEmployer' : 'sh.list.emptySeeker')} to={st.role === 'employer' ? 'hire' : 'board'} action={t(st.role === 'employer' ? 'm.posts' : 'm.board')} />
        : <ul className="space-y-2">{rows.map(({ a, p, mySide, last, unread }) => (
          <li key={a.id}><NavLink to={`chat?acc=${a.id}`} className={`card !p-3 flex items-center gap-3 hover:bg-surface3 ${unread ? 'border-primary/60' : ''}`}>
            <span aria-hidden className="h-10 w-10 shrink-0 rounded-full bg-brand text-brandfg grid place-items-center"><Icon name={mySide === 'seeker' ? 'business' : 'user'} size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2"><span className={`truncate ${unread ? 'font-bold' : 'font-semibold'}`}>{mySide === 'seeker' ? p.company : nameOf(a)}</span>
                {last && <span className="text-[0.6875rem] text-muted shrink-0">{N.dayTime(Date.parse(last.at))}</span>}</span>
              <span className="block text-xs text-muted truncate">{p.position} · {t(mySide === 'seeker' ? 'sh.list.asSeeker' : 'sh.list.asEmployer')}</span>
              <span className={`block text-sm truncate ${unread ? 'font-medium' : 'text-muted'}`}>
                {last ? `${last.from === mySide ? `${t('sh.list.you')}: ` : ''}${last.phrase ? t(`ch.p.${last.phrase}` as never) : last.text}` : a.intro?.trim() ? `${t('sh.intro')}: ${a.intro.trim()}` : t('sh.list.noMsg')}</span>
            </span>
            {unread > 0 && <span className="shrink-0 min-w-[1.5rem] h-6 px-1.5 rounded-full bg-primary text-onprimary text-xs font-bold grid place-items-center" aria-label={t('m.unread', { n: unread })}>{unread}</span>}
          </NavLink></li>))}</ul>}
    </Page>
  )
}
