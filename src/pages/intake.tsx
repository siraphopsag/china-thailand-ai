import { useMemo, useState } from 'react'
import type { Direction, EmploymentInput, Profile } from '../types'
import { go, useStore } from '../store'
import { BusinessProfile, Disclaimer, EmptyState, Go, JourneyStrip, Ok, PageHead, useRouteText } from '../components/ui'
import { CountryBadge, Icon } from '../components/icons'
import { dirInfo } from '../utils/labels'
import { BRAND, BRAND_CONCEPTS } from '../brand'
import { Glow, RetroGrid } from '../components/backdrop'
import { dv, tk, useI18n } from '../i18n'
import { OWNERSHIP_KEYS, buildProfile, coreDone, firstUnanswered, prune, remaining, visibleQs, type A, type Q } from '../interview'

/* ================= LANDING (lobby): the product introduction; the map is the next step, never shown here ================= */
/** A small, honest preview of how C.A.L.L. works (illustrative, labelled as such): the route, the AI activity, the integrated concerns. */
function HeroPreview() {
  const { t } = useI18n()
  const steps: [string, boolean][] = [[t('hero.act.1'), true], [t('hero.act.2'), true], [t('hero.act.3'), true], [t('hero.act.4'), false]]
  return (
    <div className="hero-tilt">
      <div className="glass rounded-2xl p-4 sm:p-5 shadow-xl text-left space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-semibold"><CountryBadge c="TH" />{tk('country', 'TH')}
            <svg width="72" height="18" viewBox="0 0 72 18" aria-hidden className="text-primary"><path d="M2 14 Q36 -4 70 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 4" /></svg>
            <CountryBadge c="CN" />{tk('country', 'CN')}</div>
          <span className="chip bg-surface3 text-muted border-line"><Icon name="ai" size={12} />{t('hero.preview')}</span>
        </div>
        <ol className="space-y-2">{steps.map(([txt, done], i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm">
            {done ? <Icon name="ok" size={17} className="text-ok-fg shrink-0" /> : <span className="w-[17px] h-[17px] grid place-items-center shrink-0"><span className="w-2 h-2 rounded-full bg-primary animate-pulse" /></span>}
            <span className={done ? '' : 'font-medium'}>{txt}</span></li>))}</ol>
        <div className="flex flex-wrap gap-1.5">{(['lang', 'legal', 'risk', 'next'] as const).map((k) => <span key={k} className="chip bg-brand text-brandfg border-line font-medium">{t(('hero.tag.' + k) as never)}</span>)}</div>
        <p className="text-[11px] text-muted">{t('hero.sample')}</p>
      </div>
    </div>
  )
}
export function Landing() {
  const { t } = useI18n()
  const { startDemo, beginNew } = useStore()
  return (
    <div className="space-y-12 max-w-5xl mx-auto">
      <section className="hero-shell relative overflow-hidden rounded-3xl border border-line px-5 pt-14 pb-10 sm:px-10 md:pt-20 md:pb-14 text-center" aria-labelledby="hero-h">
        <Glow /><RetroGrid />
        <div className="relative max-w-3xl mx-auto">
          <p className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 text-xs sm:text-sm font-medium" lang="en"><Icon name="globe" size={15} className="text-primary" />{BRAND.title}</p>
          <h1 id="hero-h" className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.15] text-ink">
            <span className="block">{t('hero.h1a')}</span><span className="block text-gradient pb-1">{t('hero.h1b')}</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted max-w-2xl mx-auto">{t('land.pos')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-3">
            <span className="cta-ring"><button className="cta-core text-base" onClick={beginNew}>{t('hero.cta')}<Icon name="next" size={18} /></button></span>
            <button className="text-sm font-medium text-muted hover:text-ink underline underline-offset-4 py-2" onClick={() => { startDemo(); go('profile') }}>{t('land.demoLink')}</button>
          </div>
          <p className="text-xs text-muted mt-3">{t('land.goNote')}</p>
        </div>
        <div className="relative max-w-2xl mx-auto mt-12"><HeroPreview /></div>
      </section>
      <section aria-labelledby="stands-h" className="space-y-3">
        <h2 id="stands-h" className="h2">{t('brand.stands')}</h2>
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3">{BRAND_CONCEPTS.map((c, i) => (
          <li key={i} className="card card-hover !p-4 space-y-1.5"><div className="flex items-baseline gap-2" lang="en"><span className="text-2xl font-bold text-gradient">{c.letter}</span><span className="font-semibold">{c.word}</span></div><p className="text-sm text-muted">{t(('brand.' + c.key) as never)}</p></li>))}</ul>
        <p className="text-xs text-muted">{t('brand.together')}</p>
      </section>
      <section aria-label={t('land.h2')}>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">{[1, 2, 3, 4, 5].map((n) => (
          <li key={n} className="flex gap-3 items-start"><span className="w-8 h-8 shrink-0 rounded-full bg-brand text-brandfg grid place-items-center font-semibold">{n}</span><span className="pt-1 font-medium">{tk('journey', String(n))}</span></li>))}</ol>
        <p className="text-sm text-muted mt-4">{t('land.tip')}</p>
      </section>
      <Disclaimer />
    </div>
  )
}

/* ================= DIRECTION ================= */
export function DirectionPage() {
  const { t } = useI18n()
  const { chooseDirection, direction } = useStore()
  const pick = (d: Direction) => { if (!chooseDirection(d)) go('dashboard') }
  return (
    <div>
      <PageHead title={t('dir.title')} sub={t('dir.sub')} />
      <div className="grid md:grid-cols-2 gap-5">{(['TH_CN', 'CN_TH'] as Direction[]).map((d) => { const i = dirInfo(d); return (
        <button key={d} onClick={() => pick(d)} className={`card text-left hover:border-primary hover:shadow-md transition p-6 md:p-8 ${direction === d ? 'ring-2 ring-primary' : ''}`}>
          <div className="mb-3 flex items-center gap-2 text-primary" aria-hidden><CountryBadge c={i.from} className="!text-sm !px-2.5 !py-1" /><Icon name="next" size={22} /><CountryBadge c={i.to} className="!text-sm !px-2.5 !py-1" /></div>
          <div className="text-2xl font-bold">{tk('country', i.from)} → {tk('country', i.to)}</div><div className="text-muted">{tk('dir', d)}</div>
          <p className="mt-3">{tk('dir', d + '.text')}</p><span className="btn-primary mt-4"><Go>{t('dir.choose')}</Go></span>
        </button>) })}</div>
    </div>
  )
}

/* ================= INTERVIEW: 3 quick questions, the rest can be answered later ================= */
const emptyFor = (q: Q) => (q.type === 'multi' ? [] : '')

export function InterviewPage() {
  const { t } = useI18n()
  const { direction, profile, answers, employment, set, log, startDemo, originProvince, destinationProvince } = useStore()
  const route = useRouteText()
  const d: Direction = direction ?? 'TH_CN'
  const info = dirInfo(d)
  const vars = { from: tk('country', info.from), to: tk('country', info.to) }
  const visible = useMemo(() => visibleQs(answers), [answers])
  const [idx, setIdx] = useState(() => firstUnanswered(answers))
  const [val, setVal] = useState<string | string[]>(() => { const v = visibleQs(answers); const q0 = v[Math.min(firstUnanswered(answers), v.length - 1)]; return (answers[q0.id] as string | string[] | undefined) ?? emptyFor(q0) })
  const [err, setErr] = useState('')
  if (!direction) return <div><PageHead title={t('intv.title')} /><EmptyState title={t('intv.noDir.t')} text={t('intv.noDir.d')} /></div>
  const q = visible[Math.min(idx, visible.length - 1)]
  const core = coreDone(answers)
  const left = remaining(answers)
  const label = (x: Q, o: string) => tk(`opt.${x.ns}`, o, vars)
  const qText = (x: Q) => t(`q.${x.id}` as never, vars)
  const coreTotal = visible.filter((x) => x.core).length

  /** Build (or update) the profile from the answers so far and show the first result. */
  const finalize = (next: A) => {
    const { profile: base, mode } = buildProfile(next, d)
    const built = { ...base, originProvince: originProvince ?? undefined, destProvince: destinationProvince ?? undefined }
    const prev = profile && !profile.isDemo ? profile : null
    // keep manual what-if edits on the ownership page if no ownership-related answer changed
    const same = !!prev && OWNERSHIP_KEYS.every((k) => JSON.stringify(answers[k]) === JSON.stringify(next[k]))
    const merged: Profile = same && prev ? { ...built, holders: prev.holders, realInvestor: prev.realInvestor, operator: prev.operator, sideAgreement: prev.sideAgreement, unknownFacts: prev.unknownFacts } : built
    const seed: EmploymentInput = { mode, nationality: next.empNat ? `@opt.empNat.${next.empNat}` : '', location: merged.location, duration: next.empDuration ? `@opt.empDuration.${next.empDuration}` : '', salary: String(next.empSalary ?? ''), hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' }
    const emp = prev ? (Object.fromEntries(Object.keys(seed).map((k) => [k, (employment as unknown as Record<string, string>)[k] || (seed as unknown as Record<string, string>)[k]])) as unknown as EmploymentInput) : seed
    set({ profile: merged, answers: next, employment: emp, analysisDone: false, tour: null, ...(prev ? {} : { stepOverrides: {}, actionStatus: {}, actionSnap: {}, docs: {}, docStamp: {} }) })
    log(prev ? 'hist.profileUpdate' : 'hist.profile'); go('dashboard')
  }
  const submit = () => {
    let v = val
    if (q.type === 'multi') { if (!(v as string[]).length) return setErr(t('intv.e.pick')) }
    else if (!String(v).trim()) return setErr(t('intv.e.required'))
    if (q.type === 'pct' || q.type === 'number') {
      const n = Number(v)
      if (Number.isNaN(n) || n < (q.min ?? 0) || (q.type === 'pct' && n > 100)) return setErr(q.type === 'pct' ? t('intv.e.pct') : t('intv.e.num'))
      v = String(Math.round(n))
    }
    if (q.type === 'text' && String(v).trim().length < 2) return setErr(t('intv.e.short'))
    const next = prune({ ...answers, [q.id]: q.type === 'text' ? String(v).trim() : v }) // drops answers that are no longer relevant
    set({ answers: next }); setErr('')
    const nv = visibleQs(next)
    const nextIdx = nv.findIndex((x) => x.id === q.id) + 1
    const justFinishedQuickStart = !profile && coreDone(next) && !coreDone(answers)
    if (nextIdx >= nv.length || justFinishedQuickStart) return finalize(next)
    setIdx(nextIdx); setVal((next[nv[nextIdx].id] as string | string[] | undefined) ?? emptyFor(nv[nextIdx]))
  }
  const back = () => { if (idx > 0) { setIdx(idx - 1); const pq = visible[idx - 1]; setVal((answers[pq.id] as string | string[]) ?? emptyFor(pq)); setErr('') } }
  const shown = (x: Q) => { const a = answers[x.id]; return Array.isArray(a) ? a.map((o) => label(x, o)).join(', ') : x.type === 'choice' ? label(x, String(a)) : String(a ?? '') + (x.type === 'pct' ? '%' : '') }
  return (
    <div className="max-w-2xl mx-auto">
      <PageHead title={t('intv.title')} sub={t('intv.sub', { dir: route || tk('dir', d) })}><button className="btn-ghost" onClick={() => { startDemo(); go('profile') }}>{t('intv.useDemo')}</button></PageHead>
      <div className="mb-4" aria-live="polite">
        {!core ? <><p className="text-sm font-medium">{t('intv.quickProg', { n: Math.min(idx + 1, coreTotal), total: coreTotal })}</p>
          <div className="h-1.5 rounded bg-surface3 mt-1.5 overflow-hidden"><div className="h-1.5 bg-primary transition-all duration-500" style={{ width: `${(Math.min(idx, coreTotal) / coreTotal) * 100}%` }} /></div>
          <p className="text-xs text-muted mt-1.5">{t('intv.quickHint')}</p></>
          : <p className="text-sm text-muted">{t('intv.left', { n: left })}</p>}
      </div>
      <section className="space-y-3">
        {idx > 0 && visible.slice(Math.max(0, idx - 2), idx).map((pq) => <div key={pq.id} className="space-y-1"><div className="bg-brand text-brandfg border border-line rounded-xl px-4 py-2 text-sm max-w-xl flex gap-2 items-start"><Icon name="ai" size={16} className="mt-0.5" />{qText(pq)}</div><div className="bg-primary text-onprimary rounded-xl px-4 py-2 text-sm ml-auto max-w-md w-fit">{shown(pq)}</div></div>)}
        <div className="card border-primary/40">
          <div className="text-xs text-primary mb-1">{tk('cat', String(q.cat))}</div>
          <label className="text-lg font-semibold flex gap-2 items-start" htmlFor="ans" id="q-label"><Icon name="ai" size={20} className="mt-1 text-primary" />{qText(q)}</label>
          {q.help && <p className="text-sm text-muted mt-1">{t(`q.${q.id}.h` as never)}</p>}
          <div className="mt-3">
            {(q.type === 'choice' || q.type === 'multi') && <div className="grid sm:grid-cols-2 gap-2" role={q.type === 'choice' ? 'radiogroup' : 'group'} aria-labelledby="q-label">{q.opts!.map((o) => { const sel = q.type === 'multi' ? (val as string[]).includes(o) : val === o; return (
              <button type="button" key={o} aria-pressed={sel} onClick={() => { setErr(''); setVal((prev) => (q.type === 'multi' ? ((prev as string[]).includes(o) ? (prev as string[]).filter((x) => x !== o) : [...(prev as string[]), o]) : o)) }} className={`text-left px-4 py-3 rounded-lg border min-h-[44px] transition ${sel ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-line hover:bg-surface3'}`}><span className="flex items-center gap-2.5"><Icon name={q.type === 'multi' ? (sel ? 'squareCheck' : 'square') : sel ? 'circleDot' : 'circle'} className={sel ? 'text-primary' : 'text-muted'} />{label(q, o)}</span></button>) })}</div>}
            {q.type === 'text' && <input id="ans" className="input" value={val as string} onChange={(e) => { setVal(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />}
            {(q.type === 'number' || q.type === 'pct') && <input id="ans" type="number" inputMode="numeric" className="input max-w-[180px]" value={val as string} onChange={(e) => { setVal(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />}
          </div>
          {err && <p role="alert" className="text-danger-fg text-sm mt-2">{err}</p>}
          <div className="flex flex-wrap gap-2 mt-4"><button className="btn-ghost" onClick={back} disabled={idx === 0}><Icon name="back" size={16} />{t('c.back')}</button><button className="btn-primary" onClick={submit}>{idx + 1 >= visible.length || (!profile && coreDone({ ...answers, [q.id]: val }) && !core) ? t('intv.submit') : t('c.next')}<Icon name="next" size={16} /></button></div>
        </div>
        {core && <div className="flex flex-wrap items-center gap-3"><button className="btn-ghost" onClick={() => finalize(answers)}><Go>{t('intv.finish')}</Go></button><span className="text-xs text-muted">{t('intv.finishNote')}</span></div>}
      </section>
    </div>
  )
}

/* ================= PROFILE ================= */
export function ProfilePage() {
  const { t } = useI18n()
  const { profile, set, log, originProvince, destinationProvince } = useStore()
  const route = useRouteText()
  const [edit, setEdit] = useState(false)
  const [f, setF] = useState<Profile | null>(profile)
  const [err, setErr] = useState('')
  if (!profile || !f) return <div><PageHead title={t('prof.title')} /><EmptyState /></div>
  const save = () => {
    if (!dv(f.companyName).trim() || !dv(f.activity).trim()) return setErr(t('prof.e.req'))
    if (!(f.employees >= 0)) return setErr(t('prof.e.emp'))
    set({ profile: f, analysisDone: false }); log('hist.profileEdit'); setEdit(false); setErr('')
  }
  const fields = [['companyName', 'bp.name'], ['activity', 'bp.activity'], ['location', 'bp.location'], ['products', 'bp.products'], ['targetMarket', 'bp.market']] as const
  return (
    <div className="space-y-5">
      <PageHead title={t('prof.title')} sub={t('prof.sub')} />
      <JourneyStrip />
      {(originProvince || destinationProvince) && <p className="text-sm flex items-center gap-2"><Icon name="globe" size={16} className="text-primary" /><span className="text-muted">{t('geo.route')}:</span> <b>{route}</b></p>}
      {edit ? (
        <div className="card space-y-3">
          <h2 className="h2">{t('prof.edit')}</h2>
          <div><label className="label" htmlFor="btype">{t('bp.type')}</label>
            <select id="btype" className="input" value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })}>{['manufacturing', 'retail', 'service', 'food', 'tech', 'other'].map((o) => <option key={o} value={o}>{tk('opt.btype', o)}</option>)}</select></div>
          {fields.map(([k, lk]) => <div key={k}><label className="label" htmlFor={k}>{t(lk)}</label><input id={k} className="input" value={dv(f[k] as string)} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}
          <div><label className="label" htmlFor="emp">{t('prof.emp')}</label><input id="emp" type="number" min={0} className="input max-w-[180px]" value={f.employees} onChange={(e) => setF({ ...f, employees: Number(e.target.value) })} /></div>
          <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" className="w-5 h-5" checked={f.crossBorderWorkers} onChange={(e) => setF({ ...f, crossBorderWorkers: e.target.checked })} />{t('prof.cross')}</label>
          <p className="text-sm text-muted">{t('prof.ownerNote')}</p>
          {err && <p role="alert" className="text-danger-fg text-sm">{err}</p>}
          <div className="flex gap-2"><button className="btn-primary" onClick={save}>{t('c.save')}</button><button className="btn-ghost" onClick={() => { setF(profile); setEdit(false); setErr('') }}>{t('c.cancel')}</button></div>
        </div>
      ) : <BusinessProfile p={profile} onEdit={() => { setF(profile); setEdit(true) }} />}
      <section className="card space-y-3" aria-labelledby="need-h">
        <h2 id="need-h" className="h2">{t('biz.need.t')}</h2>
        {profile.unknownFacts && profile.unknownFacts.length > 0 ? <>
          <p className="text-sm text-muted">{t('biz.need.d')}</p>
          <ul className="space-y-2">{profile.unknownFacts.map((u) => (
            <li key={u} className="card-i flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1 basis-60"><div className="font-medium text-sm">{tk('unk', u)}</div><div className="text-xs text-muted">{tk('biz.why', u)}</div></div>
              <button className="btn-ghost !min-h-[36px] !py-1 text-sm" onClick={() => go('interview')}>{t('biz.answerNow')}</button>
            </li>))}</ul>
        </> : <p className="text-sm text-ok-fg"><Ok>{t('biz.need.none')}</Ok></p>}
      </section>
      <div className="space-y-2"><div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('analysis')}><Icon name="ai" size={16} />{t('biz.analyze')}</button><button className="btn-ghost" onClick={() => go('dashboard')}>{t('prof.toDash')}</button></div>
        {!!profile.unknownFacts?.length && <p className="text-xs text-muted">{t('biz.analyzeHint')}</p>}</div>
      <Disclaimer />
    </div>
  )
}
