// All the data on one page, and what is checked about each side (24 Nov 2026: the organiser's focus on trust and data). The texts
// (locales/v2g.ts) describe what the database does today; change them together with any new table.
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { Icon } from '../components/icons'

export const DATA_ROWS = ['account', 'job', 'chat', 'id', 'contract', 'care', 'review', 'ai'] as const
const COLS = ['what', 'why', 'who', 'keep'] as const

export function DataMap() {
  const { t } = useI18n()
  return (
    <section className="card space-y-4 text-sm" aria-labelledby="dm2-h">
      <div><h2 id="dm2-h" className="h2">{t('dm2.h')}</h2><p className="text-muted">{t('dm2.sub')}</p></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead className="text-xs text-muted"><tr>{COLS.map((c) => <th key={c} scope="col" className="p-2 font-medium">{t(`dm2.c.${c}`)}</th>)}</tr></thead>
          <tbody>{DATA_ROWS.map((r) => (
            <tr key={r} className="border-t border-line align-top">{COLS.map((c) => (
              c === 'what' ? <th key={c} scope="row" className="p-2 font-medium">{t(`dm2.${r}.${c}`)}</th> : <td key={c} className="p-2 text-muted">{t(`dm2.${r}.${c}`)}</td>))}</tr>))}</tbody>
        </table>
      </div>
      <div className="space-y-1.5">
        <h3 className="font-semibold text-base">{t('dm2.where.h')}</h3>
        <p className="text-muted">{t('dm2.where.t')}</p><p className="text-muted">{t('dm2.th')}</p><p className="text-muted">{t('dm2.cn')}</p>
      </div>
    </section>
  )
}

/** what is checked about an employer and a job seeker; `side` shows one of them (beside that side's own form) */
export function VerifyOverview({ side }: { side?: 'emp' | 'seek' }) {
  const { t } = useI18n()
  const sides = side ? [side] as const : (['emp', 'seek'] as const)
  return (
    <section className="card space-y-3 text-sm" aria-labelledby={`vo-h-${side ?? 'all'}`}>
      <h2 id={`vo-h-${side ?? 'all'}`} className="h2 flex items-center gap-2"><Icon name="shield" size={18} className="text-primary" />{t('vo.h')}</h2>
      <div className={side ? '' : 'grid md:grid-cols-2 gap-4'}>{sides.map((s) => (
        <div key={s}><h3 className="font-semibold">{t(`vo.${s}`)}</h3>
          <ol className="mt-1.5 space-y-1.5">{([1, 2, 3, 4] as const).map((n) => (
            <li key={n} className="flex gap-2"><span className="shrink-0 grid place-items-center w-5 h-5 rounded-full bg-surface3 text-[11px] font-bold" aria-hidden>{n}</span><span>{t(`vo.${s}.${n}`)}</span></li>))}</ol>
        </div>))}</div>
      {side && <p><NavLink to="privacy" className="link">{t('vo.more')}</NavLink></p>}
    </section>
  )
}
