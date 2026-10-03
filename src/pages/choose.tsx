import { useI18n } from '../i18n'
import { go } from '../store'
import { useMatch } from '../matchData'
import { Icon, type IconName } from '../components/icons'

/**
 * /choose-role — the step after "Start using C.A.L.L.": two roles only. Employer → place + needs on the map (/hire);
 * Job seeker → pins on the map (/seek). Admin is not offered here (administrators log in at the top right).
 * Choosing a role is a setting in this browser, not an account.
 */
const ROLES: { role: 'employer' | 'seeker'; to: string; icon: IconName; t: 'm.role.employer' | 'm.role.seeker'; d: 'm.role.employer.d' | 'm.role.seeker.d'; en: string }[] = [
  { role: 'employer', to: 'hire', icon: 'business', t: 'm.role.employer', d: 'm.role.employer.d', en: 'Employer' },
  { role: 'seeker', to: 'seek', icon: 'employment', t: 'm.role.seeker', d: 'm.role.seeker.d', en: 'Job Seeker' },
]

export function ChooseRolePage() {
  const { t, lang } = useI18n()
  const { setRole } = useMatch()
  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4">
      <div className="text-center">
        <h1 className="h1">{t('m.role.title')}</h1>
        <p className="text-muted mt-1">{t('m.role.sub')}</p>
      </div>
      <ul className="grid sm:grid-cols-2 gap-4">{ROLES.map((r) => (
        <li key={r.role}>
          <button type="button" className="glass-card !p-6 w-full h-full text-left flex flex-col gap-3 group" onClick={() => { setRole(r.role); go(r.to) }}>
            <span className="w-14 h-14 rounded-2xl bg-brand text-brandfg grid place-items-center"><Icon name={r.icon} size={28} /></span>
            <span className="block text-2xl font-bold group-hover:underline underline-offset-4">{t(r.t)}{lang !== 'en' && <span className="text-base font-medium text-muted" lang="en"> ({r.en})</span>}</span>
            <span className="block text-muted">{t(r.d)}</span>
            <Icon name="next" size={22} className="text-primary mt-auto self-end" />
          </button>
        </li>))}</ul>
    </div>
  )
}
