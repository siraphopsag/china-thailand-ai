/**
 * The real AI on screen (owner, Oct 2026 — "A + B" for the AI + Law competition).
 *  A) AiCheckResult: what the AI found in a job post before it goes out (used in the employer's "Check and post" step, hire.tsx).
 *  B) AskPage: the legal Q&A assistant — one question, an answer grounded in the site's legal records, the records it used, a next step.
 * AI text is shown as plain text (React escapes it). Every AI result says it can be wrong and is not legal advice.
 */
import { useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { messages } from '../locales'
import { useAuth } from '../auth'
import { NavLink } from '../store'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { getReg, regText } from '../data/regulations'
import { aiAsk } from '../ai/client'
import { MAX_QUESTION, type AiAnswer, type AiCheck, type AiResponse } from '../ai/spec'
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

export function AskPage() {
  const { t, lang } = useI18n()
  const { status, online } = useAuth()
  const [q, setQ] = useState('')
  const [asked, setAsked] = useState('')
  const [res, setRes] = useState<AiResponse<AiAnswer> | 'busy' | null>(null)
  const [short, setShort] = useState(false)
  const run = useRef(0)
  const box = useRef<HTMLTextAreaElement>(null)
  const canUse = status === 'signedIn' && online !== false
  const send = async (e?: FormEvent, text = q) => {
    e?.preventDefault()
    const v = text.trim()
    if (v.length < 4) { setShort(true); box.current?.focus(); return }
    setShort(false); setQ(v); setAsked(v)
    const n = ++run.current
    setRes('busy')
    const r = await aiAsk(v, lang)
    if (n === run.current) setRes(r)
  }
  const ok = res && res !== 'busy' && res.ok ? res : null
  return (
    <Page title={t('ai.ask.title')} sub={t('ai.ask.sub')}>
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 items-start">
        <section className="card space-y-3">
          {!canUse && <Warn tone="info">{t('ai.ask.signin')} {status === 'signedOut' && <NavLink to="login" className="font-semibold text-primary underline underline-offset-4">{t('m.login')}</NavLink>}</Warn>}
          <form onSubmit={send} className="space-y-2">
            <label htmlFor="ai-q" className="label">{t('ai.ask.label')}</label>
            <textarea id="ai-q" ref={box} className="input min-h-[110px]" maxLength={MAX_QUESTION} placeholder={t('ai.ask.ph')} value={q} onChange={(e) => setQ(e.target.value)} aria-invalid={short} aria-describedby="ai-q-hint" disabled={!canUse} />
            <div id="ai-q-hint" className="flex justify-between gap-2 text-xs"><span className={short ? 'text-danger-fg font-medium' : 'text-muted'}>{short ? t('ai.ask.short') : t('ai.ask.privacy')}</span><span className="text-muted shrink-0">{q.length}/{MAX_QUESTION}</span></div>
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={!canUse || res === 'busy'}><Icon name="ai" size={16} />{t('ai.ask.send')}</button>
          </form>
          <div><p className="text-xs text-muted mb-1.5">{t('ai.ask.try')}</p>
            <div className="flex flex-col gap-1.5">{(['ex1', 'ex2', 'ex3'] as const).map((k) => (
              <button key={k} type="button" disabled={!canUse || res === 'busy'} onClick={() => send(undefined, t(`ai.ask.${k}`))} className="text-left text-sm rounded-lg border border-control px-3 py-2 hover:bg-surface3 disabled:opacity-60">{t(`ai.ask.${k}`)}</button>))}</div></div>
        </section>
        <section className="card space-y-3 min-h-[200px]" aria-live="polite" aria-busy={res === 'busy'}>
          {!res && <p className="text-sm text-muted flex items-center gap-2"><Icon name="legal" size={18} />{t('ai.ask.note')}</p>}
          {res === 'busy' && <p role="status" className="text-sm text-muted flex items-center gap-2 py-8 justify-center"><span className="ai-spin" aria-hidden />{t('ai.ask.loading')}</p>}
          {res && res !== 'busy' && !res.ok && <Warn tone={res.reason === 'busy' || res.reason === 'error' ? 'danger' : 'info'}>{t(`ai.why.${res.reason}`)}</Warn>}
          {ok && <>
            <p className="text-sm text-muted"><q>{asked}</q></p>
            <div className="flex flex-wrap items-center gap-2"><h2 className="h2">{t('ai.ask.answer')}</h2>
              <span className={`chip border ${ok.result.grounding === 'grounded' ? 'border-ok-line bg-ok-bg text-ok-fg' : 'border-warn-line bg-warn-bg text-warn-fg'}`}><Icon name="ai" size={12} />{t(`ai.ask.g.${ok.result.grounding}`)}</span></div>
            <div className="text-[15px] leading-relaxed whitespace-pre-line">{ok.result.answer}</div>
            {ok.result.lawIds.length > 0 && <div><h3 className="font-semibold text-sm mb-1">{t('ai.ask.sources')}</h3><ul className="space-y-1">{ok.result.lawIds.map((id) => <LawRef key={id} id={id} />)}</ul></div>}
            {ok.result.nextStep && <p className="text-sm rounded-lg bg-brand text-brandfg px-3 py-2 flex gap-2"><Icon name="next" size={16} className="mt-0.5 shrink-0" /><span><b>{t('ai.ask.next')}:</b> {ok.result.nextStep}</span></p>}
            <p className="text-xs text-muted border-t border-line pt-2">{t('ai.ask.note')}{ok.left !== null && <> · {t('ai.left', { n: ok.left })}</>}</p>
            <button type="button" className="btn-ghost" onClick={() => { setRes(null); setQ(''); box.current?.focus() }}>{t('ai.ask.again')}</button>
          </>}
        </section>
      </div>
    </Page>
  )
}
