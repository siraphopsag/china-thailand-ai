// The floating help button (v2 model, owner Nov 2026): job seekers reach the help page (emergency numbers, report pack) from
// every page in one tap. It sits above the phone menu capsule and leaves room for it; it is hidden when printing.
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { Icon } from './icons'

export function SosButton() {
  const { t } = useI18n()
  return (
    // phones: a round floating button above the menu; computers and tablets: in the header (owner, 27 Nov 2026: the floating pill sat on
    // inputs and buttons of pages that fit the screen). Before: a wide pill on every screen.
    // phones: a round button (owner, 27 Nov 2026: the wide pill covered headings, buttons and the chat's phrases); the words show from md up
    <NavLink to="sos" aria-label={t('hp.button')} title={t('hp.button')} className="fixed right-3 md:right-4 z-40 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] md:hidden inline-flex items-center justify-center rounded-full border border-danger-line bg-danger-bg text-danger-fg w-12 h-12 shadow-lg print:hidden">
      <Icon name="phone" size={20} /></NavLink>
  )
}

/** computers and tablets: the same help link in the header, where it never covers the page */
export function SosHeaderLink() {
  const { t } = useI18n()
  return <NavLink to="sos" className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-danger-line bg-danger-bg text-danger-fg text-xs font-semibold print:hidden"><Icon name="phone" size={14} />{t('hp.button')}</NavLink>
}
