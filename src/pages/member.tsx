import { useState } from 'react'
import { useI18n } from '../i18n'
import { useMatch } from '../matchData'
import { memberActive } from '../domain/match/logic'
import { FREE_POSTS_PER_WEEK, MEMBER_PINS_PER_WEEK, MEMBER_POSTS_PER_WEEK, PINS_PER_WEEK, PLANS, type PlanId } from '../domain/match/types'
import { Icon } from '../components/icons'
import { Page, Toast, useGate, useNames } from './match'

/**
 * Membership (owner, Oct 2026): three plans — 1 month 59 baht, 6 months 349 baht, 1 year 599 baht. The prices are shown struck
 * through and every plan is free during the trial; nothing is paid and no card details are asked for. A plan runs from today (or
 * adds on to a running membership); after it ends the account is back on the free allowances. Employers post 10 times per cycle
 * instead of 3, job seekers pin 10 places instead of 5.
 */
const fmt = (n: number, lang: string) => new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : lang === 'th' ? 'th-TH' : 'en-GB').format(n)

/** the three plans as cards; `compact` = inside the "posts used up" window */
export function PlanGrid({ compact, onJoined }: { compact?: boolean; onJoined?: (until: string) => void }) {
  const { t, lang } = useI18n()
  const { st, limitNow, subscribe, mode } = useMatch()
  const [busy, setBusy] = useState<PlanId | null>(null)
  const active = memberActive(st, limitNow)
  const monthly = PLANS[0].price
  const can = mode === 'local' || mode === 'remote'
  return (
    <ul className={`grid gap-3 ${compact ? 'sm:grid-cols-3' : 'md:grid-cols-3'}`}>{PLANS.map((p) => {
      const perMonth = Math.round(p.price / p.months)
      const save = Math.round((1 - p.price / (monthly * p.months)) * 100)
      const best = p.id === 'y1'
      return (
        <li key={p.id} className={`glass-card p-4 flex flex-col gap-2 ${best ? 'plan-best' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-lg">{t(`m.plan.${p.id}` as never)}</h3>
            {best && <span className="chip rar rar-1"><Icon name="star" size={11} className="fill-current" />{t('m.plan.best')}</span>}
          </div>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="price-was text-lg text-muted"><span className="sr-only">{t('m.pk.priceSr')} </span>{t('m.plan.price', { n: fmt(p.price, lang) })}</span>
            <span className="text-2xl font-bold text-ok-fg">{t('m.plan.free')}</span>
          </p>
          {p.months > 1 && <p className="text-xs text-muted">{t('m.plan.perMonth', { n: fmt(perMonth, lang) })}{save >= 5 ? ` · ${t('m.plan.save', { n: save })}` : ''}</p>}
          <button type="button" className={`${best ? 'btn-primary' : 'btn-ghost'} mt-auto justify-center`} disabled={!can || busy !== null}
            onClick={async () => { setBusy(p.id); const until = await subscribe(p.id); setBusy(null); if (until) onJoined?.(until) }}>
            <Icon name="crown" size={15} />{t(active ? 'm.plan.extend' : 'm.plan.join')}
          </button>
        </li>)
    })}</ul>
  )
}

export function MemberPage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, limitNow } = useMatch()
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const gate = useGate('member')
  if (gate) return <Page title={t('m.plan.title')}>{gate}</Page>
  const active = memberActive(st, limitNow)
  const perks: [string, string][] = [
    [t('m.plan.perkEmployer'), t('m.plan.perkEmployer.d', { from: FREE_POSTS_PER_WEEK, to: MEMBER_POSTS_PER_WEEK })],
    [t('m.plan.perkSeeker'), t('m.plan.perkSeeker.d', { from: PINS_PER_WEEK, to: MEMBER_PINS_PER_WEEK })],
    [t('m.plan.perkBadge'), t('m.plan.perkBadge.d')],
  ]
  return (
    <Page title={t('m.plan.title')} sub={t('m.plan.sub')}>
      <section className="glass-card p-4 flex flex-wrap items-center gap-3" aria-labelledby="mb-now">
        <span className="glass-drop w-10 h-10 shrink-0"><Icon name="crown" size={20} /></span>
        <div className="min-w-0">
          <h2 id="mb-now" className="font-semibold">{t('m.plan.status')}</h2>
          <p className="text-sm">{active ? (st.memberUntil ? t('m.plan.until', { d: N.day(st.memberUntil) }) : t('m.plan.member')) : t('m.plan.free.status')}</p>
        </div>
      </section>
      <Toast msg={msg} />
      <PlanGrid onJoined={(until) => setMsg({ tone: 'info', text: t('m.plan.done', { d: N.day(until) }) })} />
      <section className="glass-card p-5 space-y-3" aria-labelledby="mb-perks">
        <h2 id="mb-perks" className="h2">{t('m.plan.perks')}</h2>
        <ul className="space-y-2">{perks.map(([k, d]) => (
          <li key={k} className="flex items-start gap-2.5 text-sm"><Icon name="check" size={16} className="text-ok-fg mt-0.5 shrink-0" /><span><b>{k}</b> — {d}</span></li>))}</ul>
      </section>
      <p className="text-xs text-muted">{t('m.pk.note')}</p>
    </Page>
  )
}
