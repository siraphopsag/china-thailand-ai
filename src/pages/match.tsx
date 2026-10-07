import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { LANGS, useI18n } from '../i18n'
import { ACCENTS, useTheme } from '../theme'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { provinces } from '../locales/provinces'
import { activePins, capacityOf, inbox, isCountry, memberActive, pinQuota, type Problem } from '../domain/match/logic'
import { DAY_MS, reachFor, scheduleOf, stageAt, type Quota, capStage } from '../domain/match/release'
import { INDUSTRIES, MY_EMPLOYER, PIN_LIFE_DAYS, SKILLS, type Acceptance, type Benefit, type Country, type Edu, type Employment, type Industry, type LanguageSkill, type Level, type Post, type Salary, type Skill } from '../domain/match/types'
import { ACTIVE, GEO, SOON, type GeoCode } from '../geo'
import capitalsData from '../data/geo/capitals.json'
import { GeoMap, type MapPin } from '../components/geomap'
import { ListSelect } from '../components/listselect'
import { Warn } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { useConfirm } from '../components/confirm'
import { PagedList } from '../components/pager'
import { Drawer } from '../components/drawer'
import { motionOff, setMotionOff } from '../components/ui/background-paths'
import { NeedLogin } from './auth'
import { VerifyCard } from './case'
import { currentStep, stepsDone } from '../domain/match/cases'

/**
 * Pages of the matching prototype. Data stay in this browser or the project's database (see matchData.tsx); after a match the
 * case is followed on pages/case.tsx, where an administrator plays the agency. Links to agencies open their official websites.
 */
const CAPITALS = capitalsData as { country: GeoCode; name: string }[]
const AGENCIES = [{ key: 'm.agency.doe', url: 'https://www.doe.go.th/' }, { key: 'm.agency.dsd', url: 'https://www.dsd.go.th/' }] as const

export function useNames() {
  const { t, lang } = useI18n()
  const collator = useMemo(() => new Intl.Collator(lang === 'zh' ? 'zh-CN' : lang), [lang])
  return {
    country: (c: GeoCode) => t(`geo.c.${c}` as never), prov: (p: string) => t(`prov.${p}` as never),
    place: (c: GeoCode, p: string) => `${t(`prov.${p}` as never)}, ${t(`geo.c.${c}` as never)}`,
    skill: (s: Skill) => t(`jb.skill.${s}` as never), industry: (i: Industry) => t(`jb.industry.${i}` as never),
    provList: (c: Country) => Object.keys(provinces).filter((k) => k.startsWith(`prov.${c}-`)).map((k) => k.slice(5)).sort((a, b) => collator.compare(t(`prov.${a}` as never), t(`prov.${b}` as never))),
    problem: (p: Problem) => t(`m.err.${p}` as never),
    employment: (e: Employment) => t(`m.emp.type.${e}` as never),
    edu: (e: Edu) => t(`m.edu.${e}`),
    lang: (l: LanguageSkill['lang']) => t(`jb.lang.${l}` as never), level: (l: LanguageSkill['level']) => t(`jb.level.${l}` as never),
    benefit: (b: Benefit) => t(`m.ben.${b}` as never),
    money: (s: Salary) => { const f = new Intl.NumberFormat(locale(lang)); return `${f.format(s.min)}–${f.format(s.max)} ${t(`m.cur.${s.currency}` as never)}${t('m.perMonth')}` },
    day: (d: string) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(d.length === 10 ? d + 'T00:00:00Z' : d)),
    /** a moment on the (demo) clock: day, month and time */
    dayTime: (ms: number) => new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)),
  }
}
const locale = (l: string) => (l === 'zh' ? 'zh-CN' : l === 'th' ? 'th-TH' : 'en-GB')
/** "3 hours ago" / "in 5 days" in the visitor's language, against the demo clock */
export function useRel() {
  const { lang } = useI18n()
  const { now } = useMatch()
  const fmt = (ms: number, sign: 1 | -1) => {
    const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' })
    const s = Math.max(0, ms) / 1000
    if (s < 3600) return rtf.format(sign * Math.max(1, Math.round(s / 60)), 'minute')
    if (s < 86400) return rtf.format(sign * Math.round(s / 3600), 'hour')
    if (s < 86400 * 45) return rtf.format(sign * Math.round(s / 86400), 'day')
    return rtf.format(sign * Math.round(s / (86400 * 30)), 'month')
  }
  return { ago: (iso: string) => fmt(now - Date.parse(iso), -1), until: (ms: number) => fmt(ms - now, 1) }
}
/**
 * The details an employer gives (Oct 2026): people, type, salary, start, languages, education, benefits. Posts saved before
 * these fields existed show "not stated". Used on my posts, the post page, job seekers' notifications and the back office.
 */
export function PostFacts({ post, compact }: { post: Post; compact?: boolean }) {
  const { t } = useI18n()
  const N = useNames()
  const ns = t('m.notStated')
  const rows: [IconName, string, string][] = [
    ['user', t('m.f.headcount'), post.headcount === null ? ns : t('m.people', { n: post.headcount })],
    ['posts', t('m.f.employment'), post.employment ? N.employment(post.employment) : ns],
    ['funding', t('m.f.salary'), post.salary ? N.money(post.salary) : ns],
    ['plan', t('m.f.start'), post.startDate ? N.day(post.startDate) : ns],
    ['language', t('m.f.languages'), post.languages.length ? post.languages.map((l) => `${N.lang(l.lang)}: ${N.level(l.level)}`).join(' · ') : ns],
    ['culture', t('m.f.education'), N.edu(post.education)],
    ['ok', t('m.f.benefits'), post.benefits.length ? post.benefits.map(N.benefit).join(' · ') : ns],
  ]
  if (compact) return <p className="text-sm text-muted">{rows.filter(([, , v]) => v !== ns).map(([, , v]) => v).join(' · ') || ns}</p>
  return (
    <dl className="grid sm:grid-cols-2 gap-x-5 gap-y-2.5 text-sm">{rows.map(([icon, k, v]) => (
      <div key={k} className="flex items-start gap-2.5"><Icon name={icon} size={16} className="text-primary mt-0.5 shrink-0" /><div><dt className="text-muted text-xs">{k}</dt><dd className="font-medium">{v}</dd></div></div>))}</dl>
  )
}
export function Page({ title, sub, actions, fit, body, children }: { title: string; sub?: string; actions?: ReactNode; fit?: boolean; body?: string; children: ReactNode }) {
  const head = <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 shrink-0"><div className="min-w-0"><h1 className="h1">{title}</h1>{sub && <p className="text-muted text-sm sm:text-base mt-0.5 sm:mt-1 max-w-3xl line-clamp-2 sm:line-clamp-none">{sub}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>
  if (!fit) return <div className="space-y-4 sm:space-y-5">{head}{children}</div>
  return <div className="space-y-4 sm:space-y-5 fit:space-y-0 fit:flex fit:flex-col fit:gap-3 fit:h-[var(--app-h)]">{head}<div className={`fit:flex-1 fit:min-h-0 ${body ?? 'space-y-4 fit:space-y-3 fit:overflow-hidden'}`}>{children}</div></div>
}
/** a sample post made for the prototype (not a real employer) */
export function SampleBadge() {
  const { t } = useI18n()
  return <span className="chip bg-surface3 text-muted border-line" title={t('m.sample.d')}><Icon name="info" size={12} />{t('m.sample.badge')}</span>
}
/** a short message in a live region (pin added, posted, accepted …) */
export function Toast({ msg }: { msg: { tone: 'info' | 'danger'; text: string } | null }) {
  return <div role="status" aria-live="polite">{msg && <Warn tone={msg.tone}>{msg.text}</Warn>}</div>
}
/**
 * WCAG 3.3.1 / 1.3.1: a form error is shown under the field it belongs to, the field is marked invalid and described by it,
 * and focus moves to that field. `key` names the field group, `focus` the control to focus.
 */
export function useFieldError() {
  const [err, setErr] = useState<{ key: string; focus: string; text: string } | null>(null)
  useEffect(() => { if (err) document.getElementById(err.focus)?.focus() }, [err])
  return {
    set: (key: string, focus: string, text: string) => setErr({ key, focus, text }),
    clear: () => setErr(null),
    invalid: (key: string) => err?.key === key || undefined,
    describe: (key: string, ...more: string[]) => [err?.key === key ? `${key}-err` : '', ...more].filter(Boolean).join(' ') || undefined,
    msg: (key: string) => err?.key === key ? <p id={`${key}-err`} className="text-sm text-danger-fg flex items-center gap-1.5 mt-1"><Icon name="alert" size={15} />{err.text}</p> : null,
  }
}
export type FieldError = ReturnType<typeof useFieldError>
/** WCAG 3.3.2: required fields say so in their label */
export function Req() {
  const { t } = useI18n()
  return <span className="font-normal text-muted"> ({t('m.req')})</span>
}
/** nothing to show yet: say why and offer the next step, so no page is a dead end */
export function Empty({ icon, text, to, action }: { icon: 'bell' | 'pin' | 'posts'; text: string; to?: string; action?: string }) {
  return (
    <div className="glass-card p-5 flex flex-col items-center text-center gap-3 !py-8">
      <span className="w-12 h-12 rounded-2xl bg-brand text-brandfg grid place-items-center"><Icon name={icon} size={22} /></span>
      <p className="text-muted max-w-sm">{text}</p>
      {to && action && <NavLink to={to} className="btn-primary">{action}<Icon name="next" size={16} /></NavLink>}
    </div>
  )
}
/** null when the page can show its content; otherwise what to show instead (a wait, or "sign in first") */
export function useGate(here: string): ReactNode | null {
  const { t } = useI18n()
  const { mode } = useMatch()
  if (mode === 'loading') return <p className="text-muted py-10 text-center" role="status">{t('c.loading')}</p>
  if (mode === 'signedOut') return <NeedLogin here={here} />
  return null
}
export function NeedRole({ role }: { role: 'seeker' | 'employer' }) {
  const { t } = useI18n()
  return <div className="glass-card p-5 space-y-3"><p>{t('m.profile.none')}</p><NavLink to="choose-role" className="btn-primary inline-flex">{t(role === 'seeker' ? 'm.role.seeker' : 'm.role.employer')}<Icon name="next" size={16} /></NavLink></div>
}

/** country buttons + province list, shown next to the map */
/**
 * Country list with every ASEAN country (+ China). Only Thailand and China are open today; choosing another one frames it on the
 * map, shows its capital and a "coming soon" note, and keeps the province list and the next step closed. Nothing is saved for it.
 */
export function PlaceFields({ country, province, onCountry, onProvince, idp, fe }: { country: GeoCode | null; province: string | null; onCountry: (c: GeoCode) => void; onProvince: (p: string | null) => void; idp: string; fe: FieldError }) {
  const { t } = useI18n()
  const N = useNames()
  const open = isCountry(country)
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {/* the lists open below the field: countries = open now + ~5 coming soon (greyed, scroll for more); provinces = 10 rows, scroll for more */}
        <div><label id={`${idp}-cl`} htmlFor={`${idp}-c`} className="label">{t('m.country')}<Req /></label>
          <ListSelect id={`${idp}-c`} labelId={`${idp}-cl`} required invalid={fe.invalid(idp)} describedBy={fe.describe(idp)} value={country} placeholder={t('m.chooseCountry')} maxRows={7}
            onChange={(v) => { if (v in GEO) onCountry(v as GeoCode) }}
            groups={[{ label: t('m.countryOpen'), dot: true, options: ACTIVE.map((c) => ({ value: c, label: N.country(c) })) }, { label: t('geo.soon'), note: t('m.soonNote'), icon: 'clock', itemIcon: 'clock', badge: t('geo.soon'), muted: true, options: SOON.map((c) => ({ value: c, label: N.country(c) })) }]} /></div>
        <div><label id={`${idp}-pl`} htmlFor={idp} className="label">{t('m.province')}<Req /></label>
          <ListSelect id={idp} labelId={`${idp}-pl`} required disabled={!open} invalid={fe.invalid(idp)} describedBy={fe.describe(idp)} value={province} placeholder={t('m.chooseProv')} maxRows={10}
            onChange={(v) => onProvince(v)} groups={[{ options: isCountry(country) ? N.provList(country).map((p) => ({ value: p, label: N.prov(p) })) : [] }]} /></div>
      </div>
      {country && !open && <SoonNote country={country} />}
      {fe.msg(idp)}
    </div>
  )
}
/** a planned ASEAN country: its capital and a plain "coming soon" note (announced politely) */
export function SoonNote({ country }: { country: GeoCode }) {
  const { t } = useI18n()
  const N = useNames()
  const cap = CAPITALS.find((c) => c.country === country)
  return (
    <div role="status" className="card-i space-y-1.5">
      <p className="flex flex-wrap items-center gap-2"><b className="text-base">{N.country(country)}</b><span className="chip bg-info-bg text-info-fg border-info-line">{t('geo.soon')}</span></p>
      {cap && <p className="text-sm flex items-center gap-2"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[rgb(var(--globe-capital))]" aria-hidden />{t('geo.capital')}: <b>{t(`geo.city.${cap.name.replace(/\s/g, '')}` as never)}</b></p>}
      <p className="text-sm text-muted">{t('geo.soon.t')} {t('geo.soon.now')}</p>
    </div>
  )
}
export function SkillPicker({ skills, onChange, idp, fe }: { skills: Skill[]; onChange: (s: Skill[]) => void; idp: string; fe: FieldError }) {
  const { t } = useI18n()
  const N = useNames()
  return (
    <fieldset aria-describedby={fe.describe(idp)}><legend className="label">{t('m.skills')}</legend>
      <div className="grid grid-cols-2 auto-rows-fr gap-2">{SKILLS.map((s, i) => (
        <label key={s} className="chip-check">
          <input id={i === 0 ? `${idp}-0` : undefined} type="checkbox" className="sr-only" aria-invalid={fe.invalid(idp)} checked={skills.includes(s)} onChange={() => onChange(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])} />
          <span className="chip-box" aria-hidden><Icon name="check" size={14} /></span>{N.skill(s)}
        </label>))}</div>
      {fe.msg(idp)}
    </fieldset>
  )
}
export const IndustrySelect = ({ value, onChange, label }: { value: Industry; onChange: (i: Industry) => void; label: string }) => {
  const N = useNames()
  return <label className="block"><span className="label">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value as Industry)}>{INDUSTRIES.map((i) => <option key={i} value={i}>{N.industry(i)}</option>)}</select></label>
}
/** step pills: done = tick, current = bold + aria-current (not colour alone) */
export const Steps = ({ items, at }: { items: string[]; at: number }) => (
  <ol className="flex flex-wrap gap-2">{items.map((s, i) => (
    <li key={s} aria-current={i === at ? 'step' : undefined} className={`inline-flex items-center gap-2 rounded-full border pl-1 ${i === at ? 'pr-3' : 'pr-1'} py-1 text-xs sm:text-sm ${i === at ? 'border-primary bg-brand text-brandfg font-semibold' : i < at ? 'border-ok-line bg-ok-bg text-ok-fg' : 'border-line bg-surface text-muted'}`}>
      <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-[11px] font-bold ${i === at ? 'bg-primary text-onprimary' : i < at ? 'bg-ok-fg text-ok-bg' : 'bg-surface3 text-muted'}`}>{i < at ? <Icon name="check" size={13} /> : i + 1}</span>
      {/* only the current step shows its name, on every screen, so the row stays one line in every language
          (compared both ways on 1280 px: full names wrapped to 2 rows in English; screen readers still hear every name) */}
      <span className={i === at ? undefined : 'sr-only'}>{s}</span>
    </li>))}</ol>
)
/** two columns on large screens: the map stays in view on the left while the steps scroll on the right */
export const MAP_SIZE = 'h-[260px] sm:h-[360px] lg:h-[calc(100vh-11rem)] lg:min-h-[420px] lg:max-h-[640px] fit:h-auto fit:flex-1 fit:min-h-0 fit:max-h-none'
export function MapLayout({ map, children, hideMap }: { map: ReactNode; children: ReactNode; hideMap?: boolean }) {
  return (
    <div className={`grid ${hideMap ? '' : 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'} gap-5 items-start fit:h-full fit:items-stretch`}>
      {!hideMap && <div className="lg:sticky lg:top-20 space-y-2 fit:static fit:flex fit:flex-col fit:min-h-0">{map}</div>}
      <div className="space-y-4 min-w-0 fit:min-h-0 fit:overflow-y-auto fit:pr-1">{children}</div>
    </div>
  )
}
/** tabs above a panel (owner, Oct 2026: split long pages instead of scrolling) */
export function PanelTabs<K extends string>({ tabs, value, onChange, label }: { tabs: { k: K; text: string; n?: number }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1 shrink-0">
      {tabs.map((x) => <button key={x.k} type="button" role="tab" aria-selected={value === x.k} onClick={() => onChange(x.k)}
        className={`min-h-[38px] px-3.5 rounded-xl text-sm inline-flex items-center gap-1.5 ${value === x.k ? 'bg-primary text-onprimary font-semibold' : 'hover:bg-surface3'}`}>{x.text}{x.n !== undefined && <span className="text-xs opacity-75">{x.n}</span>}</button>)}
    </div>
  )
}

/* ================= job seeker: origin → destination → pin (up to 5) ================= */
export function SeekPage() {
  const { t } = useI18n()
  const [seekTab, setSeekTab] = useState<'new' | 'mine'>('new')
  const N = useNames()
  const { st, limitNow, setOrigin, pin, unpin } = useMatch()
  const [editOrigin, setEditOrigin] = useState(false)
  const [oc, setOc] = useState<GeoCode | null>(st.me.origin?.country ?? null), [op, setOp] = useState<string | null>(st.me.origin?.province ?? null)
  const [dc, setDc] = useState<GeoCode | null>(null), [dp, setDp] = useState<string | null>(null)
  const [industry, setIndustry] = useState<Industry>('manufacturing')
  const [skills, setSkills] = useState<Skill[]>([])
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const fe = useFieldError()
  const gate = useGate('seek')
  if (gate) return <Page title={t('m.seek.title')}>{gate}</Page>
  if (st.role !== 'seeker') return <Page title={t('m.seek.title')}><NeedRole role="seeker" /></Page>
  const originStep = !st.me.origin || editOrigin
  const pq = pinQuota(st, limitNow)
  const pins: MapPin[] = activePins(st.me, limitNow).map((p) => ({ country: p.country, province: p.province, label: N.place(p.country, p.province), tone: 'mine' }))
  const confirmOrigin = async () => {
    if (isCountry(oc) && op) { await setOrigin({ country: oc, province: op }); setEditOrigin(false); setMsg(null); fe.clear() }
    else { setMsg(null); fe.set('origin-prov', oc ? 'origin-prov' : 'origin-prov-c', N.problem('place')) }
  }
  const submitPin = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!isCountry(dc) || !dp) { fe.set('dest-prov', isCountry(dc) ? 'dest-prov' : 'dest-prov-c', N.problem('place')); return }
    const r = await pin({ place: { country: dc, province: dp }, industry, skills })
    if (r.ok) { fe.clear(); setMsg({ tone: 'info', text: t('m.pin.done', { p: N.place(dc, dp) }) }); setDp(null); setSkills([]); return }
    if (r.problem === 'place' || r.problem === 'duplicate') fe.set('dest-prov', 'dest-prov', N.problem(r.problem))
    else if (r.problem === 'skills') fe.set('seek-skills', 'seek-skills-0', N.problem(r.problem))
    else { fe.clear(); setMsg({ tone: 'danger', text: N.problem(r.problem) }) }
  }
  return (
    <Page title={t('m.seek.title')} fit>
      <MapLayout map={<>
        <GeoMap className={MAP_SIZE} label={t('m.mapLabel')} country={originStep ? oc : dc} province={originStep ? op : dp} pins={pins}
          onPickCountry={(c) => { if (originStep) { setOc(c); setOp(null) } else { setDc(c); setDp(null) } fe.clear() }} onPickProvince={(p) => { if (originStep) setOp(p); else setDp(p); fe.clear() }} />
        <p className="text-xs text-muted">{t('m.mapHint')}</p></>}>
      <PanelTabs label={t('m.seek.title')} value={seekTab} onChange={setSeekTab} tabs={[{ k: 'new', text: t('m.pin.tab.new') }, { k: 'mine', text: t('m.pins'), n: activePins(st.me, limitNow).length }]} />
      <Toast msg={msg} />
      {seekTab === 'new' && (<>
      <Steps items={[t('m.seek.s1'), t('m.seek.s2'), t('m.seek.s3')]} at={originStep ? 0 : dp ? 2 : 1} />
      {originStep ? (
        <section className="card space-y-3" aria-labelledby="s1h">
          <h2 id="s1h" className="h2">{t('m.seek.s1')}</h2>
          <PlaceFields idp="origin-prov" fe={fe} country={oc} province={op} onCountry={(c) => { setOc(c); setOp(null); fe.clear() }} onProvince={(p) => { setOp(p); fe.clear() }} />
          <button type="button" className="btn-primary" disabled={!!oc && !isCountry(oc)} onClick={confirmOrigin}>{t('m.next')}<Icon name="next" size={16} /></button>
        </section>
      ) : (
        <form className="card space-y-4" onSubmit={submitPin} aria-labelledby="s2h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="s2h" className="h2">{t('m.seek.s2')}</h2>
            <p className="text-sm text-muted">{t('m.seek.from', { p: N.place(st.me.origin!.country, st.me.origin!.province) })} <button type="button" className="underline text-primary min-h-[24px]" onClick={() => { setOc(st.me.origin?.country ?? null); setOp(st.me.origin?.province ?? null); setEditOrigin(true) }}>{t('m.edit')}</button></p>
          </div>
          <PlaceFields idp="dest-prov" fe={fe} country={dc} province={dp} onCountry={(c) => { setDc(c); setDp(null); fe.clear() }} onProvince={(p) => { setDp(p); fe.clear() }} />
          <p className="text-xs text-muted">{t('m.seek.same')}</p>
          <div className="border-t border-line pt-3 space-y-3">
            <h3 className="font-semibold">{t('m.seek.s3')}</h3>
            <IndustrySelect value={industry} onChange={setIndustry} label={t('m.industry')} />
            <SkillPicker idp="seek-skills" fe={fe} skills={skills} onChange={(s) => { setSkills(s); fe.clear() }} />
          </div>
          <button type="submit" className="btn-primary" disabled={pq.left <= 0 || (!!dc && !isCountry(dc))}><Icon name="pin" size={16} />{t('m.pin.go')}</button>
        </form>
      )}
      </>)}
      {seekTab === 'mine' && (
      <section className="space-y-2" aria-labelledby="pins-h">
        <h2 id="pins-h" className="h2">{t('m.pin.active', { n: activePins(st.me, limitNow).length })}</h2>
        <QuotaBar q={pq} kind="pin" />
        <p className="text-xs text-muted">{t('m.pin.why')}</p>
        <PinList onRemove={async (id) => { await unpin(id); setMsg({ tone: 'info', text: t('m.pin.removed') }) }} />
      </section>)}
      </MapLayout>
    </Page>
  )
}

/* ================= shared pieces of the board (owner, Oct 2026) ================= */
/** release level as a game-like rarity: stars (5 for level 1 … 1 for level 5), a colour and the name — never colour alone */
export function LevelBadge({ level, reached }: { level: Level; reached?: boolean }) {
  const { t } = useI18n()
  const name = t(`m.lv.${level}` as never)
  return (
    <span className={`chip rar rar-${level}`}>
      <span className="inline-flex" aria-hidden>{Array.from({ length: 6 - level }, (_, i) => <Icon key={i} name="star" size={11} className="fill-current" />)}</span>
      {reached ? t('m.lv.reached', { l: name }) : name}
    </span>
  )
}
/** one post on the board, in notifications and in "my posts": rarity strip, title, place, age, pay, places and reservations */
export function PostCard({ post, level, reached, children }: { post: Post; level: Level; reached?: boolean; children?: ReactNode }) {
  const { t } = useI18n()
  const N = useNames()
  const { ago } = useRel()
  const { counts } = useMatch()
  const c = counts[post.id] ?? { held: 0, pending: 0, reserved: 0 }
  const cap = capacityOf(post)
  const state = c.held >= cap ? (c.pending > 0 ? 'waiting' : 'closed') : 'open'
  return (
    <li className={`glass-card rar-card rar-edge-${level} p-4 space-y-2`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LevelBadge level={level} reached={reached} />
        <span className="text-xs text-muted inline-flex items-center gap-1"><Icon name="clock" size={13} />{t(post.releasedAt !== post.createdAt ? 'm.ago.renewed' : 'm.ago.posted', { t: ago(post.releasedAt) })}</span>
      </div>
      <div>
        <h3 className="font-semibold text-lg leading-snug"><NavLink to={`post?id=${post.id}`} className="hover:underline underline-offset-4">{post.position}</NavLink></h3>
        <p className="text-sm text-muted">{post.company} · {N.place(post.country, post.province)} · {N.industry(post.industry)}</p>
      </div>
      <PostFacts post={post} compact />
      <p className="flex flex-wrap gap-1.5">
        <span className="chip bg-surface3 border-line"><Icon name="users" size={12} />{t('m.cnt.held', { n: c.held, max: cap })}</span>
        {c.reserved > 0 && <span className="chip bg-info-bg text-info-fg border-info-line"><Icon name="ticket" size={12} />{t('m.cnt.reserved', { n: c.reserved })}</span>}
        {state !== 'open' && <span className="chip bg-warn-bg text-warn-fg border-warn-line">{t(state === 'waiting' ? 'm.state.waiting' : 'm.state.closed')}</span>}
        {post.verified ? <span className="chip bg-ok-bg text-ok-fg border-ok-line"><Icon name="shield" size={12} />{t('m.vf.badge')}</span>
          : <span className="chip bg-warn-bg text-warn-fg border-warn-line"><Icon name="warn" size={12} />{t('m.vf.unverified')}</span>}
        {post.sample && <SampleBadge />}
      </p>
      {children}
    </li>
  )
}
/** newest first ↔ oldest first; the visible words are part of the button's name */
export function SortToggle({ order, onChange }: { order: 'new' | 'old'; onChange: (o: 'new' | 'old') => void }) {
  const { t } = useI18n()
  return (
    <button type="button" className="btn-ghost text-sm !px-3 sm:!px-4" onClick={() => onChange(order === 'new' ? 'old' : 'new')} title={t('m.sort.switch')}>
      <Icon name={order === 'new' ? 'sortNew' : 'sortOld'} size={16} /><span className="sr-only sm:not-sr-only">{t(order === 'new' ? 'm.sort.new' : 'm.sort.old')}</span>
    </button>
  )
}
/** how much of a weekly allowance is used and when it all comes back */
export function QuotaBar({ q, kind }: { q: Quota; kind: 'pin' | 'post' }) {
  const { t } = useI18n()
  const N = useNames()
  return (
    <div className="space-y-1">
      <p className="text-sm flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{t(kind === 'pin' ? 'm.qb.pins' : 'm.qb.posts', { n: q.used, max: q.limit })}</span>
        <span className="text-xs text-muted">{q.resetAt ? t('m.qb.reset', { d: N.dayTime(q.resetAt) }) : t('m.qb.fresh')}</span>
      </p>
      <div className="h-1.5 rounded-full bg-surface3 overflow-hidden" aria-hidden><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(100, (q.used / q.limit) * 100)}%` }} /></div>
    </div>
  )
}
/** my active pins: newest or oldest first, "new" for pins of the last 7 days, and how long each one still lasts */
export function PinList({ onRemove }: { onRemove?: (id: string) => void }) {
  const { t } = useI18n()
  const N = useNames()
  const { ago, until } = useRel()
  const { st, limitNow } = useMatch()
  const [order, setOrder] = useState<'new' | 'old'>('new')
  const pins = activePins(st.me, limitNow).sort((a, b) => (order === 'new' ? b.at.localeCompare(a.at) : a.at.localeCompare(b.at)))
  if (!pins.length) return <div className="glass-card p-5 text-muted">{t('m.pin.none')}</div>
  return (
    <div className="space-y-2">
      <SortToggle order={order} onChange={setOrder} />
      <ul className="grid sm:grid-cols-2 gap-2">{pins.map((p) => {
        const fresh = limitNow - Date.parse(p.at) < 7 * DAY_MS
        return (
          <li key={p.id} className="glass-card p-3 flex items-start gap-3">
            <Icon name="pin" size={20} className="text-danger-fg mt-0.5" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <h3 className="font-semibold flex flex-wrap items-center gap-2">{N.place(p.country, p.province)}<span className={`chip ${fresh ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line'}`}>{t(fresh ? 'm.pin.new' : 'm.pin.old')}</span></h3>
              <p className="text-sm text-muted">{N.industry(p.industry)} · {p.skills.map(N.skill).join(', ')}</p>
              <p className="text-xs text-muted">{t('m.pin.when', { t: ago(p.at) })} · {t('m.pin.ends', { t: until(Date.parse(p.at) + PIN_LIFE_DAYS * DAY_MS) })}</p>
            </div>
            {onRemove && <button type="button" className="w-9 h-9 rounded-lg border border-control grid place-items-center hover:bg-surface3" aria-label={`${t('m.pin.remove')}: ${N.place(p.country, p.province)}`} title={t('m.pin.remove')} onClick={() => onRemove(p.id)}><Icon name="close" size={16} /></button>}
          </li>)
      })}</ul>
    </div>
  )
}
/** the demo clock: jump an hour, a day or a month to watch the release levels; it moves what the site shows, not the database */
export function ClockControls() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, mode, advanceClock, resetClock } = useMatch()
  const h = st.clockHours
  return (
    <div className="space-y-2">
      <p className="text-sm flex flex-wrap items-center gap-2"><span className="chip bg-info-bg text-info-fg border-info-line"><Icon name="clock" size={12} />{t('m.clock.now', { d: N.dayTime(now) })}</span>{h > 0 && <span className="text-xs text-muted">{t('m.clock.ahead', { d: Math.floor(h / 24), h: h % 24 })}</span>}</p>
      <div className="flex flex-wrap gap-2">
        {([[1, 'm.clock.h'], [24, 'm.clock.d'], [24 * 30, 'm.clock.m']] as const).map(([n, k]) => <button key={k} type="button" className="btn-ghost text-sm" onClick={() => advanceClock(n)}><Icon name="fastForward" size={15} />{t(k)}</button>)}
        {h > 0 && <button type="button" className="btn-ghost text-sm" onClick={resetClock}>{t('m.clock.reset')}</button>}
      </div>
      <p className="text-xs text-muted">{t('m.clock.note')}</p>
      {mode === 'remote' && <p className="text-xs text-muted">{t('m.clock.noteRemote')}</p>}
    </div>
  )
}
/** the name an employer sees for an applicant (sample seekers in the demo, the copied name in the database) */
export function useApplicantName() {
  const { st } = useMatch()
  return (a: Acceptance) => a.seekerName ?? st.seekers.find((s) => s.id === a.seekerId)?.name ?? '—'
}
function NoteItem({ icon, title, text, to, tone }: { icon: IconName; title: string; text?: string; to: string; tone?: 'warn' }) {
  return (
    <li className="glass-card p-4 flex items-start gap-3">
      <Icon name={icon} size={20} className={`${tone === 'warn' ? 'text-warn-fg' : 'text-primary'} mt-0.5`} />
      <div className="min-w-0"><h3 className="font-semibold"><NavLink to={to} className="hover:underline underline-offset-4">{title}</NavLink></h3>{text && <p className="text-sm text-muted">{text}</p>}</div>
    </li>
  )
}
/** official agency links, shown once an employer has confirmed (opening them sends nothing) */
export function AgencyLinks() {
  const { t } = useI18n()
  return (
    <div className="text-sm"><p className="font-medium">{t('m.agency.h')}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">{AGENCIES.map((a) => <li key={a.key}><a className="text-primary underline inline-flex items-center gap-1 min-h-[24px]" href={a.url} target="_blank" rel="noopener noreferrer">{t(a.key)}<Icon name="external" size={13} /></a></li>)}</ul>
      <p className="text-xs text-muted mt-1">{t('m.agency.note')}</p></div>
  )
}

/* ================= notifications ================= */
export function NotificationsPage() {
  const { t } = useI18n()
  const { st, now, pool, counts } = useMatch()
  const { until } = useRel()
  const nameOf = useApplicantName()
  const gate = useGate('notifications')
  if (gate) return <Page title={t('m.notif.title')}>{gate}</Page>
  const box = inbox(st, pool, now, (id) => counts[id]?.reserved ?? 0)
  const caseNotes = box.cases.map((c) => {
    const p = st.posts.find((x) => x.id === c.postId); if (!p) return null
    const cur = currentStep(c), news = box.caseNews.includes(c)
    const arrive = st.role === 'employer' && cur === 'arrived'
    return <NoteItem key={`c-${c.id}`} icon="plane" tone={arrive ? 'warn' : undefined} to={`case?id=${c.id}`}
      title={t('m.cs.n.item', { p: p.position, s: cur ? t(`m.cs.s.${cur}` as never) : t('m.cs.n.closed') })}
      text={[t('m.cs.progress', { n: stepsDone(c) }), arrive ? t('m.cs.n.arrive') : news ? t('m.cs.n.updated') : ''].filter(Boolean).join(' · ')} />
  })
  const caseSection = box.cases.length > 0 && (
    <section className="space-y-2" aria-labelledby="n-cs"><h2 id="n-cs" className="h2">{t('m.cs.n.h')}</h2><ul className="space-y-2">{caseNotes}</ul></section>)
  const memberNote = box.memberEnds ? <NoteItem icon="crown" tone="warn" title={t('m.n.memberEnds', { t: until(box.memberEnds) })} text={t('m.n.memberHint')} to="member" /> : null
  if (st.role === 'employer') {
    const mine = st.posts.filter((p) => p.employerId === MY_EMPLOYER)
    const { waiting, reserved } = box
    const expiring = box.expiring.map((p) => ({ p, s: scheduleOf(p, pool, now) }))
    return (
      <Page title={t('m.notif.title')}>
        {caseSection}
        {!waiting.length && !reserved.length && !expiring.length && !memberNote ? (box.cases.length ? null : <Empty icon="bell" text={t('m.notif.none')} to="hire" action={t('m.posts')} />) : (
          <ul className="space-y-2">
            {memberNote}
            {expiring.map(({ p, s }) => <NoteItem key={`x-${p.id}`} icon="hourglass" tone="warn" title={t('m.n.expiring', { p: p.position, t: until(s.expiresAt) })} text={t('m.n.renewHint')} to={`post?id=${p.id}`} />)}
            {waiting.map((a) => { const p = mine.find((x) => x.id === a.postId)!; return <NoteItem key={a.id} icon="users" title={t('m.n.applied', { p: p.position })} text={`${nameOf(a)} · ${t(a.promotedAt ? 'm.n.fromQueue' : 'm.n.waitYou')}`} to={`post?id=${p.id}`} /> })}
            {reserved.map((p) => <NoteItem key={`r-${p.id}`} icon="ticket" title={t('m.n.reserved', { p: p.position, n: counts[p.id]?.reserved ?? 0 })} to={`post?id=${p.id}`} />)}
          </ul>)}
      </Page>)
  }
  if (st.role !== 'seeker') return <Page title={t('m.notif.title')}><Empty icon="bell" text={t('m.notif.none')} to="choose-role" action={t('hero.cta')} /></Page>
  const { offers, updates } = box
  const say = (a: Acceptance) => a.status === 'confirmed' ? 'm.n.confirmed' : a.status === 'rejected' ? 'm.n.rejected' : a.status === 'forwarded' ? 'm.n.forwarded' : 'm.n.promoted'
  return (
    <Page title={t('m.notif.title')}>
      {memberNote && <ul>{memberNote}</ul>}
      {caseSection}
      {!box.hasPins && !updates.length ? ( <Empty icon="pin" text={t('m.notif.noPins')} to="seek" action={t('m.pins')} />) : (<>
        {updates.length > 0 && (
          <section className="space-y-2" aria-labelledby="n-up"><h2 id="n-up" className="h2">{t('m.n.updates')}</h2>
            <ul className="space-y-2">{updates.map((a) => { const p = st.posts.find((x) => x.id === a.postId); if (!p) return null; return (
              <li key={a.id} className="glass-card p-4 space-y-2">
                <h3 className="font-semibold flex items-start gap-2"><Icon name={a.status === 'rejected' ? 'info' : 'ok'} size={18} className={`${a.status === 'rejected' ? 'text-muted' : 'text-ok-fg'} mt-0.5`} /><NavLink to={`post?id=${p.id}`} className="hover:underline underline-offset-4">{t(say(a), { p: p.position })}</NavLink></h3>
                {a.status === 'forwarded' && <p className="text-sm text-muted">{t('m.st.forwarded')}</p>}
                {(a.status === 'confirmed' || a.status === 'forwarded') && <AgencyLinks />}
              </li>) })}</ul>
          </section>)}
        <section className="space-y-2" aria-labelledby="n-new"><h2 id="n-new" className="h2">{t('m.n.offers')}</h2>
          {!offers.length ? <Empty icon="bell" text={t('m.notif.none')} to="board" action={t('m.board')} /> : (
            <ul className="space-y-3">{offers.map((p) => (
              <PostCard key={p.id} post={p} level={reachFor(p, st.me.pins, pool, now).level}>
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5"><Icon name="bell" size={14} />{t('m.offer.new')}</p>
              </PostCard>))}</ul>)}
        </section>
      </>)}
    </Page>
  )
}

/* ================= profile, prepare, settings, help ================= */
export function MePage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, limitNow } = useMatch()
  const gate = useGate('me')
  if (gate) return <Page title={t('m.profile.title')}>{gate}</Page>
  return (
    <Page title={t('m.profile.title')} fit>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-4">
      <section className="glass-card p-5 space-y-2">
        <p><span className="text-muted">{t('m.profile.role')}:</span> <b>{st.role ? t(st.role === 'seeker' ? 'm.role.seeker' : 'm.role.employer') : t('m.profile.none')}</b></p>
        {st.role === 'seeker' && st.me.origin && <p className="text-sm">{t('m.seek.from', { p: N.place(st.me.origin.country, st.me.origin.province) })} · {t('m.pin.active', { n: activePins(st.me, limitNow).length })}</p>}
        {st.role === 'employer' && st.myCompany && <p className="text-sm">{t('m.emp.company')}: {st.myCompany}</p>}
        <p className="text-sm flex flex-wrap items-center gap-2"><Icon name="crown" size={15} className="text-primary" />{memberActive(st, limitNow) ? (st.memberUntil ? t('m.plan.until', { d: N.day(st.memberUntil) }) : t('m.plan.member')) : t('m.plan.free')} <NavLink to="member" className="text-primary underline underline-offset-4 min-h-[24px] inline-flex items-center">{t('m.plan.see')}</NavLink></p>
        <NavLink to="choose-role" className="btn-ghost inline-flex">{t('m.profile.change')}</NavLink>
        <p className="text-xs text-muted">{t('m.profile.note')}</p>
      </section>
      <AccountSection />
      </div>
      {st.role === 'employer' && <VerifyCard />}
      </div>
    </Page>
  )
}
/** signed-in account: name, e-mail, role, and "delete my account" (PDPA right to erasure); hidden when sign-in is not set up */
function AccountSection() {
  const { t } = useI18n()
  const { status, user, isAdmin, deleteAccount } = useAuth()
  const [msg, setMsg] = useState<'done' | 'fail' | null>(null)
  const [ask, askDialog] = useConfirm()
  const [busy, setBusy] = useState(false)
  if (status === 'off' || status === 'loading') return null
  return (
    <section className="glass-card p-5 space-y-2" aria-labelledby="account-h">
      <h2 id="account-h" className="h2">{t('m.auth.account')}</h2>
      {user ? (<>
        <p className="font-medium">{user.name} <span className="text-sm text-muted">· {user.email}</span></p>
        {isAdmin && <p className="text-sm inline-flex items-center gap-1.5 text-primary"><Icon name="shield" size={15} />{t('m.auth.admin')}</p>}
        <div><button type="button" className="btn-ghost text-danger-fg" disabled={busy} onClick={async () => { if (!(await ask(t('m.auth.delete.confirm'), { yes: t('m.auth.delete'), danger: true }))) return; setBusy(true); setMsg((await deleteAccount()) ? 'done' : 'fail'); setBusy(false) }}>{busy ? t('m.ask.busy') : t('m.auth.delete')}</button></div>
      </>) : <p className="text-sm text-muted">{t('m.auth.signedOut')} · {t('m.auth.optional')}</p>}
      <p role="status" className="text-sm">{msg === 'done' ? t('m.auth.delete.done') : msg === 'fail' ? t('m.auth.delete.fail') : ''}</p>
      {askDialog}
    </section>
  )
}
export function PreparePage() {
  const { t } = useI18n()
  const cards = [['safety', 'shield', 'm.sc.prepare', 'm.sc.prepare.d'], ['language', 'culture', 'm.prepare.lang', 'm.prepare.lang.d'], ['sources', 'legal', 'm.prepare.legal', 'm.prepare.legal.d']] as const
  return (
    <Page title={t('m.prepare.title')}>
      <ul className="grid md:grid-cols-2 gap-3">{cards.map(([to, icon, h, d]) => (
        <li key={to}><NavLink to={to} className="glass-card p-5 flex gap-4 items-start h-full"><span className="w-11 h-11 shrink-0 rounded-xl bg-brand text-brandfg grid place-items-center"><Icon name={icon} size={22} /></span><span><span className="block font-semibold text-lg">{t(h)}</span><span className="block text-sm text-muted mt-1">{t(d)}</span></span></NavLink></li>))}</ul>
    </Page>
  )
}
export function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle, accent, setAccent, weekStart, setWeekStart } = useTheme()
  const [accentMsg, setAccentMsg] = useState('')
  const { reset, mode } = useMatch()
  const [done, setDone] = useState(false)
  const [motion, setMotion] = useState(() => !motionOff())
  const [ask, askDialog] = useConfirm()
  return (
    <Page title={t('m.settings.title')} fit>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
      <section className="card space-y-4" aria-label={t('m.settings.look')}>
        <fieldset><legend className="label">{t('m.settings.lang')}</legend><div className="flex flex-wrap gap-2">{LANGS.map((l) => <button key={l.id} type="button" lang={l.html} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className={`min-h-[44px] px-4 rounded-lg border ${lang === l.id ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{l.label}</button>)}</div></fieldset>
        <fieldset><legend className="label">{t('m.settings.theme')}</legend><div className="flex gap-2">{(['light', 'dark'] as const).map((m) => <button key={m} type="button" aria-pressed={theme === m} onClick={() => theme !== m && toggle()} className={`min-h-[44px] px-4 rounded-lg border flex items-center gap-2 ${theme === m ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}><Icon name={m} size={16} />{t(m === 'light' ? 'm.settings.light' : 'm.settings.dark')}</button>)}</div></fieldset>
        {/* accent colour (owner, Oct 2026): the swatch is decoration; the name is the label */}
        <fieldset aria-describedby="accent-hint"><legend className="label">{t('m.settings.accent')}</legend><div className="flex flex-wrap gap-2">{ACCENTS.map((a) => (
          <button key={a} type="button" aria-pressed={accent === a} onClick={() => { setAccent(a); setAccentMsg(t('m.settings.accentDone', { c: t(`m.accent.${a}` as never) })) }}
            className={`min-h-[40px] pl-2 pr-3.5 rounded-lg border flex items-center gap-2 ${accent === a ? 'border-primary ring-2 ring-primary/40 font-semibold' : 'border-control hover:bg-surface3'}`}>
            <span aria-hidden className={`w-7 h-7 rounded-md swatch-${a}`} />{t(`m.accent.${a}` as never)}</button>))}</div>
          <p id="accent-hint" className="text-xs text-muted mt-1">{t('m.settings.accent.d')}</p>
          <p role="status" className="text-sm font-medium text-primary mt-1">{accentMsg}</p>
          {/* a small preview in the chosen colour (decoration; the whole site changes with it) */}
          <div aria-hidden className="mt-2 rounded-xl border border-line p-3 flex flex-wrap items-center gap-3" style={{ background: 'rgb(var(--page))' }}>
            <span className="btn-primary text-sm pointer-events-none">{t('m.settings.preview.btn')}</span>
            <span className="chip bg-brand text-brandfg border-primary/40">{t('m.settings.preview.chip')}</span>
            <span className="flex-1 min-w-[80px] h-2 rounded-full bg-surface3 overflow-hidden"><span className="block h-full w-2/3 bg-primary rounded-full" /></span>
          </div></fieldset>
        <fieldset><legend className="label">{t('m.settings.week')}</legend><div className="flex gap-2">{([0, 1] as const).map((w) => <button key={w} type="button" aria-pressed={weekStart === w} onClick={() => setWeekStart(w)} className={`min-h-[44px] px-4 rounded-lg border ${weekStart === w ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{t(w === 0 ? 'm.settings.week.sun' : 'm.settings.week.mon')}</button>)}</div></fieldset>
      </section>
      <section className="card space-y-4" aria-label={t('m.settings.other')}>
        {/* the home hero's moving lines (WCAG 2.2.2: a way to stop them; owner asked for no button on the hero itself) */}
        <fieldset aria-describedby="motion-hint"><legend className="label">{t('m.settings.motion')}</legend><div className="flex gap-2">{([true, false] as const).map((on) => <button key={String(on)} type="button" aria-pressed={motion === on} onClick={() => { setMotion(on); setMotionOff(!on) }} className={`min-h-[44px] px-4 rounded-lg border ${motion === on ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{t(on ? 'm.settings.on' : 'm.settings.off')}</button>)}</div>
          <p id="motion-hint" className="text-xs text-muted mt-1">{t('m.settings.motion.d')}</p></fieldset>
        <fieldset className="border-t border-line pt-3"><legend className="label">{t('m.clock.title')}</legend><ClockControls /></fieldset>
        {mode === 'local' && <div className="border-t border-line pt-3 space-y-2"><p className="text-sm text-muted">{t('m.settings.reset.d')}</p>
          <button type="button" className="btn-ghost" onClick={async () => { if (await ask(t('m.settings.reset.d'), { yes: t('m.settings.reset'), danger: true })) { reset(); setDone(true) } }}>{t('m.settings.reset')}</button>
          <p role="status" className="text-sm">{done && t('m.settings.resetDone')}</p></div>}
        {askDialog}
      </section>
      </div>
    </Page>
  )
}
export function HelpPage() {
  const { t } = useI18n()
  return <Page title={t('m.help.title')}><section className="glass-card p-5 space-y-3 text-sm"><p>{t('m.help.seeker')}</p><p>{t('m.help.employer')}</p><p className="text-muted">{t('m.proto')}</p></section></Page>
}

/* ================= admin back office ================= */
/* The back office in tabs (owner, Oct 2026: one long page was hard to read; on a computer it must not scroll): an overview of what
   needs attention, then one tab each for verification requests, reports, cases and posts — compact rows, smaller type. On a
   computer the page takes exactly the screen and long lists turn into pages; a post's details open in a side panel. Arrow keys
   move between the tabs. */
type AdminTab = 'overview' | 'verify' | 'reports' | 'cases' | 'posts'
const ADMIN_TABS: { k: AdminTab; icon: IconName }[] = [{ k: 'overview', icon: 'overview' }, { k: 'verify', icon: 'shield' }, { k: 'reports', icon: 'alert' }, { k: 'cases', icon: 'plane' }, { k: 'posts', icon: 'posts' }]
const ROW = 'rounded-xl border border-line bg-surface px-4 py-3 text-sm'
export function BackofficePage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, pool, deletePost, stats, mode, pendingVerifications, decideVerification, reports, moderate } = useMatch()
  const { isAdmin } = useAuth()
  const nameOf = useApplicantName()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [postOpen, setPostOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const [ask, askDialog] = useConfirm()
  if (!isAdmin) return <Page title={t('m.adm.title')}><Warn>{t('m.adm.gate')}</Warn></Page>
  const people = [{ ...st.me, name: t('m.adm.you') }, ...st.seekers]
  const openCases = st.cases.filter((c) => currentStep(c) !== null)
  const count: Record<AdminTab, number> = { overview: 0, verify: pendingVerifications.length, reports: reports.length, cases: openCases.length, posts: st.posts.length }
  const decideR = async (postId: string, action: 'dismiss' | 'remove' | 'suspend') => {
    if (action !== 'dismiss' && !(await ask(t(action === 'remove' ? 'm.adm.remove.confirm' : 'm.adm.suspend.confirm'), { yes: t(action === 'remove' ? 'm.adm.remove' : 'm.adm.suspend'), danger: true }))) return
    const r = await moderate(postId, action)
    setMsg(r.ok ? { tone: 'info', text: t('m.adm.moderated') } : { tone: 'danger', text: N.problem(r.problem) })
  }
  const decideV = async (id: string | null, ok: boolean) => {
    if (!ok && !(await ask(t('m.adm.reject.confirm'), { yes: t('m.adm.reject'), danger: true }))) return
    setMsg((await decideVerification(id, ok)) ? { tone: 'info', text: t('m.adm.verifyDone') } : { tone: 'danger', text: t('m.err.network') })
  }
  const go = (k: AdminTab) => { setTab(k); requestAnimationFrame(() => document.getElementById(`adm-tab-${k}`)?.focus()) }
  const keys = (e: React.KeyboardEvent) => {
    const i = ADMIN_TABS.findIndex((x) => x.k === tab)
    if (e.key === 'ArrowRight') { e.preventDefault(); go(ADMIN_TABS[(i + 1) % ADMIN_TABS.length].k) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(ADMIN_TABS[(i - 1 + ADMIN_TABS.length) % ADMIN_TABS.length].k) }
    if (e.key === 'Home') { e.preventDefault(); go(ADMIN_TABS[0].k) }
    if (e.key === 'End') { e.preventDefault(); go(ADMIN_TABS[ADMIN_TABS.length - 1].k) }
  }
  const empty = (text: string) => <p className={`${ROW} text-muted`}>{text}</p>
  const detail = postOpen ? st.posts.find((p) => p.id === postOpen) : undefined

  return (
    <Page title={t('m.adm.title')} sub={t('m.adm.sub2')} fit body="flex flex-col gap-3"
      actions={<NavLink to="analytics" className="btn-ghost text-sm !rounded-full"><Icon name="chart" size={15} />{t('m.an.title')}</NavLink>}>
      <Toast msg={msg} />
      {askDialog}
      <div role="tablist" aria-label={t('m.adm.tabs')} onKeyDown={keys} className="shrink-0 flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1">
        {ADMIN_TABS.map(({ k, icon }) => (
          <button key={k} id={`adm-tab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls="adm-panel" tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}
            className={`min-h-[40px] px-3.5 rounded-xl text-sm inline-flex items-center gap-2 ${tab === k ? 'bg-primary text-onprimary font-semibold' : 'hover:bg-surface3'}`}>
            <Icon name={icon} size={15} />{t(`m.adm.tab.${k}` as never)}
            {count[k] > 0 && k !== 'overview' && <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold grid place-items-center ${tab === k ? 'bg-onprimary text-primary' : (k === 'verify' || k === 'reports') ? 'bg-danger-fg text-page' : 'bg-surface3 text-muted'}`}>{count[k]}</span>}
          </button>))}
      </div>

      <section id="adm-panel" role="tabpanel" aria-labelledby={`adm-tab-${tab}`} className="space-y-3 fit:flex-1 fit:min-h-0 fit:flex fit:flex-col fit:overflow-hidden">
        {tab === 'overview' && (<>
          <h2 className="text-base font-semibold">{t('m.adm.attn')}</h2>
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3">{(['verify', 'reports', 'cases', 'posts'] as const).map((k) => (
            <li key={k}><button type="button" onClick={() => go(k)} className="w-full text-left glass-card p-4 space-y-1">
              <span className="text-xs text-muted flex items-center justify-between gap-2">{t(`m.adm.tab.${k}` as never)}<Icon name={ADMIN_TABS.find((x) => x.k === k)!.icon} size={15} /></span>
              <span className="block text-3xl font-bold">{count[k]}</span>
              <span className="block text-xs text-muted">{t(`m.adm.attn.${k}` as never)}</span>
            </button></li>))}</ul>
          {mode === 'remote' && stats && (
            <div className="space-y-2"><h2 className="text-base font-semibold">{t('m.adm.stats')}</h2>
              <dl className="grid grid-cols-3 lg:grid-cols-6 gap-2">{([['m.adm.st.users', stats.users], ['m.adm.st.employers', stats.employers], ['m.adm.st.seekers', stats.seekers], ['m.adm.st.posts', stats.posts], ['m.adm.st.posts7', stats.posts_7d], ['m.adm.st.acc', stats.acceptances]] as const).map(([k, v]) => (
                <div key={k} className={ROW}><dt className="text-xs text-muted">{t(k)}</dt><dd className="text-xl font-bold">{v}</dd></div>))}</dl></div>)}
          <div className={`${ROW} space-y-2`}><p className="font-medium">{t('m.adm.demoClock')}</p><ClockControls /></div>
          <p className="text-xs text-muted">{t('m.adm.ai')}</p>
        </>)}

        {tab === 'verify' && (<>
          <p className="text-xs text-muted shrink-0">{t('m.adm.verifyCheck')}</p>
          <div className="fit:flex-1 fit:min-h-0"><PagedList items={pendingVerifications} rowH={66} keyOf={(v) => v.id ?? 'me'} empty={empty(t('m.adm.verifyNone'))} render={(v) => (
            <div className={`${ROW} flex flex-wrap items-center justify-between gap-3`}>
              <div className="min-w-0"><p className="font-semibold">{v.company || '—'} <span className="font-normal text-muted">· {v.name}</span></p>
                <p className="text-xs text-muted">{t(`geo.c.${v.country}` as never)} · <span className="font-mono">{v.regNo}</span>{v.at ? ` · ${N.dayTime(Date.parse(v.at))}` : ''}</p></div>
              <div className="flex gap-2"><button type="button" className="btn-primary text-sm" onClick={() => void decideV(v.id, true)}><Icon name="ok" size={15} />{t('m.adm.approve')}</button>
                <button type="button" className="btn-ghost text-sm text-danger-fg" onClick={() => void decideV(v.id, false)}>{t('m.adm.reject')}</button></div>
            </div>)} /></div>
        </>)}

        {tab === 'reports' && (
          <div className="fit:flex-1 fit:min-h-0"><PagedList items={reports} rowH={150} keyOf={(g) => g.postId} empty={empty(t('m.adm.reportsNone'))} render={(g) => {
            const p = st.posts.find((x) => x.id === g.postId)
            return (
              <div className={`${ROW} space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold min-w-0">{p ? <NavLink to={`post?id=${p.id}`} className="hover:underline underline-offset-4">{p.position} · {p.company}</NavLink> : t('m.adm.reportsGone')}</p>
                  <p className="flex flex-wrap gap-1.5"><span className="chip bg-danger-bg text-danger-fg border-danger-line"><Icon name="alert" size={12} />{t('m.adm.reportsBy', { n: g.count })}</span>
                    {p?.hidden && <span className="chip bg-warn-bg text-warn-fg border-warn-line"><Icon name="eyeOff" size={12} />{t('m.adm.hidden')}</span>}</p>
                </div>
                <p className="flex flex-wrap gap-1.5">{Object.entries(g.reasons).map(([k, n]) => <span key={k} className="chip bg-surface3 border-line">{t(`m.rpt.r.${k}` as never)} × {n}</span>)}</p>
                {g.notes.length > 0 && <p className="text-xs text-muted line-clamp-1">{g.notes.map((n) => `“${n}”`).join(' · ')}</p>}
                {p && <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost text-sm" onClick={() => void decideR(g.postId, 'dismiss')}><Icon name="ok" size={15} />{t('m.adm.dismiss')}</button>
                  <button type="button" className="btn-ghost text-sm text-danger-fg" onClick={() => void decideR(g.postId, 'remove')}><Icon name="trash" size={15} />{t('m.adm.remove')}</button>
                  {!p.employerId.startsWith('sample:') && <button type="button" className="btn-ghost text-sm text-danger-fg" onClick={() => void decideR(g.postId, 'suspend')}><Icon name="lock" size={15} />{t('m.adm.suspend')}</button>}
                </div>}
              </div>)
          }} /></div>)}

        {tab === 'cases' && (
          <div className="fit:flex-1 fit:min-h-0"><PagedList items={[...st.cases].sort((a, b) => Number(currentStep(a) === null) - Number(currentStep(b) === null))} rowH={62} keyOf={(c) => c.id} empty={empty(t('m.adm.casesNone'))} render={(c) => {
            const p = st.posts.find((x) => x.id === c.postId), a = st.acceptances.find((x) => x.id === c.accId), cur = currentStep(c)
            return (
              <div className={`${ROW} flex flex-wrap items-center justify-between gap-3`}>
                <div className="min-w-0"><p className="font-semibold truncate">{p ? `${p.position} · ${p.company}` : '—'}</p>
                  <p className="text-xs text-muted truncate">{a ? nameOf(a) : '—'} · {cur ? t(`m.cs.s.${cur}` as never) : t('m.cs.n.closed')} · {t('m.cs.progress', { n: stepsDone(c) })}</p></div>
                <NavLink to={`case?id=${c.id}`} className="btn-ghost text-sm"><Icon name="plane" size={15} />{t('m.cs.open')}</NavLink>
              </div>)
          }} /></div>)}

        {tab === 'posts' && (
          <div className="fit:flex-1 fit:min-h-0"><PagedList items={st.posts} rowH={62} keyOf={(p) => p.id} render={(p) => {
            const stage = capStage(stageAt(scheduleOf(p, pool, now), now), p)
            const acc = st.acceptances.filter((a) => a.postId === p.id)
            const reached = people.filter((s) => reachFor(p, s.pins, pool, now).visible).length
            return (
              <button type="button" onClick={() => setPostOpen(p.id)} className={`${ROW} w-full text-left flex flex-wrap items-center justify-between gap-2 hover:bg-surface3`}>
                <span className="min-w-0"><h3 className="font-semibold">{p.position} · {p.company} {p.sample && <SampleBadge />}</h3>
                  <span className="block text-xs text-muted truncate">{N.place(p.country, p.province)} · {N.industry(p.industry)} · {t('m.adm.applicants', { n: acc.length })} · {t('m.adm.reachedN', { n: reached })}</span></span>
                <span className="flex items-center gap-2">{stage !== 'expired' && <LevelBadge level={stage} reached />}<Icon name="next" size={15} className="text-muted" /></span>
              </button>)
          }} /></div>)}
      </section>

      <Drawer open={!!detail} onClose={() => setPostOpen(null)}>{(titleId) => {
        if (!detail) return null
        const p = detail
        const reach = people.map((s) => ({ s, r: reachFor(p, s.pins, pool, now) }))
        const reached = reach.filter((x) => x.r.visible), waiting = reach.filter((x) => !x.r.visible && x.r.level < 5)
        const acc = st.acceptances.filter((a) => a.postId === p.id).sort((a, b) => a.at.localeCompare(b.at))
        return (<>
          <h2 id={titleId} className="h2 pr-10">{p.position} · {p.company}</h2>
          <p className="text-sm text-muted">{N.place(p.country, p.province)} · {N.industry(p.industry)} {p.sample && <SampleBadge />}</p>
          <PostFacts post={p} compact />
          <div className="grid gap-3 text-sm">
            <div><p className="font-medium">{t('m.adm.reached')} ({reached.length})</p><p className="text-muted">{reached.map((x) => x.s.name).join(', ') || t('m.adm.none')}</p></div>
            <div><p className="font-medium">{t('m.adm.waiting')}</p><p className="text-muted">{waiting.map((x) => `${x.s.name} (${t('m.lv.short', { n: x.r.level })})`).join(', ') || t('m.adm.none')}</p></div>
          </div>
          {acc.length > 0 && <ul className="space-y-1 text-sm border-t border-line pt-3">{acc.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
              <span><Icon name="ok" size={14} className="inline text-ok-fg" /> {nameOf(a)} · {t(`m.as.${a.status}` as never)}</span>
              {(() => { const c = st.cases.find((x) => x.accId === a.id); return c ? <NavLink to={`case?id=${c.id}`} className="text-primary underline underline-offset-4 min-h-[24px] inline-flex items-center">{t('m.adm.forwarded')}</NavLink> : null })()}
            </li>))}</ul>}
          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-3">
            <NavLink to={`post?id=${p.id}`} className="btn-ghost text-sm">{t('m.bd.openFull')}</NavLink>
            <button type="button" className="btn-ghost text-sm text-danger-fg" onClick={async () => { if (await ask(t('m.post.delete.confirm'), { yes: t('m.post.delete'), danger: true })) { const ok = await deletePost(p.id); setMsg(ok ? { tone: 'info', text: t('m.post.deleted') } : { tone: 'danger', text: t('m.post.delete.fail') }); if (ok) setPostOpen(null) } }}><Icon name="trash" size={15} />{t('m.post.delete')}</button>
          </div>
        </>)
      }}</Drawer>
    </Page>
  )
}
