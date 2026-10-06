import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { getClient, useAuth } from '../auth'
import { useTheme } from '../theme'
import { localDay } from '../domain/match/logic'
import { dbProblem } from '../domain/match/remote'
import { METRICS, RANGES, STAGES, caseStages, change, heatWeeks, parseDaily, periods, toCsv, total, type DayRow, type Metric, type Range } from '../domain/match/analytics'
import { AreaChart, Donut, Heatmap, Sparkline } from '../components/charts'
import { Icon, type IconName } from '../components/icons'
import { Warn } from '../components/ui'
import { Page } from './match'

/**
 * Admin analytics (owner, Oct 2026): key numbers against the period before, one chart over time, cases by stage and a daily
 * activity grid, with a table view and a CSV of the totals. Real numbers come from the database (admin_daily, 0006). The local
 * demo — and a database that has not run 0006 yet — shows clearly labelled sample numbers so the page can be tried.
 */
const KPI: { m: Metric; icon: IconName }[] = [{ m: 'visits', icon: 'eye' }, { m: 'signups', icon: 'user' }, { m: 'applications', icon: 'send' }, { m: 'cases', icon: 'plane' }]
const locale = (l: string) => (l === 'zh' ? 'zh-CN' : l === 'th' ? 'th-TH' : 'en-GB')

/** sample numbers for the demo (fixed, so the page looks the same on every visit) */
export function sampleDaily(today: string, days: number): DayRow[] {
  const [y, m, d] = today.split('-').map(Number)
  return Array.from({ length: days }, (_, i) => {
    const x = new Date(y, m - 1, d - (days - 1 - i)), k = i + 1
    const wave = (a: number, b: number) => Math.max(0, Math.round(a + b * Math.sin(k / 5) + ((k * 37) % 7) - 3))
    return { day: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`,
      visits: wave(60 + i / 3, 18), signups: wave(5, 3), posts: wave(3, 2), applications: wave(7, 4), cases: wave(1, 1), reports: (k * 13) % 11 === 0 ? 1 : 0 }
  })
}

export function AnalyticsPage() {
  const { t, lang } = useI18n()
  const { st, now, mode } = useMatch()
  const { isAdmin } = useAuth()
  const { weekStart } = useTheme()
  const [range, setRange] = useState<Range>(30)
  const [metric, setMetric] = useState<Metric>('visits')
  const [rows, setRows] = useState<DayRow[] | null>(null)
  const [problem, setProblem] = useState<'dbOld' | 'network' | null>(null)
  const today = localDay(new Date(now).toISOString())
  const real = mode === 'remote' && isAdmin
  const need = Math.max(range * 2, 140)
  useEffect(() => {
    if (!real) return
    let alive = true
    void (async () => {
      try {
        const sb = await getClient()
        const { data, error } = await sb.rpc('admin_daily', { p_days: need })
        if (!alive) return
        if (error) { setProblem(dbProblem(error) === 'dbOld' ? 'dbOld' : 'network'); setRows(null) } else { setProblem(null); setRows(parseDaily(data)) }
      } catch { if (alive) setProblem('network') }
    })()
    return () => { alive = false }
  }, [real, need])
  if (mode === 'remote' && !isAdmin) return <Page title={t('m.an.title')}><Warn>{t('m.adm.gate')}</Warn></Page>

  const sample = !real || problem !== null
  const data = sample ? sampleDaily(today, need) : rows
  const fmtN = (n: number) => new Intl.NumberFormat(locale(lang)).format(n)
  const dayLabel = (d: string) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short' }).format(new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))))
  const name = (m: Metric) => t(`m.an.m.${m}` as never)
  const csv = () => {
    if (!data) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toCsv(periods(data, range).cur)], { type: 'text/csv;charset=utf-8' })); a.download = `call-analytics-${range}d.csv`
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  return (
    <Page title={t('m.an.title')} sub={t('m.an.sub')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 rounded-full border border-line p-1 bg-surface" role="group" aria-label={t('m.an.range')}>
          {RANGES.map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={`min-h-[36px] px-3.5 rounded-full text-sm ${range === r ? 'bg-primary text-onprimary font-semibold' : 'hover:bg-surface3'}`}>{t('m.an.days', { n: r })}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <NavLink to="backoffice" className="btn-ghost text-sm"><Icon name="shield" size={15} />{t('m.admin')}</NavLink>
          <button type="button" className="btn-ghost text-sm" onClick={csv} disabled={!data}><Icon name="download" size={15} />{t('m.an.csv')}</button>
        </div>
      </div>
      {sample && <Warn tone="info">{t(problem === 'dbOld' ? 'm.an.sampleDb' : problem === 'network' ? 'm.an.sampleNet' : 'm.an.sample')}</Warn>}
      {!data ? <p className="text-muted py-10 text-center" role="status">{t('c.loading')}</p> : (() => {
        const { cur, prev } = periods(data, range)
        const points = cur.map((r) => ({ day: r.day, n: r[metric] }))
        const prevVals = prev.length === cur.length ? prev.map((r) => r[metric]) : undefined
        const stages = caseStages(st.cases)
        const allCases = STAGES.reduce((n, s) => n + stages[s], 0)
        const weeks = heatWeeks(data, 20, weekStart, today)
        const max = Math.max(0, ...weeks.flat().map((x) => x.n))
        const wd = weeks[0].map((x) => new Intl.DateTimeFormat(locale(lang), { weekday: 'short' }).format(new Date(Number(x.day.slice(0, 4)), Number(x.day.slice(5, 7)) - 1, Number(x.day.slice(8, 10)))))
        return (<>
          {/* key numbers against the period before */}
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">{KPI.map(({ m, icon }) => {
            const a = total(cur, m), b = total(prev, m), c = change(a, b)
            return (
              <div key={m} className="glass-card p-4 space-y-1">
                <dt className="text-xs text-muted flex items-center justify-between gap-2">{name(m)}<Icon name={icon} size={15} /></dt>
                <dd className="text-3xl font-bold">{fmtN(a)}</dd>
                <dd className="text-xs text-muted flex items-center gap-1">{c === null ? t('m.an.new') : <><Icon name={c >= 0 ? 'up' : 'down'} size={13} />{t('m.an.vs', { p: `${c > 0 ? '+' : ''}${c}%`, n: range })}</>}</dd>
                <dd><Sparkline values={cur.map((r) => r[m])} /></dd>
              </div>)
          })}</dl>

          <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 items-start">
            <section className="card space-y-3" aria-labelledby="an-trend">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h2 id="an-trend" className="h2">{t('m.an.trend', { m: name(metric) })}</h2><p className="text-xs text-muted">{t('m.an.trendSub', { n: range })}</p></div>
                <p className="text-xs text-muted flex gap-3"><span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-primary" />{t('m.an.thisPeriod')}</span><span className="inline-flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-muted" />{t('m.an.prevPeriod')}</span></p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('m.an.metric')}>{METRICS.map((m) => <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)} className={`min-h-[34px] px-3 rounded-full border text-xs ${metric === m ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{name(m)}</button>)}</div>
              <AreaChart points={points} prev={prevVals} label={t('m.an.chartLabel', { m: name(metric), n: range, total: fmtN(total(cur, metric)) })} dayLabel={dayLabel}
                valueLabel={(n) => `${fmtN(n)} ${name(metric)}`} prevLabel={(n) => t('m.an.prevValue', { n: fmtN(n) })} />
              <details className="text-sm"><summary className="cursor-pointer text-primary underline underline-offset-4 min-h-[24px]">{t('m.an.table')}</summary>
                <div className="max-h-64 overflow-auto mt-2"><table className="w-full text-left text-xs"><thead><tr className="text-muted"><th className="py-1 pr-2">{t('m.an.day')}</th><th className="py-1 pr-2">{name(metric)}</th>{prevVals && <th className="py-1">{t('m.an.prevPeriod')}</th>}</tr></thead>
                  <tbody>{points.map((p, i) => <tr key={p.day} className="border-t border-line"><td className="py-1 pr-2">{dayLabel(p.day)}</td><td className="py-1 pr-2">{fmtN(p.n)}</td>{prevVals && <td className="py-1">{fmtN(prevVals[i])}</td>}</tr>)}</tbody></table></div></details>
            </section>

            <section className="card space-y-3" aria-labelledby="an-cases">
              <h2 id="an-cases" className="h2">{t('m.an.cases')}</h2>
              <div className="flex flex-wrap items-center gap-4">
                <Donut parts={STAGES.map((s) => ({ key: s, n: stages[s] }))} total={allCases} totalLabel={t('m.an.casesTotal')} />
                <ul className="space-y-1.5 text-sm flex-1 min-w-[150px]">{STAGES.map((s, i) => (
                  <li key={s} className="flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2"><span className={`viz-key viz-c${i + 1}`} aria-hidden />{t(`m.an.st.${s}` as never)}</span><b>{stages[s]}</b></li>))}</ul>
              </div>
              <p className="text-xs text-muted">{t('m.an.casesNote')}</p>
            </section>
          </div>

          <section className="card space-y-2" aria-labelledby="an-heat">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 id="an-heat" className="h2">{t('m.an.activity')}</h2><p className="text-xs text-muted">{t('m.an.activitySub')}</p></div>
              <p className="text-xs text-muted flex items-center gap-1" aria-hidden>{t('m.an.less')}{[0, 1, 2, 3, 4].map((l) => <svg key={l} width="12" height="12"><rect width="12" height="12" rx="3" className={`viz-h${l}`} /></svg>)}{t('m.an.more')}</p>
            </div>
            <Heatmap weeks={weeks} max={max} weekdayLabels={wd} cellLabel={(d, n) => `${dayLabel(d)}: ${fmtN(n)}`} />
          </section>
          <p className="text-xs text-muted flex items-start gap-1.5"><Icon name="lock" size={13} className="mt-0.5" />{t('m.an.privacy')}</p>
        </>)
      })()}
    </Page>
  )
}
