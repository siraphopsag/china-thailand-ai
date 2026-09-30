import { useEffect, useRef, useState } from 'react'
import type { Holder, Profile } from '../types'
import { go, useStore } from '../store'
import { AnalysisTabs, Disclaimer, EmptyState, ControlBars, OwnershipMap, PageHead, SourceCard, StatusBadge, VerifyBadge, Warn, WorkflowStrip } from '../components/ui'
import { AICommandCenter } from '../components/ai'
import { compliantOptions, consequences, detectNomineeRisk, holderName, holdersSum, indicatorCategory, ownershipDims, targetCountry, verifyAnalysis, hasCompany, type IndicatorCategory } from '../services/engines'
import { getReg } from '../data/regulations'
import { levelPanel } from '../utils/labels'
import { tk, useI18n } from '../i18n'

const MODULES = ['legal', 'invest', 'ownership', 'nominee', 'employment', 'tax', 'language', 'culture'] as const

/* ================= ANALYSIS CENTER ================= */
export function AnalysisCenter() {
  const { t } = useI18n()
  const { profile, employment, analysisDone, set, log } = useStore()
  const [step, setStep] = useState(analysisDone ? MODULES.length : -1)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearInterval(timer.current), [])
  if (!profile) return <div><PageHead title={t('nav.analysis')} /><EmptyState /></div>
  const vr = verifyAnalysis(profile, employment)
  const run = () => {
    setStep(0); window.clearInterval(timer.current)
    let i = 0
    timer.current = window.setInterval(() => { i++; setStep(i); if (i >= MODULES.length) { window.clearInterval(timer.current); set({ analysisDone: true }); log('hist.analysis') } }, 650)
  }
  const running = step >= 0 && step < MODULES.length
  const done = step >= MODULES.length
  return (
    <div className="space-y-5">
      <PageHead title={t('an.title')} sub={t('an.sub')}><button className="btn-primary" onClick={run} disabled={running}>{done ? t('an.rerun') : t('an.run')}</button></PageHead>
      <AnalysisTabs active="analysis" />
      <WorkflowStrip active={done ? 3 : 1} />
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card">
          <h2 className="h2 mb-3">{t('an.modules')}</h2>
          {step < 0 ? <p className="text-muted text-sm">{t('an.hint')}</p> : (
            <ul className="space-y-2" aria-live="polite">{MODULES.map((m, i) => (
              <li key={m} className="flex items-center gap-3 text-sm"><span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-xs transition-colors ${i < step ? 'bg-ok-fg text-surface' : i === step ? 'bg-primary text-onprimary animate-pulse' : 'bg-surface3'}`}>{i < step ? '✓' : i === step ? '…' : '○'}</span><span className="font-medium w-36 shrink-0">{tk('an.m', m)}</span><span className="text-muted">{i === step ? tk('an.msg', m) : i < step ? t('an.done') : t('an.queued')}</span></li>))}</ul>)}
          {done && <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => go('ownership')}>{t('an.toOwner')}</button><button className="btn-ghost" onClick={() => go('risk')}>{t('an.toRisk')}</button></div>}
        </div>
        <div className="card">
          <h2 className="h2 mb-1">{t('an.verify')}</h2>
          <p className="text-sm text-muted mb-3">{t('an.verifySub')}</p>
          {!done ? <p className="text-sm text-muted">{t('an.verifyWait')}</p> : <>
            <ul className="space-y-2">{vr.steps.map((s) => <li key={s.name} className="text-sm flex gap-2"><span aria-hidden>{s.ok ? '✅' : '⚠️'}</span><span><b>{s.name}</b><br /><span className="text-muted">{s.note}</span></span></li>)}</ul>
            {vr.recheck && <div className="mt-3"><Warn tone="danger">{t('an.recheck')}</Warn></div>}
            <div className="mt-3 flex items-center gap-2 text-sm flex-wrap">{t('an.final')}: <VerifyBadge v={vr.final} /></div></>}
        </div>
      </div>
      <AICommandCenter profile={profile} />
      <Disclaimer />
    </div>
  )
}

/* ================= OWNERSHIP ================= */
const num = (v: string) => Math.max(0, Math.min(100, Number(v) || 0))
export function OwnershipPage() {
  const { t } = useI18n()
  const { profile, set, log } = useStore()
  if (!profile) return <div><PageHead title={t('own.title')} /><EmptyState /></div>
  const upd = (id: Holder['id'], k: keyof Holder, v: number) => {
    const hs = profile.holders.map((h) => (h.id === id ? { ...h, [k]: v } : h))
    if (k === 'percent') { const o = hs.find((h) => h.id !== id)!; o.percent = 100 - v }
    set({ profile: { ...profile, holders: hs }, analysisDone: false })
  }
  const dims = ownershipDims(profile)
  const sum = holdersSum(profile)
  const chg = (patch: Partial<Profile>) => { set({ profile: { ...profile, ...patch } }); log('hist.control') }
  const [o, pa] = profile.holders
  const sel = (label: string, v: string, key: 'realInvestor' | 'operator') => (
    <div><label className="label" htmlFor={key}>{label}</label><select id={key} className="input" value={v} onChange={(e) => chg({ [key]: e.target.value } as Partial<Profile>)}>
      <option value="origin">{holderName(o)}</option><option value="partner">{holderName(pa)}</option><option value={key === 'operator' ? 'joint' : 'shared'}>{t('own.opt.joint')}</option><option value="unknown">{t('own.opt.unknown')}</option></select></div>)
  return (
    <div className="space-y-5">
      <PageHead title={t('own.title')} sub={t('own.sub')} />
      <AnalysisTabs active="ownership" />
      <div className="card"><h2 className="h2 mb-3">{t('own.mapTitle')}</h2><OwnershipMap p={profile} />
        {Math.round(sum) !== 100 && <div className="mt-3"><Warn tone="danger">{t('own.sumBad', { sum })}</Warn></div>}</div>
      <Warn tone="info"><b>{t('own.noteB')}</b> {t('own.noteT')}</Warn>
      <div className="card"><ControlBars p={profile} /></div>
      <details className="card group">
        <summary className="h2 cursor-pointer list-none flex items-center justify-between">{t('own.adjust')}<span className="text-muted text-sm group-open:rotate-180 transition-transform" aria-hidden>▾</span></summary>
        <p className="text-sm text-muted my-3">{t('own.adjustSub')}</p>
        <div className="grid md:grid-cols-2 gap-4">{profile.holders.map((h) => (
          <fieldset key={h.id} className="border border-line rounded-xl p-3"><legend className="font-semibold px-1">{holderName(h)}</legend>
            <div className="grid grid-cols-2 gap-2">{(['percent', 'capital', 'voting', 'board', 'economic'] as const).map((k) => (
              <div key={k}><label className="label" htmlFor={h.id + k}>{tk('own.f', k)}</label><input id={h.id + k} type="number" min={0} max={100} className="input" value={h[k]} onChange={(e) => upd(h.id, k, num(e.target.value))} /></div>))}</div></fieldset>))}</div>
        <h3 className="font-semibold mt-5 mb-2">{t('own.ctlTitle')}</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {sel(t('own.q.investor'), profile.realInvestor, 'realInvestor')}{sel(t('own.q.operator'), profile.operator, 'operator')}
          <div><label className="label" htmlFor="side">{t('own.q.agreement')}</label><select id="side" className="input" value={profile.sideAgreement} onChange={(e) => chg({ sideAgreement: e.target.value as Profile['sideAgreement'] })}><option value="no">{t('opt.agr.no')}</option><option value="yes">{t('opt.agr.yes')}</option><option value="unknown">{t('opt.agr.unknown')}</option></select></div></div>
      </details>
      <div className="card"><h2 className="h2 mb-3">{t('own.dims')}</h2>
        <ul className="grid md:grid-cols-2 gap-2">{dims.map((d) => <li key={d.key} className="card-i flex flex-col gap-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-sm">{d.title}</span><StatusBadge level={d.status} /></div><span className="text-sm text-muted">{d.note}</span></li>)}</ul></div>
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('nominee')}>{t('own.toNominee')}</button></div>
      <Disclaimer />
    </div>
  )
}

/* ================= NOMINEE (risk screening, never a verdict) ================= */
const CATS: IndicatorCategory[] = ['funding', 'control', 'ownership', 'economic', 'management']
const CAT_ICON: Record<IndicatorCategory, string> = { funding: '💰', control: '🎛️', ownership: '🏛️', economic: '📈', management: '🧑‍💼' }
export function NomineePage() {
  const { t } = useI18n()
  const { profile } = useStore()
  const r = profile ? detectNomineeRisk(profile) : null
  const firstFlag = r ? CATS.find((c) => r.indicators.some((i) => indicatorCategory(i.key) === c)) ?? null : null
  const [openCat, setOpenCat] = useState<IndicatorCategory | null>(null)
  if (!profile || !r) return <div><PageHead title={t('nom.title')} /><EmptyState /></div>
  const tc = targetCountry(profile)
  const conc = consequences(profile)
  const sel = openCat ?? firstFlag
  const comp = hasCompany(profile)
  const count = (c: IndicatorCategory) => r.indicators.filter((i) => indicatorCategory(i.key) === c).length
  return (
    <div className="space-y-5">
      <PageHead title={t('nom.title')} sub={t('nom.sub')} />
      <AnalysisTabs active="nominee" />
      <div className={`rounded-2xl border-2 p-5 ${levelPanel[r.level]}`}>
        <div className="flex flex-wrap items-center gap-3"><StatusBadge level={r.level} /><h2 className="h2">{r.headline}</h2></div>
        <div className="mt-3 text-sm space-y-1"><p><b>{t('ai.answer')}:</b> {r.answer}</p><p><b>{t('ai.reason')}:</b> {r.reason}</p><p><b>{t('ai.source')}:</b> {getReg(tc === 'CN' ? 'cn-neglist-2024' : 'th-fba') && `${tc === 'CN' ? 'NDRC / MOFCOM' : 'DBD'}`} ({t('c.sample')})</p></div>
        <p className="text-xs text-muted mt-3">{t('nom.note')}</p>
        {r.stop && <div className="mt-3"><Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('nom.stopRoadmap')}</Warn></div>}
      </div>
      <section aria-label={t('nom.tiles')}>
        <h2 className="h2 mb-2">{t('nom.tiles')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">{CATS.map((c) => {
          const n = count(c); const flagged = n > 0
          return (
            <button key={c} onClick={() => setOpenCat(c)} aria-pressed={sel === c} className={`rounded-2xl border p-3 text-left transition active:scale-[.98] ${sel === c ? 'ring-2 ring-primary' : ''} ${flagged ? 'border-review-line bg-review-bg' : 'border-line bg-surface hover:bg-surface3'}`}>
              <div className="text-xl" aria-hidden>{CAT_ICON[c]}</div><div className="font-semibold text-sm">{tk('nom.cat', c)}</div>
              <div className={`text-xs mt-1 ${flagged ? 'text-review-fg font-semibold' : 'text-muted'}`}>{!comp ? t('nom.tile.na') : flagged ? t('nom.tile.flag', { n }) : t('nom.tile.ok')}</div>
            </button>)
        })}</div>
      </section>
      {sel && (
        <section className="space-y-3" aria-live="polite"><h2 className="h2">{tk('nom.cat', sel)}</h2>
          {r.indicators.filter((i) => indicatorCategory(i.key) === sel).map((i) => (
            <div key={i.key} className="card border-l-8 border-l-review-fg text-sm space-y-1.5">
              <p className="font-semibold">🚩 {t('nom.detected')}: {i.text}</p>
              <p><b>{t('nom.why')}:</b> {i.why}</p><p><b>{t('nom.missing')}:</b> {i.missing}</p><p><b>{t('nom.verify')}:</b> {i.verify}</p><p><b>{t('nom.do')}:</b> {i.next}</p></div>))}
        </section>)}
      {r.unknowns.length > 0 && <div className="card"><h2 className="h2 mb-1">{t('nom.unk.t')}</h2><ul className="list-disc ml-5 text-sm">{r.unknowns.map((u) => <li key={u}>{u}</li>)}</ul><p className="text-sm text-muted mt-2">{t('nom.unk.d')}</p></div>}
      <div className="card"><h2 className="h2 mb-2">{t('nom.next.t')}</h2><ol className="list-decimal ml-5 text-sm space-y-1">{r.next.map((n) => <li key={n}>{n}</li>)}</ol></div>
      {r.level !== 'LOW' && (
        <div className="card"><h2 className="h2 mb-1">{t('nom.cons.t')}</h2><p className="text-xs text-muted mb-3">{t('nom.cons.d')}</p>
          <div className="space-y-3">{conc.map((c) => (
            <div key={c.id} className="card-i text-sm space-y-1">
              <p className="font-semibold">{t('nom.cons.issue')}: {c.issue}</p>
              <p><b>{t('nom.cons.law')}:</b> {c.law} (<a className="text-primary underline" href={getReg(c.regId)?.sourceUrl} target="_blank" rel="noopener noreferrer">{t('nom.cons.src')} ↗</a>)</p>
              <p><b>{t('nom.cons.effect')}:</b> {c.consequence}</p><p><b>{t('nom.cons.why')}:</b> {c.why}</p><p><b>{t('c.status')}:</b> <VerifyBadge v={c.v} /></p><p><b>{t('nom.cons.next')}:</b> {c.next}</p></div>))}</div></div>)}
      {r.level !== 'LOW' && (
        <div><h2 className="h2 mb-2">{t('nom.opt.t')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">{compliantOptions().map((o) => <div key={o.k} className="card !p-4"><div className="text-xs text-primary font-bold">OPTION {o.k}</div><div className="font-semibold">{o.t}</div><p className="text-sm text-muted">{o.d}</p></div>)}</div>
          <div className="mt-3"><Warn tone="info">{t('nom.opt.warn')}</Warn></div>
          <div className="mt-3"><button className="btn-primary" onClick={() => go('documents')}>{t('nom.expert')}</button></div></div>)}
      <div><h2 className="h2 mb-2">{t('nom.sources')}</h2><div className="grid md:grid-cols-2 gap-3"><SourceCard id={tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'} /><SourceCard id={tc === 'CN' ? 'cn-fil' : 'th-dbd-reg'} /></div></div>
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('employment')}>{t('nom.toEmp')}</button><button className="btn-ghost" onClick={() => go('roadmap')}>{t('nom.toRoadmap')}</button></div>
      <Disclaimer />
    </div>
  )
}
