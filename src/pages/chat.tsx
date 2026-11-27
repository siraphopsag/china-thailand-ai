// Chat and interview booking between the employer and the worker of one match (v2 model, owner Nov 2026). Opens once the worker
// has accepted the offer. Ready-made phrases go out in Thai and Chinese; typed text has contact details hidden; a signed-in person
// can have the AI translate a message. The employer offers up to three times, the worker picks one, and it shows in the calendar.
// Signed in, the conversation is shared through the database (shared.ts, SQL 0014) and new messages appear at once; the local demo
// and the offline kit keep it on this device (chatStore.ts), where either side can be tried with the side switch. The job seeker's
// introduction from the application is shown as the first message.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { tr } from '../i18n/core'
import { useI18n } from '../i18n'
import { NavLink, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { MAX_SLOTS, MAX_STRIKES, MAX_TEXT, PHRASES, closedBy, strikesOf, newMessage, offerSlots, pickSlot, type Chat, type ChatMsg, type Side } from '../domain/match/chat'
import { ME, MY_EMPLOYER } from '../domain/match/types'
import { useChat } from '../chatStore'
import { isUuid, markRead, newId, useRemoteChat } from '../shared'
import { aiTranslate } from '../ai/client'
import type { AiTranslation } from '../ai/spec'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { Empty, Page, useApplicantName, useNames } from './match'

/** the demo match of the sample case (case-demo.tsx) */
export const DEMO_ACC = 'acc-demo'
const OPEN = ['accepted', 'confirmed', 'forwarded']
const pad = (n: number) => String(n).padStart(2, '0')
const localStamp = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }

export function ChatPage() {
  const { t } = useI18n()
  const { st, mode, now, endForContact } = useMatch()
  const { user } = useAuth()
  const nameOf = useApplicantName()
  const accId = useSearchParam('acc')
  const a = st.acceptances.find((x) => x.id === accId)
  const p = a && st.posts.find((x) => x.id === a.postId)
  const demo = accId === DEMO_ACC
  const sides: Side[] = demo || mode === 'local' ? ['seeker', 'employer']
    : [...(a?.seekerId === ME ? ['seeker' as const] : []), ...(p?.employerId === MY_EMPLOYER ? ['employer' as const] : [])]
  const [picked, setSide] = useState<Side | null>(null)
  // the side I am in this match (the data may arrive after the first render, e.g. when the chat link is opened directly)
  const preferred: Side = p?.employerId === MY_EMPLOYER && a?.seekerId !== ME ? 'employer' : 'seeker'
  const side: Side = picked && sides.includes(picked) ? picked : sides.includes(preferred) ? preferred : sides[0] ?? 'seeker'
  const remote = mode === 'remote' && !demo && isUuid(accId)
  const [localChat, saveLocal] = useChat(accId, demo ? 'post-demo' : p?.id ?? '')
  const [remoteChat, saveRemote, problem, loaded] = useRemoteChat(remote ? accId : null)
  const chat: Chat = remote ? remoteChat : localChat
  const save = (c: Chat) => (remote ? saveRemote(c) : saveLocal({ ...localChat, ...c }))
  // opening the conversation marks what the other side wrote as read (the unread counts in the menu and the chat list)
  const lastAt = chat.msgs.length ? chat.msgs[chat.msgs.length - 1].at : ''
  useEffect(() => { if (remote && user && lastAt) markRead(user.id, accId, lastAt) }, [remote, user, accId, lastAt])
  // the chat's third violation ends the match (owner's blueprint, 27 Nov 2026); the database does it by itself (SQL 0017)
  const closed = closedBy(chat)
  useEffect(() => { if (closed && !remote && !demo && accId && a && !a.endedFor) endForContact(accId, closed) }, [closed, remote, demo, accId, a, endForContact])
  if (!demo && (!a || !p || !sides.length)) return <Page title={t('ch.title')}><Empty icon="bell" text={t('ch.none')} to="notifications" action={t('m.notif.title')} /></Page>
  if (!demo && !OPEN.includes(a!.status)) return <Page title={t('ch.title')}><Empty icon="bell" text={t('ch.notYet')} to={`post?id=${p!.id}`} action={t('m.bd.openFull')} /></Page>
  const position = demo ? t('c2.sample.position') : p!.position, company = demo ? t('c2.sample.company') : p!.company
  const worker = demo ? '李明 (LI MING)' : nameOf(a!)
  const at = new Date(now).toISOString()
  const other = side === 'seeker' ? company : worker
  // the introduction the job seeker wrote when applying opens the conversation
  const intro = !demo && a?.intro?.trim() ? { id: 'intro', from: 'seeker' as const, at: a.at, text: a.intro.trim() } : null
  const msgs = intro ? [intro, ...chat.msgs] : chat.msgs
  return (
    <Page title={t('ch.title')} sub={`${position} · ${company}`}>
      <Warn tone="info">{t('ch.safe')}</Warn>
      {remote && problem && <Warn>{t(problem === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</Warn>}
      {sides.length > 1 && (
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{t('ch.as')}</span>
          <div role="tablist" aria-label={t('ch.as')} className="flex gap-1 rounded-xl border border-line bg-surface p-1">{sides.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`min-h-[36px] px-3 rounded-lg text-sm ${side === s ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`ch.side.${s}` as never)}</button>))}</div>
          <span className="text-xs text-muted">{t('ch.asNote')}</span></div>)}
      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
        <Conversation key={side} msgs={msgs} side={side} other={other} loading={remote && !loaded} introId={intro?.id} closed={closed} strikes={strikesOf(chat, side)}
          onSend={(input) => { const r = newMessage(chat, side, input, newId(), at); if (r.ok) save({ ...chat, ...r.value }); return r.ok ? r.masked : null }} />
        <InterviewBox chat={chat} side={side} at={at} nowLocal={localStamp(now)} onSave={(c) => save({ ...chat, ...c })} />
      </div>
    </Page>
  )
}

function Conversation({ msgs, side, other, onSend, loading, introId, closed, strikes }: { msgs: ChatMsg[]; side: Side; other: string; onSend: (i: { text?: string; phrase?: string }) => boolean | null; loading?: boolean; introId?: string; closed: Side | null; strikes: number }) {
  const { t } = useI18n()
  const N = useNames()
  const [text, setText] = useState('')
  const [masked, setMasked] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length]) // newest at the bottom, in view
  const send = (e: FormEvent) => { e.preventDefault(); const r = onSend({ text }); if (r !== null) { setText(''); setMasked(r) } }
  return (
    <section className="card !p-0 overflow-hidden flex flex-col" aria-labelledby="ch-h">
      <h2 id="ch-h" className="h2 px-4 pt-3 pb-2 border-b border-line flex items-center gap-2"><Icon name="users" size={18} className="text-primary" />{t('ch.with', { n: other })}</h2>
      <ol ref={list} className="flex-1 min-h-[16rem] max-h-[26rem] overflow-y-auto px-4 py-3 space-y-2" aria-live="polite">
        {msgs.length === 0 && <li className="text-sm text-muted text-center py-8">{t(loading ? 'c.loading' : 'ch.empty')}</li>}
        {msgs.map((m) => <Bubble key={m.id} m={m} mine={m.from === side} when={m.id === introId ? `${t('sh.intro')} · ${N.dayTime(Date.parse(m.at))}` : N.dayTime(Date.parse(m.at))} />)}
      </ol>
      {closed ? <p className="border-t border-line p-3 text-sm text-danger-fg flex items-start gap-2" role="status"><Icon name="alert" size={16} className="mt-0.5 shrink-0" />{t(closed === side ? 'ch.closed.me' : 'ch.closed.other', { max: MAX_STRIKES })}</p> : (
      <div className="border-t border-line p-3 space-y-2">
        <p className="text-xs font-medium">{t('ch.phrases')}</p>
        <div className="flex flex-wrap gap-1.5">{PHRASES[side].map((k) => (
          <button key={k} type="button" className="chip bg-surface border-line min-h-[32px] px-3 hover:bg-surface3" onClick={() => { onSend({ phrase: k }); setMasked(false) }}>{t(`ch.p.${k}` as never)}</button>))}</div>
        <form className="flex gap-2" onSubmit={send}>
          <input className="input flex-1" maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ch.type')} aria-label={t('ch.type')} />
          <button type="submit" className="btn-primary" disabled={!text.trim()}><Icon name="send" size={16} />{t('ch.send')}</button>
        </form>
        {masked && <p className="text-xs text-warn-fg" role="status">{t('ch.strike', { n: strikes, max: MAX_STRIKES })}</p>}
      </div>)}
    </section>
  )
}
function Bubble({ m, mine, when }: { m: ChatMsg; mine: boolean; when: string }) {
  const { t, lang } = useI18n()
  const { status, online } = useAuth()
  const [tx, setTx] = useState<AiTranslation | 'busy' | 'fail' | null>(null)
  const canAi = status === 'signedIn' && online !== false && !m.phrase
  const translate = async () => { setTx('busy'); const r = await aiTranslate(m.text, lang); setTx(r.ok ? r.result : 'fail') }
  return (
    <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`ch-bubble ${mine ? 'ch-mine' : 'ch-theirs'}`}>
        {m.phrase ? (<>
          <p lang="th">{tr(`ch.p.${m.phrase}.full` as never, undefined, 'th')}</p>
          <p lang="zh-CN" className="opacity-90">{tr(`ch.p.${m.phrase}.full` as never, undefined, 'zh')}</p>
        </>) : <p className="whitespace-pre-wrap break-words">{m.text}</p>}
        {tx && tx !== 'busy' && tx !== 'fail' && <p className="mt-1 pt-1 border-t border-current/20 text-[13px] opacity-90">{tx[lang]}</p>}
        <p className="text-[10px] opacity-70 mt-0.5 flex items-center gap-1.5">{when}{m.masked && <span>· {t('ch.hidden')}</span>}
          {canAi && !tx && <button type="button" className="underline" onClick={() => void translate()}>{t('ch.translate')}</button>}
          {tx === 'busy' && <span>{t('ch.translating')}</span>}{tx === 'fail' && <span>{t('ch.translateFail')}</span>}</p>
      </div>
    </li>
  )
}

function InterviewBox({ chat, side, at, nowLocal, onSave }: { chat: Parameters<typeof offerSlots>[0]; side: Side; at: string; nowLocal: string; onSave: (c: Parameters<typeof offerSlots>[0]) => void }) {
  const { t, lang } = useI18n()
  const iv = chat.interview
  const [slots, setSlots] = useState<string[]>(['', '', ''])
  const [mode, setMode] = useState<'video' | 'onsite'>('video')
  const [err, setErr] = useState('')
  const [redo, setRedo] = useState(false)
  const fmt = (s: string) => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : lang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(s))
  const offer = (e: FormEvent) => { e.preventDefault(); const r = offerSlots(chat, slots, mode, at, nowLocal); if (!r.ok) { setErr(t(`ch.iv.err.${r.problem}` as never)); return } setErr(''); setRedo(false); onSave(r.value) }
  return (
    <section className="card space-y-3" aria-labelledby="iv-h">
      <h2 id="iv-h" className="h2 flex items-center gap-2"><Icon name="calendar" size={18} className="text-primary" />{t('ch.iv.h')}</h2>
      {iv?.chosen ? (
        <div className="rounded-xl border border-ok-line bg-ok-bg p-3 space-y-1">
          <p className="font-semibold text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('ch.iv.booked')}</p>
          <p className="text-lg font-bold">{fmt(iv.chosen)}</p>
          <p className="text-sm">{t(`ch.iv.mode.${iv.mode}` as never)}</p>
          <NavLink to="calendar" className="text-sm text-primary underline underline-offset-4 inline-flex items-center gap-1"><Icon name="calendar" size={14} />{t('m.cs.seeCal')}</NavLink>
        </div>
      ) : iv && !redo ? (
        side === 'seeker' ? (
          <div className="space-y-2"><p className="text-sm">{t('ch.iv.pick', { m: t(`ch.iv.mode.${iv.mode}` as never) })}</p>
            <ul className="space-y-1.5">{iv.slots.map((s) => (
              <li key={s}><button type="button" className="w-full min-h-[44px] rounded-xl border border-primary/60 px-3 text-left hover:bg-brand flex items-center justify-between gap-2" onClick={() => { const c = pickSlot(chat, s, at); if (c) onSave(c) }}>
                <span className="font-medium">{fmt(s)}</span><Icon name="next" size={16} /></button></li>))}</ul></div>
        ) : (
          <div className="space-y-2"><p className="text-sm text-muted">{t('ch.iv.waiting')}</p>
            <ul className="text-sm space-y-1">{iv.slots.map((s) => <li key={s} className="flex items-center gap-2"><Icon name="clock" size={14} />{fmt(s)}</li>)}</ul>
            <button type="button" className="btn-ghost text-sm" onClick={() => setRedo(true)}>{t('ch.iv.change')}</button></div>
        )
      ) : side === 'employer' ? (
        <form className="space-y-2" onSubmit={offer}>
          <p className="text-sm text-muted">{t('ch.iv.offerD', { n: MAX_SLOTS })}</p>
          {slots.map((s, i) => <input key={i} type="datetime-local" className="input w-full" value={s} min={nowLocal} aria-label={t('ch.iv.slot', { n: i + 1 })} onChange={(e) => setSlots((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />)}
          <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 w-fit" role="radiogroup" aria-label={t('ch.iv.modeL')}>
            {(['video', 'onsite'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`min-h-[34px] px-3 rounded-lg text-sm ${mode === m ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`ch.iv.mode.${m}` as never)}</button>)}
          </div>
          {err && <p className="text-sm text-danger-fg" role="alert">{err}</p>}
          <button type="submit" className="btn-primary"><Icon name="send" size={16} />{t('ch.iv.offer')}</button>
        </form>
      ) : <p className="text-sm text-muted">{t('ch.iv.none')}</p>}
    </section>
  )
}
