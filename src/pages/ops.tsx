import { useState } from 'react'
import type { AlertItem, StepStatus } from '../types'
import { fingerprint, go, useStore } from '../store'
import { ActionList, AlertCard, Checklist, Disclaimer, Disclosure, EmptyState, ExtLink, GuideStrip, Go, JourneyStrip, Ok, PageHead, RiskCard, RoadmapTimeline, SampleTag, SourceCard, StatusBadge, VerifyBadge, Warn, useReasonText } from '../components/ui'
import { AICommandCenter, AITimeline } from '../components/ai'
import { CountryBadge, Icon } from '../components/icons'
import { assessRisks, buildDocument, contractKeys, contractLabel, detectNomineeRisk, docDesc, docIds, docTitle, docToHtml, hasCompany, riskRoute, type DocType } from '../services/engines'
import { aiService } from '../services/aiService'
import { useActions, useRoadmap } from '../hooks'
import { checklistItems } from '../data/demo'
import { coverageGaps, lastVerifiedText, regText, regulations, simulatedReplacement } from '../data/regulations'
import { trustSummary } from '../data/legal/trust'
import { RequiredDocs } from '../components/compliance'
import { BRAND } from '../brand'
import { dirInfo, levelOrder } from '../utils/labels'
import { dv, LANGS, tk, useI18n, type Lang } from '../i18n'

/* ================= DASHBOARD (business · status · issues · next action · documents · AI activity) ================= */
export function Dashboard() {
  const { t } = useI18n()
  const { profile, employment, employeeCheck, checks, docs, analysisDone, startDemo } = useStore()
  const steps = useRoadmap()
  const actions = useActions()
  if (!profile) return <div><PageHead title={t('dash.title')} /><EmptyState /></div>
  const risks = assessRisks(profile, employment, employeeCheck)
  const d = dirInfo(profile.direction)
  const nom = detectNomineeRisk(profile)
  const total = steps.length + actions.length + checklistItems.length
  const done = steps.filter((s) => s.status === 'done').length + actions.filter((a) => a.status === 'done').length + checklistItems.filter((c) => checks[c.id]).length
  const pending = actions.filter((a) => a.status !== 'done')
  const pct = Math.round((done / total) * 100)
  const next = pending.find((a) => a.riskId === 'nominee') ?? pending[0]
  const issues = [...risks].filter((r) => r.level !== 'LOW').sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)).slice(0, 3)
  const status = !analysisDone ? t('dash.status.notYet') : nom.stop ? t('dash.status.stop') : pending.length ? t('dash.status.fix') : t('dash.status.ok')
  const needed: DocType[] = ['business', ...(hasCompany(profile) ? (['ownership'] as DocType[]) : []), ...(profile.employees > 0 || profile.crossBorderWorkers ? (['employment', 'contract'] as DocType[]) : []), 'report', 'plan']
  return (
    <div className="space-y-5">
      <PageHead title={t('dash.title')} sub={t('dash.sub')}>{profile.isDemo && <button className="btn-ghost" onClick={() => startDemo()}>{t('dash.resetDemo')}</button>}</PageHead>
      <JourneyStrip />
      <div className="grid lg:grid-cols-5 gap-4">
        <section className="card lg:col-span-3 space-y-4" aria-labelledby="biz-h">
          <div>
            <div id="biz-h" className="text-xs text-muted flex items-center gap-2 flex-wrap">{t('dash.business')}{profile.isDemo && <SampleTag text={t('c.demoTag')} />}</div>
            <div className="text-2xl font-semibold break-words">{dv(profile.companyName)}</div>
            <div className="text-sm text-muted flex items-center gap-1.5 flex-wrap mt-1"><CountryBadge c={d.from} />{tk('country', d.from)}<Icon name="next" size={14} /><CountryBadge c={d.to} />{tk('country', d.to)}<span aria-hidden>·</span>{profile.businessType === 'other' && profile.businessTypeOther ? profile.businessTypeOther : tk('opt.btype', profile.businessType)}</div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg bg-surface2 border border-line px-3 py-2.5">
            <Icon name={nom.stop && analysisDone ? 'warn' : 'info'} className={nom.stop && analysisDone ? 'text-danger-fg mt-0.5' : 'text-info-fg mt-0.5'} />
            <div><div className="text-xs text-muted">{t('dash.status')}</div><div className="font-semibold">{status}</div></div>
          </div>
          {analysisDone && <div><div className="flex justify-between text-sm"><span className="text-muted">{t('dash.progress')}</span><span className="font-semibold">{done} / {total}</span></div>
            <div className="h-2.5 bg-surface3 rounded-full mt-1.5 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('dash.progress')}><div className="h-2.5 bg-primary transition-all duration-700" style={{ width: pct + '%' }} /></div></div>}
        </section>
        <section className="lg:col-span-2 rounded-xl bg-primary text-onprimary p-5 flex flex-col gap-3 shadow-md" aria-labelledby="nxt-h">
          <div id="nxt-h" className="text-xs font-semibold flex items-center gap-1.5"><Icon name="ai" size={15} />{t('dash.nextTitle')}</div>
          {!analysisDone ? <>
            <p className="text-lg font-semibold leading-snug flex-1">{t('journey.cta.3')}</p>
            <p className="text-xs">{t('journey.d.3')}</p>
            <button className="btn bg-surface text-ink hover:opacity-90" onClick={() => go('analysis')}><Go>{t('journey.cta.3')}</Go></button>
            {!!profile.unknownFacts?.length && <button className="text-sm underline underline-offset-2 text-left opacity-90" onClick={() => go('profile')}>{t('dash.answerFirst', { n: profile.unknownFacts.length })}</button>}
          </> : <>
            <p className="text-lg font-semibold leading-snug flex-1">{next ? next.title : t('dash.nextNone')}</p>
            {next && <div className="text-xs">{t('c.fromRisk')}: {next.riskLabel} · {t('c.owner')}: {next.owner}</div>}
            {next && <button className="btn bg-surface text-ink hover:opacity-90" onClick={() => go(riskRoute(next.riskId))}><Go>{t('dash.nextGo')}</Go></button>}
          </>}
        </section>
      </div>
      {nom.stop && analysisDone && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('dash.stopText')} <button className="underline font-semibold ml-1" onClick={() => go('ownership')}>{t('dash.seeDetails')}</button></Warn>}
      <section className="card" aria-labelledby="iss-h"><h2 id="iss-h" className="h2 mb-3">{t('dash.found')}</h2>
        {!analysisDone ? <div className="space-y-3"><p className="text-sm text-muted">{t('dash.foundWait')}</p><button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('analysis')}><Go>{t('journey.cta.3')}</Go></button></div>
          : issues.length ? <><ul className="space-y-2">{issues.map((r) => (
            <li key={r.id}><button className="w-full text-left card-i hover:bg-surface3 transition flex flex-col gap-1" onClick={() => go('analysis')}>
              <span className="flex items-center justify-between gap-2 flex-wrap"><span className="font-medium text-sm">{r.category}</span><StatusBadge level={r.level} /></span>
              <span className="block text-sm text-muted line-clamp-2">{r.found}</span></button></li>))}</ul>
            <div className="flex flex-wrap gap-2 mt-3"><button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('analysis')}><Go>{t('dash.foundAll')}</Go></button><button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('documents')}><Icon name="documents" size={16} />{t('dash.brief')}</button></div></>
          : <p className="text-sm text-ok-fg"><Ok>{t('dash.noIssues')}</Ok></p>}
      </section>
      <Disclosure title={t('dash.docsNeeded')}>
        <p className="text-xs text-muted">{t('dash.docsSub')}</p>
        <ul className="space-y-2">{needed.map((x) => (
          <li key={x} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 min-w-0"><Icon name="documents" size={16} className="text-muted" /><span className="truncate">{docTitle(x)}</span></span>
            <span className={'chip shrink-0 ' + (docs[x] ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line')}>{docs[x] ? t('dash.docMade') : t('dash.docTodo')}</span></li>))}</ul>
        <button className="btn-ghost !min-h-[40px] text-sm" onClick={() => go('documents')}><Go>{t('dash.toDocs')}</Go></button>
      </Disclosure>
      <Disclosure title={t('dash.aiDid')}><AITimeline p={profile} emp={employment} /></Disclosure>
      <div className="card"><AICommandCenter profile={profile} /></div>
      <Disclaimer />
    </div>
  )
}

/* ================= TO-DO PLAN: what to do now · what was found · all steps ================= */
export function RoadmapPage({ openRisks = false }: { openRisks?: boolean }) {
  const { t } = useI18n()
  const { profile, employment, employeeCheck, stepOverrides, setActionStatus, checks, set } = useStore()
  const steps = useRoadmap()
  const actions = useActions()
  const [lockMsg, setLockMsg] = useState('')
  if (!profile) return <div><PageHead title={t('rm.title')} /><EmptyState /></div>
  const stop = detectNomineeRisk(profile).stop
  const done = steps.filter((s) => s.status === 'done').length
  const risks = [...assessRisks(profile, employment, employeeCheck)].sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level))
  const setAct = (id: string, s: StepStatus) => { const a = actions.find((x) => x.id === id); if (a) setActionStatus(a, s) }
  return (
    <div className="space-y-5">
      <PageHead title={t('rm.title')} sub={t('rm.sub')} />
      <JourneyStrip active={4} />
      {lockMsg && <Warn tone="danger">{lockMsg}</Warn>}
      {stop && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('rm.lockText')}</Warn>}
      <section className="card" aria-labelledby="todo-h"><h2 id="todo-h" className="h2 mb-1">{t('rm.actionsT')}</h2><p className="text-sm text-muted mb-3">{t('rm.actionsD')}</p>
        <ActionList actions={actions} onStatus={setAct} /></section>
      <Disclosure title={t('rm.found')} defaultOpen={openRisks}>
        <p className="text-xs text-muted">{t('risk.boardNote')}</p>
        <div className="grid md:grid-cols-2 gap-3">{risks.map((r) => <RiskCard key={r.id} r={r} compact detail={riskRoute(r.id) === 'roadmap' ? undefined : riskRoute(r.id)} actions={actions.filter((a) => a.riskId === r.id)} onAction={setAct} />)}</div>
      </Disclosure>
      <Disclosure title={`${t('rm.allSteps')} (${t('rm.progress', { n: done, total: steps.length })})`}>
        <RoadmapTimeline steps={steps} onStatus={(id, s: StepStatus) => {
          if (stop && id >= 7 && (s === 'doing' || s === 'done')) { setLockMsg(t('rm.locked', { n: id })); return }
          setLockMsg(''); set({ stepOverrides: { ...stepOverrides, [id]: s } })
        }} />
      </Disclosure>
      <Disclosure title={t('rm.checklist')}><Checklist done={checks} onToggle={(id) => set({ checks: { ...checks, [id]: !checks[id] } })} /></Disclosure>
      <Disclaimer />
    </div>
  )
}
/** /risk is the same page with the findings opened. */
export const RiskPage = () => <RoadmapPage openRisks />

/* ================= DOCUMENTS ================= */
const DOC_EDIT: Record<DocType, string> = { brief: 'analysis', business: 'roadmap', ownership: 'ownership', employment: 'employment', contract: 'contract', report: 'risk', translation: 'language', plan: 'roadmap' }
const MULTI_LANG: DocType[] = ['brief', 'contract', 'translation']
/** Which findings each document supports (so the user sees why it is needed). */
const DOC_RISK: Record<DocType, string[]> = { brief: [], business: ['legal'], ownership: ['nominee', 'ownership'], employment: ['employment', 'tax'], contract: ['employment', 'language'], report: [], translation: ['language'], plan: [] }
export function DocumentsPage() {
  const { t, lang } = useI18n()
  const { profile, employment, employeeCheck, contract, docs, docLang, docStamp, docStatus, checks, set, log } = useStore()
  const actions = useActions()
  const [sel, setSel] = useState<DocType | null>(null)
  const [genLang, setGenLang] = useState<Partial<Record<DocType, Lang>>>({})
  const [busy, setBusy] = useState<DocType | null>(null)
  const [err, setErr] = useState('')
  const [cache, setCache] = useState<Record<string, { title: string; text: string; lang: Lang }>>({})
  if (!profile) return <div><PageHead title={t('docs.title')} /><EmptyState /></div>
  const fp = fingerprint(profile, employment, contract)
  const langOf = (x: DocType): Lang => (MULTI_LANG.includes(x) ? genLang[x] ?? docLang[x] ?? lang : docLang[x] ?? lang)
  const key = (x: DocType, l: Lang) => `${x}|${l}`
  const get = (x: DocType, l: Lang) => cache[key(x, l)] ?? buildDocument(x, profile, employment, contract, l, actions)
  const create = async (x: DocType) => {
    const l = MULTI_LANG.includes(x) ? langOf(x) : lang
    setBusy(x); setErr('')
    try { const r = await aiService.generateDocument(x, profile, employment, contract, l, actions); setCache((c) => ({ ...c, [key(x, l)]: r })); set({ docs: { ...docs, [x]: true }, docLang: { ...docLang, [x]: l }, docStamp: { ...docStamp, [x]: fp } }); log('hist.doc', { title: r.title }); setSel(x) } catch { setErr(t('err.generic')) }
    setBusy(null)
  }
  const download = (x: DocType) => {
    const l = langOf(x); const r = get(x, l)
    const url = URL.createObjectURL(new Blob([docToHtml(r.title, r.text, l)], { type: 'text/html;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `${x}-${l}-draft.html`; a.click(); URL.revokeObjectURL(url)
  }
  const items = (x: DocType): { label: string; done: boolean }[] => {
    if (x === 'contract') return contractKeys.map((k) => ({ label: contractLabel(k), done: !!dv(contract[k]).trim() }))
    if (x === 'business' || x === 'ownership' || x === 'employment') return checklistItems.filter((c) => c.group === x).map((c) => ({ label: t(`chk.${c.id}` as never), done: !!checks[c.id] }))
    return []
  }
  const pctOf = (x: DocType) => { const it = items(x); return it.length ? Math.round((it.filter((i) => i.done).length / it.length) * 100) : null }
  const cur = sel ? get(sel, langOf(sel)) : null
  const risks = assessRisks(profile, employment, employeeCheck)
  return (
    <div className="space-y-5">
      <PageHead title={t('docs.title')} sub={t('docs.sub')} />
      <GuideStrip page="documents" nextRoute="dashboard" />
      {err && <Warn tone="danger">{err}</Warn>}
      <RequiredDocs docStatus={docStatus} onChange={(id, s) => set({ docStatus: { ...docStatus, [id]: s } })} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{docIds.map((x) => {
        const gen = !!docs[x]; const pc = pctOf(x)
        return (
          <article key={x} className={`card flex flex-col gap-2 !p-4 transition ${sel === x ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between gap-2"><h3 className="font-semibold leading-snug flex items-start gap-2"><Icon name="documents" size={18} className="mt-0.5 text-primary" />{docTitle(x)}</h3><span className={`chip shrink-0 ${gen ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line'}`}>{gen ? t('docs.draftMade') : t('docs.notMade')}</span></div>
            <p className="text-sm text-muted">{docDesc(x)}</p>
            {(() => {
              const rel = DOC_RISK[x].map((id) => risks.find((r) => r.id === id)).filter((r) => !!r)
              const relActs = actions.filter((a) => DOC_RISK[x].includes(a.riskId))
              const open = relActs.find((a) => a.status !== 'done')
              return (
                <div className="text-xs rounded-lg bg-surface2 border border-line px-2.5 py-2 space-y-1">
                  {rel.length ? <p className="flex flex-wrap items-center gap-1.5"><b>{t('docs.relRisk')}:</b> {rel[0]!.category} <StatusBadge level={rel[0]!.level} /></p> : <p className="text-muted">{t('docs.relNone')}</p>}
                  {relActs.length > 0 && <p><b>{t('docs.relAction')}:</b> {open ? open.title : t('docs.relAllDone')}{open && <button className="text-primary underline ml-1.5 inline-flex items-center min-h-[24px]" onClick={() => go('roadmap')}>{t('docs.relOpen')}</button>}</p>}
                </div>)
            })()}
            {gen && docStamp[x] !== undefined && docStamp[x] !== fp && <p className="text-xs text-warn-fg flex items-center gap-1.5"><Icon name="alert" size={14} />{t('docs.stale')}</p>}
            <div className="flex gap-1.5 items-center" role="group" aria-label={t('docs.langLabel')}>
              {MULTI_LANG.includes(x) ? LANGS.map((l) => <button key={l.id} aria-pressed={langOf(x) === l.id} onClick={() => setGenLang({ ...genLang, [x]: l.id })} className={`px-2.5 py-1 rounded-md border text-xs min-h-[32px] transition ${langOf(x) === l.id ? 'bg-primary text-onprimary border-primary' : 'border-control hover:bg-surface3'}`}>{l.short}</button>) : <span className="chip bg-surface2 border-control text-muted">{LANGS.find((l) => l.id === (gen ? docLang[x] ?? lang : lang))!.short}</span>}
            </div>
            {pc !== null && <div><div className="flex justify-between text-xs text-muted"><span>{t('docs.complete')}</span><span>{pc}%</span></div><div className="h-2 rounded bg-surface3 overflow-hidden"><div className="h-2 bg-primary transition-all duration-500" style={{ width: pc + '%' }} /></div></div>}
            <div className="flex flex-wrap gap-2 mt-auto pt-1">
              <button className="btn-primary !py-1.5 !min-h-[40px] text-sm" disabled={busy === x} onClick={() => create(x)}>{busy === x ? t('docs.busy') : gen ? (MULTI_LANG.includes(x) ? t('docs.otherLang') : t('c.recreate')) : t('c.create')}</button>
              <button className="btn-ghost !py-1.5 !min-h-[40px] text-sm" disabled={!gen} onClick={() => setSel(x)}>{t('c.view')}</button>
              <button className="btn-ghost !py-1.5 !min-h-[40px] text-sm" disabled={!gen} onClick={() => setSel(x)}>{t('c.verifyBtn')}</button>
              <button className="btn-ghost !py-1.5 !min-h-[40px] text-sm" onClick={() => go(DOC_EDIT[x])}>{t('c.edit')}</button>
              <button className="btn-ghost !py-1.5 !min-h-[40px] text-sm" disabled={!gen} onClick={() => download(x)}>{t('c.download')}</button>
            </div>
          </article>)
      })}</div>
      <section className="card" aria-live="polite" aria-label={t('docs.preview')}>
        <h2 className="h2 mb-2">{t('docs.preview')}</h2>
        {!sel || !cur ? <p className="text-sm text-muted">{t('docs.previewEmpty')}</p> : (
          <div className="grid lg:grid-cols-[280px_1fr] gap-4">
            <div><h3 className="font-semibold text-sm mb-2">{cur.title}</h3>
              {items(sel).length ? <ul className="space-y-1 text-sm">{items(sel).map((i) => <li key={i.label} className="flex gap-2 items-start"><Icon name={i.done ? 'ok' : 'alert'} size={16} className={`mt-0.5 ${i.done ? 'text-ok-fg' : 'text-warn-fg'}`} />{i.label}</li>)}</ul> : <p className="text-sm text-muted">{t('docs.auto')}</p>}
              <p className="text-xs text-muted mt-3">{t('draft.note')}</p></div>
            <pre lang={LANGS.find((l) => l.id === langOf(sel))!.html} className="whitespace-pre-wrap text-sm bg-surface2 border border-line rounded-lg p-4 font-sans max-h-[60vh] overflow-auto">{cur.text}</pre>
          </div>)}
      </section>
      <Disclaimer />
    </div>
  )
}

/* ================= MONITORING ================= */
export function MonitoringPage() {
  const { t } = useI18n()
  const { profile, alerts, extraAlerts, regChanged, set, log } = useStore()
  if (!profile) return <div><PageHead title={t('mon.title')} /><EmptyState /></div>
  const simulate = () => {
    const a: AlertItem = { id: 'sim' + Date.now(), titleKey: 'alert.sim.title', when: new Date().toISOString(), country: 'CN', topicKey: 'alert.a1.topic', sourceId: 'cn-neglist-next', impactKey: 'alert.sim.impact', nextKey: 'alert.sim.next', isSample: true, severity: 'NEEDS_REVIEW' }
    set({ extraAlerts: [a, ...extraAlerts], regChanged: true }); log('hist.regsim')
  }
  return (
    <div className="space-y-5">
      <PageHead title={t('mon.title')} sub={t('mon.sub')}><button className="btn-primary" onClick={simulate}>{t('mon.simulate')}</button></PageHead>
      <Warn tone="info"><b>{t('mon.status')}</b> · {t('mon.note')}</Warn>
      {alerts.length === 0 ? <div className="card"><Ok>{t('mon.none')}</Ok></div> : <div className="grid lg:grid-cols-2 gap-4">{alerts.map((a) => <AlertCard key={a.id} a={a} profileName={dv(profile.companyName)} />)}</div>}
      {regChanged && <Warn>{t('mon.changed')} <button className="underline" onClick={() => go('admin')}>{t('mon.toAdmin')}</button></Warn>}
      <Disclaimer />
    </div>
  )
}

/* ================= SOURCES / ADMIN ================= */
function useRegs() {
  const { regChanged } = useStore()
  return [...regulations.map((r) => (regChanged && r.id === 'cn-neglist-2024' ? { ...r, supersededBy: simulatedReplacement.id } : r)), ...(regChanged ? [simulatedReplacement] : [])]
}
function Filters({ c, setC, q, setQ }: { c: string; setC: (v: string) => void; q: string; setQ: (v: string) => void }) {
  const { t } = useI18n()
  return (
    <div className="flex gap-2 flex-wrap mb-3"><label className="sr-only" htmlFor="sq">{t('src.search')}</label>
      <div className="relative w-full max-w-xs"><Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" /><input id="sq" className="input !pl-9" placeholder={t('src.search')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <label className="sr-only" htmlFor="sc">{t('c.country')}</label><select id="sc" className="input max-w-[170px]" value={c} onChange={(e) => setC(e.target.value)}><option value="ALL">{t('src.allCountries')}</option><option value="TH">{tk('country', 'TH')}</option><option value="CN">{tk('country', 'CN')}</option></select></div>
  )
}
export function SourcesPage() {
  const { t } = useI18n()
  const [c, setC] = useState('ALL')
  const [q, setQ] = useState('')
  const list = useRegs().filter((r) => (c === 'ALL' || r.country === c) && (regText(r.id, 'title') + regText(r.id, 'auth') + regText(r.id, 'topic')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-5"><PageHead title={t('src.title')} sub={t('src.sub')} />
      <Warn>{t('src.warn', { v: regulations.filter((r) => r.trust === 'VERIFIED').length, n: regulations.length })}</Warn>
      <div className="card"><Filters c={c} setC={setC} q={q} setQ={setQ} />
        {list.length === 0 ? <p className="text-muted">{t('c.noData')}</p> : <div className="grid md:grid-cols-2 gap-3">{list.map((r) => <div key={r.id}><div className="text-xs font-semibold text-muted mb-1">{regText(r.id, 'topic')}</div><SourceCard id={r.id} /></div>)}</div>}</div>
      <Disclaimer /></div>
  )
}
/** A document a lawyer can fill in: every record's summary in TH/ZH/EN plus blanks for link, articles, effective date, corrections and sign-off. */
function downloadPack(lang: Lang) {
  const T = (k: string) => tk('adm', k)
  const lines = [T('pack.title'), BRAND.title, '', T('pack.intro'), '']
  for (const r of regulations) {
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━', `[${r.id}] ${tk('country', r.country)} — ${r.instrument ?? r.originalTerm ?? ''}`)
    for (const l of ['th', 'zh', 'en'] as const) lines.push(`${l.toUpperCase()}: ${regText(r.id, 'title', l)}`, `    ${regText(r.id, 'rule', l)}`)
    lines.push('', `${T('pack.link')}: ______________________________`, `${T('pack.articles')}: ____________   ${T('pack.effective')}: ____________`, `${T('pack.ok')} ______________________________`, `${T('pack.by')}: ______________________________`, '')
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━', T('pack.gaps'), ...coverageGaps.map((g) => `- [${g.id}] ${tk('country', g.country)} — ${g.instrument}`))
  const url = URL.createObjectURL(new Blob([docToHtml(T('pack.title'), lines.join('\n'), lang)], { type: 'text/html;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `call-legal-review-pack-${lang}.html`; a.click(); URL.revokeObjectURL(url)
}
export function AdminPage() {
  const { t, lang } = useI18n()
  const { regChanged, set } = useStore()
  const reason = useReasonText()
  const [c, setC] = useState('ALL')
  const [q, setQ] = useState('')
  const sum = trustSummary()
  const list = useRegs().filter((r) => (c === 'ALL' || r.country === c) && (regText(r.id, 'title') + regText(r.id, 'auth') + regText(r.id, 'topic')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-5"><PageHead title={t('adm.title')} sub={t('adm.sub')}><button className="btn-ghost" onClick={() => set({ regChanged: !regChanged })}>{regChanged ? t('adm.undo') : t('adm.sim')}</button></PageHead>
      <Warn tone="info">{t('adm.note')}</Warn>
      <p className="text-sm font-semibold" role="status">{t('adm.sum', { v: sum.verified, u: sum.unverified, s: sum.needsReview, g: sum.gaps })}</p>
      <div className="card"><Filters c={c} setC={setC} q={q} setQ={setQ} />
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[820px]"><thead><tr className="bg-surface3 text-left"><th className="p-2">{t('c.country')}</th><th className="p-2">{t('c.authority')}</th><th className="p-2">{t('src.record')}</th><th className="p-2">{t('adm.col.review')}</th><th className="p-2">{t('adm.col.monitor')}</th><th className="p-2">{t('c.status')}</th><th className="p-2">{t('adm.col.why')}</th></tr></thead><tbody>
          {list.map((r) => <tr key={r.id} className="border-b border-line align-top"><td className="p-2"><span className="inline-flex items-center gap-1.5"><CountryBadge c={r.country} />{tk('country', r.country)}</span></td><td className="p-2">{regText(r.id, 'auth')}<div className="text-xs text-muted">{regText(r.id, 'topic')}</div></td>
            <td className="p-2"><span className="text-muted">{regText(r.id, 'title')}</span><br /><ExtLink href={r.sourceUrl}>{r.textUrl ? t('cite.textLink') : t('cite.agencyOnly')}</ExtLink></td>
            <td className="p-2 text-xs">{r.reviewedBy ? `${r.reviewedBy} · ${r.lastVerified}` : lastVerifiedText(r)}</td><td className="p-2 text-xs">{r.monitored ? t('cite.monitored') : t('cite.notMonitored')}</td>
            <td className="p-2 space-y-1"><VerifyBadge v={r.verificationStatus} />{r.supersededBy && <div className="text-xs text-danger-fg">{t('reg.outdated')}</div>}</td><td className="p-2 text-xs text-muted">{r.trust === 'VERIFIED' ? '-' : reason(r.trustReasons)}</td></tr>)}</tbody></table></div></div>
      <section className="card space-y-2" aria-labelledby="gaps-h"><h2 id="gaps-h" className="h2">{t('adm.gaps.t')}</h2><p className="text-sm text-muted">{t('adm.gaps.d')}</p>
        <ul className="text-sm space-y-1">{coverageGaps.map((g) => <li key={g.id} className="flex flex-wrap items-center gap-2"><CountryBadge c={g.country} /><span lang={g.country === 'CN' ? 'zh' : 'th'}>{g.instrument}</span><VerifyBadge v={g.verificationStatus} /></li>)}</ul></section>
      <section className="card space-y-2" aria-labelledby="pack-h"><h2 id="pack-h" className="h2">{t('adm.pack')}</h2><p className="text-sm text-muted">{t('adm.pack.d')}</p>
        <button className="btn-primary" onClick={() => downloadPack(lang)}><Icon name="documents" size={16} />{t('adm.pack')}</button></section>
      <section className="card space-y-2" aria-labelledby="how-h"><h2 id="how-h" className="h2">{t('adm.how.t')}</h2>
        <ol className="list-decimal ml-5 text-sm space-y-1"><li>{t('adm.how.1')}</li><li>{t('adm.how.2')}</li><li>{t('adm.how.3')}</li><li>{t('adm.how.4')}</li></ol></section>
      <Disclaimer /></div>
  )
}
/* ================= PRICING / PRIVACY ================= */
export function PricingPage() {
  const { t } = useI18n()
  const plans: [string, string[]][] = [['free', ['1', '2']], ['pro', ['1', '2', '3']], ['business', ['1', '2', '3']], ['enterprise', ['1', '2', '3']]]
  return (
    <div className="space-y-5"><PageHead title={t('prc.title')} sub={t('prc.sub')} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{plans.map(([n, f]) => <div key={n} className="card flex flex-col"><h2 className="h2">{tk('prc', n)}</h2><div className="text-muted mb-2">{tk('prc', n + '.p')}</div><ul className="text-sm flex-1 space-y-1">{f.map((x) => <li key={x} className="flex gap-2 items-start"><Icon name="check" size={16} className="mt-0.5 text-ok-fg" />{tk('prc', `${n}.${x}`)}</li>)}</ul><p className="text-xs text-muted mt-4">{t('prc.note')}</p></div>)}</div>
      <Disclaimer /></div>
  )
}
export function PrivacyPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-5 max-w-3xl"><PageHead title={t('pri.title')} sub={t('pri.sub')} />
      <div className="card space-y-3 text-sm">{(['1', '2', '3', '4', '5'] as const).map((k) => <p key={k}><b>{tk('pri', k + '.h')}:</b> {tk('pri', k + '.t')}</p>)}</div><Disclaimer /></div>
  )
}
