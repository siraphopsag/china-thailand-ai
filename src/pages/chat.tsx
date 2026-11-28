// Chat and interview booking between the employer and the worker of one match (v2 model, owner Nov 2026). Opens once the worker
// has accepted the offer. Ready-made phrases go out in Thai and Chinese; typed text has contact details hidden; a signed-in person
// can have the AI translate a message. The employer offers up to three times, the worker picks one, and it shows in the calendar.
// Signed in, the conversation is shared through the database (shared.ts, SQL 0014) and new messages appear at once; the local demo
// and the offline kit keep it on this device (chatStore.ts), where either side can be tried with the side switch. The job seeker's
// introduction from the application is shown as the first message.
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { tr } from '../i18n/core'
import { useI18n } from '../i18n'
import { NavLink, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { MAX_SLOTS, MAX_STRIKES, MAX_TEXT, PHRASES, closedBy, strikesOf, newMessage, offerSlots, pickSlot, type Chat, type ChatMsg, type Side } from '../domain/match/chat'
import { ME, MY_EMPLOYER } from '../domain/match/types'
import { useChat } from '../chatStore'
import { CONTACT_MAX, contactOk, useContactShare } from '../contactShare'
import { isUuid, markRead, newId, useRemoteChat } from '../shared'
import { aiTranslate } from '../ai/client'
import type { AiTranslation } from '../ai/spec'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { Empty, Page, useApplicantName, useNames } from './match'

/** the demo match of the sample case (case-demo.tsx) */
export const DEMO_ACC = 'acc-demo'
const OPEN = ['accepted', 'confirmed', 'forwarded']
const PHONE = '(max-width: 767px)'
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
  const [full, setFull] = useState(true) // phones: the conversation fills the screen, like a messaging app
  // the side I am in this match (the data may arrive after the first render, e.g. when the chat link is opened directly)
  const preferred: Side = p?.employerId === MY_EMPLOYER && a?.seekerId !== ME ? 'employer' : 'seeker'
  const side: Side = picked && sides.includes(picked) ? picked : sides.includes(preferred) ? preferred : sides[0] ?? 'seeker'
  const remote = mode === 'remote' && !demo && isUuid(accId)
  // contact details can be exchanged once the case's documents step is done (owner, 28 Nov 2026; SQL 0026 decides when signed in)
  const unlockedHere = demo || !!st.cases.find((c) => c.accId === accId)?.steps.documents
  const [localChat, saveLocal] = useChat(accId, demo ? 'post-demo' : p?.id ?? '')
  const [remoteChat, saveRemote, problem, loaded] = useRemoteChat(remote ? accId : null)
  const chat: Chat = remote ? remoteChat : localChat
  // what was typed is only sent to the database; the device keeps the hidden version
  const save = (c: Chat) => (remote ? saveRemote(c) : saveLocal({ ...localChat, ...c, msgs: c.msgs.map(({ typed: _t, ...m }) => m) }))
  // opening the conversation marks what the other side wrote as read (the unread counts in the menu and the chat list)
  const lastAt = chat.msgs.length ? chat.msgs[chat.msgs.length - 1].at : ''
  useEffect(() => { if (remote && user && lastAt) markRead(user.id, accId, lastAt) }, [remote, user, accId, lastAt])
  // the chat's third violation ends the match (owner's blueprint, 27 Nov 2026); the database does it by itself (SQL 0017)
  const closed = closedBy(chat)
  useEffect(() => { if (closed && !remote && !demo && accId && a && !a.endedFor) endForContact(accId, closed) }, [closed, remote, demo, accId, a, endForContact])
  if (!demo && (!a || !p || !sides.length)) return <Page title={t('ch.title')}><Empty icon="bell" text={t('ch.none')} to="notifications" action={t('m.notif.title')} /></Page>
  if (!demo && !OPEN.includes(a!.status) && a!.endedFor !== 'contact') return <Page title={t('ch.title')}><Empty icon="bell" text={t('ch.notYet')} to={`post?id=${p!.id}`} action={t('m.bd.openFull')} /></Page>
  const position = demo ? t('c2.sample.position') : p!.position, company = demo ? t('c2.sample.company') : p!.company
  const worker = demo ? '李明 (LI MING)' : nameOf(a!)
  const at = new Date(now).toISOString()
  const other = side === 'seeker' ? company : worker
  // the introduction the job seeker wrote when applying opens the conversation
  const intro = !demo && a?.intro?.trim() ? { id: 'intro', from: 'seeker' as const, at: a.at, text: a.intro.trim() } : null
  const msgs = intro ? [intro, ...chat.msgs] : chat.msgs
  const switcher = sides.length > 1 ? (
    <div role="tablist" aria-label={t('ch.as')} className="flex gap-1 rounded-xl border border-line bg-surface p-1">{sides.map((s) => (
      <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`min-h-[36px] px-3 rounded-lg text-sm ${side === s ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`ch.side.${s}` as never)}</button>))}</div>) : null
  return (
    <Page title={t('ch.title')} sub={`${position} · ${company}`}>
      {/* phones: the chat is on top of everything (owner, 28 Nov 2026); "interview" in its bar shows this page again */}
      {!full && <button type="button" className="btn-primary w-full justify-center md:hidden" onClick={() => setFull(true)}><Icon name="chat" size={16} />{t('ch.backToChat')}</button>}
      <Warn tone="info">{t('ch.safe')}</Warn>
      {remote && problem && <Warn>{t(problem === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</Warn>}
      {sides.length > 1 && (
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{t('ch.as')}</span>
          {switcher}
          <span className="text-xs text-muted">{t('ch.asNote')}</span></div>)}
      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
        <Conversation key={side} full={full} onInterview={() => setFull(false)} onShare={() => { setFull(false); setTimeout(() => document.getElementById('ch-share')?.scrollIntoView({ block: 'start' }), 60) }} sub={`${position} · ${company}`} switcher={switcher} msgs={msgs} side={side} other={other} loading={remote && !loaded} introId={intro?.id} closed={closed} strikes={strikesOf(chat, side)}
          onSend={(input) => { const r = newMessage(chat, side, input, newId(), at); if (r.ok) save({ ...chat, ...r.value }); return r.ok ? r.masked : null }} />
        <div className="space-y-4 min-w-0">
          <InterviewBox chat={chat} side={side} at={at} nowLocal={localStamp(now)} onSave={(c) => save({ ...chat, ...c })} />
          <ContactShareCard key={side} acc={accId!} side={side} remote={remote} unlockedHere={unlockedHere} at={at} />
        </div>
      </div>
    </Page>
  )
}

/**
 * Phones (owner, 28 Nov 2026: the box was tiny, and scrolling back through the history moved the whole page): the conversation
 * covers the screen like a messaging app — a bar with back, the other side and "interview"; the messages scroll on their own
 * (the page behind does not move); the phrases on one swipeable line; the box to type at the bottom. Larger screens: a card.
 */
function Conversation({ full, onInterview, onShare, sub, switcher, msgs, side, other, onSend, loading, introId, closed, strikes }: { full: boolean; onInterview: () => void; onShare: () => void; sub: string; switcher: ReactNode; msgs: ChatMsg[]; side: Side; other: string; onSend: (i: { text?: string; phrase?: string }) => boolean | null; loading?: boolean; introId?: string; closed: Side | null; strikes: number }) {
  const { t } = useI18n()
  const N = useNames()
  const [text, setText] = useState('')
  const [masked, setMasked] = useState(false)
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length, full]) // newest at the bottom, in view
  // while it covers a phone screen the page behind stays still
  useEffect(() => {
    if (!full || !window.matchMedia(PHONE).matches) return
    const h = document.documentElement, before = h.style.overflow
    h.style.overflow = 'hidden'
    return () => { h.style.overflow = before }
  }, [full])
  const send = (e: FormEvent) => { e.preventDefault(); const r = onSend({ text }); if (r !== null) { setText(''); setMasked(r) } }
  return (
    <section className={`card !p-0 overflow-hidden flex flex-col ${full ? 'ch-full' : 'ch-away'}`} aria-labelledby="ch-h">
      <div className="shrink-0 border-b border-line flex items-center gap-2 px-2 md:px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 md:pt-3 ch-bar">
        <NavLink to="chats" className="md:hidden w-10 h-10 grid place-items-center rounded-full hover:bg-surface3 shrink-0" aria-label={t('ch.allChats')}><Icon name="left" size={20} /></NavLink>
        <div className="min-w-0 flex-1">
          <h2 id="ch-h" className="h2 flex items-center gap-2 min-w-0"><Icon name="users" size={18} className="text-primary shrink-0 hidden md:block" /><span className="truncate">{t('ch.with', { n: other })}</span></h2>
          <p className="md:hidden text-xs text-muted truncate">{sub}</p>
        </div>
        <button type="button" className="md:hidden btn-ghost text-sm !min-h-[40px] !px-3 shrink-0" onClick={onInterview}><Icon name="calendar" size={16} />{t('ch.interviewBtn')}</button>
      </div>
      {switcher && <div className="md:hidden shrink-0 px-3 py-2 border-b border-line flex items-center gap-2 ch-bar"><span className="text-xs font-medium">{t('ch.as')}</span>{switcher}</div>}
      <ol ref={list} className="ch-list flex-1 min-h-0 md:min-h-[16rem] md:max-h-[26rem] overflow-y-auto px-4 py-3 space-y-2" aria-live="polite">
        <li className="md:hidden text-xs text-muted text-center px-2 pb-1 flex items-start justify-center gap-1.5"><Icon name="info" size={13} className="mt-0.5 shrink-0" />{t('ch.safe')}</li>
        <li className="md:hidden flex justify-center"><button type="button" className="chip bg-surface border-line min-h-[32px] px-3" onClick={onShare}><Icon name="phone" size={13} />{t('cx.open')}</button></li>
        {msgs.length === 0 && <li className="text-sm text-muted text-center py-8">{t(loading ? 'c.loading' : 'ch.empty')}</li>}
        {msgs.map((m) => <Bubble key={m.id} m={m} mine={m.from === side} when={m.id === introId ? `${t('sh.intro')} · ${N.dayTime(Date.parse(m.at))}` : N.dayTime(Date.parse(m.at))} />)}
      </ol>
      {closed ? <p className="border-t border-line p-3 text-sm text-danger-fg flex items-start gap-2" role="status"><Icon name="alert" size={16} className="mt-0.5 shrink-0" />{t(closed === side ? 'ch.closed.me' : 'ch.closed.other', { max: MAX_STRIKES })}</p> : (
      <div className="shrink-0 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 ch-bar">
        <p className="text-xs font-medium sr-only md:not-sr-only">{t('ch.phrases')}</p>
        <div className="flex flex-nowrap md:flex-wrap gap-1.5 overflow-x-auto md:overflow-visible no-scrollbar -mx-3 px-3 md:mx-0 md:px-0">{PHRASES[side].map((k) => (
          <button key={k} type="button" className="chip bg-surface border-line min-h-[32px] px-3 hover:bg-surface3 shrink-0 whitespace-nowrap" onClick={() => { onSend({ phrase: k }); setMasked(false) }}>{t(`ch.p.${k}` as never)}</button>))}</div>
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
        {tx && tx !== 'busy' && tx !== 'fail' && <p className="mt-1 pt-1 border-t border-current/20 text-[0.8125rem] opacity-90">{tx[lang]}</p>}
        <p className="text-[0.625rem] opacity-70 mt-0.5 flex items-center gap-1.5">{when}{m.masked && <span>· {t('ch.hidden')}</span>}
          {canAi && !tx && <button type="button" className="underline" onClick={() => void translate()}>{t('ch.translate')}</button>}
          {tx === 'busy' && <span>{t('ch.translating')}</span>}{tx === 'fail' && <span>{t('ch.translateFail')}</span>}</p>
      </div>
    </li>
  )
}

/**
 * Exchanging contact details (owner, 28 Nov 2026): locked until the C.A.L.L. team has checked the contract and the documents (the
 * case's documents step); then each side gives a phone number, LINE or WeChat and agrees — each sees the other's only when both
 * have agreed, and either can take theirs back. The chat stays the official channel and keeps hiding contact details.
 */
function ContactShareCard({ acc, side, remote, unlockedHere, at }: { acc: string; side: Side; remote: boolean; unlockedHere: boolean; at: string }) {
  const { t } = useI18n()
  const { state, problem, agree, withdraw, simAgree } = useContactShare(acc, side, remote, unlockedHere, () => at)
  const [v, setV] = useState(''), [ok, setOk] = useState(false), [busy, setBusy] = useState(false)
  const s = state
  const run = async (f: () => Promise<boolean>) => { setBusy(true); await f(); setBusy(false) }
  return (
    <section id="ch-share" className="card space-y-3 scroll-mt-24" aria-labelledby="cx-h">
      <h2 id="cx-h" className="h2 flex items-center gap-2"><Icon name={s?.theirs ? 'ok' : s?.unlocked ? 'phone' : 'lock'} size={18} className="text-primary" />{t('cx.h')}</h2>
      {problem && <Warn>{t(problem === 'dbOld' ? 'cx.dbOld' : problem === 'locked' ? 'cx.locked' : 'sh.network')}</Warn>}
      {!s ? <p className="text-sm text-muted">{t('c.loading')}</p> : !s.unlocked ? (
        <><p className="text-sm">{t('cx.locked')}</p><p className="text-xs text-muted">{t('cx.why')}</p></>
      ) : s.theirs ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">{t('cx.theirs')}</p>
          <p className="text-lg font-bold break-words select-all rounded-xl border border-ok-line bg-ok-bg/40 px-3 py-2">{s.theirs}</p>
          <p className="text-xs text-muted">{t('cx.mineWas', { c: s.mine ?? '' })}</p>
          <Warn tone="info">{t('cx.after')} <NavLink to="sos" className="underline font-semibold">{t('cx.sos')}</NavLink></Warn>
          <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void run(withdraw)}>{t('cx.withdraw')}</button>
        </div>
      ) : s.meAt ? (
        <div className="space-y-2">
          <p className="text-sm flex items-center gap-2"><Icon name="hourglass" size={15} className="text-primary" />{t('cx.waiting')}</p>
          <p className="text-xs text-muted">{t('cx.mineWas', { c: s.mine ?? '' })}</p>
          <div className="flex flex-wrap gap-2">
            {s.sim && <button type="button" className="btn-soft text-sm" disabled={busy} onClick={() => void run(simAgree)}><Icon name="sim" size={15} />{t('cx.sim')}</button>}
            <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={() => void run(withdraw)}>{t('cx.withdraw')}</button>
          </div>
        </div>
      ) : (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (ok && contactOk(v)) void run(() => agree(v)) }}>
          <p className="text-sm">{t(s.themAt ? 'cx.themReady' : 'cx.open.d')}</p>
          <label className="block"><span className="label">{t('cx.mine')}</span><input className="input" maxLength={CONTACT_MAX} value={v} onChange={(e) => setV(e.target.value)} placeholder={t('cx.mine.ph')} autoComplete="off" /></label>
          <label className="flex items-start gap-2.5 text-sm"><input type="checkbox" className="mt-1 w-5 h-5 shrink-0" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>{t('cx.consent')}</span></label>
          <button type="submit" className="btn-primary" disabled={busy || !ok || !contactOk(v)}><Icon name="phone" size={16} />{t('cx.agree')}</button>
        </form>
      )}
    </section>
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
