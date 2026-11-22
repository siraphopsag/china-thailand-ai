// The floating help button (v2 model, owner Nov 2026): job seekers reach the help page (emergency numbers, report pack) from
// every page in one tap. It sits above the phone menu capsule and leaves room for it; it is hidden when printing.
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { Icon } from './icons'

export function SosButton() {
  const { t } = useI18n()
  return (
    <NavLink to="sos" className="fixed right-4 z-40 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] md:bottom-6 inline-flex items-center gap-2 rounded-full border border-danger-line bg-danger-bg text-danger-fg font-semibold px-4 min-h-touch shadow-lg print:hidden">
      <Icon name="phone" size={18} />{t('hp.button')}</NavLink>
  )
}
