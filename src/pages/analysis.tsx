import { useEffect, useRef, useState } from 'react'
import type { Holder, Profile } from '../types'
import { go, useStore } from '../store'
import { ControlBars, Disclaimer, Disclosure, EmptyState, ExtLink, GuideStrip, Go, OwnershipMap, PageHead, SectionTabs, SourceCard, StatusBadge, VerifyBadge, Warn, WorkflowStrip } from '../components/ui'
import { AICommandCenter } from '../components/ai'
import { Icon, type IconName } from '../components/icons'
import { compliantOptions, consequences, detectNomineeRisk, holderName, holdersSum, indicatorCategory, ownershipDims, targetCountry, verifyAnalysis, hasCompany, type IndicatorCategory } from '../services/engines'
import { getReg } from '../data/regulations'
import { levelPanel } from '../utils/labels'
import { tk, useI18n } from '../i18n'

const MODULES = ['legal', 'invest', 'ownership', 'nominee', 'employment', 'tax', 'language', 'culture'] as const

/* ================= ANALYSE MY BUSINESS ================= */
export function AnalysisCenter() {
  const { t } = useI18n()
  const { profile, employment, analysisDone, set, log } = useStore()
  const [step, setStep] = useState(analysisDone ? MODULES.length : -1)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearInterval(timer.current), [])
  if (!profile) return <div><PageHead title={t('an.title')} /><EmptyState /></div>
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
      <PageHead title={t('an.title')} sub={t('an.sub')}><button className="btn-primary" onClick={run} disabled={running}><Icon name="ai" size={16} />{done ? t('an.rerun') : t('an.run')}</button></PageHead>
      <GuideStrip page="analysis" nextRoute="ownership" />
      <WorkflowStrip active={done ? 3 : 1} />
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card">
          <h2 className="h2 mb-3">{t('an.modules')}</h2>
          {step < 0 ? <p className="text-muted text-sm">{t('an.hint')}</p> : (
            <ul className="space-y-2.5" aria-live="polite">{MODULES.map((m, i) => (
              <li key={m} className="flex items-center gap-3 text-sm"><Icon name={i < step ? 'ok' : i === step ? 'ai' : 'circle'} className={i < step ? 'text-ok-fg' : i === step ? 'text-primary animate-pulse' : 'text-muted'} /><span className="font-medium w-32 shrink-0">{tk('an.m', m)}</span><span className="text-muted">{i === step ? tk('an.msg', m) : i < step ? t('an.done') : t('an.queued')}</span></li>))}</ul>)}
          {done && <div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary" onClick={() => go('ownership')}><Go>{t('an.toOwner')}</Go></button><button className="btn-ghost" onClick={() => go('risk')}>{t('an.toRisk')}</button></div>}
        </div>
        <div className="card">
          <h2 className="h2 mb-1">{t('an.verify')}</h2>
          <p className="text-sm text-muted mb-3">{t('an.verifySub')}</p>
          {!done ? <p className="text-sm text-muted">{t('an.verifyWait')}</p> : <>
            <ul className="space-y-2">{vr.steps.map((s) => <li key={s.name} className="text-sm flex gap-2"><Icon name={s.ok ? 'ok' : 'alert'} size={17} className={`mt-0.5 ${s.ok ? 'text-ok-fg' : 'text-warn-fg'}`} /><span><b>{s.name}</b><br /><span className="text-muted">{s.note}</span></span></li>)}</ul>
            {vr.recheck && <div className="mt-3"><Warn tone="danger">{t('an.recheck')}</Warn></div>}
            <div className="mt-3 flex items-center gap-2 text-sm flex-wrap">{t('an.final')}: <VerifyBadge v={vr.final} /></div></>}
        </div>
      </div>
      <AICommandCenter profile={profile} />
      <Disclaimer />
    </div>
  )
}

/* ================= OWNERSHIP CHECK ================= */
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
      <SectionTabs group="ownership" active="ownership" />
      <GuideStrip page="ownership" nextRoute="nominee" />
      <div className="card"><h2 className="h2 mb-3">{t('own.mapTitle')}</h2><OwnershipMap p={profile} />
        {Math.round(sum) !== 100 && <div className="mt-3"><Warn tone="danger">{t('own.sumBad', { sum })}</Warn></div>}</div>
      <div className="card"><ControlBars p={profile} /></div>
      <Warn tone="info"><b>{t('own.noteB')}</b> {t('own.noteT')}</Warn>
      <Disclosure title={t('own.dims')}>
        <ul className="grid md:grid-cols-2 gap-2">{dims.map((d) => <li key={d.key} className="card-i flex flex-col gap-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-sm">{d.title}</span><StatusBadge level={d.status} /></div><span className="text-sm text-muted">{d.note}</span></li>)}</ul>
      </Disclosure>
      <Disclosure title={t('own.adjust')}>
        <p className="text-sm text-muted">{t('own.adjustSub')}</p>
        <div className="grid md:grid-cols-2 gap-4">{profile.holders.map((h) => (
          <fieldset key={h.id} className="border border-line rounded-lg p-3"><legend className="font-semibold px-1">{holderName(h)}</legend>
            <div className="grid grid-cols-2 gap-2">{(['percent', 'capital', 'voting', 'board', 'economic'] as const).map((k) => (
              <div key={k}><label className="label" htmlFor={h.id + k}>{tk('own.f', k)}</label><input id={h.id + k} type="number" min={0} max={100} className="input" value={h[k]} onChange={(e) => upd(h.id, k, num(e.target.value))} /></div>))}</div></fieldset>))}</div>
        <h3 className="font-semibold pt-2">{t('own.ctlTitle')}</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {sel(t('own.q.investor'), profile.realInvestor, 'realInvestor')}{sel(t('own.q.operator'), profile.operator, 'operator')}
          <div><label className="label" htmlFor="side">{t('own.q.agreement')}</label><select id="side" className="input" value={profile.sideAgreement} onChange={(e) => chg({ sideAgreement: e.target.value as Profile['sideAgreement'] })}><option value="no">{t('opt.agr.no')}</option><option value="yes">{t('opt.agr.yes')}</option><option value="unknown">{t('opt.agr.unknown')}</option></select></div></div>
      </Disclosure>
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => go('nominee')}><Go>{t('own.toNominee')}</Go></button></div>
      <Disclaimer />
    </div>
  )
}

/* ================= SHAREHOLDING CHECK (risk screening, never a verdict) ================= */
const CATS: IndicatorCategory[] = ['funding', 'control', 'ownership', 'economic', 'management']
const CAT_ICON: Record<IndicatorCategory, IconName> = { funding: 'funding', control: 'control', ownership: 'ownershipCat', economic: 'economic', management: 'management' }
export function NomineePage() {
  const { t } = useI18n()
  const { profile } = useStore()
  const r = profile ? detectNomineeRisk(profile) : null
  const [openCat, setOpenCat] = useState<IndicatorCategory | null>(null)
  if (!profile || !r) return <div><PageHead title={t('nom.title')} /><EmptyState /></div>
  const tc = targetCountry(profile)
  const conc = consequences(profile)
  const comp = hasCompany(profile)
  const count = (c: IndicatorCategory) => r.indicators.filter((i) => indicatorCategory(i.key) === c).length
  const means = r.level === 'LOW' ? t('nom.means.low') : r.indicators.length ? t('nom.means.flag') : t('nom.means.unk')
  return (
    <div className="space-y-5">
      <PageHead title={t('nom.title')} sub={t('nom.sub')} />
      <SectionTabs group="ownership" active="nominee" />
      <GuideStrip page="nominee" nextRoute="employment" />
      {/* Level 1–3: what the AI found · what it means · what to do next */}
      <section className={`rounded-xl border-2 p-5 space-y-4 ${levelPanel[r.level]}`} aria-label={t('lvl1.found')}>
        <div><div className="text-xs font-semibold text-muted mb-1">{t('lvl1.found')}</div>
          <div className="flex flex-wrap items-center gap-3"><StatusBadge level={r.level} /><h2 className="text-lg font-semibold">{r.headline}</h2></div></div>
        <div><div className="text-xs font-semibold text-muted mb-1">{t('lvl2.means')}</div><p className="text-sm">{means}</p></div>
        <div><div className="text-xs font-semibold text-muted mb-1">{t('lvl3.next')}</div>
          <ol className="list-decimal ml-5 text-sm space-y-0.5">{r.next.map((n) => <li key={n}>{n}</li>)}</ol></div>
        {r.stop && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('nom.stopRoadmap')}</Warn>}
        <div className="flex flex-wrap gap-2">
          {r.level !== 'LOW' && <button className="btn-primary" onClick={() => go('documents')}><Icon name="documents" size={16} />{t('nom.expert')}</button>}
          <button className="btn-ghost" onClick={() => go('employment')}><Go>{t('nom.toEmp')}</Go></button>
        </div>
        <p className="text-xs text-muted">{t('nom.note')}</p>
      </section>
      {r.unknowns.length > 0 && <div className="card"><h2 className="h2 mb-1">{t('nom.unk.t')}</h2><ul className="list-disc ml-5 text-sm">{r.unknowns.map((u) => <li key={u}>{u}</li>)}</ul><p className="text-sm text-muted mt-2">{t('nom.unk.d')}</p></div>}
      <section aria-label={t('nom.tiles')}>
        <h2 className="h2 mb-2">{t('nom.tiles')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">{CATS.map((c) => {
          const n = count(c); const flagged = n > 0
          return (
            <button key={c} onClick={() => setOpenCat(openCat === c ? null : c)} aria-pressed={openCat === c} className={`rounded-xl border p-3 text-left transition active:scale-[.98] ${openCat === c ? 'ring-2 ring-primary' : ''} ${flagged ? 'border-review-line bg-review-bg' : 'border-line bg-surface hover:bg-surface3'}`}>
              <Icon name={CAT_ICON[c]} size={20} className={flagged ? 'text-review-fg' : 'text-primary'} /><div className="font-semibold text-sm mt-1.5">{tk('nom.cat', c)}</div>
              <div className={`text-xs mt-1 ${flagged ? 'text-review-fg font-semibold' : 'text-muted'}`}>{!comp ? t('nom.tile.na') : flagged ? t('nom.tile.flag', { n }) : t('nom.tile.ok')}</div>
            </button>)
        })}</div>
        {!openCat && r.indicators.length > 0 && <p className="text-sm text-muted mt-2">{t('nom.pickTopic')}</p>}
      </section>
      {openCat && (
        <section className="space-y-3" aria-live="polite"><h2 className="h2">{tk('nom.cat', openCat)}</h2>
          {r.indicators.filter((i) => indicatorCategory(i.key) === openCat).map((i) => (
            <div key={i.key} className="card border-l-4 border-l-review-fg text-sm space-y-1.5">
              <p className="font-semibold">{t('nom.detected')}: {i.text}</p>
              <p><b>{t('nom.why')}:</b> {i.why}</p><p><b>{t('nom.missing')}:</b> {i.missing}</p><p><b>{t('nom.verify')}:</b> {i.verify}</p><p><b>{t('nom.do')}:</b> {i.next}</p></div>))}
          {count(openCat) === 0 && <div className="card-i text-sm text-muted">{comp ? t('nom.tile.ok') : t('nom.tile.na')}</div>}
        </section>)}
      {/* Level 4: legal basis, lawful options, sources */}
      <Disclosure title={t('lvl4.more')}>
        {r.level !== 'LOW' && <>
          <h3 className="font-semibold">{t('nom.cons.t')}</h3><p className="text-xs text-muted">{t('nom.cons.d')}</p>
          <div className="space-y-3">{conc.map((c) => (
            <div key={c.id} className="card-i text-sm space-y-1">
              <p className="font-semibold">{t('nom.cons.issue')}: {c.issue}</p>
              <p><b>{t('nom.cons.law')}:</b> {c.law} (<ExtLink href={getReg(c.regId)?.sourceUrl}>{t('nom.cons.src')}</ExtLink>)</p>
              <p><b>{t('nom.cons.effect')}:</b> {c.consequence}</p><p><b>{t('nom.cons.why')}:</b> {c.why}</p><p><b>{t('c.status')}:</b> <VerifyBadge v={c.v} /></p><p><b>{t('nom.cons.next')}:</b> {c.next}</p></div>))}</div>
          <h3 className="font-semibold pt-2">{t('nom.opt.t')}</h3>
          <div className="grid sm:grid-cols-2 gap-3">{compliantOptions().map((o) => <div key={o.k} className="card-i"><div className="text-xs text-primary font-semibold">OPTION {o.k}</div><div className="font-semibold text-sm">{o.t}</div><p className="text-sm text-muted">{o.d}</p></div>)}</div>
          <Warn tone="info">{t('nom.opt.warn')}</Warn>
        </>}
        <h3 className="font-semibold pt-2">{t('nom.sources')}</h3>
        <div className="grid md:grid-cols-2 gap-3"><SourceCard id={tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'} /><SourceCard id={tc === 'CN' ? 'cn-fil' : 'th-dbd-reg'} /></div>
      </Disclosure>
      <div className="flex gap-2 flex-wrap"><button className="btn-ghost" onClick={() => go('roadmap')}><Go>{t('nom.toRoadmap')}</Go></button></div>
      <Disclaimer />
    </div>
  )
}
