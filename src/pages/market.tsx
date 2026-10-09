import { useI18n } from '../i18n'
import type { Market, Scope } from '../domain/match/market'
import { Icon } from '../components/icons'
import { useNames } from './match'

/**
 * The job market beside the board's map (owner, Oct 2026): not only where people want to work, but the state of the market —
 * totals, the busiest provinces, the fields job seekers pin most (rising), the fields employers want most, and demand against
 * supply per field. Both countries together or one; a tap on a province narrows everything to it. Counts only.
 */
const SEG = 'inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1'
const pill = (on: boolean) => `min-h-[32px] px-3 rounded-full text-sm inline-flex items-center gap-1.5 whitespace-nowrap ${on ? 'seg-on' : 'text-ink hover:bg-surface3'}`

export function MarketPanel({ m, scope, province, onScope, onAll }: { m: Market; scope: Scope; province: string | null; onScope: (s: Scope) => void; onAll: () => void }) {
  const { t } = useI18n()
  const N = useNames()
  const tiles = [['m.mk.posts', m.totals.posts, 'posts'], ['m.mk.places', m.totals.places, 'users'], ['m.mk.employers', m.totals.employers, 'business'], ['m.mk.pins', m.totals.pins, 'pin']] as const
  const maxRise = Math.max(1, ...m.rising.map((r) => r.n)), maxWant = Math.max(1, ...m.wanted.map((r) => r.n))
  const none = <p className="text-sm text-muted py-1">{t('m.mk.none')}</p>
  return (
    <section className="glass-card p-4 space-y-4 min-w-0" aria-labelledby="mk-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mk-h" className="h2 flex items-center gap-2"><Icon name="chart" size={18} className="text-primary" />{t('m.mk.title')}</h2>
        <div className={SEG} role="group" aria-label={t('m.mk.scope')}>
          {(['all', 'TH', 'CN'] as const).map((s) => <button key={s} type="button" aria-pressed={scope === s} onClick={() => onScope(s)} className={pill(scope === s)}>{s === 'all' ? t('m.mk.all') : N.country(s)}</button>)}
        </div>
      </div>
      {province && (
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-xl border border-line bg-surface px-3 py-2" role="status">
          <span className="font-semibold inline-flex items-center gap-1.5"><Icon name="pin" size={15} className="text-primary" />{t('m.mk.in', { p: N.prov(province) })}</span>
          <button type="button" className="btn-ghost text-sm !min-h-[34px] !rounded-full" onClick={onAll}><Icon name="close" size={14} />{t('m.mk.showAll')}</button>
        </p>)}

      {(m.simulated.posts > 0 || m.simulated.pins > 0) && <p className="text-xs text-warn-fg inline-flex items-center gap-1.5 -mb-2"><Icon name="sim" size={13} />{t('m.mk.simulated', { p: m.simulated.posts, n: m.simulated.pins })}</p>}
      <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
        {tiles.map(([k, v, icon]) => (
          <div key={k} className="rounded-xl border border-line bg-surface px-3 py-2">
            <dt className="text-xs text-muted flex items-center gap-1"><Icon name={icon} size={13} />{t(k)}</dt>
            <dd className="text-xl font-bold leading-tight">{v.toLocaleString()}</dd>
          </div>))}
      </dl>

      {!province && (
        <div>
          <h3 className="text-sm font-semibold mb-1.5">{t('m.mk.top')}</h3>
          {!m.top.length ? none : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted"><tr><th scope="col" className="text-left font-medium py-1">{t('m.mk.col.place')}</th><th scope="col" className="text-right font-medium py-1 w-16">{t('m.mk.col.pins')}</th><th scope="col" className="text-right font-medium py-1 w-24">{t('m.mk.col.employers')}</th></tr></thead>
              <tbody>{m.top.map((r, i) => (
                <tr key={`${r.country}|${r.province}`} className="border-t border-line">
                  <td className="py-1.5"><span className="inline-grid place-items-center w-5 h-5 mr-2 rounded-full bg-surface3 text-[11px] font-bold" aria-hidden>{i + 1}</span>{N.country(r.country)} · <span className="font-medium">{N.prov(r.province)}</span></td>
                  <td className="py-1.5 text-right tabular-nums">{r.pins}</td><td className="py-1.5 text-right tabular-nums">{r.employers}</td>
                </tr>))}</tbody>
            </table>)}
        </div>)}

      <div className="grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold">{t('m.mk.rising')}</h3>
          <p className="text-xs text-muted mb-1.5">{t('m.mk.rising.d')}</p>
          {!m.rising.length ? none : <ul className="space-y-1.5">{m.rising.map((r) => {
            const d = r.last7 - r.prev7
            return (
              <li key={r.industry} className="text-sm">
                <p className="flex items-center justify-between gap-2"><span className="truncate">{N.industry(r.industry)}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums font-semibold">{r.n}
                    <span role="img" aria-label={t('m.mk.up', { a: r.last7, b: r.prev7 })} title={t('m.mk.up', { a: r.last7, b: r.prev7 })} className={d > 0 ? 'text-ok-fg' : d < 0 ? 'text-danger-fg' : 'text-muted'}>
                      <Icon name={d > 0 ? 'trendUp' : d < 0 ? 'trendDown' : 'dash'} size={15} /></span></span></p>
                <div className="fill-bar mt-1" aria-hidden><span style={{ width: `${(r.n / maxRise) * 100}%` }} /></div>
              </li>)
          })}</ul>}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t('m.mk.wanted')}</h3>
          <p className="text-xs text-muted mb-1.5">{t('m.mk.wanted.d')}</p>
          {!m.wanted.length ? none : <ul className="space-y-1.5">{m.wanted.map((r) => (
            <li key={r.industry} className="text-sm">
              <p className="flex items-center justify-between gap-2"><span className="truncate">{N.industry(r.industry)}</span><span className="tabular-nums font-semibold">{r.n}</span></p>
              <div className="fill-bar mk-want mt-1" aria-hidden><span style={{ width: `${(r.n / maxWant) * 100}%` }} /></div>
            </li>))}</ul>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">{t('m.mk.balance')}</h3>
        <p className="text-xs text-muted mb-1.5">{t('m.mk.balance.d')}</p>
        {!m.balance.length ? none : <ul className="divide-y divide-line">{m.balance.map((r) => {
          const total = Math.max(1, r.wanted + r.seeking)
          return (
            <li key={r.industry} className="py-1.5 text-sm">
              <p className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <span className="font-medium truncate">{N.industry(r.industry)}</span>
                <span className={`chip !py-0 ${r.state === 'people' ? 'bg-warn-bg text-warn-fg border-warn-line' : r.state === 'jobs' ? 'bg-info-bg text-info-fg border-info-line' : 'bg-surface3 border-line'}`}>{t(r.state === 'people' ? 'm.mk.short.people' : r.state === 'jobs' ? 'm.mk.short.jobs' : 'm.mk.even')}</span>
              </p>
              {/* demand (employers) | supply (job seekers) as one split bar, with the numbers in words beside it */}
              <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                <span className="tabular-nums whitespace-nowrap">{t('m.mk.need', { n: r.wanted })}</span>
                <span className="mk-split flex-1" aria-hidden><span style={{ width: `${(r.wanted / total) * 100}%` }} /></span>
                <span className="tabular-nums whitespace-nowrap">{t('m.mk.seek', { n: r.seeking })}</span>
              </div>
            </li>)
        })}</ul>}
      </div>
      <p className="text-xs text-muted">{t('m.mk.privacy')}</p>
    </section>
  )
}
