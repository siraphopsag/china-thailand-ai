// Special posts at the top of the board (v2 model, owner Nov 2026): from government agencies (free notices), verified companies
// and partner law firms (sponsors — the "sponsor revenue" of the business model). Each is labelled with what it is, sponsors say
// "Sponsored" so nobody mistakes a paid post for an ordinary one, and there are never more than three. The prototype uses SAMPLE
// organisations only: no real agency, company or firm is named, so nothing suggests they have joined the project.
import { useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { Icon, type IconName } from '../components/icons'

export type SponsorKind = 'gov' | 'company' | 'law'
export interface Sponsored { id: string; kind: SponsorKind; key: string; to: string }
/** at most this many on the board at once */
export const MAX_SPONSORED = 3
export const SPONSORED: Sponsored[] = [
  { id: 'sp-gov', kind: 'gov', key: 'gov', to: 'prepare' },
  { id: 'sp-co', kind: 'company', key: 'co', to: 'contract' },
  { id: 'sp-law', kind: 'law', key: 'law', to: 'contract' },
]
const ICON: Record<SponsorKind, IconName> = { gov: 'legal', company: 'verified', law: 'documents' }
/** a paid post says so; a government notice is free */
export const isPaid = (k: SponsorKind) => k !== 'gov'

export function SponsoredStrip() {
  const { t } = useI18n()
  const [hide, setHide] = useState(false)
  if (hide) return <button type="button" className="shrink-0 self-start text-xs text-primary underline underline-offset-4 min-h-[24px]" onClick={() => setHide(false)}>{t('sp.show')}</button>
  return (
    <section className="shrink-0 space-y-1.5" aria-labelledby="sp-h">
      <div className="flex items-center justify-between gap-2"><h2 id="sp-h" className="text-sm font-semibold flex items-center gap-1.5"><Icon name="star" size={15} className="er-gold" />{t('sp.h')}</h2>
        <button type="button" className="text-xs text-muted underline underline-offset-4 min-h-[24px]" onClick={() => setHide(true)}>{t('sp.hide')}</button></div>
      <ul className="grid sm:grid-cols-3 gap-2">{SPONSORED.slice(0, MAX_SPONSORED).map((s) => (
        <li key={s.id}><NavLink to={s.to} className={`sp-card sp-${s.kind} flex flex-col gap-1 rounded-2xl border p-3 h-full`}>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="sp-badge"><Icon name={ICON[s.kind]} size={12} />{t(`sp.kind.${s.kind}` as never)}</span>
            {isPaid(s.kind) && <span className="chip bg-surface3 border-line text-[11px]">{t('sp.paid')}</span>}
            <span className="chip bg-surface3 text-muted border-line text-[11px]">{t('c.sample')}</span>
          </span>
          <span className="font-semibold text-sm leading-snug">{t(`sp.${s.key}.t` as never)}</span>
          <span className="text-xs text-muted">{t(`sp.${s.key}.org` as never)}</span>
          <span className="text-xs">{t(`sp.${s.key}.d` as never)}</span>
        </NavLink></li>))}</ul>
    </section>
  )
}
