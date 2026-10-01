import { useState } from 'react'
import type { AIResponse, EmploymentInput, Profile } from '../types'
import { dv, tk, useI18n } from '../i18n'
import { aiService } from '../services/aiService'
import { analyzeEmployment, detectNomineeRisk, hasCompany, ownershipDims } from '../services/engines'
import { dirInfo } from '../utils/labels'
import { AIMessage } from './ui'
import { Icon, type IconName } from './icons'

/** Ask the AI about this business. Uses the shared business context; answers come with citations and a verification status. */
export function AICommandCenter({ profile }: { profile: Profile | null }) {
  const { t, lang } = useI18n()
  const [q, setQ] = useState('')
  const [resp, setResp] = useState<AIResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ask = async () => {
    if (q.trim().length < 4) return setErr(t('err.qShort'))
    if (q.length > 500) return setErr(t('err.qLong'))
    setErr(''); setBusy(true)
    try { setResp(await aiService.orchestrate(q, profile, lang)) } catch { setErr(t('err.generic')) }
    setBusy(false)
  }
  return (
    <section className="space-y-3" aria-labelledby="cc-h">
      <div><h2 id="cc-h" className="h2">{t('cc.title')}</h2><p className="text-sm text-muted">{t('cc.sub')}</p></div>
      <label htmlFor="cc-q" className="sr-only">{t('cc.askLabel')}</label>
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]"><Icon name="ai" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input id="cc-q" className="input !pl-10" value={q} placeholder={t('cc.ph')} onChange={(e) => { setQ(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && ask()} maxLength={500} /></div>
        <button className="btn-primary" disabled={busy} onClick={ask}>{busy ? t('cc.busy') : t('cc.ask')}</button>
      </div>
      <div className="flex gap-2 flex-wrap text-sm">{(['s1', 's2', 's3'] as const).map((k) => <button key={k} className="px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-surface3 min-h-[36px] transition text-left" onClick={() => setQ(t(('cc.' + k) as never))}>{tk('cc', k)}</button>)}</div>
      {err && <p role="alert" className="text-danger-fg text-sm">{err}</p>}
      {busy && <p className="text-sm text-muted animate-pulse" role="status">{t('cc.loading')}</p>}
      {resp && !busy && <AIMessage r={resp} />}
    </section>
  )
}

type TlState = 'ok' | 'warn' | 'active' | 'na'
/** AI activity timeline — every state is derived from the real analysis results, nothing is faked. */
export function AITimeline({ p, emp }: { p: Profile; emp: EmploymentInput }) {
  const { t } = useI18n()
  const d = dirInfo(p.direction)
  const comp = hasCompany(p)
  const nom = detectNomineeRisk(p)
  const ownWarn = ownershipDims(p).some((x) => x.status !== 'LOW')
  const miss = analyzeEmployment(emp, p).filter((a) => a.missing).length
  const items: [TlState, string][] = [
    ['ok', t('tl.read', { name: dv(p.companyName) })],
    ['ok', t('tl.classify', { type: p.businessType === 'other' && p.businessTypeOther ? p.businessTypeOther : tk('opt.btype', p.businessType) })],
    ['ok', t('tl.dest', { country: tk('country', d.to) })],
    comp ? [ownWarn ? 'warn' : 'ok', ownWarn ? t('tl.ownWarn') : t('tl.own')] : ['na', t('tl.ownNa')],
    comp ? [nom.level === 'LOW' ? 'ok' : 'warn', nom.level === 'LOW' ? t('tl.nomOk') : t('tl.nomWarn')] : ['na', t('tl.nomNa')],
    [miss ? 'warn' : 'ok', miss ? t('tl.empWarn', { n: miss }) : t('tl.emp')],
    ['active', t('tl.roadmap')],
  ]
  const icon: Record<TlState, IconName> = { ok: 'ok', warn: 'warn', active: 'next', na: 'dash' }
  const cls: Record<TlState, string> = { ok: 'text-ok-fg', warn: 'text-warn-fg', active: 'text-info-fg', na: 'text-muted' }
  return (
    <ol className="space-y-2.5" aria-label={t('tl.title')}>
      {items.map(([s, text], i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <Icon name={icon[s]} size={18} className={`mt-0.5 ${cls[s]} ${s === 'active' ? 'animate-pulse' : ''}`} />
          <span className={s === 'warn' ? 'font-medium' : ''}>{text}</span>
        </li>))}
    </ol>
  )
}
