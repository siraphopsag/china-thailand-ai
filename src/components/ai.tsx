import { useState } from 'react'
import type { AIResponse, EmploymentInput, Profile } from '../types'
import { dv, tk, useI18n } from '../i18n'
import { aiService } from '../services/aiService'
import { analyzeEmployment, detectNomineeRisk, hasCompany, ownershipDims } from '../services/engines'
import { dirInfo } from '../utils/labels'
import { go } from '../store'
import { AIMessage } from './ui'

const TILES: [route: string, icon: string, key: string][] = [
  ['analysis', '🧭', 'a1'], ['ownership', '🧩', 'a2'], ['risk', '🛡️', 'a3'], ['employment', '👥', 'a4'], ['contract', '📄', 'a5'], ['roadmap', '✅', 'a6'],
]

/** AI Command Center: action tiles wired to the modules + a free-text ask that goes through the orchestrator. */
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
    <section className="card space-y-4" aria-labelledby="cc-h">
      <div><h2 id="cc-h" className="h2">🤖 {t('cc.title')}</h2><p className="text-sm text-muted">{t('cc.sub')}</p></div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {TILES.map(([route, icon, k]) => (
          <button key={k} onClick={() => go(route)} className="card-i text-left flex items-center gap-2 min-h-[56px] hover:bg-surface3 hover:shadow-sm transition active:scale-[.98]">
            <span className="text-xl" aria-hidden>{icon}</span><span className="text-sm font-medium">{tk('cc', k)}</span>
          </button>))}
      </div>
      <div className="space-y-2">
        <label htmlFor="cc-q" className="label">{t('cc.askLabel')}</label>
        <div className="flex gap-2 flex-wrap">
          <input id="cc-q" className="input flex-1 min-w-[200px]" value={q} placeholder={t('cc.ph')} onChange={(e) => { setQ(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && ask()} maxLength={500} />
          <button className="btn-primary" disabled={busy} onClick={ask}>{busy ? t('cc.busy') : t('cc.ask')}</button>
        </div>
        <div className="flex gap-2 flex-wrap text-sm">{(['s1', 's2', 's3'] as const).map((k) => <button key={k} className="px-3 py-1.5 rounded-full border border-line bg-surface hover:bg-surface3 min-h-[36px] transition" onClick={() => setQ(t(`cc.${k}` as never))}>{tk('cc', k)}</button>)}</div>
        {err && <p role="alert" className="text-danger-fg text-sm">{err}</p>}
        {busy && <p className="text-sm text-muted animate-pulse">{t('cc.loading')}</p>}
        {resp && !busy && <AIMessage r={resp} />}
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
  const icon: Record<TlState, string> = { ok: '✓', warn: '⚠', active: '→', na: '–' }
  const cls: Record<TlState, string> = { ok: 'bg-ok-bg text-ok-fg', warn: 'bg-warn-bg text-warn-fg', active: 'bg-info-bg text-info-fg', na: 'bg-surface3 text-muted' }
  return (
    <ol className="space-y-2" aria-label={t('tl.title')}>
      {items.map(([s, text], i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs font-bold ${cls[s]} ${s === 'active' ? 'animate-pulse' : ''}`} aria-hidden>{icon[s]}</span>
          <span className={s === 'warn' ? 'font-medium' : ''}>{text}</span>
        </li>))}
    </ol>
  )
}
