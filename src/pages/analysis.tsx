import { useEffect, useRef, useState } from 'react'
import type { Holder, Profile, StepStatus } from '../types'
import { go, useStore } from '../store'
import { BackLink, ControlBars, Disclaimer, Disclosure, EmptyState, ExtLink, GuideStrip, Go, JourneyStrip, Ok, OwnershipMap, PageHead, RiskCard, SimTag, SourceCard, StatusBadge, VerifyBadge, Warn } from '../components/ui'
import { AICommandCenter } from '../components/ai'
import { Icon, type IconName } from '../components/icons'
import { useActions } from '../hooks'
import { assessRisks, riskRoute, compliantOptions, consequences, detectNomineeRisk, holderName, holdersSum, indicatorCategory, ownershipDims, targetCountry, verifyAnalysis, hasCompany, type IndicatorCategory } from '../services/engines'
import { getReg } from '../data/regulations'
import { levelOrder, levelPanel } from '../utils/labels'
import type { Level } from '../types'
import { tk, useI18n } from '../i18n'

const MODULES = ['legal', 'invest', 'ownership', 'nominee', 'employment', 'tax', 'language', 'culture'] as const

/* ================= AI ANALYSIS: the AI checks key issues, then shows what it found (found · why · unknown · verify · next · status) ================= */
export function AnalysisCenter() {
  const { t } = useI18n()
  const { profile, employment, analysisDone, set, log, setActionStatus } = useStore()
  const actions = useActions()
  const [step, setStep] = useState(analysisDone ? MODULES.length : -1)
  const timer = useRef<number>(0)
  const run = () => {
    setStep(0); window.clearInterval(timer.current)
    let i = 0
    timer.current = window.setInterval(() => { i++; setStep(i); if (i >= MODULES.length) { window.clearInterval(timer.current); set({ analysisDone: true }); log('hist.analysis') } }, 450)
  }
  // Arriving here with a business context that has not been analysed yet starts the analysis: no extra click needed.
  useEffect(() => { if (profile && !analysisDone) run(); return () => window.clearInterval(timer.current) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!profile) return <div><PageHead title={t('an.title')} /><EmptyState /></div>
  const vr = verifyAnalysis(profile, employment)
  const risks = [...assessRisks(profile, employment)].sort((x, y) => levelOrder.indexOf(x.level) - levelOrder.indexOf(y.level))
  const byId = Object.fromEntries(risks.map((r) => [r.id, r.level])) as Record<string, Level>
  const fund = ownershipDims(profile).find((d) => d.key === 'fund')!.status
  const res = (m: (typeof MODULES)[number]): Level => (m === 'invest' ? fund : byId[m])
  const running = step >= 0 && step < MODULES.length
  const done = !running && (analysisDone || step >= MODULES.length)
  const top = risks.filter((r) => r.level !== 'LOW'), rest = risks.filter((r) => r.level === 'LOW')
  const detailOf = (id: string) => { const r = riskRoute(id); return r === 'roadmap' ? undefined : r }
  const setAct = (id: string, st: StepStatus) => { const x = actions.find((y) => y.id === id); if (x) setActionStatus(x, st) }
  const card = (r: (typeof risks)[number], compact: boolean) => <RiskCard key={r.id} r={r} compact={compact} detail={detailOf(r.id)} actions={actions.filter((x) => x.riskId === r.id)} onAction={setAct} />
  const nom = detectNomineeRisk(profile)
  return (
    <div className="space-y-5">
      <PageHead title={t('an.title')} sub={t('an.sub')}>{done && <button className="btn-ghost" onClick={run}><Icon name="ai" size={16} />{t('an.rerun')}</button>}</PageHead>
      <JourneyStrip active={done ? 3 : 2} />
      {!done && (
        <section className={'card space-y-3 ' + (running ? 'ai-scan' : '')} aria-live="polite" aria-busy={running}>
          <p className="font-semibold flex items-center gap-2"><Icon name="ai" size={18} className="text-primary animate-pulse" />{step < 0 ? t('an.hint') : t('an.working')}</p>
          {step < 0 ? <button className="btn-primary" onClick={run}><Icon name="ai" size={16} />{t('an.run')}</button> : (
            <ul className="space-y-2">{MODULES.map((m, i) => (
              <li key={m} className="flex items-center gap-3 text-sm"><Icon name={i < step ? 'ok' : i === step ? 'ai' : 'circle'} className={i < step ? 'text-ok-fg' : i === step ? 'text-primary animate-pulse' : 'text-muted'} /><span className={i <= step ? 'font-medium' : 'text-muted'}>{tk('an.m', m)}</span>{i < step && <span className="ml-auto"><StatusBadge level={res(m)} /></span>}</li>))}</ul>)}
        </section>)}
      {done && <>
        <div className="rounded-xl border border-line bg-brand text-brandfg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" role="status">
          <Icon name="ok" size={18} className="text-ok-fg" /><p className="text-sm flex-1 min-w-[200px] font-medium">{t('an.doneLine', { n: top.length })}</p>
          <button className="btn-primary !min-h-[40px]" onClick={() => go('roadmap')}><Go>{t('an.toActions')}</Go></button>
        </div>
        {nom.stop && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('nom.stopRoadmap')}</Warn>}
        <section aria-labelledby="found-h" className="space-y-3">
          <h2 id="found-h" className="h2">{t('find.top')}</h2>
          {top.length ? <div className="grid lg:grid-cols-2 gap-4 items-start">{top.map((r, i) => card(r, i > 0))}</div> : <div className="card"><Ok>{t('find.none')}</Ok></div>}
        </section>
        {rest.length > 0 && <Disclosure title={t('find.rest') + ' (' + rest.length + ')'}><div className="grid lg:grid-cols-2 gap-4 items-start">{rest.map((r) => card(r, true))}</div></Disclosure>}
        <Disclosure title={t('an.areas')}>
          <ul className="grid sm:grid-cols-2 gap-2">{MODULES.map((m) => <li key={m} className="flex items-center justify-between gap-2 text-sm card-i"><span>{tk('an.m', m)}</span><StatusBadge level={res(m)} /></li>)}</ul>
          <div className="flex flex-wrap gap-2 pt-1"><button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('ownership')}><Icon name="ownership" size={16} />{t('an.detail.own')}</button><button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('employment')}><Icon name="employment" size={16} />{t('an.detail.emp')}</button></div>
        </Disclosure>
        <Disclosure title={t('an.verify')}>
          <p className="text-sm text-muted flex flex-wrap items-center gap-2">{t('an.verifySub')}<SimTag /></p>
          <ul className="space-y-2">{vr.steps.map((x) => <li key={x.name} className="text-sm flex gap-2"><Icon name={x.ok ? 'ok' : 'alert'} size={17} className={'mt-0.5 ' + (x.ok ? 'text-ok-fg' : 'text-warn-fg')} /><span><b>{x.name}</b><br /><span className="text-muted">{x.note}</span></span></li>)}</ul>
          {vr.recheck && <Warn tone="danger">{t('an.recheck')}</Warn>}
          <div className="flex items-center gap-2 text-sm flex-wrap">{t('an.final')}: <VerifyBadge v={vr.final} /></div><p className="text-xs text-muted">{t('an.finalWhy')}</p>
        </Disclosure>
        <Disclosure title={t('an.ask')}><AICommandCenter profile={profile} /></Disclosure>
      </>}
      <Disclaimer />
    </div>
  )
}

/* ================= OWNERSHIP CHECK (map + screening result in one page) ================= */
const num = (v: string) => Math.max(0, Math.min(100, Number(v) || 0))
const CATS: IndicatorCategory[] = ['funding', 'control', 'ownership', 'economic', 'management']
const CAT_ICON: Record<IndicatorCategory, IconName> = { funding: 'funding', control: 'control', ownership: 'ownershipCat', economic: 'economic', management: 'management' }
export function OwnershipPage() {
  const { t } = useI18n()
  const { profile, set, log } = useStore()
  const [openCat, setOpenCat] = useState<IndicatorCategory | null>(null)
  if (!profile) return <div><PageHead title={t('own.title')} /><EmptyState /></div>
  const r = detectNomineeRisk(profile)
  const tc = targetCountry(profile)
  const conc = consequences(profile)
  const comp = hasCompany(profile)
  const count = (c: IndicatorCategory) => r.indicators.filter((i) => indicatorCategory(i.key) === c).length
  const means = r.level === 'LOW' ? t('nom.means.low') : r.indicators.length ? t('nom.means.flag') : t('nom.means.unk')
  // One value per dimension: the partner's side is always 100 minus the other side, so the numbers can never be inconsistent.
  const setDim = (k: 'percent' | 'capital' | 'voting' | 'board' | 'economic', v: number) =>
    set({ profile: { ...profile, holders: profile.holders.map((h: Holder) => ({ ...h, [k]: h.id === 'origin' ? v : 100 - v })) }, analysisDone: false })
  const dims = ownershipDims(profile)
  const sum = holdersSum(profile)
  const chg = (patch: Partial<Profile>) => { set({ profile: { ...profile, ...patch } }); log('hist.control') }
  const [o, pa] = profile.holders
  const sel = (label: string, v: string, key: 'realInvestor' | 'operator') => (
    <div><label className="label" htmlFor={key}>{label}</label><select id={key} className="input" value={v} onChange={(e) => chg({ [key]: e.target.value } as Partial<Profile>)}>
      <option value="origin">{holderName(o)}</option><option value="partner">{holderName(pa)}</option><option value={key === 'operator' ? 'joint' : 'shared'}>{t('own.opt.joint')}</option><option value="unknown">{t('own.opt.unknown')}</option></select></div>)
  return (
    <div className="space-y-5">
      <BackLink to="analysis" label={t('nav.backAnalysis')} />
      <PageHead title={t('own.title')} sub={t('own.sub')} />
      <GuideStrip page="ownership" nextRoute="employment" />
      {/* what the AI found · what it means · what to do next */}
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
      {r.unknowns.length > 0 && <div className="card"><h2 className="h2 mb-1">{t('nom.unk.t')}</h2><ul className="list-disc ml-5 text-sm">{r.unknowns.map((u) => <li key={u}>{u}</li>)}</ul><p className="text-sm text-muted mt-2">{t('nom.unk.d')}</p>
        <button className="btn-ghost mt-3 !min-h-[40px] text-sm" onClick={() => go('interview')}><Go>{t('dash.answerMore')}</Go></button></div>}
      <div className="card"><h2 className="h2 mb-3">{t('own.mapTitle')}</h2><OwnershipMap p={profile} />
        {Math.round(sum) !== 100 && <div className="mt-3"><Warn tone="danger">{t('own.sumBad', { sum })}</Warn></div>}</div>
      <div className="card"><ControlBars p={profile} /></div>
      <Disclosure title={t('nom.tiles')}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">{CATS.map((c) => {
          const n = count(c); const flagged = n > 0
          return (
            <button key={c} onClick={() => setOpenCat(openCat === c ? null : c)} aria-pressed={openCat === c} className={`rounded-xl border p-3 text-left transition active:scale-[.98] ${openCat === c ? 'ring-2 ring-primary' : ''} ${flagged ? 'border-warn-line bg-warn-bg' : 'border-line bg-surface hover:bg-surface3'}`}>
              <Icon name={CAT_ICON[c]} size={20} className={flagged ? 'text-warn-fg' : 'text-primary'} /><div className="font-semibold text-sm mt-1.5">{tk('nom.cat', c)}</div>
              <div className={`text-xs mt-1 ${flagged ? 'text-warn-fg font-semibold' : 'text-muted'}`}>{!comp ? t('nom.tile.na') : flagged ? t('nom.tile.flag', { n }) : t('nom.tile.ok')}</div>
            </button>)
        })}</div>
        {!openCat && r.indicators.length > 0 && <p className="text-sm text-muted">{t('nom.pickTopic')}</p>}
        {openCat && (
          <div className="space-y-3" aria-live="polite"><h3 className="font-semibold">{tk('nom.cat', openCat)}</h3>
            {r.indicators.filter((i) => indicatorCategory(i.key) === openCat).map((i) => (
              <div key={i.key} className="card-i border-l-4 border-l-warn-fg text-sm space-y-1.5">
                <p className="font-semibold">{t('nom.detected')}: {i.text}</p>
                <p><b>{t('nom.why')}:</b> {i.why}</p><p><b>{t('nom.missing')}:</b> {i.missing}</p><p><b>{t('nom.verify')}:</b> {i.verify}</p><p><b>{t('nom.do')}:</b> {i.next}</p></div>))}
            {count(openCat) === 0 && <div className="card-i text-sm text-muted">{comp ? t('nom.tile.ok') : t('nom.tile.na')}</div>}
          </div>)}
      </Disclosure>
      <Disclosure title={t('lvl4.more')}>
        {r.level !== 'LOW' && <>
          <h3 className="font-semibold">{t('nom.cons.t')}</h3><p className="text-xs text-muted">{t('nom.cons.d')}</p>
          <div className="space-y-3">{conc.map((c) => (
            <div key={c.id} className="card-i text-sm space-y-1">
              <p className="font-semibold">{t('nom.cons.issue')}: {c.issue}</p>
              <p><b>{t('nom.cons.law')}:</b> {c.law} (<ExtLink href={getReg(c.regId)?.sourceUrl}>{t('nom.cons.src')}</ExtLink>)</p>
              <p><b>{t('nom.cons.effect')}:</b> {c.consequence}</p><p><b>{t('nom.cons.why')}:</b> {c.why}</p><p><b>{t('c.status')}:</b> <VerifyBadge v={c.v} /></p><p><b>{t('nom.cons.next')}:</b> {c.next}</p></div>))}</div>
          <h3 className="font-semibold pt-2">{t('nom.opt.t')}</h3>
          <div className="grid sm:grid-cols-2 gap-3">{compliantOptions().map((o2) => <div key={o2.k} className="card-i"><div className="text-xs text-primary font-semibold">{t('copt.opt', { k: o2.k })}</div><div className="font-semibold text-sm">{o2.t}</div><p className="text-sm text-muted">{o2.d}</p></div>)}</div>
          <Warn tone="info">{t('nom.opt.warn')}</Warn>
        </>}
        <h3 className="font-semibold pt-2">{t('nom.sources')}</h3>
        <div className="grid md:grid-cols-2 gap-3"><SourceCard id={tc === 'CN' ? 'cn-neglist-2024' : 'th-fba'} /><SourceCard id={tc === 'CN' ? 'cn-fil' : 'th-dbd-reg'} /></div>
      </Disclosure>
      <Disclosure title={t('own.dims')}>
        <Warn tone="info"><b>{t('own.noteB')}</b> {t('own.noteT')}</Warn>
        <ul className="grid md:grid-cols-2 gap-2">{dims.map((d) => <li key={d.key} className="card-i flex flex-col gap-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-sm">{d.title}</span><StatusBadge level={d.status} /></div><span className="text-sm text-muted">{d.note}</span></li>)}</ul>
      </Disclosure>
      <Disclosure title={t('own.adjust')}>
        <p className="text-sm text-muted">{t('own.adjustSub')}</p>
        <div className="space-y-4">{(['percent', 'capital', 'voting', 'board', 'economic'] as const).map((k) => (
          <div key={k}>
            <div className="flex flex-wrap justify-between gap-2 text-sm"><label htmlFor={'dim-' + k} className="font-medium">{tk('own.f', k)}</label><span className="text-muted">{t('own.split', { a: holderName(o), x: o[k], b: holderName(pa), y: pa[k] })}</span></div>
            <div className="flex items-center gap-3">
              <input id={'dim-' + k} type="range" min={0} max={100} step={1} value={o[k]} onChange={(e) => setDim(k, num(e.target.value))} aria-label={t('own.slider', { holder: holderName(o) })} className="flex-1 h-8 accent-[rgb(var(--primary))]" />
              <input type="number" min={0} max={100} className="input !w-20" aria-label={t('own.slider', { holder: holderName(o) })} value={o[k]} onChange={(e) => setDim(k, num(e.target.value))} />
            </div>
          </div>))}</div>
        <h3 className="font-semibold pt-2">{t('own.ctlTitle')}</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {sel(t('own.q.investor'), profile.realInvestor, 'realInvestor')}{sel(t('own.q.operator'), profile.operator, 'operator')}
          <div><label className="label" htmlFor="side">{t('own.q.agreement')}</label><select id="side" className="input" value={profile.sideAgreement} onChange={(e) => chg({ sideAgreement: e.target.value as Profile['sideAgreement'] })}><option value="no">{t('opt.agr.no')}</option><option value="yes">{t('opt.agr.yes')}</option><option value="unknown">{t('opt.agr.unknown')}</option></select></div></div>
      </Disclosure>
      <Disclaimer />
    </div>
  )
}
/** /nominee is the same page now: the screening result and the ownership map live together. */
export const NomineePage = OwnershipPage
