import { NavLink } from '../store'
import { Disclaimer } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { BRAND, BRAND_CONCEPTS } from '../brand'
import { Glow } from '../components/backdrop'
import { BackgroundPaths } from '../components/ui/background-paths'
import { useI18n } from '../i18n'

/** the main parts of the system and the problem each one answers (lobby) */
const SYSTEMS: [number, IconName][] = [[1, 'pin'], [2, 'target'], [3, 'verified'], [4, 'shield'], [5, 'plane'], [6, 'chart']]

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
      {/* liquid-glass cards (owner, Oct 2026); the soft coloured light they show comes from the page background */}
      <div className="space-y-14">
        <section aria-labelledby="stands-h" className="space-y-4">
          <div><h2 id="stands-h" className="text-2xl font-bold">{t('m.problems.h')}</h2><p className="text-muted mt-1">{t('brand.stands')} Cross · ASEAN · Language · Legal</p></div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr gap-3">{BRAND_CONCEPTS.map((c, i) => (
            <li key={i} className="glass-card !p-4 space-y-2"><div className="flex items-center gap-2.5" lang="en"><span className="glass-drop w-9 h-9 text-lg">{c.letter}</span><span className="font-semibold">{c.word}</span></div><p className="text-sm text-muted">{t(('brand.' + c.key) as never)}</p></li>))}</ul>
          <p className="text-xs text-muted">{t('brand.together')}</p>
        </section>
        <section aria-labelledby="how-h" className="space-y-4">
          <h2 id="how-h" className="text-2xl font-bold">{t('m.how.h')}</h2>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr gap-3">{[1, 2, 3, 4].map((n) => (
            <li key={n} className="glass-card !p-4 flex gap-3 items-start"><span className="glass-drop w-8 h-8 shrink-0">{n}</span>
              <span className="pt-1 min-w-0"><span className="block font-semibold leading-snug">{t(`m.how.${n}.t` as never)}</span><span className="block text-sm text-muted mt-1">{t(`m.how.${n}` as never)}</span></span></li>))}</ol>
        </section>
        {/* owner, Oct 2026: say in the lobby how each part works and which problem it answers */}
        <section aria-labelledby="sys-h" className="space-y-4">
          <h2 id="sys-h" className="text-2xl font-bold">{t('m.sys.h')}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr gap-3">{SYSTEMS.map(([n, icon]) => (
            <li key={n} className="glass-card !p-4 space-y-2">
              <p className="text-sm text-muted flex items-start gap-2"><Icon name="alert" size={15} className="mt-0.5 shrink-0" /><span>{t(`m.sys.${n}.p` as never)}</span></p>
              <p className="flex items-start gap-2.5"><span className="glass-drop w-8 h-8 shrink-0"><Icon name={icon} size={16} /></span><span className="text-sm pt-1">{t(`m.sys.${n}` as never)}</span></p>
            </li>))}</ul>
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
