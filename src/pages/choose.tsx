import { useI18n } from '../i18n'
import { go } from '../store'
import { useMatch } from '../matchData'
import { rememberNext } from '../auth'
import { Icon, type IconName } from '../components/icons'

/**
 * /choose-role — the step after "Start using C.A.L.L.": two roles only. Employer → place + needs on the map (/hire);
 * Job seeker → pins on the map (/seek). Admin is not offered here (administrators log in at the top right).
 * Choosing a role is a setting in this browser, not an account.
 *
 * Design (owner, Oct 2026): glass cards, each with its own colour (employer = indigo, job seeker = sky), what the role can
 * do, and a clear glass "Start as …" button. The whole card is clickable (the button stretches over it), screen readers hear
 * the role name and description first, and the list stays readable on its own.
 */
type RoleKey = 'employer' | 'seeker'
const ROLES: { role: RoleKey; to: string; icon: IconName; en: string }[] = [
  { role: 'employer', to: 'hire', icon: 'business', en: 'Employer' },
  { role: 'seeker', to: 'seek', icon: 'employment', en: 'Job Seeker' },
]

export function ChooseRolePage() {
  const { t, lang } = useI18n()
  const { setRole, mode } = useMatch()
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="text-center">
        <h1 className="h1">{t('m.role.title')}</h1>
        <p className="text-muted mt-1">{t('m.role.sub')}</p>
      </div>
      <ul className="grid md:grid-cols-2 auto-rows-fr gap-5">{ROLES.map((r) => (
        <li key={r.role} className={`glass-card role-card role-${r.role} p-6 flex flex-col gap-4`}>
          <span className="role-drop w-14 h-14" aria-hidden><Icon name={r.icon} size={26} /></span>
          <div>
            <h2 id={`role-${r.role}-t`} className="text-2xl font-bold">{t(`m.role.${r.role}`)}{lang !== 'en' && <span className="text-base font-medium text-muted" lang="en"> ({r.en})</span>}</h2>
            <p id={`role-${r.role}-d`} className="text-muted mt-1">{t(`m.role.${r.role}.d`)}</p>
          </div>
          <ul className="space-y-2.5 text-sm">{([1, 2, 3, 4] as const).map((n) => (
            <li key={n} className="flex items-start gap-2.5"><Icon name="check" size={17} className="role-tick shrink-0 mt-0.5" />{t(`m.role.${r.role}.p${n}`)}</li>))}</ul>
          <button type="button" className="role-cta mt-auto" aria-describedby={`role-${r.role}-d`} onClick={async () => { if (mode === 'signedOut' || mode === 'loading') { rememberNext(r.to, r.role); go(`login?next=${r.to}`); return } await setRole(r.role); go(r.to) }}>
            {t(`m.role.start.${r.role}`)}<Icon name="next" size={18} className="role-arrow" />
          </button>
        </li>))}</ul>
      <p className="text-center text-xs text-muted flex items-center justify-center gap-1.5"><Icon name="info" size={14} />{t('m.role.change')}</p>
    </div>
  )
}
