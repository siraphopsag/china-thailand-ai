import { useEffect, useMemo, useState } from 'react'
import type { Direction, Holder, Profile, Side } from '../types'
import { go, useStore } from '../store'
import { BusinessProfile, Disclaimer, EmptyState, Go, PageHead, ProgressStepper, Warn, WorkflowStrip } from '../components/ui'
import { CountryBadge, Icon, type IconName } from '../components/icons'
import { dirInfo } from '../utils/labels'
import { dv, tk, useI18n } from '../i18n'
import { KEYS, safeGet, safeSet } from '../storage'
import { isObj } from '../profileSchema'

/* ================= LANDING ================= */
function CrossBorderVisual() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 select-none" aria-hidden>
      <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-3 text-center w-24 sm:w-28"><div className="text-2xl font-bold tracking-wide">TH</div><div className="text-xs mt-1">{tk('country', 'TH')}</div></div>
      <div className="flex-1 max-w-[140px] flex items-center"><span className="flex-1 border-t-2 border-dashed border-white/40" /><span className="mx-1 rounded-full bg-accent text-onaccent px-2 py-1 animate-pulse"><Icon name="ai" size={16} /></span><span className="flex-1 border-t-2 border-dashed border-white/40" /></div>
      <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-3 text-center w-24 sm:w-28"><div className="text-2xl font-bold tracking-wide">CN</div><div className="text-xs mt-1">{tk('country', 'CN')}</div></div>
      <span className="sr-only">{t('dir.TH_CN')}</span>
    </div>
  )
}
export function Landing() {
  const { t } = useI18n()
  const { startDemo, beginNew } = useStore()
  const steps: [string, IconName][] = [['1', 'business'], ['2', 'ai'], ['3', 'risk'], ['4', 'plan'], ['5', 'monitor']]
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-hero text-onheader px-6 py-10 md:px-12 md:py-14 grid md:grid-cols-[1.3fr_1fr] gap-8 items-center">
        <div>
          <p className="text-sm opacity-75 mb-3">{t('land.kicker')}</p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight">{t('land.h1')}</h1>
          <p className="mt-4 text-lg opacity-90 max-w-2xl">{t('land.sub')}</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <button className="btn-accent" onClick={beginNew}><Go>{t('cta.start')}</Go></button>
            <button className="btn border border-white/50 text-onheader hover:bg-white/10" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>{t('land.how')}</button>
            <button className="btn border border-white/50 text-onheader hover:bg-white/10" onClick={() => { startDemo(); go('profile') }}>{t('cta.demo')}</button>
          </div>
          <p className="text-xs opacity-70 mt-4">{t('land.demoNote')}</p>
        </div>
        <CrossBorderVisual />
      </section>
      <section id="how" aria-labelledby="how-h">
        <h2 id="how-h" className="h1 text-center mb-6">{t('land.h2')}</h2>
        <ol className="grid grid-cols-2 md:grid-cols-5 gap-3">{steps.map(([n, i]) => <li key={n} className="card text-center !p-4"><div className="mx-auto w-10 h-10 rounded-lg bg-brand text-brandfg grid place-items-center"><Icon name={i} size={20} /></div><div className="text-xs text-muted mt-1">{t('land.stepN', { n })}</div><div className="font-semibold">{tk('land', 's' + n)}</div></li>)}</ol>
        <div className="card mt-6"><p className="text-sm text-muted mb-3">{t('land.notChat')}</p><WorkflowStrip /></div>
      </section>
      <section aria-labelledby="ba-h">
        <h2 id="ba-h" className="h1 text-center mb-6">{t('land.ba.h')}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card border-danger-line"><div className="text-sm font-semibold text-danger-fg mb-2">{t('land.before')}</div><p>{t('land.beforeT')}</p><p className="text-sm text-muted mt-2">{t('land.beforeS')}</p></div>
          <div className="card border-ok-line"><div className="text-sm font-semibold text-ok-fg mb-2">{t('land.after')}</div><p>{t('land.afterT')}</p><p className="text-sm text-muted mt-2">{t('land.afterS')}</p></div>
        </div>
        <p className="text-center font-semibold mt-6 max-w-3xl mx-auto">{t('land.quote')}</p>
      </section>
      <section className="grid md:grid-cols-3 gap-4">
        {(['1', '2', '3'] as const).map((k) => <div key={k} className="card"><h3 className="h2">{tk('land', `c${k}t`)}</h3><p className="text-sm text-muted mt-1">{tk('land', `c${k}d`)}</p></div>)}
      </section>
      <Disclaimer />
    </div>
  )
}

/* ================= DIRECTION ================= */
export function DirectionPage() {
  const { t } = useI18n()
  const { set, direction, profile } = useStore()
  const pick = (d: Direction) => { try { localStorage.removeItem(KEYS.interview) } catch { /* ignore */ } set({ direction: d, profile: profile && profile.direction === d ? profile : null }); go('interview') }
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

/* ================= INTERVIEW (answers are language-neutral ids) ================= */
type A = Record<string, string | string[]>
interface Q { id: string; cat: number; type: 'text' | 'choice' | 'multi' | 'number' | 'pct'; ns?: string; opts?: string[]; when?: (a: A) => boolean; help?: boolean; min?: number }
const SIDE = ['origin', 'partner', 'shared', 'unknown']
const send = (a: A) => (a.forms as string[] | undefined)?.includes('send') ?? false
const hires = (a: A) => (a.forms as string[] | undefined)?.includes('hire') ?? false
const wantsStaff = (a: A) => send(a) || hires(a) || a.hire === 'yes' || a.hire === 'unsure'
const goods = (a: A) => ((a.forms as string[] | undefined)?.includes('goods') ?? false) || ['manufacturing', 'retail'].includes(String(a.btype ?? ''))
const company = (a: A) => (a.forms as string[] | undefined)?.some((f) => f === 'company' || f === 'invest') ?? false
const QS: Q[] = [
  { id: 'name', cat: 0, type: 'text', help: true },
  { id: 'btype', cat: 0, type: 'choice', ns: 'btype', opts: ['manufacturing', 'retail', 'service', 'food', 'tech', 'other'] },
  { id: 'btypeOther', cat: 0, type: 'text', help: true, when: (a) => a.btype === 'other' },
  { id: 'activity', cat: 0, type: 'text', help: true },
  { id: 'activityMore', cat: 0, type: 'text', when: (a) => String(a.activity ?? '').trim().length < 20 },
  { id: 'forms', cat: 1, type: 'multi', ns: 'forms', opts: ['company', 'invest', 'goods', 'hire', 'send', 'partner', 'other'] },
  { id: 'invest', cat: 1, type: 'choice', ns: 'invest', opts: ['lt10', '10to50', 'gt50', 'unknown'], when: company },
  { id: 'ownOrigin', cat: 2, type: 'pct', help: true, when: company },
  { id: 'funding', cat: 2, type: 'choice', ns: 'funding', opts: ['prop', 'origin', 'partner', 'unknown'], when: company },
  { id: 'realInvestor', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'operator', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'board', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'voting', cat: 2, type: 'choice', ns: 'side', opts: SIDE, when: company },
  { id: 'economic', cat: 2, type: 'choice', ns: 'economic', opts: ['prop', 'funder', 'unknown'], when: (a) => company(a) && (a.funding === 'origin' || a.funding === 'partner') },
  { id: 'side', cat: 2, type: 'choice', ns: 'agr', opts: ['no', 'yes', 'unknown'], help: true, when: company },
  { id: 'hire', cat: 3, type: 'choice', ns: 'hire', opts: ['yes', 'no', 'unsure'], when: (a) => !send(a) && !hires(a) },
  { id: 'employees', cat: 3, type: 'number', min: 0, when: wantsStaff },
  { id: 'crossWorkers', cat: 3, type: 'choice', ns: 'cw', opts: ['yes', 'no'], when: (a) => !send(a) && wantsStaff(a) },
  { id: 'empEmployer', cat: 3, type: 'choice', ns: 'empEmployer', opts: ['origin', 'new', 'unsure'], when: send },
  { id: 'empNat', cat: 3, type: 'choice', ns: 'empNat', opts: ['TH', 'CN', 'multi'], when: send },
  { id: 'empDuration', cat: 3, type: 'choice', ns: 'empDuration', opts: ['le6', '6to12', '1to3', 'gt3', 'tbd'], when: send },
  { id: 'empSalary', cat: 3, type: 'text', help: true, when: send },
  { id: 'products', cat: 4, type: 'text' },
  { id: 'market', cat: 4, type: 'text' },
  { id: 'regulated', cat: 4, type: 'choice', ns: 'regulated', opts: ['none', 'food', 'electrical', 'other'], when: goods },
  { id: 'location', cat: 5, type: 'text' },
  { id: 'cross', cat: 6, type: 'multi', ns: 'cross', opts: ['import', 'export', 'fx', 'none'], when: goods },
]
const isSide = (v: unknown): v is 'origin' | 'partner' | 'shared' | 'unknown' => SIDE.includes(String(v))

function buildProfile(a: A, d: Direction): { profile: Profile; mode: string } {
  const comp = company(a)
  const origin = comp ? Number(a.ownOrigin ?? 50) : 100
  const fund = String(a.funding ?? 'prop')
  const fo = fund === 'origin' ? 100 : fund === 'partner' ? 0 : origin
  const ecoOrigin = a.economic === 'funder' ? (fo === 100 ? 80 : 20) : origin
  const unknownFacts: string[] = []
  if (comp && fund === 'unknown') unknownFacts.push('funding')
  if (comp && a.economic === 'unknown') unknownFacts.push('economic')
  const ctl = (v: unknown, what: string) => { const s = isSide(v) ? v : 'unknown'; if (s === 'unknown' && comp) unknownFacts.push(what); return s === 'origin' ? 100 : s === 'partner' ? 0 : origin }
  const vo = ctl(a.voting, 'voting')
  const bo = ctl(a.board, 'board')
  const nat = (s: Side): 'TH' | 'CN' => (s === 'origin' ? (d === 'TH_CN' ? 'TH' : 'CN') : d === 'TH_CN' ? 'CN' : 'TH')
  const mk = (id: Side, pct: number, cap: number, eco: number, vot: number, brd: number): Holder => ({ id, nationality: nat(id), percent: pct, capital: cap, voting: vot, board: brd, economic: eco })
  const op = isSide(a.operator) ? a.operator : 'unknown'
  const s = send(a)
  const profile: Profile = {
    companyName: String(a.name), direction: d, businessType: String(a.btype), businessTypeOther: a.btype === 'other' ? String(a.btypeOther ?? '') : undefined,
    activity: [a.activity, a.activityMore].filter(Boolean).join(' — '), forms: a.forms as string[], investmentRange: String(a.invest ?? ''),
    employees: Number(a.employees ?? 0), crossBorderWorkers: a.crossWorkers === 'yes' || s,
    holders: [mk('origin', origin, fo, ecoOrigin, vo, bo), mk('partner', 100 - origin, 100 - fo, 100 - ecoOrigin, 100 - vo, 100 - bo)],
    realInvestor: isSide(a.realInvestor) ? a.realInvestor : 'unknown', operator: op === 'shared' ? 'joint' : op,
    sideAgreement: a.side === 'yes' ? 'yes' : a.side === 'no' ? 'no' : 'unknown',
    products: String(a.products ?? ''), targetMarket: String(a.market ?? ''), regulatedGoods: String(a.regulated ?? ''), location: String(a.location ?? ''),
    crossBorder: ((a.cross as string[]) ?? []).filter((x) => x !== 'none'), unknownFacts,
  }
  const mode = !wantsStaff(a) ? '' : s ? (d === 'TH_CN' ? 'send_th_cn' : 'send_cn_th') : d === 'TH_CN' ? 'hire_cn' : 'hire_th'
  return { profile, mode }
}

/** The interview survives a refresh: answers + position are kept until the profile is created. */
function loadDraft(d: Direction): { answers: A; idx: number } {
  try {
    const x = JSON.parse(safeGet(KEYS.interview) ?? 'null') as unknown
    if (isObj(x) && x.direction === d && isObj(x.answers) && typeof x.idx === 'number') return { answers: x.answers as A, idx: Math.max(0, Math.floor(x.idx)) }
  } catch { /* ignore */ }
  return { answers: {}, idx: 0 }
}
const emptyFor = (q: Q) => (q.type === 'multi' ? [] : '')

export function InterviewPage() {
  const { t } = useI18n()
  const { direction, set, log, startDemo } = useStore()
  const d: Direction = direction ?? 'TH_CN'
  const [answers, setAnswers] = useState<A>(() => loadDraft(d).answers)
  const [idx, setIdx] = useState(() => { const dr = loadDraft(d); return Math.min(dr.idx, Math.max(0, QS.filter((q) => !q.when || q.when(dr.answers)).length - 1)) })
  const [val, setVal] = useState<string | string[]>(() => { const dr = loadDraft(d); const vis = QS.filter((q) => !q.when || q.when(dr.answers)); const q0 = vis[Math.min(dr.idx, vis.length - 1)]; return (dr.answers[q0.id] as string | string[] | undefined) ?? emptyFor(q0) })
  const [err, setErr] = useState('')
  useEffect(() => { if (direction) safeSet(KEYS.interview, JSON.stringify({ direction, answers, idx })) }, [direction, answers, idx])
  const info = dirInfo(d)
  const vars = { from: tk('country', info.from), to: tk('country', info.to) }
  const visible = useMemo(() => QS.filter((q) => !q.when || q.when(answers)), [answers])
  if (!direction) return <div><PageHead title={t('intv.title')} /><EmptyState title={t('intv.noDir.t')} text={t('intv.noDir.d')} /></div>
  const q = visible[Math.min(idx, visible.length - 1)]
  const label = (x: Q, o: string) => tk(`opt.${x.ns}`, o, vars)
  const qText = (x: Q) => t(`q.${x.id}` as never, vars)
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
    const raw = { ...answers, [q.id]: q.type === 'text' ? String(v).trim() : v }
    const nv = QS.filter((x) => !x.when || x.when(raw))
    // drop answers of questions that are no longer relevant (e.g. after going back and changing a choice)
    const visibleIds = new Set(nv.map((x) => x.id))
    const next = Object.fromEntries(Object.entries(raw).filter(([k]) => visibleIds.has(k))) as A
    setAnswers(next); setErr('')
    const nextIdx = nv.findIndex((x) => x.id === q.id) + 1
    if (nextIdx >= nv.length) {
      const { profile, mode } = buildProfile(next, d)
      set({
        profile, analysisDone: false, stepOverrides: {}, actionStatus: {}, docs: {}, tour: null,
        employment: { mode, nationality: next.empNat ? `@opt.empNat.${next.empNat}` : '', location: profile.location, duration: next.empDuration ? `@opt.empDuration.${next.empDuration}` : '', salary: String(next.empSalary ?? ''), hours: '', leave: '', socialSecurity: '', workAuth: '', tax: '' },
      })
      try { localStorage.removeItem(KEYS.interview) } catch { /* ignore */ }
      log('hist.profile'); return go('profile')
    }
    setIdx(nextIdx); setVal(nv[nextIdx].type === 'multi' ? [] : '')
  }
  const back = () => { if (idx > 0) { setIdx(idx - 1); const pq = visible[idx - 1]; setVal((answers[pq.id] as string | string[]) ?? (pq.type === 'multi' ? [] : '')); setErr('') } }
  const shown = (x: Q) => { const a = answers[x.id]; return Array.isArray(a) ? a.map((o) => label(x, o)).join(', ') : x.type === 'choice' ? label(x, String(a)) : String(a ?? '') + (x.type === 'pct' ? '%' : '') }
  const cats = [0, 1, 2, 3, 4, 5, 6].map((c) => tk('cat', String(c)))
  return (
    <div>
      <PageHead title={t('intv.title')} sub={t('intv.sub', { dir: tk('dir', d) })}><button className="btn-ghost" onClick={() => { startDemo(); go('profile') }}>{t('intv.useDemo')}</button></PageHead>
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="card h-fit"><ProgressStepper steps={cats} current={q.cat} label={t('intv.aria')} /></aside>
        <section className="space-y-3" aria-live="polite">
          {visible.slice(0, idx).map((pq) => <div key={pq.id} className="space-y-1"><div className="bg-brand text-brandfg border border-line rounded-xl px-4 py-2 text-sm max-w-xl flex gap-2 items-start"><Icon name="ai" size={16} className="mt-0.5" />{qText(pq)}</div><div className="bg-primary text-onprimary rounded-xl px-4 py-2 text-sm ml-auto max-w-md w-fit">{shown(pq)}</div></div>)}
          <div className="card border-primary/40">
            <div className="text-xs text-primary mb-1">{t('intv.cat', { letter: String.fromCharCode(65 + q.cat), cat: cats[q.cat], n: idx + 1 })}</div>
            <label className="text-lg font-semibold flex gap-2 items-start" htmlFor="ans" id="q-label"><Icon name="ai" size={20} className="mt-1 text-primary" />{qText(q)}</label>
            {q.help && <p className="text-sm text-muted mb-2">{t(`q.${q.id}.h` as never)}</p>}
            <div className="mt-3">
              {(q.type === 'choice' || q.type === 'multi') && <div className="grid sm:grid-cols-2 gap-2" role={q.type === 'choice' ? 'radiogroup' : 'group'} aria-labelledby="q-label">{q.opts!.map((o) => { const sel = q.type === 'multi' ? (val as string[]).includes(o) : val === o; return (
                <button type="button" key={o} aria-pressed={sel} onClick={() => { setErr(''); setVal(q.type === 'multi' ? (sel ? (val as string[]).filter((x) => x !== o) : [...(val as string[]), o]) : o) }} className={`text-left px-4 py-3 rounded-lg border min-h-[44px] transition ${sel ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-line hover:bg-surface3'}`}><span className="flex items-center gap-2.5"><Icon name={q.type === 'multi' ? (sel ? 'squareCheck' : 'square') : sel ? 'circleDot' : 'circle'} className={sel ? 'text-primary' : 'text-muted'} />{label(q, o)}</span></button>) })}</div>}
              {q.type === 'text' && <input id="ans" className="input" value={val as string} onChange={(e) => { setVal(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />}
              {(q.type === 'number' || q.type === 'pct') && <input id="ans" type="number" inputMode="numeric" className="input max-w-[180px]" value={val as string} onChange={(e) => { setVal(e.target.value); setErr('') }} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />}
            </div>
            {err && <p role="alert" className="text-danger-fg text-sm mt-2">{err}</p>}
            <div className="flex gap-2 mt-4"><button className="btn-ghost" onClick={back} disabled={idx === 0}><Icon name="back" size={16} />{t('c.back')}</button><button className="btn-primary" onClick={submit}>{idx + 1 >= visible.length ? t('intv.submit') : t('c.next')}<Icon name="next" size={16} /></button></div>
          </div>
          <p className="text-xs text-muted">{t('intv.answered', { n: idx })}</p>
        </section>
      </div>
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
