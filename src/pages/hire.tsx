import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { NavLink, go, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { canPost, caseBlocksDelete, isCountry, localDay, memberActive, postQuota, type PostInput, type Problem } from '../domain/match/logic'
import { scheduleOf, stageAt, capStage } from '../domain/match/release'
import { precheck, type Precheck } from '../domain/match/precheck'
import { useAuth } from '../auth'
import { aiCheck } from '../ai/client'
import type { AiCheck, AiResponse } from '../ai/spec'
import { AiCheckResult } from './ask'
import { ThinkingOrb } from '../components/morph-orb'
import { useLite } from '../theme'
import { BENEFITS, CURRENCIES, EDU, EMPLOYMENT, LANGS, LANG_LEVELS, MY_EMPLOYER, type Benefit, type Currency, type Edu, type Employment, type Industry, type LanguageSkill, type Post, type Skill } from '../domain/match/types'
import type { GeoCode } from '../geo'
import { GeoMap } from '../components/geomap'
import { Modal } from '../components/modal'
import { useConfirm } from '../components/confirm'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { IndustrySelect, MAP_SIZE, MapLayout, NeedRole, Page, PanelTabs, PlaceFields, PostCard, QuotaBar, Req, SkillPicker, Steps, Toast, useFieldError, useGate, useNames, useRel } from './match'
import { VerifyCard } from './case'
import { useFit } from '../components/pager'
import { postToInput } from '../domain/match/remote'
import { PlanGrid } from './member'

/**
 * Employer flow (owner, Oct 2026): place on the map → company and needs (4 groups) → "Check and post" → pre-check (the real AI when
 * signed in and switched on — scam/trafficking signs, labour law, missing details; otherwise the basic rules) →
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
  headcount: ['emp-headcount', 'emp-headcount'], belowHeld: ['emp-headcount', 'emp-headcount'], employment: ['emp-employment', 'emp-employment'], salary: ['emp-salary', 'emp-salary-min'],
  startDate: ['emp-start', 'emp-start'], languages: ['emp-langs', 'emp-langs-th'], education: ['emp-edu', 'emp-edu'],
}

export function HirePage() {
  const { t, lang } = useI18n()
  const { status, online } = useAuth()
  const N = useNames()
  const { st, now, limitNow, pool, post, editPost, deletePost, renew } = useMatch()
  const [joinedUntil, setJoinedUntil] = useState<string | null>(null)
  const { until } = useRel()
  const editId = useSearchParam('edit')
  const [editing, setEditing] = useState<Post | null>(null)
  const [saving, setSaving] = useState(false)
  const [c, setC] = useState<GeoCode | null>(null), [p, setP] = useState<string | null>(null)
  const [form, setForm] = useState(false)
  const tabAsked = useSearchParam('tab') // the board's "waiting for you" chip opens my posts
  const [side, setSide] = useState<'new' | 'mine' | 'verify'>(tabAsked === 'mine' || tabAsked === 'verify' ? tabAsked : 'new')
  const fit = useFit()
  const [company, setCompany] = useState(st.myCompany), [position, setPosition] = useState('')
  const [industry, setIndustry] = useState<Industry>('manufacturing'), [skills, setSkills] = useState<Skill[]>([])
  const [years, setYears] = useState('0'), [details, setDetails] = useState('')
  const [headcount, setHeadcount] = useState('1'), [employment, setEmployment] = useState<Employment>('permanent')
  const [salMin, setSalMin] = useState(''), [salMax, setSalMax] = useState(''), [currency, setCurrency] = useState<Currency>('THB')
  const [start, setStart] = useState(''), [langs, setLangs] = useState<LanguageSkill[]>([]), [edu, setEdu] = useState<Edu>('none'), [benefits, setBenefits] = useState<Benefit[]>([])
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const [stage, setStage] = useState<Stage>(null)
  const [check, setCheck] = useState<Precheck | null>(null)
  // the AI check (null = not asked; 'busy' = waiting); a high-risk result needs the employer's tick before posting
  const [aiRes, setAiRes] = useState<AiResponse<AiCheck> | 'busy' | null>(null), [ack, setAck] = useState(false)
  const aiRun = useRef(0)
  const lite = useLite()
  const [shown, setShown] = useState(false) // the orb has turned green: show the result
  const [pending, setPending] = useState<PostInput | null>(null)
  const [posted, setPosted] = useState<Post | null>(null)
  const fe = useFieldError()
  const [ask, askDialog] = useConfirm()
  const [deleting, setDeleting] = useState<string | null>(null), [renewing, setRenewing] = useState<string | null>(null)
  const gate = useGate('hire')
  const startEdit = (x: Post) => {
    setSide('new')
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
  const q = postQuota(st, limitNow), used = q.used, limit = q.limit
  const clear = () => fe.clear()
  const showProblem = (pr: Problem) => { const f = FIELD[pr]; if (f) fe.set(f[0], f[1], N.problem(pr)); else setMsg({ tone: 'danger', text: N.problem(pr) }) }

  const input = (): PostInput | null => {
    if (!isCountry(c) || !p) return null
    const hasSalary = salMin.trim() !== '' || salMax.trim() !== ''
    return { place: { country: c, province: p }, company: company.trim(), position: position.trim(), industry, skills, minYears: Number(years), details: details.trim(),
      headcount: Number(headcount), employment, salary: hasSalary ? { min: Number(salMin), max: Number(salMax), currency } : null, startDate: start, languages: langs, education: edu, benefits }
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null); fe.clear()
    const i = input(); if (!i) { setMsg({ tone: 'danger', text: N.problem('place') }); return }
    if (!editing && !canPost(st, limitNow)) { setStage('package'); return }
    // editing without changing the start date: it is checked against the posting day, so a post whose start has passed can still be fixed
    const r = precheck(i, editing && editing.startDate && i.startDate === editing.startDate ? editing.createdAt : new Date(now).toISOString())
    setPending(i); setCheck(r); setAiRes(null); setAck(false); setShown(false)
    // rule errors (e.g. a phone number in the details) must be fixed first; otherwise the AI reads the post when it can
    // local development only (?orbdemo): try the AI check without an account or an AI key — not in the built site
    const demo = import.meta.env.DEV && new URLSearchParams(location.search).has('orbdemo')
    if (!r.errors.length && ((status === 'signedIn' && online !== false) || demo)) {
      const run = ++aiRun.current
      setAiRes('busy'); setStage('check')
      const res: AiResponse<AiCheck> = demo ? await new Promise((ok) => setTimeout(() => ok({ ok: true, left: 18, result: { verdict: 'review', summary: 'ประกาศนี้ยังขาดข้อมูลบางส่วน', flags: [{ category: 'missing_info', severity: 'low', quote: '', explanation: 'ยังไม่ระบุเวลาทำงานและประเภทสัญญาจ้าง', suggestion: 'เพิ่มเวลาทำงานต่อวันและวันหยุด', lawIds: [] }] } }), 6000)) : await aiCheck(i, lang)
      if (run === aiRun.current) setAiRes(res)
      return
    }
    setStage(r.errors.length || r.warnings.length ? 'check' : 'confirm')
  }
  const closeCheck = () => { aiRun.current++; setStage(null); if (check?.errors[0]) showProblem(check.errors[0]) }
  const aiOk = aiRes && aiRes !== 'busy' && aiRes.ok && shown ? aiRes : null
  const orbOn = aiRes === 'busy' || (aiRes !== null && aiRes.ok && !shown) // still reading, or turning green
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
    setStage(null); setPosted(null); setPending(null); setCheck(null); setAiRes(null); setEditing(null)
    setPosition(''); setSkills([]); setDetails(''); setYears('0'); setHeadcount('1'); setEmployment('permanent'); setSalMin(''); setSalMax(''); setStart(''); setLangs([]); setEdu('none'); setBenefits([])
    setForm(false); setC(null); setP(null)
    // the form unmounts, so keyboard focus would fall back to the page: put it on the country field to start the next post
    requestAnimationFrame(() => document.getElementById('emp-prov-c')?.focus())
  }
  const remove = async (x: Post) => {
    if (caseBlocksDelete(st, x.id)) { setMsg({ tone: 'danger', text: N.problem('caseStarted') }); return }
    if (!(await ask(t('m.post.delete.confirm'), { yes: t('m.post.delete'), danger: true }))) return
    setDeleting(x.id)
    const ok = await deletePost(x.id)
    setDeleting(null)
    if (ok && editing?.id === x.id) another()
    setMsg(ok ? { tone: 'info', text: t('m.post.deleted') } : { tone: 'danger', text: t('m.post.delete.fail') })
  }
  const renewIt = async (x: Post) => {
    if (!(await ask(t('m.em.renew.confirm'), { yes: t('m.em.renew') }))) return
    setRenewing(x.id)
    const r = await renew(x.id)
    setRenewing(null)
    if (r.ok) setMsg({ tone: 'info', text: t('m.em.renewed') })
    else if (r.problem === 'quota') setStage('package')
    else setMsg({ tone: 'danger', text: N.problem(r.problem) })
  }
  const toggleLang = (l: LanguageSkill['lang']) => { setLangs((xs) => (xs.some((x) => x.lang === l) ? xs.filter((x) => x.lang !== l) : [...xs, { lang: l, level: 'conversational' }])); clear() }
  const setLevel = (l: LanguageSkill['lang'], level: LanguageSkill['level']) => setLangs((xs) => xs.map((x) => (x.lang === l ? { ...x, level } : x)))

  return (
    <Page title={t('m.emp.title')} fit>
      <MapLayout hideMap={form && fit && side === 'new'} map={<>
        <GeoMap className={MAP_SIZE} label={t('m.mapLabel')} country={c} province={p} pins={mine.map((x) => ({ country: x.country, province: x.province, label: `${x.position} · ${N.place(x.country, x.province)}`, tone: 'post' }))}
          onPickCountry={(x) => { setC(x); setP(null); setForm(false) }} onPickProvince={(x) => { setP(x); setForm(false) }} />
        <p className="text-xs text-muted">{t('m.mapHint')}</p></>}>
      {st.suspended && <Warn tone="danger">{t('m.rpt.suspended')}</Warn>}
      <PanelTabs label={t('m.emp.title')} value={side} onChange={setSide} tabs={[{ k: 'new', text: t(editing ? 'm.edit.title' : 'm.emp.tab.new') }, { k: 'mine', text: t('m.posts'), n: mine.length }, { k: 'verify', text: t('m.vf.title') }]} />
      <Toast msg={msg} />
      {side === 'new' && (<>
      <Steps items={[t('m.emp.s1'), t('m.emp.s2')]} at={form ? 1 : 0} />
      {!form ? (
        <section className="card space-y-3" aria-labelledby="e1h">
          <h2 id="e1h" className="h2">{t('m.emp.s1')}</h2>
          <PlaceFields idp="emp-prov" fe={fe} country={c} province={p} onCountry={(x) => { setC(x); setP(null) }} onProvince={setP} />
          <button type="button" className="btn-primary" disabled={!isCountry(c) || !p} onClick={() => { setForm(true); setMsg(null) }}><Icon name="posts" size={16} />{t('m.emp.fill')}</button>
        </section>
      ) : (
        <form className="card space-y-5" onSubmit={submit} aria-labelledby="e2h" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="e2h" tabIndex={-1} className="h2 outline-none">{t(editing ? 'm.edit.title' : 'm.emp.s2')}</h2><p className="text-sm text-muted">{c && p && N.place(c, p)} <button type="button" className="underline text-primary min-h-[24px]" onClick={() => setForm(false)}>{t('m.edit')}</button></p></div>

          <div className="space-y-5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:items-start">
          <div className="space-y-5">
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

          </div>
          <div className="space-y-5">
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

          </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary"><Icon name="ai" size={16} />{t(editing ? 'm.edit.save' : 'm.emp.post')}</button>
            {editing ? <button type="button" className="btn-ghost" onClick={another}>{t('m.edit.cancel')}</button> : <QuotaNote used={used} limit={limit} member={memberActive(st, limitNow)} />}
          </div>
        </form>
      )}
      </>)}
      {side === 'verify' && <VerifyCard />}
      {side === 'mine' && (
      <section className="space-y-2" aria-labelledby="myposts-h">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="myposts-h" className="h2">{t('m.posts')}</h2><NavLink to="board" className="text-sm font-medium text-primary inline-flex items-center gap-1 min-h-[24px]">{t('m.board')}<Icon name="next" size={14} /></NavLink></div>
        <QuotaBar q={q} kind="post" />
        {!mine.length ? <div className="glass-card p-5 text-muted">{t('m.posts.none')}</div> : (
          <ul className="space-y-2">{mine.map((x) => { const sc = scheduleOf(x, pool, now), stage = capStage(stageAt(sc, now), x); return stage === 'expired' ? null : (
            <PostCard key={x.id} post={x} level={stage} reached>
              {now >= sc.warnAt && <p className="text-sm text-warn-fg flex items-center gap-1.5"><Icon name="hourglass" size={15} />{t('m.em.expiring', { t: until(sc.expiresAt) })}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <NavLink to={`post?id=${x.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary min-h-[24px]">{t('m.pp.view')}<Icon name="next" size={14} /></NavLink>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-medium min-h-[24px] hover:underline underline-offset-4" onClick={() => startEdit(x)} aria-label={`${t('m.post.edit')}: ${x.position}`}><Icon name="edit" size={14} />{t('m.post.edit')}</button>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-medium min-h-[24px] hover:underline underline-offset-4" onClick={() => renewIt(x)} disabled={renewing === x.id} aria-label={`${t('m.em.renew')}: ${x.position}`}><Icon name="renew" size={14} />{renewing === x.id ? t('m.ask.busy') : t('m.em.renew')}</button>
                <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-danger-fg min-h-[24px] hover:underline underline-offset-4" onClick={() => remove(x)} disabled={deleting === x.id} aria-label={`${t('m.post.delete')}: ${x.position}`}><Icon name="trash" size={14} />{deleting === x.id ? t('m.ask.busy') : t('m.post.delete')}</button>
              </div>
            </PostCard>) })}</ul>)}
      </section>)}
      </MapLayout>

      {askDialog}
      {/* 1) pre-check: the real AI when available, otherwise the basic rules (labelled as such) */}
      <Modal open={stage === 'check'} onClose={closeCheck} wide>{(id) => check && (<>
        <div className="flex flex-wrap items-center gap-2"><h2 id={id} className="h2">{t('m.chk.title')}</h2><span className="chip bg-info-bg text-info-fg border-info-line"><Icon name="ai" size={12} />{t(aiRes && (aiRes === 'busy' || aiRes.ok) ? 'ai.chk.by' : 'm.chk.sim')}</span></div>
        {orbOn ? <><ThinkingOrb lite={lite} done={aiRes !== 'busy'} onDone={() => setShown(true)} chips={[t('ai.cat.scam'), t('ai.cat.trafficking'), t('ai.cat.labour_law'), t('ai.cat.discrimination'), t('ai.cat.missing_info')]} label={(c) => t('ai.chk.now', { c })} doneText={t('ai.chk.allDone')} summing={t('ai.chk.summing')} /><p className="text-xs text-muted text-center">{t('ai.chk.wait')}</p></>
          : aiOk ? <><p className="mo-checked"><span className="mo-checked-ball" aria-hidden="true" />{t('ai.chk.allDone')}</p><AiCheckResult res={aiOk.result} left={aiOk.left} /></>
          : <p className="text-xs text-muted">{aiRes && !aiRes.ok ? t('ai.chk.fallback', { why: t(`ai.why.${aiRes.reason}` as never) }) : t('m.chk.simNote')}</p>}
        {!aiOk && !orbOn && check.errors.length === 0 && check.warnings.length === 0 && <p className="text-sm text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('m.chk.ok')}</p>}
        {aiOk?.result.verdict === 'high_risk' && <label className="flex items-start gap-2 text-sm font-medium rounded-lg border border-danger-line bg-danger-bg text-danger-fg p-3"><input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />{t('ai.chk.ack')}</label>}
        {!aiOk && !orbOn && check.errors.length > 0 && <div className="space-y-1.5"><p className="text-sm font-semibold text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={16} />{t('m.chk.errors')}</p>
          <ul className="list-disc pl-6 text-sm space-y-1">{check.errors.map((e) => <li key={e}>{N.problem(e)}</li>)}</ul></div>}
        {!aiOk && !orbOn && check.warnings.length > 0 && <div className="space-y-1.5"><p className="text-sm font-semibold text-warn-fg flex items-center gap-1.5"><Icon name="warn" size={16} />{t('m.chk.warnings')}</p>
          <ul className="list-disc pl-6 text-sm space-y-1">{check.warnings.map((w) => <li key={w}>{t(`m.chk.w.${w}` as never)}</li>)}</ul></div>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost" onClick={closeCheck}>{t('m.chk.fix')}</button>
          {check.errors.length === 0 && !orbOn && <button type="button" className="btn-primary" disabled={aiOk?.result.verdict === 'high_risk' && !ack} onClick={() => setStage('confirm')}>{t('m.chk.continue')}<Icon name="next" size={16} /></button>}
        </div></>)}</Modal>

      {/* 2) are you sure? */}
      <Modal open={stage === 'confirm'} onClose={() => setStage(null)}>{(id) => pending && (<>
        <h2 id={id} className="h2">{t(editing ? 'm.edit.cf.title' : 'm.cf.title')}</h2>
        {aiOk ? (aiOk.result.verdict === 'ok' && <p className="text-sm text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('ai.chk.v.ok')} <span className="text-muted">({t('ai.chk.by')})</span></p>)
          : check && check.warnings.length === 0 && check.errors.length === 0 && <p className="text-sm text-ok-fg flex items-center gap-1.5"><Icon name="ok" size={16} />{t('m.chk.ok')} <span className="text-muted">({t('m.chk.sim')})</span></p>}
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
        <div className="flex items-center gap-3"><span className="glass-drop w-11 h-11 shrink-0"><Icon name="ok" size={22} /></span><h2 id={id} className="h2">{t('m.plan.done', { d: joinedUntil ? N.day(joinedUntil) : '' })}</h2></div>
        <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setStage(null)}>{t('m.pk.ok')}</button></div></>) : (<>
        <h2 id={id} className="h2">{t('m.pk.title')}</h2>
        <p className="text-sm text-muted">{t('m.pk.lead', { max: limit })}</p>
        <PlanGrid compact onJoined={(until) => { setJoinedUntil(until); setStage('joined') }} />
        <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setStage(null)}>{t('m.pk.later')}</button></div></>)}</Modal>
    </Page>
  )
}

function QuotaNote({ used, limit, member }: { used: number; limit: number; member: boolean }) {
  const { t } = useI18n()
  return <span className="text-xs text-muted inline-flex items-center gap-2">{t('m.q.count', { n: used, max: limit })}<span className={`chip ${member ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line'}`}>{member ? t('m.q.member') : t('m.q.free')}</span></span>
}
