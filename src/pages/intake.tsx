import { useMemo, useState } from 'react'
import type { Direction, EmploymentInput, Profile } from '../types'
import { go, useStore } from '../store'
import { BusinessProfile, Disclaimer, EmptyState, Go, PageHead, Warn, WorkflowStrip } from '../components/ui'
import { CountryBadge, Icon } from '../components/icons'
import { dirInfo } from '../utils/labels'
import { dv, tk, useI18n } from '../i18n'
import { OWNERSHIP_KEYS, buildProfile, coreDone, firstUnanswered, prune, remaining, visibleQs, type A, type Q } from '../interview'

/* ================= LANDING ================= */
function CrossBorderVisual() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 select-none" aria-hidden>
      <div className="rounded-xl bg-herotile border border-heroline px-3 py-3 text-center w-24 sm:w-28"><div className="text-2xl font-bold tracking-wide">TH</div><div className="text-xs mt-1">{tk('country', 'TH')}</div></div>
      <div className="flex-1 max-w-[140px] flex items-center"><span className="flex-1 border-t-2 border-dashed border-onhero/40" /><span className="mx-1 rounded-full bg-accent text-onaccent px-2 py-1 animate-pulse"><Icon name="ai" size={16} /></span><span className="flex-1 border-t-2 border-dashed border-onhero/40" /></div>
      <div className="rounded-xl bg-herotile border border-heroline px-3 py-3 text-center w-24 sm:w-28"><div className="text-2xl font-bold tracking-wide">CN</div><div className="text-xs mt-1">{tk('country', 'CN')}</div></div>
      <span className="sr-only">{t('dir.TH_CN')}</span>
    </div>
  )
}
export function Landing() {
  const { t } = useI18n()
  const { startDemo, beginNew } = useStore()
  return (
    <div className="space-y-10 max-w-5xl mx-auto">
      <section className="rounded-2xl border border-heroline bg-hero text-onhero px-6 py-12 md:px-12 md:py-16 grid md:grid-cols-[1.4fr_1fr] gap-8 items-center">
        <div>
          <p className="text-sm opacity-75 mb-3">{t('land.kicker')}</p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">{t('land.h1')}</h1>
          <p className="mt-4 text-lg opacity-90 max-w-xl">{t('land.sub')}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-8">
            <button className="btn-accent !px-6 !min-h-[52px] text-base" onClick={beginNew}><Go>{t('land.go')}</Go></button>
            <button className="underline underline-offset-4 text-sm font-medium py-2" onClick={() => { startDemo(); go('profile') }}>{t('land.demoLink')}</button>
          </div>
          <p className="text-xs opacity-70 mt-3">{t('land.goNote')}</p>
        </div>
        <div className="hidden md:block"><CrossBorderVisual /></div>
      </section>
      <section aria-label={t('land.h2')}>
        <ol className="grid sm:grid-cols-3 gap-4">{[1, 2, 3].map((n) => (
          <li key={n} className="flex gap-3 items-start"><span className="w-8 h-8 shrink-0 rounded-full bg-brand text-brandfg grid place-items-center font-semibold">{n}</span><span className="pt-1 font-medium">{tk('land', 't' + n)}</span></li>))}</ol>
        <p className="text-sm text-muted mt-4">{t('land.tip')}</p>
      </section>
      <Disclaimer />
    </div>
  )
}

/* ================= DIRECTION ================= */
export function DirectionPage() {
  const { t } = useI18n()
  const { set, reset, direction } = useStore()
  const pick = (d: Direction) => { reset(); set({ direction: d }); go('interview') }
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
  const { direction, profile, answers, employment, set, log, startDemo } = useStore()
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
    const { profile: built, mode } = buildProfile(next, d)
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
      <PageHead title={t('intv.title')} sub={t('intv.sub', { dir: tk('dir', d) })}><button className="btn-ghost" onClick={() => { startDemo(); go('profile') }}>{t('intv.useDemo')}</button></PageHead>
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
  const { profile, set, log } = useStore()
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
      <WorkflowStrip active={0} />
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
      {profile.unknownFacts && profile.unknownFacts.length > 0 && <Warn>{t('prof.unknown')} {profile.unknownFacts.map((u) => tk('unk', u)).join(' · ')}</Warn>}
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('analysis')}><Icon name="ai" size={16} />{t('prof.startAi')}</button><button className="btn-ghost" onClick={() => go('dashboard')}>{t('prof.toDash')}</button></div>
      <Disclaimer />
    </div>
  )
}
