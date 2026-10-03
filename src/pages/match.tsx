import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { LANGS, useI18n } from '../i18n'
import { useTheme } from '../theme'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { provinces } from '../locales/provinces'
import { isCountry, isTaken, offersFor, reachTier, tierOf, isVisibleTo, type Problem } from '../domain/match/logic'
import { INDUSTRIES, MAX_PINS, ME, MY_EMPLOYER, SKILLS, type Country, type Industry, type Post, type Skill, type Tier } from '../domain/match/types'
import { ACTIVE, GEO, SOON, type GeoCode } from '../geo'
import capitalsData from '../data/geo/capitals.json'
import { GeoMap, type MapPin } from '../components/geomap'
import { Warn } from '../components/ui'
import { Icon } from '../components/icons'

/**
 * Pages of the matching prototype. Data stay in this browser (see matchData.tsx); forwarding to agencies is simulated and
 * nothing is sent anywhere. Links to agencies open their official websites.
 */
const CAPITALS = capitalsData as { country: GeoCode; name: string }[]
const AGENCIES = [{ key: 'm.agency.doe', url: 'https://www.doe.go.th/' }, { key: 'm.agency.dsd', url: 'https://www.dsd.go.th/' }] as const

function useNames() {
  const { t, lang } = useI18n()
  const collator = useMemo(() => new Intl.Collator(lang === 'zh' ? 'zh-CN' : lang), [lang])
  return {
    country: (c: GeoCode) => t(`geo.c.${c}` as never), prov: (p: string) => t(`prov.${p}` as never),
    place: (c: GeoCode, p: string) => `${t(`prov.${p}` as never)}, ${t(`geo.c.${c}` as never)}`,
    skill: (s: Skill) => t(`jb.skill.${s}` as never), industry: (i: Industry) => t(`jb.industry.${i}` as never),
    provList: (c: Country) => Object.keys(provinces).filter((k) => k.startsWith(`prov.${c}-`)).map((k) => k.slice(5)).sort((a, b) => collator.compare(t(`prov.${a}` as never), t(`prov.${b}` as never))),
    problem: (p: Problem) => t(`m.err.${p}` as never),
  }
}
function Page({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return <div className="space-y-5"><div><h1 className="h1">{title}</h1>{sub && <p className="text-muted mt-1 max-w-3xl">{sub}</p>}</div>{children}</div>
}
/** a short message in a live region (pin added, posted, accepted …) */
function Toast({ msg }: { msg: { tone: 'info' | 'danger'; text: string } | null }) {
  return <div role="status" aria-live="polite">{msg && <Warn tone={msg.tone}>{msg.text}</Warn>}</div>
}
/**
 * WCAG 3.3.1 / 1.3.1: a form error is shown under the field it belongs to, the field is marked invalid and described by it,
 * and focus moves to that field. `key` names the field group, `focus` the control to focus.
 */
function useFieldError() {
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
type FieldError = ReturnType<typeof useFieldError>
/** WCAG 3.3.2: required fields say so in their label */
function Req() {
  const { t } = useI18n()
  return <span className="font-normal text-muted"> ({t('m.req')})</span>
}
/** nothing to show yet: say why and offer the next step, so no page is a dead end */
function Empty({ icon, text, to, action }: { icon: 'bell' | 'pin' | 'posts'; text: string; to?: string; action?: string }) {
  return (
    <div className="card flex flex-col items-center text-center gap-3 !py-8">
      <span className="w-12 h-12 rounded-2xl bg-brand text-brandfg grid place-items-center"><Icon name={icon} size={22} /></span>
      <p className="text-muted max-w-sm">{text}</p>
      {to && action && <NavLink to={to} className="btn-primary">{action}<Icon name="next" size={16} /></NavLink>}
    </div>
  )
}
function NeedRole({ role }: { role: 'seeker' | 'employer' }) {
  const { t } = useI18n()
  return <div className="card space-y-3"><p>{t('m.profile.none')}</p><NavLink to="choose-role" className="btn-primary inline-flex">{t(role === 'seeker' ? 'm.role.seeker' : 'm.role.employer')}<Icon name="next" size={16} /></NavLink></div>
}

/** country buttons + province list, shown next to the map */
/**
 * Country list with every ASEAN country (+ China). Only Thailand and China are open today; choosing another one frames it on the
 * map, shows its capital and a "coming soon" note, and keeps the province list and the next step closed. Nothing is saved for it.
 */
function PlaceFields({ country, province, onCountry, onProvince, idp, fe }: { country: GeoCode | null; province: string | null; onCountry: (c: GeoCode) => void; onProvince: (p: string | null) => void; idp: string; fe: FieldError }) {
  const { t } = useI18n()
  const N = useNames()
  const open = isCountry(country)
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block"><span className="label">{t('m.country')}<Req /></span>
          <select id={`${idp}-c`} className="input" aria-required="true" aria-invalid={fe.invalid(idp)} aria-describedby={fe.describe(idp)} value={country ?? ''} onChange={(e) => { const v = e.target.value; if (v in GEO) onCountry(v as GeoCode) }}>
            <option value="" disabled>{t('m.chooseCountry')}</option>
            <optgroup label={t('m.countryOpen')}>{ACTIVE.map((c) => <option key={c} value={c}>{N.country(c)}</option>)}</optgroup>
            <optgroup label={t('geo.soon')}>{SOON.map((c) => <option key={c} value={c}>{N.country(c)} · {t('geo.soon')}</option>)}</optgroup>
          </select></label>
        <label className="block"><span className="label">{t('m.province')}<Req /></span>
          <select id={idp} className="input" disabled={!open} aria-required="true" aria-invalid={fe.invalid(idp)} aria-describedby={fe.describe(idp)} value={province ?? ''} onChange={(e) => onProvince(e.target.value || null)}>
            <option value="">{t('m.chooseProv')}</option>
            {isCountry(country) && N.provList(country).map((p) => <option key={p} value={p}>{N.prov(p)}</option>)}
          </select></label>
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
function SkillPicker({ skills, onChange, idp, fe }: { skills: Skill[]; onChange: (s: Skill[]) => void; idp: string; fe: FieldError }) {
  const { t } = useI18n()
  const N = useNames()
  return (
    <fieldset aria-describedby={fe.describe(idp)}><legend className="label">{t('m.skills')}</legend>
      <div className="grid grid-cols-2 gap-2">{SKILLS.map((s, i) => (
        <label key={s} className="chip-check">
          <input id={i === 0 ? `${idp}-0` : undefined} type="checkbox" className="sr-only" aria-invalid={fe.invalid(idp)} checked={skills.includes(s)} onChange={() => onChange(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])} />
          <span className="chip-box" aria-hidden><Icon name="check" size={14} /></span>{N.skill(s)}
        </label>))}</div>
      {fe.msg(idp)}
    </fieldset>
  )
}
const IndustrySelect = ({ value, onChange, label }: { value: Industry; onChange: (i: Industry) => void; label: string }) => {
  const N = useNames()
  return <label className="block"><span className="label">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value as Industry)}>{INDUSTRIES.map((i) => <option key={i} value={i}>{N.industry(i)}</option>)}</select></label>
}
/** step pills: done = tick, current = bold + aria-current (not colour alone) */
const Steps = ({ items, at }: { items: string[]; at: number }) => (
  <ol className="flex flex-wrap gap-2">{items.map((s, i) => (
    <li key={s} aria-current={i === at ? 'step' : undefined} className={`inline-flex items-center gap-2 rounded-full border pl-1 pr-3 py-1 text-xs sm:text-sm ${i === at ? 'border-primary bg-brand text-brandfg font-semibold' : i < at ? 'border-ok-line bg-ok-bg text-ok-fg' : 'border-line bg-surface text-muted'}`}>
      <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${i === at ? 'bg-primary text-onprimary' : i < at ? 'bg-ok-fg text-ok-bg' : 'bg-surface3 text-muted'}`}>{i < at ? <Icon name="check" size={13} /> : i + 1}</span>{s}
    </li>))}</ol>
)
/** two columns on large screens: the map stays in view on the left while the steps scroll on the right */
const MAP_SIZE = 'h-[300px] sm:h-[380px] lg:h-[calc(100vh-11rem)] lg:min-h-[420px] lg:max-h-[640px]'
function MapLayout({ map, children }: { map: ReactNode; children: ReactNode }) {
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
  const { st, setOrigin, pin, unpin } = useMatch()
  const [editOrigin, setEditOrigin] = useState(false)
  const [oc, setOc] = useState<GeoCode | null>(st.me.origin?.country ?? null), [op, setOp] = useState<string | null>(st.me.origin?.province ?? null)
  const [dc, setDc] = useState<GeoCode | null>(null), [dp, setDp] = useState<string | null>(null)
  const [industry, setIndustry] = useState<Industry>('manufacturing')
  const [skills, setSkills] = useState<Skill[]>([])
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const fe = useFieldError()
  if (st.role !== 'seeker') return <Page title={t('m.seek.title')}><NeedRole role="seeker" /></Page>
  const originStep = !st.me.origin || editOrigin
  const pins: MapPin[] = st.me.pins.map((p) => ({ country: p.country, province: p.province, label: N.place(p.country, p.province), tone: 'mine' }))
  const confirmOrigin = () => {
    if (isCountry(oc) && op) { setOrigin({ country: oc, province: op }); setEditOrigin(false); setMsg(null); fe.clear() }
    else { setMsg(null); fe.set('origin-prov', oc ? 'origin-prov' : 'origin-prov-c', N.problem('place')) }
  }
  const submitPin = (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!isCountry(dc) || !dp) { fe.set('dest-prov', isCountry(dc) ? 'dest-prov' : 'dest-prov-c', N.problem('place')); return }
    const r = pin({ place: { country: dc, province: dp }, industry, skills })
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
            <p className="text-sm text-muted">{t('m.seek.from', { p: N.place(st.me.origin!.country, st.me.origin!.province) })} <button type="button" className="underline text-primary min-h-[24px]" onClick={() => setEditOrigin(true)}>{t('m.edit')}</button></p>
          </div>
          <PlaceFields idp="dest-prov" fe={fe} country={dc} province={dp} onCountry={(c) => { setDc(c); setDp(null); fe.clear() }} onProvince={(p) => { setDp(p); fe.clear() }} />
          <p className="text-xs text-muted">{t('m.seek.same')}</p>
          <div className="border-t border-line pt-3 space-y-3">
            <h3 className="font-semibold">{t('m.seek.s3')}</h3>
            <IndustrySelect value={industry} onChange={setIndustry} label={t('m.industry')} />
            <SkillPicker idp="seek-skills" fe={fe} skills={skills} onChange={(s) => { setSkills(s); fe.clear() }} />
          </div>
          <button type="submit" className="btn-primary" disabled={st.me.pins.length >= MAX_PINS || (!!dc && !isCountry(dc))}><Icon name="pin" size={16} />{t('m.pin.go')}</button>
        </form>
      )}
      <section className="space-y-2" aria-labelledby="pins-h">
        <h2 id="pins-h" className="h2">{t('m.pin.count', { n: st.me.pins.length })}</h2>
        {/* how many of the 5 queue places are used (the number is in the heading; the bar is a visual aid) */}
        <div className="h-1.5 rounded-full bg-surface3 overflow-hidden" aria-hidden><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(st.me.pins.length / MAX_PINS) * 100}%` }} /></div>
        <p className="text-xs text-muted">{t('m.pin.why')}</p>
        {!st.me.pins.length ? <div className="card text-muted">{t('m.pin.none')}</div> : (
          <ul className="grid sm:grid-cols-2 gap-2">{st.me.pins.map((p) => (
            <li key={p.id} className="card !p-3 flex items-start gap-3">
              <Icon name="pin" size={20} className="text-danger-fg mt-0.5" />
              <div className="min-w-0 flex-1"><h3 className="font-semibold">{N.place(p.country, p.province)}</h3><p className="text-sm text-muted">{N.industry(p.industry)} · {p.skills.map(N.skill).join(', ')}</p></div>
              <button type="button" className="w-9 h-9 rounded-lg border border-control grid place-items-center hover:bg-surface3" aria-label={`${t('m.pin.remove')}: ${N.place(p.country, p.province)}`} title={t('m.pin.remove')} onClick={() => { unpin(p.id); setMsg({ tone: 'info', text: t('m.pin.removed') }) }}><Icon name="close" size={16} /></button>
            </li>))}</ul>)}
      </section>
      </MapLayout>
    </Page>
  )
}

/* ================= employer: place on the map → company and needs → post ================= */
function PostStatus({ post }: { post: Post }) {
  const { t } = useI18n()
  const { st, now } = useMatch()
  const acc = st.acceptances.filter((a) => a.postId === post.id)
  const tier = tierOf(post, now, st.acceptances)
  const status = acc.some((a) => a.status === 'forwarded') ? 'forwarded' : acc.length ? 'accepted' : 'open'
  return (
    <div className="space-y-1 text-sm">
      <p className="flex flex-wrap items-center gap-2"><span className={`chip ${status === 'open' ? 'bg-warn-bg text-warn-fg border-warn-line' : 'bg-ok-bg text-ok-fg border-ok-line'}`}>{t(`m.st.${status}` as never)}</span></p>
      {!isTaken(post, st.acceptances) && <p className="text-muted">{t(`m.tier.${tier}` as never)} · {t('m.tier.why')}</p>}
    </div>
  )
}
export function HirePage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, post } = useMatch()
  const [c, setC] = useState<GeoCode | null>(null), [p, setP] = useState<string | null>(null)
  const [form, setForm] = useState(false)
  const [company, setCompany] = useState(st.myCompany), [position, setPosition] = useState('')
  const [industry, setIndustry] = useState<Industry>('manufacturing'), [skills, setSkills] = useState<Skill[]>([])
  const [years, setYears] = useState('0'), [details, setDetails] = useState('')
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const fe = useFieldError()
  if (st.role !== 'employer') return <Page title={t('m.emp.title')}><NeedRole role="employer" /></Page>
  const mine = st.posts.filter((x) => x.employerId === MY_EMPLOYER)
  const FIELD: Partial<Record<Problem, [string, string]>> = {
    company: ['emp-company', 'emp-company'], position: ['emp-position', 'emp-position'], years: ['emp-years', 'emp-years'],
    details: ['emp-details', 'emp-details'], contact: ['emp-details', 'emp-details'], skills: ['emp-skills', 'emp-skills-0'],
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (!isCountry(c) || !p) { setMsg({ tone: 'danger', text: N.problem('place') }); return }
    const r = post({ place: { country: c, province: p }, company: company.trim(), position: position.trim(), industry, skills, minYears: Number(years), details: details.trim() })
    if (r.ok) { fe.clear(); setMsg({ tone: 'info', text: t('m.emp.done') }); setForm(false); setPosition(''); setSkills([]); setDetails(''); setP(null); return }
    const f = FIELD[r.problem]
    if (f) fe.set(f[0], f[1], N.problem(r.problem)); else { fe.clear(); setMsg({ tone: 'danger', text: N.problem(r.problem) }) }
  }
  return (
    <Page title={t('m.emp.title')}>
      <MapLayout map={<>
        <GeoMap className={MAP_SIZE} label={t('m.mapLabel')} country={c} province={p} pins={mine.map((x) => ({ country: x.country, province: x.province, label: `${x.position} · ${N.place(x.country, x.province)}`, tone: 'post' }))}
          onPickCountry={(x) => { setC(x); setP(null); setForm(false) }} onPickProvince={(x) => { setP(x); setForm(false) }} />
        <p className="text-xs text-muted">{t('m.mapHint')}</p></>}>
      <Steps items={[t('m.emp.s1'), t('m.emp.s2')]} at={form ? 1 : 0} />
      <Toast msg={msg} />
      {!form ? (
        <section className="card space-y-3" aria-labelledby="e1h">
          <h2 id="e1h" className="h2">{t('m.emp.s1')}</h2>
          <PlaceFields idp="emp-prov" fe={fe} country={c} province={p} onCountry={(x) => { setC(x); setP(null) }} onProvince={setP} />
          <button type="button" className="btn-primary" disabled={!isCountry(c) || !p} onClick={() => { setForm(true); setMsg(null) }}><Icon name="posts" size={16} />{t('m.emp.fill')}</button>
        </section>
      ) : (
        <form className="card space-y-3" onSubmit={submit} aria-labelledby="e2h">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="e2h" className="h2">{t('m.emp.s2')}</h2><p className="text-sm text-muted">{c && p && N.place(c, p)} <button type="button" className="underline text-primary min-h-[24px]" onClick={() => setForm(false)}>{t('m.edit')}</button></p></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="block"><span className="label">{t('m.emp.company')}<Req /></span><input id="emp-company" className="input" required maxLength={80} aria-invalid={fe.invalid('emp-company')} aria-describedby={fe.describe('emp-company', 'emp-company-hint')} value={company} onChange={(e) => { setCompany(e.target.value); fe.clear() }} /></label>
              <span id="emp-company-hint" className="block text-xs text-muted mt-1">{t('m.hint.company')}</span>{fe.msg('emp-company')}</div>
            <div><label className="block"><span className="label">{t('m.emp.position')}<Req /></span><input id="emp-position" className="input" required maxLength={80} aria-invalid={fe.invalid('emp-position')} aria-describedby={fe.describe('emp-position', 'emp-position-hint')} value={position} onChange={(e) => { setPosition(e.target.value); fe.clear() }} /></label>
              <span id="emp-position-hint" className="block text-xs text-muted mt-1">{t('m.hint.position')}</span>{fe.msg('emp-position')}</div>
            <IndustrySelect value={industry} onChange={setIndustry} label={t('jb.field.industry')} />
            <div><label className="block"><span className="label">{t('m.emp.years')}</span><input id="emp-years" className="input" type="number" min={0} max={40} step={1} aria-invalid={fe.invalid('emp-years')} aria-describedby={fe.describe('emp-years')} value={years} onChange={(e) => { setYears(e.target.value); fe.clear() }} /></label>{fe.msg('emp-years')}</div>
          </div>
          <SkillPicker idp="emp-skills" fe={fe} skills={skills} onChange={(s) => { setSkills(s); fe.clear() }} />
          <div><label className="block"><span className="label">{t('m.emp.details')}</span><textarea id="emp-details" className="input min-h-[96px]" maxLength={600} aria-invalid={fe.invalid('emp-details')} aria-describedby={fe.describe('emp-details', 'det-hint')} value={details} onChange={(e) => { setDetails(e.target.value); fe.clear() }} /></label>
            <span id="det-hint" className="block text-xs text-muted mt-1">{t('m.emp.detailsHint')}</span>{fe.msg('emp-details')}</div>
          <div className="flex flex-wrap items-center gap-3"><button type="submit" className="btn-primary"><Icon name="send" size={16} />{t('m.emp.post')}</button><span className="text-xs text-muted">{t('m.emp.noPay')}</span></div>
        </form>
      )}
      <section className="space-y-2" aria-labelledby="myposts-h">
        <h2 id="myposts-h" className="h2">{t('m.posts')}</h2>
        {!mine.length ? <div className="card text-muted">{t('m.posts.none')}</div> : (
          <ul className="space-y-2">{mine.map((x) => (
            <li key={x.id} className="card !p-4 space-y-2"><div><h3 className="font-semibold">{x.position}</h3><p className="text-sm text-muted">{x.company} · {N.place(x.country, x.province)} · {N.industry(x.industry)}</p></div><PostStatus post={x} /></li>))}</ul>)}
      </section>
      </MapLayout>
    </Page>
  )
}

/* ================= notifications ================= */
export function NotificationsPage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, acceptOffer } = useMatch()
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  if (st.role === 'employer') {
    const mine = new Set(st.posts.filter((p) => p.employerId === MY_EMPLOYER).map((p) => p.id))
    const acc = st.acceptances.filter((a) => mine.has(a.postId))
    return (
      <Page title={t('m.notif.title')}>
        {!acc.length ? <Empty icon="bell" text={t('m.notif.none')} to="hire" action={t('m.posts')} /> : (
          <ul className="space-y-2">{acc.map((a) => { const p = st.posts.find((x) => x.id === a.postId)!; return (
            <li key={a.id} className="card !p-4 flex items-start gap-3"><Icon name="bell" size={20} className="text-primary mt-0.5" /><div><p className="font-semibold">{t('m.empNotif', { p: p.position })}</p><p className="text-sm text-muted">{t(a.status === 'forwarded' ? 'm.st.forwarded' : 'm.st.accepted')}</p></div></li>) })}</ul>)}
      </Page>)
  }
  if (st.role !== 'seeker') return <Page title={t('m.notif.title')}><Empty icon="bell" text={t('m.notif.none')} to="choose-role" action={t('hero.cta')} /></Page>
  const offers = offersFor(st, st.me, now)
  const why = (tier: Tier | null) => t(tier === 1 ? 'm.offer.why1' : tier === 2 ? 'm.offer.why2' : 'm.offer.why3')
  return (
    <Page title={t('m.notif.title')}>
      <Toast msg={msg} />
      {!st.me.pins.length ? <Empty icon="pin" text={t('m.notif.noPins')} to="seek" action={t('m.pins')} /> : !offers.length ? <Empty icon="bell" text={t('m.notif.none')} /> : (
        <ul className="space-y-3">{offers.map((p) => {
          const mineAcc = st.acceptances.find((a) => a.postId === p.id && a.seekerId === ME)
          return (
            <li key={p.id} className="card !p-4 space-y-2">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5"><Icon name="bell" size={14} />{t('m.offer.new')} · {why(reachTier(p, st.me))}</p>
              <div><h2 className="font-semibold text-lg">{p.position}</h2><p className="text-sm text-muted">{p.company} · {N.place(p.country, p.province)} · {N.industry(p.industry)}</p></div>
              <p className="text-sm">{t('jb.minYearsShort', { n: p.minYears })} · {p.skills.map(N.skill).join(', ')}</p>
              {p.details && <p className="text-sm text-muted">{p.details}</p>}
              {mineAcc ? (
                <div className="space-y-2 border-t border-line pt-2">
                  <p className="text-sm font-semibold text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('m.accepted')} · {t(mineAcc.status === 'forwarded' ? 'm.st.forwarded' : 'm.st.accepted')}</p>
                  <div className="text-sm"><p className="font-medium">{t('m.agency.h')}</p>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">{AGENCIES.map((a) => <li key={a.key}><a className="text-primary underline inline-flex items-center gap-1 min-h-[24px]" href={a.url} target="_blank" rel="noopener noreferrer">{t(a.key)}<Icon name="external" size={13} /></a></li>)}</ul>
                    <p className="text-xs text-muted mt-1">{t('m.agency.note')}</p></div>
                </div>
              ) : <button type="button" className="btn-primary" onClick={() => { const r = acceptOffer(p.id); setMsg(r.ok ? { tone: 'info', text: t('m.accept.done') } : { tone: 'danger', text: N.problem(r.problem) }) }}>{t('m.accept')}</button>}
            </li>)
        })}</ul>)}
    </Page>
  )
}

/* ================= profile, prepare, settings, help ================= */
export function MePage() {
  const { t } = useI18n()
  const N = useNames()
  const { st } = useMatch()
  return (
    <Page title={t('m.profile.title')}>
      <section className="card space-y-2">
        <p><span className="text-muted">{t('m.profile.role')}:</span> <b>{st.role ? t(st.role === 'seeker' ? 'm.role.seeker' : 'm.role.employer') : t('m.profile.none')}</b></p>
        {st.role === 'seeker' && st.me.origin && <p className="text-sm">{t('m.seek.from', { p: N.place(st.me.origin.country, st.me.origin.province) })} · {t('m.pin.count', { n: st.me.pins.length })}</p>}
        {st.role === 'employer' && st.myCompany && <p className="text-sm">{t('m.emp.company')}: {st.myCompany}</p>}
        <NavLink to="choose-role" className="btn-ghost inline-flex">{t('m.profile.change')}</NavLink>
        <p className="text-xs text-muted">{t('m.profile.note')}</p>
      </section>
    </Page>
  )
}
export function PreparePage() {
  const { t } = useI18n()
  const cards = [['language', 'culture', 'm.prepare.lang', 'm.prepare.lang.d'], ['sources', 'legal', 'm.prepare.legal', 'm.prepare.legal.d']] as const
  return (
    <Page title={t('m.prepare.title')}>
      <ul className="grid md:grid-cols-2 gap-3">{cards.map(([to, icon, h, d]) => (
        <li key={to}><NavLink to={to} className="card card-hover !p-5 flex gap-4 items-start h-full"><span className="w-11 h-11 shrink-0 rounded-xl bg-brand text-brandfg grid place-items-center"><Icon name={icon} size={22} /></span><span><span className="block font-semibold text-lg">{t(h)}</span><span className="block text-sm text-muted mt-1">{t(d)}</span></span></NavLink></li>))}</ul>
    </Page>
  )
}
export function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const { theme, toggle } = useTheme()
  const { reset } = useMatch()
  const [done, setDone] = useState(false)
  return (
    <Page title={t('m.settings.title')}>
      <section className="card space-y-4">
        <fieldset><legend className="label">{t('m.settings.lang')}</legend><div className="flex flex-wrap gap-2">{LANGS.map((l) => <button key={l.id} type="button" lang={l.html} aria-pressed={lang === l.id} onClick={() => setLang(l.id)} className={`min-h-[44px] px-4 rounded-lg border ${lang === l.id ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{l.label}</button>)}</div></fieldset>
        <fieldset><legend className="label">{t('m.settings.theme')}</legend><div className="flex gap-2">{(['light', 'dark'] as const).map((m) => <button key={m} type="button" aria-pressed={theme === m} onClick={() => theme !== m && toggle()} className={`min-h-[44px] px-4 rounded-lg border flex items-center gap-2 ${theme === m ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}><Icon name={m} size={16} />{t(m === 'light' ? 'm.settings.light' : 'm.settings.dark')}</button>)}</div></fieldset>
        <div className="border-t border-line pt-3 space-y-2"><p className="text-sm text-muted">{t('m.settings.reset.d')}</p>
          <button type="button" className="btn-ghost" onClick={() => { if (window.confirm(t('m.settings.reset.d'))) { reset(); setDone(true) } }}>{t('m.settings.reset')}</button>
          <p role="status" className="text-sm">{done && t('m.settings.resetDone')}</p></div>
      </section>
    </Page>
  )
}
export function HelpPage() {
  const { t } = useI18n()
  return <Page title={t('m.help.title')}><section className="card space-y-3 text-sm"><p>{t('m.help.seeker')}</p><p>{t('m.help.employer')}</p><p className="text-muted">{t('m.proto')}</p></section></Page>
}

/* ================= admin back office ================= */
export function BackofficePage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, isAdmin, advanceDay, forwardCase } = useMatch()
  if (!isAdmin) return <Page title={t('m.adm.title')}><Warn>{t('m.adm.gate')}</Warn></Page>
  const people = [{ ...st.me, name: t('m.adm.you') }, ...st.seekers]
  return (
    <Page title={t('m.adm.title')} sub={t('m.adm.sub')}>
      <div className="flex flex-wrap items-center gap-3"><span className="chip bg-info-bg text-info-fg border-info-line">{t('m.adm.clock', { n: st.dayOffset })}</span><button type="button" className="btn-ghost text-sm" onClick={advanceDay}><Icon name="fastForward" size={16} />{t('m.adm.advance')}</button></div>
      <p className="text-xs text-muted">{t('m.adm.ai')}</p>
      <section className="space-y-3" aria-labelledby="adm-posts">
        <h2 id="adm-posts" className="h2">{t('m.adm.posts')}</h2>
        <ul className="space-y-3">{st.posts.map((p) => {
          const tier = tierOf(p, now, st.acceptances)
          const reached = people.filter((s) => isVisibleTo(p, s, now, st.acceptances))
          const waiting = people.filter((s) => { const r = reachTier(p, s); return r !== null && !isVisibleTo(p, s, now, st.acceptances) })
          const acc = st.acceptances.filter((a) => a.postId === p.id)
          return (
            <li key={p.id} className="card !p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="font-semibold">{p.position} · {p.company} {p.employerId !== MY_EMPLOYER && <span className="chip bg-surface3 text-muted border-line ml-1">{t('m.adm.sample')}</span>}</h3><p className="text-sm text-muted">{N.place(p.country, p.province)} · {N.industry(p.industry)} · {p.skills.map(N.skill).join(', ')}</p></div>
                <span className="chip bg-warn-bg text-warn-fg border-warn-line">{t(`m.tier.${tier}` as never)}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><p className="font-medium">{t('m.adm.reached')} ({reached.length})</p><p className="text-muted">{reached.map((s) => s.name).join(', ') || t('m.adm.none')}</p></div>
                <div><p className="font-medium">{t('m.adm.waiting')}</p><p className="text-muted">{waiting.map((s) => `${s.name} (${reachTier(p, s)})`).join(', ') || t('m.adm.none')}</p></div>
              </div>
              {acc.map((a) => { const s = people.find((x) => x.id === a.seekerId); return (
                <div key={a.id} className="border-t border-line pt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span><Icon name="ok" size={15} className="inline text-ok-fg" /> {s?.name} · {t(a.status === 'forwarded' ? 'm.st.forwarded' : 'm.st.accepted')}</span>
                  {a.status === 'accepted' ? <button type="button" className="btn-primary text-sm" onClick={() => forwardCase(a.id)}><Icon name="send" size={15} />{t('m.adm.forward')}</button> : <span className="text-xs text-muted">{t('m.adm.forwarded')}</span>}
                </div>) })}
            </li>)
        })}</ul>
      </section>
    </Page>
  )
}
