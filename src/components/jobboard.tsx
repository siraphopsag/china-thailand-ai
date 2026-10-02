import { useI18n } from '../i18n'
import type { Persona } from '../domain/jobboard/personas'
import { SampleTag, Warn } from './ui'

/** "Worker · Ploy" / "Visitor": localized role plus the persona's invented name (if any). */
export function usePersonaLabel() {
  const { t } = useI18n()
  return (p: Persona) => { const role = t(`persona.role.${p.kind}` as never); return p.name ? `${role} · ${p.name}` : role }
}

/** Small tag for anything built from synthetic records. */
export const FictionalTag = () => { const { t } = useI18n(); return <SampleTag text={t('persona.fictional')} /> }

/**
 * The job-board simulation notice. `compact` shows one line with the details folded away (for the Lobby and menus);
 * the full form lists every limitation. Only for job-board PoC surfaces, not the business-planning or legal pages.
 */
export function SimulationNotice({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const points = (['jb.notice.1', 'jb.notice.2', 'jb.notice.3', 'jb.notice.4'] as const).map((k) => <li key={k}>{t(k)}</li>)
  if (compact) return (
    <Warn tone="info"><p className="font-semibold">{t('jb.notice.short')}</p>
      <details className="mt-1"><summary className="cursor-pointer underline underline-offset-2 inline-flex items-center min-h-[24px]">{t('jb.notice.more')}</summary><ul className="list-disc ml-5 mt-1 space-y-0.5">{points}</ul></details></Warn>
  )
  return <Warn tone="info"><p className="font-semibold">{t('jb.notice.t')}</p><ul className="list-disc ml-5 mt-1 space-y-0.5">{points}</ul></Warn>
}
