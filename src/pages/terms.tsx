// Terms of use (owner, Oct 2026): what the platform is and is not under Thai and Chinese law — an information and matching
// board; recruiting and sending workers abroad is done by the Department of Employment or a licensed agency; workers never pay.
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { Warn } from '../components/ui'

const PARTS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const
export function TermsPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-4 sm:space-y-5 max-w-3xl lg:max-w-none">
      <header><h1 className="h1">{t('m.tm.title')}</h1><p className="text-muted mt-1">{t('m.tm.sub')}</p></header>
      <Warn>{t('m.tm.key')}</Warn>
      <div className="card text-sm grid lg:grid-cols-2 gap-x-8 gap-y-4">{PARTS.map((k) => (
        <section key={k} aria-labelledby={`tm-${k}`}><h2 id={`tm-${k}`} className="font-semibold text-base">{k}. {t(`m.tm.${k}.h` as never)}</h2><p className="text-muted mt-1 whitespace-pre-line">{t(`m.tm.${k}.t` as never)}</p></section>))}
      </div>
      <p className="text-sm"><NavLink to="privacy" className="text-primary underline underline-offset-4 inline-flex items-center min-h-[24px]">{t('m.auth.privacy')}</NavLink></p>
      <p className="text-xs text-muted">{t('m.tm.updated')}</p>
    </div>
  )
}
