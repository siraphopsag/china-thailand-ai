import { useState } from 'react'
import type { AIResponse, EmploymentInput, Profile } from '../types'
import { dv, tk, useI18n } from '../i18n'
import { aiService } from '../services/aiService'
import { analyzeEmployment, detectNomineeRisk, hasCompany, ownershipDims } from '../services/engines'
import { dirInfo } from '../utils/labels'
import { go } from '../store'
import { AIMessage } from './ui'
import { Icon, type IconName } from './icons'

const TILES: [route: string, icon: IconName, key: string][] = [
  ['analysis', 'business', 'a1'], ['ownership', 'ownership', 'a2'], ['employment', 'employment', 'a3'], ['roadmap', 'plan', 'a4'], ['documents', 'documents', 'a5'],
]

/** AI Command Center: plain actions wired to the existing modules. The recommended next one is highlighted; the free-text ask is one click away. */
export function AICommandCenter({ profile, highlight }: { profile: Profile | null; highlight?: string }) {
  const { t, lang } = useI18n()
  const [q, setQ] = useState('')
  const [resp, setResp] = useState<AIResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const ask = async () => {
    if (q.trim().length < 4) return setErr(t('err.qShort'))
    if (q.length > 500) return setErr(t('err.qLong'))
    setErr(''); setBusy(true)
    try { setResp(await aiService.orchestrate(q, profile, lang)) } catch { setErr(t('err.generic')) }
    setBusy(false)
  }
  return (
    <section className="card space-y-4" aria-labelledby="cc-h">
      <div><h2 id="cc-h" className="text-xl font-semibold">{t('cc.title')}</h2><p className="text-sm text-muted">{t('cc.sub')}</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TILES.map(([route, icon, k]) => {
          const rec = highlight === route
          return (
            <button key={k} onClick={() => go(route)} aria-label={rec ? `${tk('cc', k)} — ${t('cc.recommended')}` : undefined} className={`group text-left rounded-xl border p-4 flex gap-3 items-start hover:border-primary hover:bg-surface3 transition active:scale-[.99] ${rec ? 'border-primary ring-2 ring-primary/30 bg-brand' : 'border-line bg-surface2'}`}>
              <span className="w-10 h-10 rounded-lg bg-brand text-brandfg grid place-items-center shrink-0"><Icon name={icon} size={20} /></span>
              <span className="min-w-0"><span className="block font-semibold leading-snug">{tk('cc', k)}</span><span className="block text-sm text-muted mt-0.5">{tk('cc', k + 'd')}</span>{rec && <span className="inline-block mt-1 text-xs font-semibold text-primary">{t('cc.recommended')}</span>}</span>
            </button>)
        })}
      </div>
      <div>
        <button className="text-sm text-primary font-medium inline-flex items-center gap-1" aria-expanded={askOpen} onClick={() => setAskOpen(!askOpen)}><Icon name="ai" size={15} />{t('cc.askToggle')}<Icon name={askOpen ? 'up' : 'down'} size={14} /></button>
        {askOpen && (
          <div className="space-y-2 pt-3">
            <label htmlFor="cc-q" className="sr-only">{t('cc.askLabel')}</label>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]"><Icon name="ai" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input id="cc-q" className="input !pl-10" value={q} placeholder={t('cc.ph')} onChange={(e) => { setQ(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && ask()} maxLength={500} autoFocus /></div>
              <button className="btn-primary" disabled={busy} onClick={ask}>{busy ? t('cc.busy') : t('cc.ask')}</button>
            </div>
            <div className="flex gap-2 flex-wrap text-sm">{(['s1', 's2', 's3'] as const).map((k) => <button key={k} className="px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-surface3 min-h-[36px] transition text-left" onClick={() => setQ(t(`cc.${k}` as never))}>{tk('cc', k)}</button>)}</div>
            {err && <p role="alert" className="text-danger-fg text-sm">{err}</p>}
            {busy && <p className="text-sm text-muted animate-pulse">{t('cc.loading')}</p>}
            {resp && !busy && <AIMessage r={resp} />}
          </div>)}
      </div>
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
