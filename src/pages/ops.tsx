import { useMemo, useState } from 'react'
import type { AlertItem, RoadmapStep, StepStatus } from '../types'
import { fingerprint, go, useStore } from '../store'
import { ActionList, AlertCard, Checklist, Disclaimer, Disclosure, EmptyState, ExtLink, GuideStrip, Go, Ok, PageHead, RiskCard, RoadmapTimeline, SampleTag, SourceCard, StatusBadge, VerifyBadge, Warn, WorkflowStrip } from '../components/ui'
import { AICommandCenter, AITimeline } from '../components/ai'
import { CountryBadge, Icon } from '../components/icons'
import { assessRisks, buildDocument, contractKeys, contractLabel, deriveActions, detectNomineeRisk, docDesc, docIds, docTitle, docToHtml, generateRoadmap, hasCompany, riskRoute, type DocType } from '../services/engines'
import { aiService } from '../services/aiService'
import { checklistItems } from '../data/demo'
import { lastVerifiedText, regText, regulations, simulatedReplacement } from '../data/regulations'
import { dirInfo, levelChip, levelOrder } from '../utils/labels'
import { dv, LANGS, tk, useI18n, type Lang } from '../i18n'

function useRoadmap() {
  const { lang } = useI18n()
  const { profile, stepOverrides } = useStore()
  return useMemo<RoadmapStep[]>(() => (profile ? generateRoadmap(profile).map((s) => ({ ...s, status: stepOverrides[s.id] ?? s.status })) : []), [profile, stepOverrides, lang])
}
/** Current actions from the risk analysis + finished actions whose risk has since disappeared (so progress never goes backwards). */
function useActions() {
  const { lang } = useI18n()
  const { profile, employment, actionStatus, actionSnap } = useStore()
  return useMemo(() => {
    if (!profile) return []
    const live = deriveActions(profile, employment).map((a) => ({ ...a, status: actionStatus[a.id] ?? a.status }))
    const ids = new Set(live.map((a) => a.id))
    const kept = Object.entries(actionSnap).filter(([id]) => !ids.has(id) && actionStatus[id] === 'done').map(([id, s]) => ({ id, riskId: s.riskId, riskLabel: s.riskLabel, title: s.title, owner: s.owner, status: 'done' as StepStatus }))
    return [...live, ...kept]
  }, [profile, employment, actionStatus, actionSnap, lang])
}

/* ================= DASHBOARD (business · status · issues · next action · documents · AI activity) ================= */
export function Dashboard() {
  const { t } = useI18n()
  const { profile, employment, checks, docs, startDemo } = useStore()
  const steps = useRoadmap()
  const actions = useActions()
  if (!profile) return <div><PageHead title={t('dash.title')} /><EmptyState /></div>
  const risks = assessRisks(profile, employment)
  const d = dirInfo(profile.direction)
  const nom = detectNomineeRisk(profile)
  const total = steps.length + actions.length + checklistItems.length
  const done = steps.filter((s) => s.status === 'done').length + actions.filter((a) => a.status === 'done').length + checklistItems.filter((c) => checks[c.id]).length
  const pending = actions.filter((a) => a.status !== 'done')
  const pct = Math.round((done / total) * 100)
  const next = pending.find((a) => a.riskId === 'nominee') ?? pending[0]
  const issues = [...risks].filter((r) => r.level !== 'LOW').sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)).slice(0, 3)
  const status = nom.stop ? t('dash.status.stop') : pending.length ? t('dash.status.fix') : t('dash.status.ok')
  const needed: DocType[] = ['business', ...(hasCompany(profile) ? (['ownership'] as DocType[]) : []), ...(profile.employees > 0 || profile.crossBorderWorkers ? (['employment', 'contract'] as DocType[]) : []), 'report', 'plan']
  return (
    <div className="space-y-5">
      <PageHead title={t('dash.title')} sub={t('dash.sub')}><button className="btn-ghost" onClick={() => startDemo()}>{t('dash.resetDemo')}</button></PageHead>
      <div className="grid lg:grid-cols-5 gap-4">
        <section className="card lg:col-span-3 space-y-4" aria-labelledby="biz-h">
          <div>
            <div id="biz-h" className="text-xs text-muted flex items-center gap-2 flex-wrap">{t('dash.business')}{profile.isDemo && <SampleTag text={t('c.demoTag')} />}</div>
            <div className="text-2xl font-semibold break-words">{dv(profile.companyName)}</div>
            <div className="text-sm text-muted flex items-center gap-1.5 flex-wrap mt-1"><CountryBadge c={d.from} />{tk('country', d.from)}<Icon name="next" size={14} /><CountryBadge c={d.to} />{tk('country', d.to)}</div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg bg-surface2 border border-line px-3 py-2.5">
            <Icon name={nom.stop ? 'warn' : 'info'} className={nom.stop ? 'text-danger-fg mt-0.5' : 'text-info-fg mt-0.5'} />
            <div><div className="text-xs text-muted">{t('dash.status')}</div><div className="font-semibold">{status}</div></div>
          </div>
          <div><div className="flex justify-between text-sm"><span className="text-muted">{t('dash.progress')}</span><span className="font-semibold">{done} / {total}</span></div>
            <div className="h-2.5 bg-surface3 rounded-full mt-1.5 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('dash.progress')}><div className="h-2.5 bg-primary transition-all duration-700" style={{ width: pct + '%' }} /></div>
            <p className="text-xs text-muted mt-1.5">{t('dash.progressNote')}</p></div>
        </section>
        <section className="lg:col-span-2 rounded-xl bg-primary text-onprimary p-5 flex flex-col gap-3 shadow-md" aria-labelledby="nxt-h">
          <div id="nxt-h" className="text-xs font-semibold opacity-80 flex items-center gap-1.5"><Icon name="ai" size={15} />{t('dash.nextTitle')}</div>
          <p className="text-lg font-semibold leading-snug flex-1">{next ? next.title : t('dash.nextNone')}</p>
          {next && <div className="text-xs opacity-80">{t('c.fromRisk')}: {next.riskLabel} · {t('c.owner')}: {next.owner}</div>}
          {next && <button className="btn bg-surface text-ink hover:opacity-90" onClick={() => go(riskRoute(next.riskId))}><Go>{t('dash.nextGo')}</Go></button>}
        </section>
      </div>
      {nom.stop && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('dash.stopText')} <button className="underline font-semibold ml-1" onClick={() => go('nominee')}>{t('dash.seeDetails')}</button></Warn>}
      <AICommandCenter profile={profile} />
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="card" aria-labelledby="iss-h"><h2 id="iss-h" className="h2 mb-3">{t('dash.issues')}</h2>
          {issues.length ? <ul className="space-y-2">{issues.map((r) => (
            <li key={r.id}><button className="w-full text-left card-i hover:bg-surface3 transition flex flex-col gap-1" onClick={() => go('risk')}>
              <span className="flex items-center justify-between gap-2 flex-wrap"><span className="font-medium text-sm">{r.category}</span><StatusBadge level={r.level} /></span>
              <span className="text-xs text-muted line-clamp-2">{r.why}</span></button></li>))}</ul> : <p className="text-sm text-ok-fg"><Ok>{t('dash.noIssues')}</Ok></p>}
          <button className="btn-ghost mt-3 !min-h-[40px] text-sm" onClick={() => go('risk')}><Go>{t('dash.seeAll')}</Go></button></section>
        <section className="card" aria-labelledby="doc-h"><h2 id="doc-h" className="h2">{t('dash.docsNeeded')}</h2><p className="text-xs text-muted mb-3">{t('dash.docsSub')}</p>
          <ul className="space-y-2">{needed.map((x) => (
            <li key={x} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 min-w-0"><Icon name="documents" size={16} className="text-muted" /><span className="truncate">{docTitle(x)}</span></span>
              <span className={`chip shrink-0 ${docs[x] ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line'}`}>{docs[x] ? t('dash.docMade') : t('dash.docTodo')}</span></li>))}</ul>
          <button className="btn-ghost mt-3 !min-h-[40px] text-sm" onClick={() => go('documents')}><Go>{t('dash.toDocs')}</Go></button></section>
        <section className="card" aria-labelledby="act-h"><h2 id="act-h" className="h2 mb-3">{t('tl.title')}</h2><AITimeline p={profile} emp={employment} /></section>
      </div>
      <Disclaimer />
    </div>
  )
}

/* ================= RISK (found → why it matters → what to verify → next action) ================= */
export function RiskPage() {
  const { t } = useI18n()
  const { profile, employment, setActionStatus } = useStore()
  const actions = useActions()
  if (!profile) return <div><PageHead title={t('risk.title')} /><EmptyState /></div>
  const risks = assessRisks(profile, employment)
  const setAct = (id: string, s: StepStatus) => { const a = actions.find((x) => x.id === id); if (a) setActionStatus(a, s) }
  return (
    <div className="space-y-5">
      <PageHead title={t('risk.title')} sub={t('risk.sub')} />
      <GuideStrip page="risk" nextRoute="roadmap" />
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {levelOrder.map((l) => {
          const list = risks.filter((r) => r.level === l)
          return (
            <section key={l} aria-label={tk('level', l)} className="space-y-3">
              <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${levelChip[l]}`}><span className="font-semibold text-sm">{tk('lvl', l)}</span><span className="font-semibold">{list.length}</span></div>
              {list.length ? list.map((r) => <RiskCard key={r.id} r={r} compact actions={actions.filter((a) => a.riskId === r.id)} onAction={setAct} />) : <div className="card-i text-sm text-muted text-center">{t('risk.none')}</div>}
            </section>)
        })}
      </div>
      <p className="text-xs text-muted">{t('risk.boardNote')}</p>
      <Disclaimer />
    </div>
  )
}

/* ================= ROADMAP ================= */
export function RoadmapPage() {
  const { t } = useI18n()
  const { profile, stepOverrides, setActionStatus, checks, set } = useStore()
  const steps = useRoadmap()
  const actions = useActions()
  const [lockMsg, setLockMsg] = useState('')
  if (!profile) return <div><PageHead title={t('rm.title')} /><EmptyState /></div>
  const stop = detectNomineeRisk(profile).stop
  const done = steps.filter((s) => s.status === 'done').length
  return (
    <div className="space-y-5">
      <PageHead title={t('rm.title')} sub={t('rm.sub')} />
      <GuideStrip page="roadmap" nextRoute="documents" />
      <p className="text-sm text-muted">{t('rm.progress', { n: done, total: steps.length })}</p>
      {lockMsg && <Warn tone="danger">{lockMsg}</Warn>}
      {stop && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('rm.lockText')}</Warn>}
      <RoadmapTimeline steps={steps} onStatus={(id, s: StepStatus) => {
        if (stop && id >= 7 && (s === 'doing' || s === 'done')) { setLockMsg(t('rm.locked', { n: id })); return }
        setLockMsg(''); set({ stepOverrides: { ...stepOverrides, [id]: s } })
      }} />
      <div className="card"><h2 className="h2 mb-1">{t('rm.actionsT')}</h2><p className="text-sm text-muted mb-3">{t('rm.actionsD')}</p>
        <ActionList actions={actions} onStatus={(id, s) => { const a = actions.find((x) => x.id === id); if (a) setActionStatus(a, s) }} /></div>
      <Disclosure title={t('rm.checklist')}><Checklist done={checks} onToggle={(id) => set({ checks: { ...checks, [id]: !checks[id] } })} /></Disclosure>
      <Disclaimer />
    </div>
  )
}

/* ================= DOCUMENTS ================= */
const DOC_EDIT: Record<DocType, string> = { business: 'roadmap', ownership: 'ownership', employment: 'employment', contract: 'contract', report: 'risk', translation: 'language', plan: 'roadmap' }
const MULTI_LANG: DocType[] = ['contract', 'translation']
export function DocumentsPage() {
  const { t, lang } = useI18n()
  const { profile, employment, contract, docs, docLang, docStamp, checks, set, log } = useStore()
  const [sel, setSel] = useState<DocType | null>(null)
  const [genLang, setGenLang] = useState<Partial<Record<DocType, Lang>>>({})
  const [busy, setBusy] = useState<DocType | null>(null)
  const [err, setErr] = useState('')
  const [cache, setCache] = useState<Record<string, { title: string; text: string; lang: Lang }>>({})
  if (!profile) return <div><PageHead title={t('docs.title')} /><EmptyState /></div>
  const fp = fingerprint(profile, employment, contract)
  const langOf = (x: DocType): Lang => (MULTI_LANG.includes(x) ? genLang[x] ?? docLang[x] ?? lang : docLang[x] ?? lang)
  const key = (x: DocType, l: Lang) => `${x}|${l}`
  const get = (x: DocType, l: Lang) => cache[key(x, l)] ?? buildDocument(x, profile, employment, contract, l)
  const create = async (x: DocType) => {
    const l = MULTI_LANG.includes(x) ? langOf(x) : lang
    setBusy(x); setErr('')
    try { const r = await aiService.generateDocument(x, profile, employment, contract, l); setCache((c) => ({ ...c, [key(x, l)]: r })); set({ docs: { ...docs, [x]: true }, docLang: { ...docLang, [x]: l }, docStamp: { ...docStamp, [x]: fp } }); log('hist.doc', { title: r.title }); setSel(x) } catch { setErr(t('err.generic')) }
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
  return (
    <div className="space-y-5">
      <PageHead title={t('docs.title')} sub={t('docs.sub')} />
      <GuideStrip page="documents" nextRoute="dashboard" />
      {err && <Warn tone="danger">{err}</Warn>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{docIds.map((x) => {
        const gen = !!docs[x]; const pc = pctOf(x)
        return (
          <article key={x} className={`card flex flex-col gap-2 !p-4 transition ${sel === x ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between gap-2"><h3 className="font-semibold leading-snug flex items-start gap-2"><Icon name="documents" size={18} className="mt-0.5 text-primary" />{docTitle(x)}</h3><span className={`chip shrink-0 ${gen ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line'}`}>{gen ? t('docs.draftMade') : t('docs.notMade')}</span></div>
            <p className="text-sm text-muted">{docDesc(x)}</p>
            {gen && docStamp[x] !== undefined && docStamp[x] !== fp && <p className="text-xs text-warn-fg flex items-center gap-1.5"><Icon name="alert" size={14} />{t('docs.stale')}</p>}
            <div className="flex gap-1.5 items-center" role="group" aria-label={t('docs.langLabel')}>
              {MULTI_LANG.includes(x) ? LANGS.map((l) => <button key={l.id} aria-pressed={langOf(x) === l.id} onClick={() => setGenLang({ ...genLang, [x]: l.id })} className={`px-2.5 py-1 rounded-md border text-xs min-h-[32px] transition ${langOf(x) === l.id ? 'bg-primary text-onprimary border-primary' : 'border-line hover:bg-surface3'}`}>{l.short}</button>) : <span className="chip bg-surface2 border-line text-muted">{LANGS.find((l) => l.id === (gen ? docLang[x] ?? lang : lang))!.short}</span>}
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
      <Warn>{t('src.warn')}</Warn>
      <div className="card"><Filters c={c} setC={setC} q={q} setQ={setQ} />
        {list.length === 0 ? <p className="text-muted">{t('c.noData')}</p> : <div className="grid md:grid-cols-2 gap-3">{list.map((r) => <div key={r.id}><div className="text-xs font-semibold text-muted mb-1">{regText(r.id, 'topic')}</div><SourceCard id={r.id} /></div>)}</div>}</div>
      <Disclaimer /></div>
  )
}
export function AdminPage() {
  const { t } = useI18n()
  const { regChanged, set } = useStore()
  const [c, setC] = useState('ALL')
  const [q, setQ] = useState('')
  const list = useRegs().filter((r) => (c === 'ALL' || r.country === c) && (regText(r.id, 'title') + regText(r.id, 'auth') + regText(r.id, 'topic')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-5"><PageHead title={t('adm.title')} sub={t('adm.sub')}><button className="btn-ghost" onClick={() => set({ regChanged: !regChanged })}>{regChanged ? t('adm.undo') : t('adm.sim')}</button></PageHead>
      <Warn tone="info">{t('adm.note')}</Warn>
      <div className="card"><Filters c={c} setC={setC} q={q} setQ={setQ} />
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[720px]"><thead><tr className="bg-surface3 text-left"><th className="p-2">{t('c.country')}</th><th className="p-2">{t('c.authority')}</th><th className="p-2">{t('c.topic')}</th><th className="p-2">{t('src.record')}</th><th className="p-2">{t('reg.lastVerified')}</th><th className="p-2">{t('c.status')}</th></tr></thead><tbody>
          {list.map((r) => <tr key={r.id} className="border-b border-line align-top"><td className="p-2"><span className="inline-flex items-center gap-1.5"><CountryBadge c={r.country} />{tk('country', r.country)}</span></td><td className="p-2">{regText(r.id, 'auth')}</td><td className="p-2 font-medium">{regText(r.id, 'topic')}</td>
            <td className="p-2"><span className="text-muted">{regText(r.id, 'title')}</span><br /><ExtLink href={r.sourceUrl}>{t('c.openLink')}</ExtLink> {r.isSample && <SampleTag />}</td>
            <td className="p-2 text-xs">{lastVerifiedText(r)}</td><td className="p-2 space-y-1"><VerifyBadge v={r.verificationStatus} />{r.supersededBy && <div className="text-xs text-danger-fg">{t('reg.outdated')}</div>}</td></tr>)}</tbody></table></div></div>
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
