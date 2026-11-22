// Chat and interview booking between the employer and the worker of one match (v2 model, owner Nov 2026). Opens once the worker
// has accepted the offer. Ready-made phrases go out in Thai and Chinese; typed text has contact details hidden; a signed-in person
// can have the AI translate a message. The employer offers up to three times, the worker picks one, and it shows in the calendar.
// Prototype: kept on this device (chatStore.ts); in the local demo either side can be tried with the side switch.
import { useState, type FormEvent } from 'react'
import { tr } from '../i18n/core'
import { useI18n } from '../i18n'
import { NavLink, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { MAX_SLOTS, MAX_TEXT, PHRASES, newMessage, offerSlots, pickSlot, type ChatMsg, type Side } from '../domain/match/chat'
import { ME, MY_EMPLOYER } from '../domain/match/types'
import { useChat } from '../chatStore'
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
  const { st, mode, now } = useMatch()
  const nameOf = useApplicantName()
  const accId = useSearchParam('acc')
  const a = st.acceptances.find((x) => x.id === accId)
  const p = a && st.posts.find((x) => x.id === a.postId)
  const demo = accId === DEMO_ACC
  const sides: Side[] = demo || mode === 'local' ? ['seeker', 'employer']
    : [...(a?.seekerId === ME ? ['seeker' as const] : []), ...(p?.employerId === MY_EMPLOYER ? ['employer' as const] : [])]
  const [side, setSide] = useState<Side>(p?.employerId === MY_EMPLOYER && a?.seekerId !== ME ? 'employer' : 'seeker')
  const [chat, save] = useChat(accId, demo ? 'post-demo' : p?.id ?? '')
  if (!demo && (!a || !p || !sides.length)) return <Page title={t('ch.title')}><Empty icon="bell" text={t('ch.none')} to="notifications" action={t('m.notif.title')} /></Page>
  if (!demo && !OPEN.includes(a!.status)) return <Page title={t('ch.title')}><Empty icon="bell" text={t('ch.notYet')} to={`post?id=${p!.id}`} action={t('m.bd.openFull')} /></Page>
  const position = demo ? t('c2.sample.position') : p!.position, company = demo ? t('c2.sample.company') : p!.company
  const worker = demo ? 'SOMCHAI J.' : nameOf(a!)
  const at = new Date(now).toISOString()
  const other = side === 'seeker' ? company : worker
  return (
    <Page title={t('ch.title')} sub={`${position} · ${company}`}>
      <Warn tone="info">{t('ch.safe')}</Warn>
      {sides.length > 1 && (
        <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{t('ch.as')}</span>
          <div role="tablist" aria-label={t('ch.as')} className="flex gap-1 rounded-xl border border-line bg-surface p-1">{sides.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={side === s} onClick={() => setSide(s)} className={`min-h-[36px] px-3 rounded-lg text-sm ${side === s ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`ch.side.${s}` as never)}</button>))}</div>
          <span className="text-xs text-muted">{t('ch.asNote')}</span></div>)}
      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4 items-start">
        <Conversation key={side} msgs={chat.msgs} side={side} other={other}
          onSend={(input) => { const r = newMessage(chat, side, input, `m-${Date.now()}-${chat.msgs.length}`, at); if (r.ok) save({ ...chat, ...r.value }); return r.ok ? r.masked : null }} />
        <InterviewBox chat={chat} side={side} at={at} nowLocal={localStamp(now)} onSave={(c) => save({ ...chat, ...c })} />
      </div>
    </Page>
  )
}

function Conversation({ msgs, side, other, onSend }: { msgs: ChatMsg[]; side: Side; other: string; onSend: (i: { text?: string; phrase?: string }) => boolean | null }) {
  const { t } = useI18n()
  const N = useNames()
  const [text, setText] = useState('')
  const [masked, setMasked] = useState(false)
  const send = (e: FormEvent) => { e.preventDefault(); const r = onSend({ text }); if (r !== null) { setText(''); setMasked(r) } }
  return (
    <section className="card !p-0 overflow-hidden flex flex-col" aria-labelledby="ch-h">
      <h2 id="ch-h" className="h2 px-4 pt-3 pb-2 border-b border-line flex items-center gap-2"><Icon name="users" size={18} className="text-primary" />{t('ch.with', { n: other })}</h2>
      <ol className="flex-1 min-h-[16rem] max-h-[26rem] overflow-y-auto px-4 py-3 space-y-2" aria-live="polite">
        {msgs.length === 0 && <li className="text-sm text-muted text-center py-8">{t('ch.empty')}</li>}
        {msgs.map((m) => <Bubble key={m.id} m={m} mine={m.from === side} when={N.dayTime(Date.parse(m.at))} />)}
      </ol>
      <div className="border-t border-line p-3 space-y-2">
        <p className="text-xs font-medium">{t('ch.phrases')}</p>
        <div className="flex flex-wrap gap-1.5">{PHRASES[side].map((k) => (
          <button key={k} type="button" className="chip bg-surface border-line min-h-[32px] px-3 hover:bg-surface3" onClick={() => { onSend({ phrase: k }); setMasked(false) }}>{t(`ch.p.${k}` as never)}</button>))}</div>
        <form className="flex gap-2" onSubmit={send}>
          <input className="input flex-1" maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('ch.type')} aria-label={t('ch.type')} />
          <button type="submit" className="btn-primary" disabled={!text.trim()}><Icon name="send" size={16} />{t('ch.send')}</button>
        </form>
        {masked && <p className="text-xs text-warn-fg" role="status">{t('ch.masked')}</p>}
      </div>
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
