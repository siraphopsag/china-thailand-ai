// The job market from outside sources, beside the board's map (advisers' feedback at the pitch, owner 24 Nov 2026), and the page that
// explains where the figures come from, the terms they are used under and how personal data is protected. The figures come from
// /api/market (read about once a week); where that cannot run — the offline kit, a local preview — or a source is down, the copy
// saved in the website is shown with its date. What is read and how: src/domain/openData.ts.
import { useEffect, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { Icon } from '../components/icons'
import { Disclaimer, PageHead } from '../components/ui'
import { useNames } from './match'
import type { Scope } from '../domain/match/market'
import { balanceOf } from '../domain/match/market'
import { AGENCY_BOARDS, SOURCES, change, cleanExternal, type External, type WbKey } from '../domain/openData'
import snapshot from '../data/marketSnapshot.json'

const SAVED = cleanExternal(snapshot)
type Loaded = { data: External | null; saved: boolean; loading: boolean }
let cache: Loaded | null = null
const offline = () => import.meta.env.VITE_DEMO_MIRROR === '1' || import.meta.env.MODE === 'test'

/** the outside figures: the server's weekly answer, else the copy saved in the website */
export function useExternal(on = true): Loaded {
  const [s, setS] = useState<Loaded>(() => cache ?? (offline() ? { data: SAVED, saved: true, loading: false } : { data: null, saved: false, loading: true }))
  useEffect(() => {
    if (!on || cache || offline()) return
    let live = true
    fetch('/api/market').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
      const data = cleanExternal(j)
      // a partial answer (one source down) is completed from the saved copy
      const full: External | null = data ? { ...data, th: data.th ?? SAVED?.th ?? null, countries: data.countries ?? SAVED?.countries ?? null } : SAVED
      cache = { data: full, saved: !data, loading: false }
      if (live) setS(cache)
    })
    return () => { live = false }
  }, [on])
  return s
}

const LOCALE = { th: 'th-TH', zh: 'zh-CN', en: 'en-GB' } as const
export function useDates() {
  const { lang } = useI18n()
  const loc = LOCALE[lang]
  return {
    month: (m: string) => new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' }),
    day: (iso: string) => new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }),
    num: (n: number, d = 0) => n.toLocaleString(loc, { maximumFractionDigits: d, minimumFractionDigits: d }),
  }
}

/** the numbers the map draws in outside mode: Thai provinces only */
export function externalCounts(d: External | null, what: 'vacancies' | 'seekers', scope: Scope): Record<string, number> {
  if (!d?.th || scope === 'CN') return {}
  return d.th[what].now.byProvince
}

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">{children}<Icon name="external" size={12} /></a>)

function Delta({ now, before }: { now: number; before: number | null | undefined }) {
  const { t } = useI18n()
  const p = change(now, before)
  if (p === null) return null
  return <span className={`text-xs inline-flex items-center gap-0.5 ${p > 0 ? 'text-ok-fg' : p < 0 ? 'text-danger-fg' : 'text-muted'}`}><Icon name={p > 0 ? 'trendUp' : p < 0 ? 'trendDown' : 'dash'} size={13} />{t('od.vs', { p: p > 0 ? `+${p}` : p })}</span>
}

const SEG = 'inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1'
const pill = (on: boolean) => `min-h-[32px] px-3 rounded-full text-sm inline-flex items-center gap-1.5 whitespace-nowrap ${on ? 'seg-on' : 'text-ink hover:bg-surface3'}`
export function ExternalPanel({ scope, province, onScope, onAll }: { scope: Scope; province: string | null; onScope: (s: Scope) => void; onAll: () => void }) {
  const { t } = useI18n()
  const N = useNames()
  const D = useDates()
  const { data, saved, loading } = useExternal()
  if (loading) return <section className="glass-card p-4 min-w-0"><p className="text-sm text-muted" role="status">{t('od.loading')}</p></section>
  const th = data?.th, cs = data?.countries
  const prov = province && province.startsWith('TH-') ? province : null
  const v = th?.vacancies, s = th?.seekers
  const tiles = th ? ([['od.vac', v!.now, v!.before], ['od.seek', s!.now, s!.before]] as const) : []
  const top = th ? Object.entries(v!.now.byProvince).sort((a, b) => b[1] - a[1]).slice(0, 5) : []
  const maxInd = Math.max(1, ...(th?.industries.rows.slice(0, 5).map((r) => r.n) ?? [1]))
  const year = cs ? [cs.TH.unemployment?.year, cs.CN.unemployment?.year].filter(Boolean).sort().pop() : undefined
  const fig = (k: WbKey, c: 'TH' | 'CN') => { const x = cs?.[c][k]; if (!x) return '—'; return k === 'labourForce' ? t('od.million', { n: D.num(x.value / 1e6, 1) }) : `${D.num(x.value, 1)}%` }
  return (
    <section className="glass-card p-4 space-y-4 min-w-0" aria-labelledby="od-h">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="od-h" className="h2 flex items-center gap-2"><Icon name="globe" size={18} className="text-primary" />{t('od.title')}</h2>
          <div className={SEG} role="group" aria-label={t('m.mk.scope')}>
            {(['all', 'TH', 'CN'] as const).map((c) => <button key={c} type="button" aria-pressed={scope === c} onClick={() => onScope(c)} className={pill(scope === c)}>{c === 'all' ? t('m.mk.all') : N.country(c)}</button>)}
          </div>
        </div>
        {data && <p className="text-xs text-muted mt-0.5">{t('od.meta', { d: D.day(data.checkedAt) })}</p>}
        {saved && data && <p className="text-xs text-warn-fg mt-1 inline-flex items-center gap-1.5"><Icon name="info" size={13} />{t('od.snapshot', { d: D.day(data.checkedAt) })}</p>}
      </div>
      {province && (
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-xl border border-line bg-surface px-3 py-2" role="status">
          <span className="font-semibold inline-flex items-center gap-1.5"><Icon name="pin" size={15} className="text-primary" />{t('m.mk.in', { p: N.prov(province) })}</span>
          <button type="button" className="btn-ghost text-sm !min-h-[34px] !rounded-full" onClick={onAll}><Icon name="close" size={14} />{t('m.mk.showAll')}</button>
        </p>)}

      {th && scope !== 'CN' && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t('od.th.h', { m: D.month(v!.now.month) })}</h3>
          <dl className="grid grid-cols-2 gap-2">
            {tiles.map(([k, now, before]) => {
              const n = prov ? now.byProvince[prov] ?? 0 : now.total
              const b = prov ? before?.byProvince[prov] : before?.total
              return (
                <div key={k} className="rounded-xl border border-line bg-surface px-3 py-2">
                  <dt className="text-xs text-muted">{t(k)}</dt>
                  <dd className="text-xl font-bold leading-tight tabular-nums">{D.num(n)}</dd>
                  <dd><Delta now={n} before={b} /></dd>
                </div>)
            })}
          </dl>
          {prov && (() => { const st = balanceOf(v!.now.byProvince[prov] ?? 0, s!.now.byProvince[prov] ?? 0); return (
            <p><span className={`chip ${st === 'people' ? 'bg-warn-bg text-warn-fg border-warn-line' : st === 'jobs' ? 'bg-info-bg text-info-fg border-info-line' : 'bg-surface3 border-line'}`}>{t(st === 'people' ? 'm.mk.short.people' : st === 'jobs' ? 'm.mk.short.jobs' : 'm.mk.even')}</span></p>) })()}
          {!prov && (
            <table className="w-full text-sm">
              <caption className="text-left text-sm font-semibold mb-1.5">{t('od.top')}</caption>
              <thead className="text-xs text-muted"><tr><th scope="col" className="text-left font-medium py-1">{t('m.mk.col.place')}</th><th scope="col" className="text-right font-medium py-1 w-24">{t('od.vac')}</th><th scope="col" className="text-right font-medium py-1 w-24">{t('od.seek')}</th></tr></thead>
              <tbody>{top.map(([p, n], i) => (
                <tr key={p} className="border-t border-line">
                  <td className="py-1.5"><span className="inline-grid place-items-center w-5 h-5 mr-2 rounded-full bg-surface3 text-[11px] font-bold" aria-hidden>{i + 1}</span><span className="font-medium">{N.prov(p)}</span></td>
                  <td className="py-1.5 text-right tabular-nums">{D.num(n)}</td><td className="py-1.5 text-right tabular-nums">{D.num(s!.now.byProvince[p] ?? 0)}</td>
                </tr>))}</tbody>
            </table>)}
          {!!th.industries.rows.length && (
            <div>
              <h3 className="text-sm font-semibold">{t('od.ind')}</h3>
              <p className="text-xs text-muted mb-1.5">{t('od.ind.d')}</p>
              <ul className="space-y-1.5">{th.industries.rows.slice(0, 5).map((r) => (
                <li key={r.section} className="text-sm">
                  <p className="flex items-center justify-between gap-2"><span className="truncate">{t(`od.isic.${r.section}` as never)}</span><span className="tabular-nums font-semibold">{D.num(r.n)}</span></p>
                  <div className="fill-bar mk-want mt-1" aria-hidden><span style={{ width: `${(r.n / maxInd) * 100}%` }} /></div>
                </li>))}</ul>
            </div>)}
        </div>)}

      {cs && year && (
        <div>
          <h3 className="text-sm font-semibold mb-1.5">{scope === 'CN' ? t('od.cn') : t('od.cmp', { y: year })}</h3>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted"><tr><th scope="col" className="text-left font-medium py-1"><span className="sr-only">{t('od.cmp', { y: year })}</span></th>
              {(scope === 'CN' ? ['CN'] as const : ['TH', 'CN'] as const).map((c) => <th key={c} scope="col" className="text-right font-medium py-1 w-28">{N.country(c)}</th>)}</tr></thead>
            <tbody>{(['unemployment', 'youth', 'labourForce', 'agriculture', 'industry', 'services'] as const).map((k) => (
              <tr key={k} className="border-t border-line"><th scope="row" className="py-1.5 text-left font-normal">{t(`od.k.${k}`)}</th>
                {(scope === 'CN' ? ['CN'] as const : ['TH', 'CN'] as const).map((c) => <td key={c} className="py-1.5 text-right tabular-nums">{fig(k, c)}</td>)}</tr>))}</tbody>
          </table>
        </div>)}

      <div>
        <h3 className="text-sm font-semibold">{t('od.boards')}</h3>
        <p className="text-xs text-muted mb-1.5">{t('od.boards.d')}</p>
        <ul className="space-y-1 text-sm">{AGENCY_BOARDS.filter((b) => scope === 'all' || (scope === 'TH') === (b.id === 'thaimengaantam')).map((b) => (
          <li key={b.id}><Ext href={b.url}>{t(`od.board.${b.id}` as never)}</Ext></li>))}</ul>
      </div>

      <div className="text-xs text-muted space-y-1 border-t border-line pt-3">
        <p>{t('od.src')}: <Ext href={SOURCES.doe.url}>{t('od.src.doe')}</Ext> · <Ext href={SOURCES.wb.url}>{t('od.src.wb')}</Ext></p>
        <p>{t('od.privacy')}</p>
        <p><NavLink to="open-data" className="link inline-flex items-center gap-1"><Icon name="legal" size={13} />{t('od.more')}</NavLink></p>
      </div>
    </section>
  )
}

const PARTS = ['what', 'terms', 'when', 'pdpa', 'use'] as const
export function OpenDataPage() {
  const { t } = useI18n()
  const D = useDates()
  const { data } = useExternal()
  const wbYear = data?.countries ? [data.countries.TH.unemployment?.year, data.countries.CN.unemployment?.year].filter(Boolean).sort().pop() : undefined
  return (
    <div className="space-y-5 max-w-3xl"><PageHead title={t('od.more')} sub={t('od.page.sub')} />
      {data?.th && wbYear && <p className="text-sm rounded-xl border border-info-line bg-info-bg text-info-fg px-4 py-2.5" role="status">{t('od.p.status', { m: D.month(data.th.vacancies.now.month), y: wbYear, d: D.day(data.checkedAt) })}</p>}
      <div className="card space-y-5 text-sm">
        {PARTS.map((k, i) => (
          <section key={k} aria-labelledby={`od-${k}`} className="space-y-1.5">
            <h2 id={`od-${k}`} className="font-semibold text-base">{i + 1}. {t(`od.p.${k}.h`)}</h2>
            <p className="text-muted">{t(`od.p.${k}.t`)}</p>
          </section>))}
        <section aria-labelledby="od-list" className="space-y-2">
          <h2 id="od-list" className="font-semibold text-base">{PARTS.length + 1}. {t('od.p.list')}</h2>
          <ul className="space-y-2">
            {(['doe', 'wb'] as const).map((k) => (
              <li key={k} className="rounded-xl border border-line px-3 py-2">
                <p className="font-medium"><Ext href={SOURCES[k].url}>{t(`od.src.${k}`)}</Ext></p>
                <p className="text-muted">{t('od.src.licence', { l: SOURCES[k].licence })}{SOURCES[k].licenceUrl && <> · <Ext href={SOURCES[k].licenceUrl!}>{t('od.p.terms')}</Ext></>}</p>
              </li>))}
            {AGENCY_BOARDS.map((b) => <li key={b.id} className="rounded-xl border border-line px-3 py-2"><Ext href={b.url}>{t(`od.board.${b.id}` as never)}</Ext></li>)}
          </ul>
        </section>
      </div>
      <Disclaimer />
    </div>
  )
}
