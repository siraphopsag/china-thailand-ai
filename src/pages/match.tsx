import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { LANGS, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { provinces } from '../locales/provinces'
import { activePins, capacityOf, inbox, isCountry, memberActive, pinQuota, type Problem } from '../domain/match/logic'
import { DAY_MS, reachFor, scheduleOf, stageAt, type Quota } from '../domain/match/release'
import { INDUSTRIES, MY_EMPLOYER, PIN_LIFE_DAYS, SKILLS, type Acceptance, type Benefit, type Country, type Edu, type Employment, type Industry, type LanguageSkill, type Level, type Post, type Salary, type Skill } from '../domain/match/types'
import { ACTIVE, GEO, SOON, type GeoCode } from '../geo'
import capitalsData from '../data/geo/capitals.json'
import { GeoMap, type MapPin } from '../components/geomap'
import { ListSelect } from '../components/listselect'
import { Warn } from '../components/ui'
import { Icon, type IconName } from '../components/icons'
import { motionOff, setMotionOff } from '../components/ui/background-paths'
import { NeedLogin } from './auth'

/**
 * Pages of the matching prototype. Data stay in this browser (see matchData.tsx); forwarding to agencies is simulated and
 * nothing is sent anywhere. Links to agencies open their official websites.
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
export function Page({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <div className="space-y-5"><div><h1 className="h1">{title}</h1>{sub && <p className="text-muted mt-1 max-w-3xl">{sub}</p>}</div>{children}</div>
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
export const MAP_SIZE = 'h-[300px] sm:h-[380px] lg:h-[calc(100vh-11rem)] lg:min-h-[420px] lg:max-h-[640px]'
export function MapLayout({ map, children }: { map: ReactNode; children: ReactNode }) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="lg:sticky lg:top-20 space-y-2">{map}</div>
      <div className="space-y-4 min-w-0">{children}</div>
    </div>
  )
}

/* ================= job seeker: origin → destination → pin (up to 5) ================= */
export function SeekPage() {
  const { t } = useI18n()
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
    <Page title={t('m.seek.title')}>
      <MapLayout map={<>
        <GeoMap className={MAP_SIZE} label={t('m.mapLabel')} country={originStep ? oc : dc} province={originStep ? op : dp} pins={pins}
          onPickCountry={(c) => { if (originStep) { setOc(c); setOp(null) } else { setDc(c); setDp(null) } fe.clear() }} onPickProvince={(p) => { if (originStep) setOp(p); else setDp(p); fe.clear() }} />
        <p className="text-xs text-muted">{t('m.mapHint')}</p></>}>
      <Steps items={[t('m.seek.s1'), t('m.seek.s2'), t('m.seek.s3')]} at={originStep ? 0 : dp ? 2 : 1} />
      <Toast msg={msg} />
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
      <section className="space-y-2" aria-labelledby="pins-h">
        <h2 id="pins-h" className="h2">{t('m.pin.active', { n: activePins(st.me, limitNow).length })}</h2>
        <QuotaBar q={pq} kind="pin" />
        <p className="text-xs text-muted">{t('m.pin.why')}</p>
        <PinList onRemove={async (id) => { await unpin(id); setMsg({ tone: 'info', text: t('m.pin.removed') }) }} />
      </section>
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
      </p>
      {children}
    </li>
  )
}
/** newest first ↔ oldest first; the visible words are part of the button's name */
export function SortToggle({ order, onChange }: { order: 'new' | 'old'; onChange: (o: 'new' | 'old') => void }) {
  const { t } = useI18n()
  return (
    <button type="button" className="btn-ghost text-sm" onClick={() => onChange(order === 'new' ? 'old' : 'new')} title={t('m.sort.switch')}>
      <Icon name={order === 'new' ? 'sortNew' : 'sortOld'} size={16} />{t(order === 'new' ? 'm.sort.new' : 'm.sort.old')}
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
  const memberNote = box.memberEnds ? <NoteItem icon="crown" tone="warn" title={t('m.n.memberEnds', { t: until(box.memberEnds) })} text={t('m.n.memberHint')} to="member" /> : null
  if (st.role === 'employer') {
    const mine = st.posts.filter((p) => p.employerId === MY_EMPLOYER)
    const { waiting, reserved } = box
    const expiring = box.expiring.map((p) => ({ p, s: scheduleOf(p, pool, now) }))
    return (
      <Page title={t('m.notif.title')}>
        {!waiting.length && !reserved.length && !expiring.length && !memberNote ? <Empty icon="bell" text={t('m.notif.none')} to="hire" action={t('m.posts')} /> : (
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
      {!box.hasPins && !updates.length ? <Empty icon="pin" text={t('m.notif.noPins')} to="seek" action={t('m.pins')} /> : (<>
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
    <Page title={t('m.profile.title')}>
      <section className="glass-card p-5 space-y-2">
        <p><span className="text-muted">{t('m.profile.role')}:</span> <b>{st.role ? t(st.role === 'seeker' ? 'm.role.seeker' : 'm.role.employer') : t('m.profile.none')}</b></p>
        {st.role === 'seeker' && st.me.origin && <p className="text-sm">{t('m.seek.from', { p: N.place(st.me.origin.country, st.me.origin.province) })} · {t('m.pin.active', { n: activePins(st.me, limitNow).length })}</p>}
        {st.role === 'employer' && st.myCompany && <p className="text-sm">{t('m.emp.company')}: {st.myCompany}</p>}
        <p className="text-sm flex flex-wrap items-center gap-2"><Icon name="crown" size={15} className="text-primary" />{memberActive(st, limitNow) ? (st.memberUntil ? t('m.plan.until', { d: N.day(st.memberUntil) }) : t('m.plan.member')) : t('m.plan.free')} <NavLink to="member" className="text-primary underline underline-offset-4 min-h-[24px] inline-flex items-center">{t('m.plan.see')}</NavLink></p>
        <NavLink to="choose-role" className="btn-ghost inline-flex">{t('m.profile.change')}</NavLink>
        <p className="text-xs text-muted">{t('m.profile.note')}</p>
      </section>
      <AccountSection />
    </Page>
  )
}
/** signed-in account: name, e-mail, role, and "delete my account" (PDPA right to erasure); hidden when sign-in is not set up */
function AccountSection() {
  const { t } = useI18n()
  const { status, user, isAdmin, deleteAccount } = useAuth()
  const [msg, setMsg] = useState<'done' | 'fail' | null>(null)
  if (status === 'off' || status === 'loading') return null
  return (
    <section className="glass-card p-5 space-y-2" aria-labelledby="account-h">
      <h2 id="account-h" className="h2">{t('m.auth.account')}</h2>
      {user ? (<>
        <p className="font-medium">{user.name} <span className="text-sm text-muted">· {user.email}</span></p>
        {isAdmin && <p className="text-sm inline-flex items-center gap-1.5 text-primary"><Icon name="shield" size={15} />{t('m.auth.admin')}</p>}
        <div><button type="button" className="btn-ghost text-danger-fg" onClick={async () => { if (window.confirm(t('m.auth.delete.confirm'))) setMsg((await deleteAccount()) ? 'done' : 'fail') }}>{t('m.auth.delete')}</button></div>
      </>) : <p className="text-sm text-muted">{t('m.auth.signedOut')} · {t('m.auth.optional')}</p>}
      <p role="status" className="text-sm">{msg === 'done' ? t('m.auth.delete.done') : msg === 'fail' ? t('m.auth.delete.fail') : ''}</p>
    </section>
  )
}
export function PreparePage() {
  const { t } = useI18n()
  const cards = [['language', 'culture', 'm.prepare.lang', 'm.prepare.lang.d'], ['sources', 'legal', 'm.prepare.legal', 'm.prepare.legal.d']] as const
  return (
    <Page title={t('m.prepare.title')}>
      <ul className="grid md:grid-cols-2 gap-3">{cards.map(([to, icon, h, d]) => (
        <li key={to}><NavLink to={to} className="glass-card p-5 flex gap-4 items-start h-full"><span className="w-11 h-11 shrink-0 rounded-xl bg-brand text-brandfg grid place-items-center"><Icon name={icon} size={22} /></span><span><span className="block font-semibold text-lg">{t(h)}</span><span className="block text-sm text-muted mt-1">{t(d)}</span></span></NavLink></li>))}</ul>
    </Page>
  )
}
export function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  const { reset, mode } = useMatch()
  const [done, setDone] = useState(false)
  const [motion, setMotion] = useState(() => !motionOff())
  return (
    <Page title={t('m.settings.title')}>
      <section className="card space-y-4">
        <fieldset><legend className="label">{t('m.settings.lang')}</legend><div className="flex flex-wrap gap-2">{LANGS.map((l) => <button key={l.id} type="button" lang={l.html} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className={`min-h-[44px] px-4 rounded-lg border ${lang === l.id ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{l.label}</button>)}</div></fieldset>
        <fieldset><legend className="label">{t('m.settings.theme')}</legend><div className="flex gap-2">{(['light', 'dark'] as const).map((m) => <button key={m} type="button" aria-pressed={theme === m} onClick={() => theme !== m && toggle()} className={`min-h-[44px] px-4 rounded-lg border flex items-center gap-2 ${theme === m ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}><Icon name={m} size={16} />{t(m === 'light' ? 'm.settings.light' : 'm.settings.dark')}</button>)}</div></fieldset>
        {/* the home hero's moving lines (WCAG 2.2.2: a way to stop them; owner asked for no button on the hero itself) */}
        <fieldset aria-describedby="motion-hint"><legend className="label">{t('m.settings.motion')}</legend><div className="flex gap-2">{([true, false] as const).map((on) => <button key={String(on)} type="button" aria-pressed={motion === on} onClick={() => { setMotion(on); setMotionOff(!on) }} className={`min-h-[44px] px-4 rounded-lg border ${motion === on ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{t(on ? 'm.settings.on' : 'm.settings.off')}</button>)}</div>
          <p id="motion-hint" className="text-xs text-muted mt-1">{t('m.settings.motion.d')}</p></fieldset>
        <fieldset className="border-t border-line pt-3"><legend className="label">{t('m.clock.title')}</legend><ClockControls /></fieldset>
        {mode === 'local' && <div className="border-t border-line pt-3 space-y-2"><p className="text-sm text-muted">{t('m.settings.reset.d')}</p>
          <button type="button" className="btn-ghost" onClick={() => { if (window.confirm(t('m.settings.reset.d'))) { reset(); setDone(true) } }}>{t('m.settings.reset')}</button>
          <p role="status" className="text-sm">{done && t('m.settings.resetDone')}</p></div>}
      </section>
    </Page>
  )
}
export function HelpPage() {
  const { t } = useI18n()
  return <Page title={t('m.help.title')}><section className="glass-card p-5 space-y-3 text-sm"><p>{t('m.help.seeker')}</p><p>{t('m.help.employer')}</p><p className="text-muted">{t('m.proto')}</p></section></Page>
}

/* ================= admin back office ================= */
export function BackofficePage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, pool, forwardCase, deletePost, stats, mode } = useMatch()
  const { isAdmin } = useAuth()
  const nameOf = useApplicantName()
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  if (!isAdmin) return <Page title={t('m.adm.title')}><Warn>{t('m.adm.gate')}</Warn></Page>
  const people = [{ ...st.me, name: t('m.adm.you') }, ...st.seekers]
  return (
    <Page title={t('m.adm.title')} sub={t('m.adm.sub')}>
      <ClockControls />
      <p className="text-xs text-muted">{t('m.adm.ai')}</p>
      <Toast msg={msg} />
      {mode === 'remote' && stats && (
        <section aria-labelledby="adm-stats" className="space-y-2">
          <h2 id="adm-stats" className="h2">{t('m.adm.stats')}</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">{([['m.adm.st.users', stats.users], ['m.adm.st.employers', stats.employers], ['m.adm.st.seekers', stats.seekers], ['m.adm.st.posts', stats.posts], ['m.adm.st.posts7', stats.posts_7d], ['m.adm.st.acc', stats.acceptances]] as const).map(([k, v]) => (
            <div key={k} className="glass-card glass-lite p-3"><dt className="text-xs text-muted">{t(k)}</dt><dd className="text-2xl font-bold">{v}</dd></div>))}</dl>
        </section>)}
      <section className="space-y-3" aria-labelledby="adm-posts">
        <h2 id="adm-posts" className="h2">{t('m.adm.posts')}</h2>
        <ul className="space-y-3">{st.posts.map((p) => {
          const stage = stageAt(scheduleOf(p, pool, now), now)
          const reach = people.map((s) => ({ s, r: reachFor(p, s.pins, pool, now) }))
          const reached = reach.filter((x) => x.r.visible), waiting = reach.filter((x) => !x.r.visible && x.r.level < 5)
          const acc = st.acceptances.filter((a) => a.postId === p.id).sort((a, b) => a.at.localeCompare(b.at))
          return (
            <li key={p.id} className="glass-card glass-lite p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="font-semibold">{p.position} · {p.company} {p.employerId !== MY_EMPLOYER && <span className="chip bg-surface3 text-muted border-line ml-1">{t('m.adm.sample')}</span>}</h3><p className="text-sm text-muted">{N.place(p.country, p.province)} · {N.industry(p.industry)} · {p.skills.map(N.skill).join(', ')}</p><PostFacts post={p} compact /></div>
                {stage !== 'expired' && <LevelBadge level={stage} reached />}
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><p className="font-medium">{t('m.adm.reached')} ({reached.length})</p><p className="text-muted">{reached.map((x) => x.s.name).join(', ') || t('m.adm.none')}</p></div>
                <div><p className="font-medium">{t('m.adm.waiting')}</p><p className="text-muted">{waiting.map((x) => `${x.s.name} (${t('m.lv.short', { n: x.r.level })})`).join(', ') || t('m.adm.none')}</p></div>
              </div>
              <div className="flex justify-end"><button type="button" className="btn-ghost text-sm text-danger-fg" onClick={async () => { if (window.confirm(t('m.post.delete.confirm'))) setMsg((await deletePost(p.id)) ? { tone: 'info', text: t('m.post.deleted') } : { tone: 'danger', text: t('m.post.delete.fail') }) }}><Icon name="trash" size={15} />{t('m.post.delete')}</button></div>
              {acc.map((a) => (
                <div key={a.id} className="border-t border-line pt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span><Icon name="ok" size={15} className="inline text-ok-fg" /> {nameOf(a)} · {t(`m.as.${a.status}` as never)}</span>
                  {a.status === 'confirmed' ? <button type="button" className="btn-primary text-sm" onClick={() => { void forwardCase(a.id) }}><Icon name="send" size={15} />{t('m.adm.forward')}</button>
                    : a.status === 'forwarded' ? <span className="text-xs text-muted">{t('m.adm.forwarded')}</span> : null}
                </div>))}
            </li>)
        })}</ul>
      </section>
    </Page>
  )
}
