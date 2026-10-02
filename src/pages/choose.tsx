import { useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink, useStore } from '../store'
import { usePersona } from '../persona'
import { resolveEntry, PERSONAS, type EntryKind } from '../domain/jobboard/personas'
import { Warn } from '../components/ui'
import { SimulationNotice } from '../components/jobboard'
import { Icon, type IconName } from '../components/icons'

/**
 * /choose-role — the first step after "Start using C.A.L.L.". Three ways in:
 *  - Worker / Employer: select that role's seeded persona and open /jobs or /employer (simulated; selecting changes no records),
 *  - Business planning: the existing flow, unchanged (beginNew → map /start → interview).
 * The simulated reviewer (Admin) is deliberately not offered here; it stays in the persona menu as a demonstration role.
 */
const ROLE_CARDS: { kind: EntryKind; icon: IconName; get: 'choose.worker.get' | 'choose.employer.get' }[] = [
  { kind: 'worker', icon: 'employment', get: 'choose.worker.get' },
  { kind: 'employer', icon: 'business', get: 'choose.employer.get' },
]

export function ChooseRolePage() {
  const { t } = useI18n()
  const { enter } = usePersona()
  const { beginNew } = useStore()
  const [failed, setFailed] = useState(false)
  const name = (kind: EntryKind) => { const e = resolveEntry(kind); return e ? PERSONAS.find((p) => p.key === e.key)!.name : '' }
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="h1">{t('choose.title')}</h1>
        <p className="text-muted mt-1 max-w-3xl">{t('choose.sub')}</p>
      </div>
      <section aria-labelledby="choose-emp-h" className="space-y-3">
        <h2 id="choose-emp-h" className="h2 flex flex-wrap items-center gap-2">{t('choose.employment')}<span className="chip bg-warn-bg text-warn-fg border-warn-line">{t('choose.simBadge')}</span></h2>
        <ul className="grid md:grid-cols-2 gap-4">{ROLE_CARDS.map((c) => (
          <li key={c.kind}>
            <button type="button" className="card card-hover !p-5 w-full h-full text-left flex gap-4 items-start group border-primary/40"
              onClick={() => setFailed(!enter(c.kind))}>
              <span className="w-12 h-12 shrink-0 rounded-xl bg-brand text-brandfg grid place-items-center"><Icon name={c.icon} size={24} /></span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-lg sm:text-xl font-semibold group-hover:underline underline-offset-4">{t(`jb.lobby.${c.kind}.t` as never)}</span>
                <span className="block text-sm text-muted">{t(`jb.lobby.${c.kind}.d` as never, { name: name(c.kind) })}</span>
                <span className="block text-sm">{t(c.get)}</span>
              </span>
              <Icon name="next" size={20} className="text-primary mt-1" />
            </button>
          </li>))}</ul>
        <div role="alert">{failed && <Warn tone="danger">{t('choose.error')}</Warn>}</div>
        <SimulationNotice compact />
        <p className="text-xs text-muted">{t('persona.note')}</p>
      </section>
      <section aria-labelledby="choose-biz-h" className="space-y-2">
        <h2 id="choose-biz-h" className="text-base font-semibold text-muted">{t('choose.business.h')}</h2>
        {/* the existing business-planning flow, exactly as before: leaves the demo if active and opens the map (/start) */}
        <button type="button" className="card card-hover !p-4 w-full text-left flex gap-3 items-start group" onClick={beginNew}>
          <span className="w-10 h-10 shrink-0 rounded-xl bg-surface3 text-ink grid place-items-center"><Icon name="globe" size={20} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold group-hover:underline underline-offset-4">{t('choose.business.t')}</span>
            <span className="block text-sm text-muted">{t('choose.business.d')}</span>
          </span>
          <Icon name="next" size={18} className="text-primary mt-1" />
        </button>
      </section>
      <NavLink to="" className="btn-ghost inline-flex"><Icon name="back" size={16} />{t('choose.back')}</NavLink>
    </div>
  )
}
