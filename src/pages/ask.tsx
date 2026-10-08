/**
 * The real AI on screen (owner, Oct 2026 — "A + B" for the AI + Law competition).
 *  A) AiCheckResult: what the AI found in a job post before it goes out (used in the employer's "Check and post" step, hire.tsx).
 *  B) AskPage: the legal Q&A assistant — one question, an answer grounded in the site's legal records, the records it used, a next step.
 * AI text is shown as plain text (React escapes it). Every AI result says it can be wrong and is not legal advice.
 */
import { useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { messages } from '../locales'
import { useAuth } from '../auth'
import { NavLink } from '../store'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { getReg, regText } from '../data/regulations'
import { aiAsk } from '../ai/client'
import { useLite } from '../theme'
import MorphChat, { RevealText, type ChatTurn, type OrbCopy } from '../components/morph-orb'
import { MAX_HISTORY, MAX_QUESTION, type AiAnswer, type AiCheck, type AiResponse, type AskTurn } from '../ai/spec'
import { Page } from './match'

/** a legal record the AI relied on: its title (or the instrument's name), its agency link and whether a lawyer has checked it */
function LawRef({ id }: { id: string }) {
  const { t } = useI18n()
  const r = getReg(id)
  if (!r) return null
  const title = `reg.${id}.title` in messages ? regText(id, 'title') : (r.instrument ?? r.originalTerm ?? id)
  return (
    <li className="text-sm flex flex-wrap items-baseline gap-x-2">
      <span className="font-medium">{title}</span>
      <a href={r.textUrl ?? r.agencyUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 text-xs inline-flex items-center gap-0.5">{t('ai.ask.official')}<Icon name="external" size={12} /></a>
      {r.trust !== 'VERIFIED' && <span className="text-xs text-warn-fg">· {t('ai.ask.unverified')}</span>}
    </li>
  )
}

const SEV_TONE = { high: 'border-danger-line bg-danger-bg text-danger-fg', medium: 'border-warn-line bg-warn-bg text-warn-fg', low: 'border-line bg-surface3 text-muted' } as const
const VERDICT = { ok: ['ok', 'text-ok-fg'], review: ['warn', 'text-warn-fg'], high_risk: ['alert', 'text-danger-fg'] } as const

export function AiCheckResult({ res, left }: { res: AiCheck; left: number | null }) {
  const { t } = useI18n()
  const [icon, tone] = VERDICT[res.verdict]
  return (
    <div className="space-y-3">
      <p className={`font-semibold flex items-center gap-1.5 ${tone}`}><Icon name={icon} size={18} />{t(`ai.chk.v.${res.verdict}`)}</p>
      {res.summary && <p className="text-sm">{res.summary}</p>}
      {res.flags.length > 0 && <ol className="space-y-2.5">{res.flags.map((f, i) => (
        <li key={i} className="card-i !p-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`chip border ${SEV_TONE[f.severity]}`}>{t(`ai.sev.${f.severity}`)}</span>
            <span className="chip bg-surface3">{t(`ai.cat.${f.category}`)}</span>
          </div>
          {f.quote && <p className="text-sm"><span className="text-xs text-muted block">{t('ai.chk.quote')}</span><q className="italic">{f.quote}</q></p>}
          <p className="text-sm">{f.explanation}</p>
          {f.suggestion && <p className="text-sm"><span className="text-xs text-muted block">{t('ai.chk.fixIt')}</span>{f.suggestion}</p>}
          {f.lawIds.length > 0 && <div><span className="text-xs text-muted">{t('ai.chk.laws')}</span><ul className="space-y-0.5">{f.lawIds.map((id) => <LawRef key={id} id={id} />)}</ul></div>}
        </li>))}</ol>}
      <p className="text-xs text-muted">{t('ai.chk.note')}{left !== null && <> · {t('ai.left', { n: left })}</>}</p>
    </div>
  )
}

/** a record the AI relied on, inside the dark answer card */
function StageLawRef({ id }: { id: string }) {
  const { t } = useI18n()
  const r = getReg(id)
  if (!r) return null
  const title = `reg.${id}.title` in messages ? regText(id, 'title') : (r.instrument ?? r.originalTerm ?? id)
  return (
    <li className="mo-src">
      <span className="mo-src-title">{title}</span>
      <a href={r.textUrl ?? r.agencyUrl} target="_blank" rel="noopener noreferrer" className="mo-link">{t('ai.ask.official')}<Icon name="external" size={12} /></a>
      {r.trust !== 'VERIFIED' && <span className="mo-src-warn">· {t('ai.ask.unverified')}</span>}
    </li>
  )
}

/**
 * The AI legal assistant (owner, Oct 2026): a chat. Computers: the question card on the left, the conversation on a stage on the
 * right; phones: the conversation fills the screen and the pill sits at the bottom, like an AI chat app. Each question turns the pill
 * into a "thinking orb" that flies into the chat and unfolds into the answer (components/morph-orb.tsx, from the owner's sample).
 * The chat lives only on this page (gone when you leave); the last two exchanges go along so follow-up questions are understood.
 */
type Res = AiResponse<AiAnswer>
const DEMO_ANSWER: AiAnswer = { grounding: 'grounded', lawIds: ['th-labour', 'cn-immigration'], nextStep: 'ตรวจกับกรมการจัดหางาน หรือสายด่วน 1694', answer: 'คนจีนที่จะทำงานในไทยต้องได้รับอนุญาตให้ทำงาน (Work Permit) และมีสถานะการเข้าเมืองที่ตรงกับงาน\n• นายจ้างเป็นผู้ยื่นขอใบอนุญาตทำงาน\n• บางอาชีพสงวนไว้สำหรับคนไทย\nข้อมูลนี้ยังไม่ได้ตรวจโดยนักกฎหมาย' }
export function AskPage() {
  const { t, lang } = useI18n()
  const { status, online } = useAuth()
  const lite = useLite()
  const [turns, setTurns] = useState<ChatTurn<Res>[]>([])
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const nextId = useRef(1)
  // local development only (?orbdemo, or ?orbdemo=fail): try the chat without an account or an AI key — not in the built site
  const demo = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('orbdemo') : null
  const canUse = (status === 'signedIn' && online !== false) || demo !== null
  const copy: OrbCopy = useMemo(() => ({
    placeholder: t('ai.orb.ph'), field: t('ai.orb.more'), send: t('ai.ask.send'), answerTitle: t('ai.ask.answer'), reset: t('ai.ask.again'), done: t('ai.orb.done'),
    labels: [t('ai.orb.l1'), t('ai.orb.l2'), t('ai.orb.l3'), t('ai.orb.l4')],
  }), [t])
  const onAsk = async (text: string) => {
    const id = nextId.current++
    const history: AskTurn[] = turnsRef.current.filter((x) => x.res?.ok).slice(-MAX_HISTORY).map((x) => ({ q: x.q, a: x.res && x.res.ok ? x.res.result.answer : '' }))
    setTurns((xs) => [...xs, { id, q: text, res: null }])
    const r: Res = demo !== null ? await new Promise((ok) => setTimeout(() => ok(demo === 'fail' ? { ok: false, reason: 'busy' } : { ok: true, left: 17, result: DEMO_ANSWER }), 5000)) : await aiAsk(text, lang, history)
    setTurns((xs) => xs.map((x) => (x.id === id ? { ...x, res: r } : x)))
    return r.ok
  }
  const left = [...turns].reverse().find((x) => x.res?.ok)
  const leftN = left && left.res && left.res.ok ? left.res.left : null
  const renderAnswer = (x: ChatTurn<Res>) => {
    const r = x.res!
    if (!r.ok) return <div className="mo-err"><Icon name="warn" size={16} className="shrink-0 mt-0.5" /><span>{t(`ai.why.${r.reason}`)}{r.detail && <span className="block text-xs font-mono opacity-70 mt-1 break-words" lang="en">{r.detail}</span>}</span></div>
    const a = r.result, grounded = a.grounding === 'grounded'
    return (
      <div className="mo-answer" role="group" aria-label={t('ai.ask.answer')}>
        <div className="mo-a-head"><i className="mo-a-dot" aria-hidden="true" />{t('ai.ask.answer')}<span className={`mo-chip ${grounded ? 'mo-chip-ok' : 'mo-chip-warn'}`}>{t(`ai.ask.g.${a.grounding}`)}</span></div>
        <div className="mo-a-body">
          <div className="text-[15px] leading-relaxed"><RevealText text={a.answer} lang={lang === 'zh' ? 'zh' : lang} /></div>
          {a.lawIds.length > 0 && <div className="mt-4"><h3 className="mo-sub">{t('ai.ask.sources')}</h3><ul className="space-y-1">{a.lawIds.map((id) => <StageLawRef key={id} id={id} />)}</ul></div>}
          {a.nextStep && <p className="mo-next"><Icon name="next" size={16} className="mt-0.5 shrink-0" /><span><b>{t('ai.ask.next')}:</b> {a.nextStep}</span></p>}
          <p className="mo-fine">{t('ai.ask.note')}</p>
          {r.detail && <p className="mo-fine font-mono break-words" lang="en">{r.detail}</p>}
        </div>
      </div>
    )
  }
  return (
    <Page title={t('ai.ask.title')} sub={t('ai.ask.sub')}>
      {!canUse && <Warn tone="info">{t('ai.ask.signin')} {status === 'signedOut' && <NavLink to="login" className="font-semibold text-primary underline underline-offset-4">{t('m.login')}</NavLink>}</Warn>}
      <MorphChat<Res> copy={copy} turns={turns} onAsk={onAsk} renderAnswer={renderAnswer} disabled={!canUse} maxLength={MAX_QUESTION} lite={lite}
        label={t('ai.ask.label')} note={t('ai.ask.privacy')} idleHint={t('ai.orb.idle')} idleChips={[t('ai.orb.c1'), t('ai.orb.c2'), t('ai.orb.c3')]}
        examples={[t('ai.ask.ex1'), t('ai.ask.ex2'), t('ai.ask.ex3')]} examplesTitle={t('ai.ask.try')}
        meta={leftN !== null ? t('ai.left', { n: leftN }) : undefined} />
    </Page>
  )
}
