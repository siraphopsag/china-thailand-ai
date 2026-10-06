import { useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { useTheme } from '../theme'
import { localDay } from '../domain/match/logic'
import { EVENT_KINDS, calendarEvents, monthGrid, toIcs, type CalEvent, type EventKind } from '../domain/match/calendar'
import { Icon, type IconName } from '../components/icons'
import { Empty, Page, useGate } from './match'

/**
 * The calendar (owner, Oct 2026): a month with each appointment as a coloured label (icon + words, never colour alone), the
 * chosen day on the side, what is coming up, and a file for phone calendars. Job seekers see their courses, tests, departure and
 * first working day; employers the same for the workers they took on, plus when their posts end; the agency sees every case.
 * Days are set by the agency on the case page.
 */
const ICON: Record<EventKind, IconName> = { training: 'culture', test: 'plan', documents: 'documents', departure: 'plane', start: 'employment', expiry: 'hourglass' }
const locale = (l: string) => (l === 'zh' ? 'zh-CN' : l === 'th' ? 'th-TH' : 'en-GB')
const ymOf = (day: string) => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 })

export function useEventTitle() {
  const { t } = useI18n()
  const { st } = useMatch()
  return (e: CalEvent) => {
    const post = st.posts.find((p) => p.id === e.postId)
    const what = e.kind === 'training' ? (e.what.startsWith('@') ? t(`m.tr.${e.what.slice(1)}` as never) : e.what)
      : e.kind === 'test' ? t(`m.cs.test.${e.what}` as never) : t(`m.cal.k.${e.kind}` as never)
    const p = post?.position ?? '—'
    // courses and tests name the thing, so the kind goes in the second line; other kinds are their own name
    return { what, post: p, sub: e.kind === 'training' || e.kind === 'test' ? `${t(`m.cal.k.${e.kind}` as never)} · ${p}` : p }
  }
}

export function CalendarPage() {
  const { t, lang } = useI18n()
  const { st, now, agency, mode } = useMatch()
  const { weekStart } = useTheme()
  const title = useEventTitle()
  const today = localDay(new Date(now).toISOString())
  const [ym, setYm] = useState(() => ymOf(today))
  const [sel, setSel] = useState(today)
  const gate = useGate('calendar')
  if (gate) return <Page title={t('m.cal.title')}>{gate}</Page>
  if (!st.role && !agency) return <Page title={t('m.cal.title')}><Empty icon="bell" text={t('m.profile.none')} to="choose-role" action={t('hero.cta')} /></Page>

  // the local demo has no administrators: the agency's view would show the sample case to everyone, so follow the role there
  const events = calendarEvents(st, agency && mode !== 'local')
  const byDay = events.reduce<Record<string, CalEvent[]>>((m, e) => ({ ...m, [e.day]: [...(m[e.day] ?? []), e] }), {})
  const weeks = monthGrid(ym.y, ym.m, weekStart)
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(lang), o)
  const dayDate = (d: string) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))
  const monthName = fmt({ month: 'long', year: 'numeric' }).format(new Date(ym.y, ym.m, 1))
  const weekdays = weeks[0].map((d) => ({ short: fmt({ weekday: 'short' }).format(dayDate(d)), long: fmt({ weekday: 'long' }).format(dayDate(d)) }))
  const move = (k: number) => setYm(({ y, m }) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const goToday = () => { setYm(ymOf(today)); setSel(today) }
  const upcoming = events.filter((e) => e.day >= today).slice(0, 6)
  const selEvents = byDay[sel] ?? []
  const download = () => {
    const ics = toIcs(events.filter((e) => e.day >= today).map((e) => { const x = title(e); return { id: e.id, day: e.day, title: `${x.what} — ${x.post}` } }), new Date())
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })); a.download = 'call-calendar.ics'
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const link = (e: CalEvent) => (e.caseId ? `case?id=${e.caseId}` : `post?id=${e.postId}`)
  const Item = ({ e }: { e: CalEvent }) => { const x = title(e); return (
    <li><NavLink to={link(e)} className={`cal-ev cal-${e.kind} flex items-start gap-2 rounded-xl border px-3 py-2 hover:opacity-90`}>
      <Icon name={ICON[e.kind]} size={16} className="mt-0.5 shrink-0" /><span className="min-w-0"><span className="block font-medium text-sm">{x.what}</span><span className="block text-xs opacity-85">{x.sub}</span></span>
    </NavLink></li>) }

  return (
    <Page title={t('m.cal.title')} sub={t(agency && mode !== 'local' ? 'm.cal.subAgency' : st.role === 'employer' ? 'm.cal.subEmployer' : 'm.cal.subSeeker')}>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <section className="card space-y-3" aria-labelledby="cal-month">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="cal-month" className="h2" aria-live="polite">{monthName}</h2>
            <div className="flex items-center gap-1.5">
              <button type="button" className="w-10 h-10 grid place-items-center rounded-full border border-control hover:bg-surface3" onClick={() => move(-1)} aria-label={t('m.cal.prev')}><Icon name="left" size={18} /></button>
              <button type="button" className="btn-ghost text-sm" onClick={goToday}><Icon name="calendar" size={15} />{t('m.cal.today')}</button>
              <button type="button" className="w-10 h-10 grid place-items-center rounded-full border border-control hover:bg-surface3" onClick={() => move(1)} aria-label={t('m.cal.next')}><Icon name="right" size={18} /></button>
            </div>
          </div>
          <div role="grid" aria-labelledby="cal-month" className="space-y-1.5">
            <div role="row" className="grid grid-cols-7 gap-1.5">{weekdays.map((w) => <div key={w.long} role="columnheader" aria-label={w.long} className="text-center text-xs font-semibold text-muted uppercase">{w.short}</div>)}</div>
            {weeks.map((wk) => (
              <div key={wk[0]} role="row" className="grid grid-cols-7 gap-1.5">{wk.map((d) => {
                const evs = byDay[d] ?? [], inMonth = ymOf(d).m === ym.m, isToday = d === today, isSel = d === sel
                return (
                  <div key={d} role="gridcell" aria-selected={isSel}>
                    <button type="button" onClick={() => setSel(d)} aria-label={`${fmt({ dateStyle: 'full' }).format(dayDate(d))}${evs.length ? ` · ${t('m.cal.count', { n: evs.length })}` : ''}`}
                      className={`w-full min-h-[52px] sm:min-h-[84px] rounded-xl p-1.5 text-left flex flex-col gap-1 border transition-colors ${isSel ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'} ${inMonth ? 'bg-surface2 hover:bg-surface3' : 'opacity-45 hover:opacity-80'}`}>
                      <span className={`text-xs font-semibold w-6 h-6 grid place-items-center rounded-full ${isToday ? 'bg-primary text-onprimary' : ''}`}>{Number(d.slice(8, 10))}</span>
                      {/* phones: dots · wider screens: labels */}
                      {evs.length > 0 && <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden>{evs.slice(0, 4).map((e) => <span key={e.id} className={`cal-dot cal-${e.kind}`} />)}</span>}
                      <span className="hidden sm:flex flex-col gap-0.5 min-w-0" aria-hidden>{evs.slice(0, 2).map((e) => <span key={e.id} className={`cal-ev cal-${e.kind} truncate rounded-md border px-1 text-[11px] leading-5`}>{title(e).what}</span>)}
                        {evs.length > 2 && <span className="text-[11px] text-muted">+{evs.length - 2}</span>}</span>
                    </button>
                  </div>)
              })}</div>))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-line text-xs" aria-label={t('m.cal.legend')}>{EVENT_KINDS.filter((k) => k !== 'expiry' || st.role === 'employer').map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5"><span className={`cal-dot cal-${k}`} aria-hidden /><Icon name={ICON[k]} size={13} />{t(`m.cal.k.${k}` as never)}</li>))}</ul>
        </section>

        <aside className="space-y-4 min-w-0" aria-label={t('m.cal.side')}>
          <section className="glass-card p-4 space-y-2" aria-labelledby="cal-day">
            <p className="text-xs font-semibold text-primary uppercase">{sel === today ? t('m.cal.todayIs', { d: fmt({ weekday: 'long' }).format(dayDate(sel)) }) : fmt({ weekday: 'long' }).format(dayDate(sel))}</p>
            <h2 id="cal-day" className="h2">{fmt({ day: 'numeric', month: 'long' }).format(dayDate(sel))}</h2>
            {selEvents.length ? <ul className="space-y-2">{selEvents.map((e) => <Item key={e.id} e={e} />)}</ul> : <p className="text-sm text-muted">{t('m.cal.free')}</p>}
          </section>
          <section className="glass-card p-4 space-y-2" aria-labelledby="cal-next">
            <h2 id="cal-next" className="h2">{t('m.cal.upcoming')}</h2>
            {upcoming.length ? <ul className="space-y-2">{upcoming.map((e) => (
              <li key={e.id} className="flex items-start gap-3">
                <span className="w-11 shrink-0 rounded-lg bg-brand text-brandfg text-center py-1 leading-tight"><span className="block text-[10px] uppercase">{fmt({ month: 'short' }).format(dayDate(e.day))}</span><span className="block font-bold">{Number(e.day.slice(8, 10))}</span></span>
                <NavLink to={link(e)} className="min-w-0 hover:underline underline-offset-4"><span className="block text-sm font-medium">{title(e).what}</span><span className="block text-xs text-muted">{title(e).sub}</span></NavLink>
              </li>))}</ul> : <p className="text-sm text-muted">{t('m.cal.none')}</p>}
            {upcoming.length > 0 && <button type="button" className="btn-ghost text-sm w-full justify-center" onClick={download}><Icon name="plus" size={15} />{t('m.cal.ics')}</button>}
            <p className="text-xs text-muted">{t('m.cal.note')}</p>
          </section>
        </aside>
      </div>
    </Page>
  )
}
