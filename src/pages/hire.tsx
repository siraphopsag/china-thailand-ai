import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { NavLink, go, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { canPost, isCountry, localDay, postQuota, type PostInput, type Problem } from '../domain/match/logic'
import { scheduleOf, stageAt } from '../domain/match/release'
import { precheck, type Precheck } from '../domain/match/precheck'
import { BENEFITS, CURRENCIES, EDU, EMPLOYMENT, LANGS, LANG_LEVELS, MEMBER_POSTS_PER_WEEK, MY_EMPLOYER, type Benefit, type Currency, type Edu, type Employment, type Industry, type LanguageSkill, type Post, type Skill } from '../domain/match/types'
import type { GeoCode } from '../geo'
import { GeoMap } from '../components/geomap'
import { Modal } from '../components/modal'
import { Icon } from '../components/icons'
import { IndustrySelect, MAP_SIZE, MapLayout, NeedRole, Page, PlaceFields, PostCard, QuotaBar, Req, SkillPicker, Steps, Toast, useFieldError, useGate, useNames, useRel } from './match'
import { postToInput } from '../domain/match/remote'

/**
 * Employer flow (owner, Oct 2026): place on the map → company and needs (4 groups) → "Check and post" → simulated AI pre-check →
 * "Post this job?" → "Your post is live" with [View the post] [Post another]. 3 free posts per weekly cycle (new or renewed); after
 * that the membership package window (10 per cycle; planned price shown struck through, free in the prototype — no payment).
 * Editing (owner, Oct 2026): "Edit" on one of my posts (or hire?edit=<id>) fills the same form; saving keeps the posting date.
 */
type Stage = null | 'check' | 'confirm' | 'done' | 'package' | 'joined'
const today = (now: number) => localDay(new Date(now).toISOString())
const plusDays = (now: number, d: number) => localDay(new Date(now + d * 86_400_000).toISOString())
/** which field each problem belongs to: [error group, control to focus] */
const FIELD: Partial<Record<Problem, [string, string]>> = {
  company: ['emp-company', 'emp-company'], position: ['emp-position', 'emp-position'], years: ['emp-years', 'emp-years'],
  details: ['emp-details', 'emp-details'], contact: ['emp-details', 'emp-details'], skills: ['emp-skills', 'emp-skills-0'],
  headcount: ['emp-headcount', 'emp-headcount'], employment: ['emp-employment', 'emp-employment'], salary: ['emp-salary', 'emp-salary-min'],
  startDate: ['emp-start', 'emp-start'], languages: ['emp-langs', 'emp-langs-th'], education: ['emp-edu', 'emp-edu'],
}

export function HirePage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, pool, post, editPost, deletePost, renew, subscribe } = useMatch()
  const { until } = useRel()
  const editId = useSearchParam('edit')
  const [editing, setEditing] = useState<Post | null>(null)
  const [saving, setSaving] = useState(false)
  const [c, setC] = useState<GeoCode | null>(null), [p, setP] = useState<string | null>(null)
  const [form, setForm] = useState(false)
  const [company, setCompany] = useState(st.myCompany), [position, setPosition] = useState('')
  const [industry, setIndustry] = useState<Industry>('manufacturing'), [skills, setSkills] = useState<Skill[]>([])
  const [years, setYears] = useState('0'), [details, setDetails] = useState('')
  const [headcount, setHeadcount] = useState('1'), [employment, setEmployment] = useState<Employment>('permanent')
  const [salMin, setSalMin] = useState(''), [salMax, setSalMax] = useState(''), [currency, setCurrency] = useState<Currency>('THB')
  const [start, setStart] = useState(''), [langs, setLangs] = useState<LanguageSkill[]>([]), [edu, setEdu] = useState<Edu>('none'), [benefits, setBenefits] = useState<Benefit[]>([])
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const [stage, setStage] = useState<Stage>(null)
  const [check, setCheck] = useState<Precheck | null>(null)
  const [pending, setPending] = useState<PostInput | null>(null)
  const [posted, setPosted] = useState<Post | null>(null)
  const fe = useFieldError()
  const gate = useGate('hire')
  const startEdit = (x: Post) => {
    const i = postToInput(x)
    setEditing(x); setC(i.place.country); setP(i.place.province); setCompany(i.company); setPosition(i.position); setIndustry(i.industry); setSkills(i.skills)
    setYears(String(i.minYears)); setDetails(i.details); setHeadcount(String(i.headcount)); setEmployment(i.employment)
    setSalMin(i.salary ? String(i.salary.min) : ''); setSalMax(i.salary ? String(i.salary.max) : ''); setCurrency(i.salary?.currency ?? 'THB')
    setStart(i.startDate); setLangs(i.languages); setEdu(i.education); setBenefits(i.benefits); setForm(true); setMsg(null); fe.clear()
    window.scrollTo(0, 0); focusHead.current = true
  }
  // move focus to the form heading after the edit form has rendered
  const focusHead = useRef(false)
  useEffect(() => { if (focusHead.current) { focusHead.current = false; document.getElementById('e2h')?.focus() } })
  // the company name arrives with the account data: fill it in once, unless the employer already typed something
  useEffect(() => { if (!company && st.myCompany && !editing) setCompany(st.myCompany) }, [st.myCompany]) // eslint-disable-line react-hooks/exhaustive-deps
  // opened as hire?edit=<id> (from the post page): start editing once that post has loaded
  const editOpened = useRef(false)
  useEffect(() => {
    if (editOpened.current || !editId) return
    const x = st.posts.find((q) => q.id === editId && q.employerId === MY_EMPLOYER); if (!x) return
    editOpened.current = true; startEdit(x)
  })
  if (gate) return <Page title={t('m.emp.title')}>{gate}</Page>
  if (st.role !== 'employer') return <Page title={t('m.emp.title')}><NeedRole role="employer" /></Page>
  const mine = st.posts.filter((x) => x.employerId === MY_EMPLOYER)
  const q = postQuota(st, now), used = q.used, limit = q.limit
  const clear = () => fe.clear()
  const showProblem = (pr: Problem) => { const f = FIELD[pr]; if (f) fe.set(f[0], f[1], N.problem(pr)); else setMsg({ tone: 'danger', text: N.problem(pr) }) }

  const input = (): PostInput | null => {
    if (!isCountry(c) || !p) return null
    const hasSalary = salMin.trim() !== '' || salMax.trim() !== ''
    return { place: { country: c, province: p }, company: company.trim(), position: position.trim(), industry, skills, minYears: Number(years), details: details.trim(),
      headcount: Number(headcount), employment, salary: hasSalary ? { min: Number(salMin), max: Number(salMax), currency } : null, startDate: start, languages: langs, education: edu, benefits }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault(); setMsg(null); fe.clear()
    const i = input(); if (!i) { setMsg({ tone: 'danger', text: N.problem('place') }); return }
    if (!editing && !canPost(st, now)) { setStage('package'); return }
    // editing without changing the start date: it is checked against the posting day, so a post whose start has passed can still be fixed
    const r = precheck(i, editing && editing.startDate && i.startDate === editing.startDate ? editing.createdAt : new Date(now).toISOString())
    setPending(i); setCheck(r)
    setStage(r.errors.length || r.warnings.length ? 'check' : 'confirm')
  }
  const closeCheck = () => { setStage(null); if (check?.errors[0]) showProblem(check.errors[0]) }
  const confirm = async () => {
    if (!pending || saving) return
    setSaving(true)
    const r = editing ? await editPost(editing.id, pending) : await post(pending)
    setSaving(false)
    if (r.ok) { setPosted(r.value); setStage('done'); return }
    if (r.problem === 'quota') { setStage('package'); return }
    setStage(null); showProblem(r.problem)
  }
  const another = () => {
    setStage(null); setPosted(null); setPending(null); setCheck(null); setEditing(null)
    setPosition(''); setSkills([]); setDetails(''); setYears('0'); setHeadcount('1'); setEmployment('permanent'); setSalMin(''); setSalMax(''); setStart(''); setLangs([]); setEdu('none'); setBenefits([])
    setForm(false); setC(null); setP(null)
    // the form unmounts, so keyboard focus would fall back to the page: put it on the country field to start the next post
    requestAnimationFrame(() => document.getElementById('emp-prov-c')?.focus())
  }
  const remove = async (x: Post) => {
    if (!window.confirm(t('m.post.delete.confirm'))) return
    const ok = await deletePost(x.id)
    if (ok && editing?.id === x.id) another()
    setMsg(ok ? { tone: 'info', text: t('m.post.deleted') } : { tone: 'danger', text: t('m.post.delete.fail') })
  }
  const renewIt = async (x: Post) => {
    if (!window.confirm(t('m.em.renew.confirm'))) return
    const r = await renew(x.id)
    if (r.ok) setMsg({ tone: 'info', text: t('m.em.renewed') })
    else if (r.problem === 'quota') setStage('package')
    else setMsg({ tone: 'danger', text: N.problem(r.problem) })
  }
  const toggleLang = (l: LanguageSkill['lang']) => { setLangs((xs) => (xs.some((x) => x.lang === l) ? xs.filter((x) => x.lang !== l) : [...xs, { lang: l, level: 'conversational' }])); clear() }
  const setLevel = (l: LanguageSkill['lang'], level: LanguageSkill['level']) => setLangs((xs) => xs.map((x) => (x.lang === l ? { ...x, level } : x)))

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
        <form className="card space-y-5" onSubmit={submit} aria-labelledby="e2h" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="e2h" tabIndex={-1} className="h2 outline-none">{t(editing ? 'm.edit.title' : 'm.emp.s2')}</h2><p className="text-sm text-muted">{c && p && N.place(c, p)} <button type="button" className="underline text-primary min-h-[24px]" onClick={() => setForm(false)}>{t('m.edit')}</button></p></div>

          <fieldset className="form-sec"><legend className="form-sec-h"><Icon name="business" size={16} />{t('m.emp.sec.company')}</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="block"><span className="label">{t('m.emp.company')}<Req /></span><input id="emp-company" className="input" maxLength={80} aria-required="true" aria-invalid={fe.invalid('emp-company')} aria-describedby={fe.describe('emp-company', 'emp-company-hint')} value={company} onChange={(e) => { setCompany(e.target.value); clear() }} /></label>
                <span id="emp-company-hint" className="block text-xs text-muted mt-1">{t('m.hint.company')}</span>{fe.msg('emp-company')}</div>
              <IndustrySelect value={industry} onChange={setIndustry} label={t('jb.field.industry')} />
            </div>
          </fieldset>

          <fieldset className="form-sec"><legend className="form-sec-h"><Icon name="employment" size={16} />{t('m.emp.sec.role')}</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="block"><span className="label">{t('m.emp.position')}<Req /></span><input id="emp-position" className="input" maxLength={80} aria-required="true" aria-invalid={fe.invalid('emp-position')} aria-describedby={fe.describe('emp-position', 'emp-position-hint')} value={position} onChange={(e) => { setPosition(e.target.value); clear() }} /></label>
                <span id="emp-position-hint" className="block text-xs text-muted mt-1">{t('m.hint.position')}</span>{fe.msg('emp-position')}</div>
              <div><label className="block"><span className="label">{t('m.f.headcount')}<Req /></span><input id="emp-headcount" className="input" type="number" min={1} max={99} step={1} aria-required="true" aria-invalid={fe.invalid('emp-headcount')} aria-describedby={fe.describe('emp-headcount')} value={headcount} onChange={(e) => { setHeadcount(e.target.value); clear() }} /></label>{fe.msg('emp-headcount')}</div>
              <div><label className="block"><span className="label">{t('m.f.employment')}<Req /></span><select id="emp-employment" className="input" value={employment} onChange={(e) => setEmployment(e.target.value as Employment)}>{EMPLOYMENT.map((x) => <option key={x} value={x}>{N.employment(x)}</option>)}</select></label>{fe.msg('emp-employment')}</div>
              <div><label className="block"><span className="label">{t('m.emp.years')}</span><input id="emp-years" className="input" type="number" min={0} max={40} step={1} aria-invalid={fe.invalid('emp-years')} aria-describedby={fe.describe('emp-years')} value={years} onChange={(e) => { setYears(e.target.value); clear() }} /></label>{fe.msg('emp-years')}</div>
            </div>
            <SkillPicker idp="emp-skills" fe={fe} skills={skills} onChange={(s) => { setSkills(s); clear() }} />
          </fieldset>

          <fieldset className="form-sec"><legend className="form-sec-h"><Icon name="documents" size={16} />{t('m.emp.sec.terms')}</legend>
            <fieldset aria-describedby={fe.describe('emp-salary', 'emp-salary-hint')}><legend className="label">{t('m.f.salary')} <span className="font-normal text-muted">({t('m.opt')})</span></legend>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <input id="emp-salary-min" className="input" type="number" min={1} inputMode="numeric" aria-label={t('m.f.salaryMin')} placeholder={t('m.f.salaryMin')} aria-invalid={fe.invalid('emp-salary')} value={salMin} onChange={(e) => { setSalMin(e.target.value); clear() }} />
                <input className="input" type="number" min={1} inputMode="numeric" aria-label={t('m.f.salaryMax')} placeholder={t('m.f.salaryMax')} aria-invalid={fe.invalid('emp-salary')} value={salMax} onChange={(e) => { setSalMax(e.target.value); clear() }} />
                <select className="input !w-auto" aria-label={t('m.f.currency')} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>{CURRENCIES.map((x) => <option key={x} value={x}>{t(`m.cur.${x}` as never)}</option>)}</select>
              </div>
              <span id="emp-salary-hint" className="block text-xs text-muted mt-1">{t('m.f.salaryHint')}</span>{fe.msg('emp-salary')}
            </fieldset>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="block"><span className="label">{t('m.f.start')}<Req /></span><input id="emp-start" className="input" type="date" min={editing?.startDate && editing.startDate < today(now) ? editing.startDate : today(now)} max={plusDays(now, 730)} aria-required="true" aria-invalid={fe.invalid('emp-start')} aria-describedby={fe.describe('emp-start')} value={start} onChange={(e) => { setStart(e.target.value); clear() }} /></label>{fe.msg('emp-start')}</div>
              <div><label className="block"><span className="label">{t('m.f.education')} <span className="font-normal text-muted">({t('m.opt')})</span></span><select id="emp-edu" className="input" value={edu} onChange={(e) => setEdu(e.target.value as Edu)}>{EDU.map((x) => <option key={x} value={x}>{N.edu(x)}</option>)}</select></label></div>
            </div>
            <fieldset aria-describedby={fe.describe('emp-langs', 'emp-langs-hint')}><legend className="label">{t('m.f.languages')}<Req /></legend>
              <div className="grid sm:grid-cols-3 gap-2 items-start">{LANGS.map((l) => { const on = langs.find((x) => x.lang === l); return (
                <div key={l} className="space-y-1.5">
                  <label className="chip-check chip-auto"><input id={`emp-langs-${l}`} type="checkbox" className="sr-only" aria-invalid={fe.invalid('emp-langs')} checked={!!on} onChange={() => toggleLang(l)} /><span className="chip-box" aria-hidden><Icon name="check" size={14} /></span>{N.lang(l)}</label>
                  {on && <label className="block"><span className="block text-xs text-muted mb-1">{t('m.f.level')}</span><select className="input" aria-label={`${N.lang(l)} — ${t('m.f.level')}`} value={on.level} onChange={(e) => setLevel(l, e.target.value as LanguageSkill['level'])}>{LANG_LEVELS.map((x) => <option key={x} value={x}>{N.level(x)}</option>)}</select></label>}
                </div>) })}</div>
              <span id="emp-langs-hint" className="block text-xs text-muted mt-1">{t('m.f.languagesHint')}</span>{fe.msg('emp-langs')}
            </fieldset>
            <fieldset><legend className="label">{t('m.f.benefits')} <span className="font-normal text-muted">({t('m.opt')})</span></legend>
              <div className="grid grid-cols-2 auto-rows-fr gap-2">{BENEFITS.map((b) => (
                <label key={b} className="chip-check"><input type="checkbox" className="sr-only" checked={benefits.includes(b)} onChange={() => setBenefits((xs) => (xs.includes(b) ? xs.filter((x) => x !== b) : [...xs, b]))} /><span className="chip-box" aria-hidden><Icon name="check" size={14} /></span>{N.benefit(b)}</label>))}</div>
            </fieldset>
          </fieldset>

          <fieldset className="form-sec"><legend className="form-sec-h"><Icon name="info" size={16} />{t('m.emp.sec.more')}</legend>
            <div><label className="block"><span className="label">{t('m.emp.details')}</span><textarea id="emp-details" className="input min-h-[96px]" maxLength={600} aria-invalid={fe.invalid('emp-details')} aria-describedby={fe.describe('emp-details', 'det-hint')} value={details} onChange={(e) => { setDetails(e.target.value); clear() }} /></label>
              <span id="det-hint" className="block text-xs text-muted mt-1">{t('m.emp.detailsHint')}</span>{fe.msg('emp-details')}</div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary"><Icon name="ai" size={16} />{t(editing ? 'm.edit.save' : 'm.emp.post')}</button>
            {editing ? <button type="button" className="btn-ghost" onClick={another}>{t('m.edit.cancel')}</button> : <QuotaNote used={used} limit={limit} member={st.member} />}
          </div>
        </form>
      )}
      <section className="space-y-2" aria-labelledby="myposts-h">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="myposts-h" className="h2">{t('m.posts')}</h2><NavLink to="board" className="text-sm font-medium text-primary inline-flex items-center gap-1 min-h-[24px]">{t('m.board')}<Icon name="next" size={14} /></NavLink></div>
        <QuotaBar q={q} kind="post" />
        {!mine.length ? <div className="glass-card p-5 text-muted">{t('m.posts.none')}</div> : (
          <ul className="space-y-2">{mine.map((x) => { const sc = scheduleOf(x, pool, now), stage = stageAt(sc, now); return stage === 'expired' ? null : (
            <PostCard key={x.id} post={x} level={stage} reached>
              {now >= sc.warnAt && <p className="text-sm text-warn-fg flex items-center gap-1.5"><Icon name="hourglass" size={15} />{t('m.em.expiring', { t: until(sc.expiresAt) })}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <NavLink to={`post?id=${x.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary min-h-[24px]">{t('m.pp.view')}<Icon name="next" size={14} /></NavLink>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-medium min-h-[24px] hover:underline underline-offset-4" onClick={() => startEdit(x)} aria-label={`${t('m.post.edit')}: ${x.position}`}><Icon name="edit" size={14} />{t('m.post.edit')}</button>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-medium min-h-[24px] hover:underline underline-offset-4" onClick={() => renewIt(x)} aria-label={`${t('m.em.renew')}: ${x.position}`}><Icon name="renew" size={14} />{t('m.em.renew')}</button>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-danger-fg min-h-[24px] hover:underline underline-offset-4" onClick={() => remove(x)} aria-label={`${t('m.post.delete')}: ${x.position}`}><Icon name="trash" size={14} />{t('m.post.delete')}</button>
              </div>
            </PostCard>) })}</ul>)}
      </section>
      </MapLayout>

      {/* 1) pre-check (simulated AI) */}
      <Modal open={stage === 'check'} onClose={closeCheck} wide>{(id) => check && (<>
        <div className="flex flex-wrap items-center gap-2"><h2 id={id} className="h2">{t('m.chk.title')}</h2><span className="chip bg-info-bg text-info-fg border-info-line"><Icon name="ai" size={12} />{t('m.chk.sim')}</span></div>
        <p className="text-xs text-muted">{t('m.chk.simNote')}</p>
        {check.errors.length > 0 && <div className="space-y-1.5"><p className="text-sm font-semibold text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={16} />{t('m.chk.errors')}</p>
          <ul className="list-disc pl-6 text-sm space-y-1">{check.errors.map((e) => <li key={e}>{N.problem(e)}</li>)}</ul></div>}
        {check.warnings.length > 0 && <div className="space-y-1.5"><p className="text-sm font-semibold text-warn-fg flex items-center gap-1.5"><Icon name="warn" size={16} />{t('m.chk.warnings')}</p>
          <ul className="list-disc pl-6 text-sm space-y-1">{check.warnings.map((w) => <li key={w}>{t(`m.chk.w.${w}` as never)}</li>)}</ul></div>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={closeCheck}>{t('m.chk.fix')}</button>
          {check.errors.length === 0 && <button type="button" className="btn-primary" onClick={() => setStage('confirm')}>{t('m.chk.continue')}<Icon name="next" size={16} /></button>}
        </div></>)}</Modal>

      {/* 2) are you sure? */}
      <Modal open={stage === 'confirm'} onClose={() => setStage(null)}>{(id) => pending && (<>
        <h2 id={id} className="h2">{t(editing ? 'm.edit.cf.title' : 'm.cf.title')}</h2>
        {check && check.warnings.length === 0 && check.errors.length === 0 && <p className="text-sm text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('m.chk.ok')} <span className="text-muted">({t('m.chk.sim')})</span></p>}
        <div className="card-i space-y-1 text-sm"><p className="font-semibold">{pending.position} · {pending.company}</p><p className="text-muted">{N.place(pending.place.country, pending.place.province)} · {t('m.people', { n: pending.headcount })} · {N.employment(pending.employment)}</p></div>
        <p className="text-xs text-muted">{editing ? t('m.edit.note') : t('m.cf.quota', { n: used + 1, max: limit })}</p>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setStage(null)}>{t('m.cf.back')}</button><button type="button" className="btn-primary" disabled={saving} onClick={confirm}><Icon name="send" size={16} />{t(editing ? 'm.edit.cf.yes' : 'm.cf.yes')}</button></div></>)}</Modal>

      {/* 3) posted */}
      <Modal open={stage === 'done'} onClose={another}>{(id) => posted && (<>
        <div className="flex items-center gap-3"><span className="glass-drop w-11 h-11 shrink-0"><Icon name="check" size={22} /></span><h2 id={id} className="h2">{t(editing ? 'm.edit.done' : 'm.dn.title')}</h2></div>
        <p className="text-sm text-muted">{t(editing ? 'm.edit.note' : 'm.dn.text')}</p>
        <div className="grid sm:grid-cols-2 gap-2"><button type="button" className="btn-primary" onClick={() => { const pid = posted.id; another(); go(`post?id=${pid}`) }}><Icon name="posts" size={16} />{t('m.dn.view')}</button>
          <button type="button" className="btn-ghost" onClick={another}><Icon name={editing ? 'back' : 'plus'} size={16} />{t(editing ? 'm.pk.ok' : 'm.dn.more')}</button></div></>)}</Modal>

      {/* 4) weekly allowance reached → membership package (simulated, no payment) */}
      <Modal open={stage === 'package' || stage === 'joined'} onClose={() => setStage(null)}>{(id) => stage === 'joined' ? (<>
        <div className="flex items-center gap-3"><span className="glass-drop w-11 h-11 shrink-0"><Icon name="ok" size={22} /></span><h2 id={id} className="h2">{t('m.pk.done', { n: MEMBER_POSTS_PER_WEEK })}</h2></div>
        <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setStage(null)}>{t('m.pk.ok')}</button></div></>) : (<>
        <h2 id={id} className="h2">{t('m.pk.title')}</h2>
        <p className="text-sm text-muted">{t('m.pk.lead', { max: limit })}</p>
        <PackageCard />
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setStage(null)}>{t('m.pk.later')}</button>
          <button type="button" className="btn-primary" onClick={async () => { await subscribe(); setStage('joined') }}>{t('m.pk.join')}</button></div></>)}</Modal>
    </Page>
  )
}

function QuotaNote({ used, limit, member }: { used: number; limit: number; member: boolean }) {
  const { t } = useI18n()
  return <span className="text-xs text-muted inline-flex items-center gap-2">{t('m.q.count', { n: used, max: limit })}<span className={`chip ${member ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line'}`}>{member ? t('m.q.member') : t('m.q.free')}</span></span>
}
/** the membership package as planned: 10 posts per 7 days, planned price struck through, free in the prototype */
export function PackageCard() {
  const { t } = useI18n()
  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-3"><span className="glass-drop w-10 h-10 shrink-0"><Icon name="shield" size={20} /></span><div><p className="font-semibold">{t('m.pk.name')}</p><p className="text-sm text-muted">{t('m.pk.posts', { n: MEMBER_POSTS_PER_WEEK })}</p></div></div>
      <p className="flex items-baseline gap-3"><span className="price-was text-lg text-muted"><span className="sr-only">{t('m.pk.priceSr')} </span>{t('m.pk.price')}</span><span className="text-2xl font-bold text-ok-fg">{t('m.pk.free')}</span></p>
      <p className="text-xs text-muted">{t('m.pk.note')}</p>
    </div>
  )
}
