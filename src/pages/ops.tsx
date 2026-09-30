import { useMemo, useState } from 'react'
import type { AlertItem, Level, RoadmapStep, StepStatus } from '../types'
import { go, useStore } from '../store'
import { ActionList, AlertCard, Checklist, Disclaimer, EmptyState, PageHead, RiskCard, RoadmapTimeline, SampleTag, SourceCard, StatusBadge, VerifyBadge, Warn, WorkflowStrip } from '../components/ui'
import { AICommandCenter, AITimeline } from '../components/ai'
import { assessRisks, buildDocument, contractKeys, contractLabel, deriveActions, detectNomineeRisk, docDesc, docIds, docTitle, docToHtml, generateContract, generateRoadmap, riskRoute, type DocType } from '../services/engines'
import { aiService } from '../services/aiService'
import { checklistItems } from '../data/demo'
import { getReg, lastVerifiedText, regText, regulations, simulatedReplacement } from '../data/regulations'
import { dirInfo, levelChip, levelOrder } from '../utils/labels'
import { dv, LANGS, tk, useI18n, type Lang } from '../i18n'

function useRoadmap() {
  const { lang } = useI18n()
  const { profile, stepOverrides } = useStore()
  return useMemo<RoadmapStep[]>(() => (profile ? generateRoadmap(profile).map((s) => ({ ...s, status: stepOverrides[s.id] ?? s.status })) : []), [profile, stepOverrides, lang])
}
function useActions() {
  const { lang } = useI18n()
  const { profile, employment, actionStatus } = useStore()
  return useMemo(() => (profile ? deriveActions(profile, employment).map((a) => ({ ...a, status: actionStatus[a.id] ?? a.status })) : []), [profile, employment, actionStatus, lang])
}

/* ================= DASHBOARD ================= */
export function Dashboard() {
  const { t } = useI18n()
  const { profile, employment, checks, docs, alerts, history, actionStatus, set, startDemo } = useStore()
  const steps = useRoadmap()
  const actions = useActions()
  if (!profile) return <div><PageHead title={t('dash.title')} /><EmptyState /></div>
  const risks = assessRisks(profile, employment)
  const d = dirInfo(profile.direction)
  const nom = detectNomineeRisk(profile)
  const total = steps.length + actions.length + checklistItems.length
  const done = steps.filter((s) => s.status === 'done').length + actions.filter((a) => a.status === 'done').length + checklistItems.filter((c) => checks[c.id]).length
  const pending = actions.filter((a) => a.status !== 'done')
  const reviewCount = risks.filter((r) => r.level === 'NEEDS_REVIEW').length
  const highCount = risks.filter((r) => r.level === 'HIGH').length
  const pct = Math.round((done / total) * 100)
  const next = pending.find((a) => a.riskId === 'nominee') ?? pending[0]
  const top = [...risks].sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level)).slice(0, 3)
  const setAct = (id: string, s: StepStatus) => set({ actionStatus: { ...actionStatus, [id]: s } })
  return (
    <div className="space-y-5">
      <PageHead title={t('dash.title')} sub={t('dash.sub')}><button className="btn-ghost" onClick={() => startDemo()}>{t('dash.resetDemo')}</button></PageHead>
      <WorkflowStrip active={3} />
      <div className="grid lg:grid-cols-5 gap-4">
        <section className="card lg:col-span-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted">{t('dash.myBusiness')}</span>{profile.isDemo && <SampleTag text={t('c.demoTag')} />}</div>
          <div><div className="text-2xl font-bold break-words">{dv(profile.companyName)}</div><div className="text-sm text-muted">{d.fromFlag} {tk('country', d.from)} → {d.toFlag} {tk('country', d.to)} · <span className="text-primary font-semibold">{t('dash.analyzing')}</span></div></div>
          <div><div className="flex justify-between text-sm font-semibold"><span>{t('dash.progress')}</span><span>{done} / {total}</span></div>
            <div className="h-3 bg-surface3 rounded-full mt-1 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('dash.progress')}><div className="h-3 bg-primary transition-all duration-700" style={{ width: pct + '%' }} /></div>
            <p className="text-xs text-muted mt-1">{t('dash.progressNote')}</p></div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card-i"><div className="text-2xl font-bold text-ok-fg">{done}</div><div className="text-xs text-muted">{t('dash.done')}</div></div>
            <div className="card-i"><div className="text-2xl font-bold text-review-fg">{reviewCount}</div><div className="text-xs text-muted">{t('dash.review')}</div></div>
            <div className="card-i"><div className="text-2xl font-bold text-danger-fg">{highCount}</div><div className="text-xs text-muted">{t('dash.key')}</div></div>
          </div>
        </section>
        <section className="lg:col-span-2 rounded-2xl bg-primary text-onprimary p-5 flex flex-col gap-3 shadow-md" aria-labelledby="nxt-h">
          <div id="nxt-h" className="text-xs font-bold tracking-wide opacity-80">🤖 {t('dash.nextTitle')}</div>
          <p className="text-lg font-semibold leading-snug flex-1">{next ? next.title : t('dash.nextNone')}</p>
          {next && <div className="text-xs opacity-80">{t('c.fromRisk')}: {next.riskLabel} · {t('c.owner')}: {next.owner}</div>}
          {next && <button className="btn bg-surface text-ink hover:opacity-90" onClick={() => go(riskRoute(next.riskId))}>{t('dash.nextGo')}</button>}
        </section>
      </div>
      {nom.stop && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('dash.stopText')} <button className="underline font-semibold ml-1" onClick={() => go('nominee')}>{t('dash.seeDetails')}</button></Warn>}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><AICommandCenter profile={profile} /></div>
        <section className="card"><h2 className="h2 mb-3">{t('tl.title')}</h2><AITimeline p={profile} emp={employment} /></section>
      </div>
      <section><div className="flex justify-between items-center mb-2"><h2 className="h2">{t('dash.topRisks')}</h2><button className="btn-ghost !py-1.5" onClick={() => go('risk')}>{t('dash.seeAll')}</button></div>
        <div className="grid lg:grid-cols-3 gap-3">{top.map((r) => <RiskCard key={r.id} r={r} compact actions={actions.filter((a) => a.riskId === r.id)} onAction={setAct} />)}</div></section>
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="card"><h2 className="h2 mb-2">{t('dash.pending')}</h2>{pending.length ? <ul className="space-y-2 text-sm">{pending.slice(0, 4).map((a) => <li key={a.id}><b>{a.title}</b><br /><span className="text-muted text-xs">{t('c.fromRisk')}: {a.riskLabel} · {t('c.owner')}: {a.owner}</span></li>)}</ul> : <p className="text-sm text-ok-fg">✓ {t('act.none')}</p>}<button className="btn-ghost mt-3 !py-1.5" onClick={() => go('roadmap')}>{t('dash.openRoadmap')}</button></section>
        <section className="card"><h2 className="h2 mb-2">{t('nav.documents')}</h2><p className="text-sm">{t('dash.docsCount', { n: Object.values(docs).filter(Boolean).length, total: docIds.length })}</p><button className="btn-ghost mt-3 !py-1.5" onClick={() => go('documents')}>{t('dash.toDocs')}</button>
          <h2 className="h2 mt-4 mb-1">{t('dash.alerts')}</h2><p className="text-sm">{t('dash.alertsCount', { n: alerts.length })} <SampleTag text={t('alert.tag')} /></p><button className="btn-ghost mt-2 !py-1.5" onClick={() => go('monitoring')}>{t('dash.toMon')}</button></section>
        <section className="card"><h2 className="h2 mb-2">{t('dash.recent')}</h2>{history.length ? <ul className="text-sm space-y-1">{history.map((h, i) => <li key={i}><span className="text-muted">{h.at}</span> {t(h.key, h.vars)}</li>)}</ul> : <p className="text-sm text-muted">{t('dash.noHistory')}</p>}</section>
      </div>
      <Disclaimer />
    </div>
  )
}

/* ================= RISK BOARD (categorised — no invented likelihood/impact numbers) ================= */
export function RiskPage() {
  const { t } = useI18n()
  const { profile, employment, actionStatus, set } = useStore()
  const actions = useActions()
  if (!profile) return <div><PageHead title={t('risk.title')} /><EmptyState /></div>
  const risks = assessRisks(profile, employment)
  const setAct = (id: string, s: StepStatus) => set({ actionStatus: { ...actionStatus, [id]: s } })
  return (
    <div className="space-y-5">
      <PageHead title={t('risk.title')} sub={t('risk.sub')} />
      <WorkflowStrip active={3} />
      <Warn tone="info">{t('risk.boardNote')}</Warn>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {levelOrder.map((l) => {
          const list = risks.filter((r) => r.level === l)
          return (
            <section key={l} aria-label={tk('level', l)} className="space-y-3">
              <div className={`flex items-center justify-between rounded-xl border px-3 py-2 ${levelChip[l]}`}><span className="font-semibold text-sm">{tk('lvl', l)}</span><span className="font-bold">{list.length}</span></div>
              {list.length ? list.map((r) => <RiskCard key={r.id} r={r} compact actions={actions.filter((a) => a.riskId === r.id)} onAction={setAct} />) : <div className="card-i text-sm text-muted text-center">{t('risk.none')}</div>}
            </section>)
        })}
      </div>
      <Disclaimer />
    </div>
  )
}

/* ================= ROADMAP ================= */
export function RoadmapPage() {
  const { t } = useI18n()
  const { profile, stepOverrides, actionStatus, checks, set } = useStore()
  const steps = useRoadmap()
  const actions = useActions()
  const [lockMsg, setLockMsg] = useState('')
  if (!profile) return <div><PageHead title={t('rm.title')} /><EmptyState /></div>
  const stop = detectNomineeRisk(profile).stop
  const done = steps.filter((s) => s.status === 'done').length
  return (
    <div className="space-y-5">
      <PageHead title={t('rm.title')} sub={t('rm.sub')} />
      <WorkflowStrip active={4} />
      <p className="text-sm">{t('rm.progress', { n: done, total: steps.length })}</p>
      {lockMsg && <Warn tone="danger">{lockMsg}</Warn>}
      {stop && <Warn tone="danger"><b>{t('nom.stopBanner')}</b> — {t('rm.lockText')}</Warn>}
      <RoadmapTimeline steps={steps} onStatus={(id, s: StepStatus) => {
        if (stop && id >= 7 && (s === 'doing' || s === 'done')) { setLockMsg(t('rm.locked', { n: id })); return }
        setLockMsg(''); set({ stepOverrides: { ...stepOverrides, [id]: s } })
      }} />
      <div className="card"><h2 className="h2 mb-1">{t('rm.actionsT')}</h2><p className="text-sm text-muted mb-3">{t('rm.actionsD')}</p>
        <ActionList actions={actions} onStatus={(id, s) => set({ actionStatus: { ...actionStatus, [id]: s } })} /></div>
      <div className="card"><h2 className="h2 mb-2">{t('rm.checklist')}</h2><Checklist done={checks} onToggle={(id) => set({ checks: { ...checks, [id]: !checks[id] } })} /></div>
      <Disclaimer />
    </div>
  )
}

/* ================= DOCUMENTS ================= */
const DOC_EDIT: Record<DocType, string> = { business: 'roadmap', ownership: 'ownership', employment: 'employment', contract: 'contract', report: 'risk', translation: 'language', plan: 'roadmap' }
const MULTI_LANG: DocType[] = ['contract', 'translation']
export function DocumentsPage() {
  const { t, lang } = useI18n()
  const { profile, employment, contract, docs, docLang, checks, set, log } = useStore()
  const [sel, setSel] = useState<DocType | null>(null)
  const [genLang, setGenLang] = useState<Partial<Record<DocType, Lang>>>({})
  const [busy, setBusy] = useState<DocType | null>(null)
  const [err, setErr] = useState('')
  const [cache, setCache] = useState<Record<string, { title: string; text: string; lang: Lang }>>({})
  if (!profile) return <div><PageHead title={t('docs.title')} /><EmptyState /></div>
  const langOf = (x: DocType): Lang => (MULTI_LANG.includes(x) ? genLang[x] ?? docLang[x] ?? lang : docLang[x] ?? lang)
  const key = (x: DocType, l: Lang) => `${x}|${l}`
  const get = (x: DocType, l: Lang) => cache[key(x, l)] ?? buildDocument(x, profile, employment, contract, l)
  const create = async (x: DocType) => {
    const l = MULTI_LANG.includes(x) ? langOf(x) : lang
    setBusy(x); setErr('')
    try { const r = await aiService.generateDocument(x, profile, employment, contract, l); setCache((c) => ({ ...c, [key(x, l)]: r })); set({ docs: { ...docs, [x]: true }, docLang: { ...docLang, [x]: l } }); log('hist.doc', { title: r.title }); setSel(x) } catch { setErr(t('err.generic')) }
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
      <WorkflowStrip active={5} />
      {err && <Warn tone="danger">{err}</Warn>}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{docIds.map((x) => {
        const gen = !!docs[x]; const pc = pctOf(x)
        return (
          <article key={x} className={`card flex flex-col gap-2 !p-4 transition ${sel === x ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex items-start justify-between gap-2"><h3 className="font-semibold leading-snug">{docTitle(x)}</h3><span className={`chip ${gen ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface3 text-muted border-line'}`}>{gen ? t('docs.draftMade') : t('docs.notMade')}</span></div>
            <p className="text-sm text-muted">{docDesc(x)}</p>
            <div className="flex flex-wrap gap-1.5 items-center text-xs text-muted"><span className="chip bg-surface2 border-line text-muted">{dv(profile.companyName)}</span><span className="chip bg-surface2 border-line text-muted">{tk('docs.wf', x)}</span></div>
            <div className="flex gap-1.5 items-center" role="group" aria-label={t('docs.langLabel')}>
              {MULTI_LANG.includes(x) ? LANGS.map((l) => <button key={l.id} aria-pressed={langOf(x) === l.id} onClick={() => setGenLang({ ...genLang, [x]: l.id })} className={`px-2.5 py-1 rounded-lg border text-xs min-h-[32px] transition ${langOf(x) === l.id ? 'bg-primary text-onprimary border-primary' : 'border-line hover:bg-surface3'}`}>{l.flag} {l.id.toUpperCase()}</button>) : <span className="chip bg-surface2 border-line text-muted">{LANGS.find((l) => l.id === (gen ? docLang[x] ?? lang : lang))!.flag} {(gen ? docLang[x] ?? lang : lang).toUpperCase()}</span>}
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
              {items(sel).length ? <ul className="space-y-1 text-sm">{items(sel).map((i) => <li key={i.label} className="flex gap-2"><span className={i.done ? 'text-ok-fg' : 'text-warn-fg'} aria-hidden>{i.done ? '✓' : '⚠'}</span>{i.label}</li>)}</ul> : <p className="text-sm text-muted">{t('docs.auto')}</p>}
              <p className="text-xs text-muted mt-3">{t('draft.note')}</p></div>
            <pre lang={LANGS.find((l) => l.id === langOf(sel))!.html} className="whitespace-pre-wrap text-sm bg-surface2 border border-line rounded-xl p-4 font-sans max-h-[60vh] overflow-auto">{cur.text}</pre>
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
    const a: AlertItem = { id: 'sim' + Date.now(), titleKey: 'alert.sim.title', when: new Date().toLocaleString(), country: 'CN', topicKey: 'alert.a1.topic', sourceId: 'cn-neglist-next', impactKey: 'alert.sim.impact', nextKey: 'alert.sim.next', isSample: true, severity: 'NEEDS_REVIEW' }
    set({ extraAlerts: [a, ...extraAlerts], regChanged: true }); log('hist.regsim')
  }
  return (
    <div className="space-y-5">
      <PageHead title={t('mon.title')} sub={t('mon.sub')}><button className="btn-primary" onClick={simulate}>{t('mon.simulate')}</button></PageHead>
      <WorkflowStrip active={6} />
      <Warn tone="info"><b>{t('mon.status')}</b> · {t('mon.note')}</Warn>
      {alerts.length === 0 ? <div className="card">✓ {t('mon.none')}</div> : <div className="grid lg:grid-cols-2 gap-4">{alerts.map((a) => <AlertCard key={a.id} a={a} profileName={dv(profile.companyName)} />)}</div>}
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
    <div className="flex gap-2 flex-wrap mb-3"><label className="sr-only" htmlFor="sq">{t('src.search')}</label><input id="sq" className="input max-w-xs" placeholder={t('src.search')} value={q} onChange={(e) => setQ(e.target.value)} />
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
          {list.map((r) => <tr key={r.id} className="border-b border-line align-top"><td className="p-2">{r.country === 'TH' ? '🇹🇭' : '🇨🇳'} {tk('country', r.country)}</td><td className="p-2">{regText(r.id, 'auth')}</td><td className="p-2 font-medium">{regText(r.id, 'topic')}</td>
            <td className="p-2"><span className="text-muted">{regText(r.id, 'title')}</span><br /><a className="text-primary underline" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{t('c.openLink')}</a> {r.isSample && <SampleTag />}</td>
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{plans.map(([n, f]) => <div key={n} className="card flex flex-col"><h2 className="h2">{tk('prc', n)}</h2><div className="text-muted mb-2">{tk('prc', n + '.p')}</div><ul className="list-disc ml-5 text-sm flex-1">{f.map((x) => <li key={x}>{tk('prc', `${n}.${x}`)}</li>)}</ul><p className="text-xs text-muted mt-4">{t('prc.note')}</p></div>)}</div>
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
