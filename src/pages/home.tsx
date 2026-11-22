import { NavLink } from '../store'
import { Disclaimer } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { BRAND, BRAND_CONCEPTS } from '../brand'
import { Glow } from '../components/backdrop'
import { BackgroundPaths } from '../components/ui/background-paths'
import { useI18n } from '../i18n'
import { minMonthlyWage } from '../domain/match/minwage'

/**
 * The full journey (v2 model, owner Nov 2026: "C.A.L.L. runs the whole cycle itself"; the lobby tells it as one path in three
 * systems instead of separate cards). Each system names the problem it answers, what it does (every line opens that part), the
 * laws it rests on and one button to try it. Only parts that exist in the prototype are listed.
 */
type Stage = { k: 'front' | 'middle' | 'end'; icon: IconName; to: string; feats: { k: string; icon: IconName; to: string }[]; laws: string[] }
export const JOURNEY: Stage[] = [
  { k: 'front', icon: 'pin', to: 'board', laws: ['jr.law.foreign', 'jr.law.minwage'], feats: [
    { k: 'match', icon: 'store', to: 'board' }, { k: 'rules', icon: 'legal', to: 'hire' }, { k: 'verify', icon: 'verified', to: 'me' }, { k: 'track', icon: 'plane', to: 'case-demo' }] },
  { k: 'middle', icon: 'documents', to: 'contract', laws: ['jr.law.cnLcl', 'jr.law.thLpa', 'jr.law.eta'], feats: [
    { k: 'contract', icon: 'documents', to: 'contract' }, { k: 'passport', icon: 'personCheck', to: 'contract' }, { k: 'firm', icon: 'legal', to: 'contract' }, { k: 'sign', icon: 'edit', to: 'contract' }] },
  { k: 'end', icon: 'shield', to: 'sos', laws: ['jr.law.tip', 'jr.law.actip'], feats: [
    { k: 'arrive', icon: 'plane', to: 'case-demo' }, { k: 'hotline', icon: 'phone', to: 'sos' }, { k: 'pack', icon: 'documents', to: 'sos' }, { k: 'prepare', icon: 'culture', to: 'prepare' }] },
]

export function Journey() {
  const { t } = useI18n()
  const th = minMonthlyWage('TH', 'TH-10')
  return (
    <section aria-labelledby="jr-h" className="space-y-6">
      <div className="text-center max-w-3xl mx-auto">
        <p className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs font-semibold"><Icon name="shield" size={14} className="text-primary" />{t('jr.kicker')}</p>
        <h2 id="jr-h" className="text-2xl sm:text-3xl font-bold mt-3">{t('jr.h')}</h2>
        <p className="text-muted mt-2">{t('jr.sub')}</p>
      </div>
      <ol className="jr-path relative grid lg:grid-cols-3 gap-5 lg:gap-4">
        {JOURNEY.map((s, i) => (
          <li key={s.k} className={`jr-stage jr-${s.k} relative flex flex-col rounded-3xl border p-5 pt-6`}>
            <div className="flex items-center gap-3">
              <span className="jr-node" aria-hidden>{i + 1}</span>
              <div className="min-w-0"><p className="jr-kicker text-xs font-bold uppercase tracking-wider">{t(`jr.${s.k}.k` as never)}</p>
                <h3 className="text-lg font-bold leading-snug">{t(`jr.${s.k}.t` as never)}</h3></div>
            </div>
            <p className="jr-problem mt-4 text-sm flex items-start gap-2"><Icon name="alert" size={15} className="mt-0.5 shrink-0" /><span>{t(`jr.${s.k}.p` as never)}</span></p>
            <ul className="mt-3 space-y-1">{s.feats.map((f) => (
              <li key={f.k}><NavLink to={f.to} className="jr-feat flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm min-h-touch">
                <span className="jr-ic"><Icon name={f.icon} size={16} /></span><span className="flex-1 min-w-0">{t(`jr.f.${f.k}` as never, { th: (th?.monthly ?? 0).toLocaleString('en-US') } as never)}</span><Icon name="right" size={15} className="opacity-60 shrink-0" />
              </NavLink></li>))}</ul>
            <div className="mt-auto pt-4 space-y-3">
              <p className="flex flex-wrap gap-1.5" aria-label={t('jr.laws')}>{s.laws.map((l) => <span key={l} className="jr-law"><Icon name="legal" size={12} />{t(l as never)}</span>)}</p>
              <NavLink to={s.to} className="jr-go">{t(`jr.${s.k}.go` as never)}<Icon name="next" size={16} /></NavLink>
            </div>
          </li>))}
      </ol>
    </section>
  )
}

export function Landing() {
  const { t } = useI18n()
  return (
    <div className="space-y-14 max-w-5xl mx-auto">
      <section className="hero-shell relative isolate overflow-hidden rounded-3xl border border-line px-5 pt-14 pb-10 sm:px-10 md:pt-20 md:pb-14 text-center" aria-labelledby="hero-h">
        <Glow />
        <div className="relative z-[1] max-w-4xl mx-auto">
          <p className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 text-xs sm:text-sm font-medium" lang="en"><Icon name="globe" size={15} className="text-primary" />{BRAND.title}</p>
          {/* size follows the screen width, so the longer English headline keeps about the same number of lines as Thai and Chinese */}
          <h1 id="hero-h" className="hero-title mt-6 font-bold text-ink">
            <span className="block">{t('m.hero.h1a')}</span><span className="block text-gradient pb-1">{t('m.hero.h1b')}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-ink max-w-2xl mx-auto">{t('m.hero.sub')}</p>
          <div className="mt-8 flex justify-center">
            <span className="cta-ring"><NavLink to="choose-role" className="cta-core text-base">{t('hero.cta')}<Icon name="next" size={18} /></NavLink></span>
          </div>
          <p className="mt-4 text-xs text-muted">{t('m.proto')}</p>
        </div>
        {/* the moving lines sit behind the content (z-index); their on/off switch is in Settings */}
        <BackgroundPaths />
      </section>
      {/* owner, Nov 2026: the middle of the lobby is the full journey (front → middle → end); the C.A.L.L. letters stay */}
      <Journey />
      <div className="space-y-14">
        <section aria-labelledby="stands-h" className="space-y-4">
          <div><h2 id="stands-h" className="text-2xl font-bold">{t('m.problems.h')}</h2><p className="text-muted mt-1">{t('brand.stands')} Cross · ASEAN · Language · Legal</p></div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr gap-3">{BRAND_CONCEPTS.map((c, i) => (
            <li key={i} className="glass-card !p-4 space-y-2"><div className="flex items-center gap-2.5" lang="en"><span className="glass-drop w-9 h-9 text-lg">{c.letter}</span><span className="font-semibold">{c.word}</span></div><p className="text-sm text-muted">{t(('brand.' + c.key) as never)}</p></li>))}</ul>
          <p className="text-xs text-muted">{t('brand.together')}</p>
        </section>
        <section aria-labelledby="simwhat-h" className="rounded-2xl border border-warn-line bg-warn-bg text-warn-fg p-4 sm:p-5 space-y-1.5">
          <h2 id="simwhat-h" className="text-lg font-bold flex items-center gap-2"><Icon name="sim" size={18} />{t('m.simwhat.h')}</h2>
          <p className="text-sm">{t('m.simwhat')}</p>
        </section>
      </div>
      <Disclaimer />
    </div>
  )
}
