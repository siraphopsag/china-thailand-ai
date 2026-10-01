import { useState } from 'react'
import type { ContractInput, EmploymentInput } from '../types'
import { go, useStore } from '../store'
import { BackLink, Disclaimer, Disclosure, EmptyState, GuideStrip, Go, Ok, PageHead, SourceCard, StatusBadge, TabBar, VerifyBadge, Warn, ExtLink } from '../components/ui'
import { Icon } from '../components/icons'
import { analyzeEmployment, contractKeys, contractLabel, draftNote, generateContract } from '../services/engines'
import { aiService } from '../services/aiService'
import { situations, situationPoints, terms } from '../data/culture'
import { getReg, regText } from '../data/regulations'
import { dv, LANGS, tk, useI18n, type Lang } from '../i18n'

const MODES = ['hire_cn', 'hire_th', 'send_th_cn', 'send_cn_th', 'cross']
const EMP_FIELDS: [keyof EmploymentInput, string][] = [['nationality', 'nationality'], ['location', 'location'], ['duration', 'duration'], ['salary', 'salary'], ['hours', 'hours'], ['leave', 'leave'], ['socialSecurity', 'social'], ['workAuth', 'workauth'], ['tax', 'tax']]

/* ================= EMPLOYMENT CHECK ================= */
export function EmploymentPage({ openContract = false }: { openContract?: boolean }) {
  const { t } = useI18n()
  const { profile, employment, set, log } = useStore()
  if (!profile) return <div><PageHead title={t('emp.title')} /><EmptyState /></div>
  const rows = analyzeEmployment(employment, profile)
  const missing = rows.filter((r) => r.missing).length
  const up = (k: keyof EmploymentInput, v: string) => set({ employment: { ...employment, [k]: v }, analysisDone: false })
  const tc = profile.direction === 'TH_CN'
  return (
    <div className="space-y-5">
      <BackLink to="analysis" label={t('nav.backAnalysis')} />
      <PageHead title={t('emp.title')} sub={t('emp.sub')} />
      <GuideStrip page="employment" nextRoute="contract" />
      <div className="card space-y-3"><h2 className="h2">{t('emp.mode')}</h2>
        <div role="radiogroup" aria-label={t('emp.mode')} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{MODES.map((m) => <button key={m} role="radio" aria-checked={employment.mode === m} onClick={() => up('mode', m)} className={`px-4 py-3 rounded-lg border text-left min-h-[44px] transition flex items-center gap-2.5 ${employment.mode === m ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-line hover:bg-surface3'}`}><Icon name={employment.mode === m ? 'circleDot' : 'circle'} className={employment.mode === m ? 'text-primary' : 'text-muted'} />{tk('mode', m)}</button>)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{EMP_FIELDS.map(([k, lk]) => <div key={k}><label className="label" htmlFor={'e' + k}>{tk('emp.a', lk)}</label><input id={'e' + k} className="input" value={dv(employment[k])} onChange={(e) => up(k, e.target.value)} /></div>)}</div>
      </div>
      {missing > 0 ? <Warn>{t('emp.missCount', { n: missing })}</Warn> : <Warn tone="info">{t('emp.okNote')}</Warn>}
      <Disclosure title={t('emp.result')} defaultOpen={missing === 0}>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-surface3 text-left"><th className="p-2">{t('emp.col.area')}</th><th className="p-2">{t('c.status')}</th><th className="p-2">{t('emp.col.note')}</th><th className="p-2">{t('c.source')}</th></tr></thead><tbody>
          {rows.map((r) => { const g = getReg(r.sourceId); return <tr key={r.id} className="border-b border-line align-top"><td className="p-2 font-medium">{r.area}</td><td className="p-2"><StatusBadge level={r.status} /></td><td className="p-2 text-muted">{r.note}</td><td className="p-2">{g && <ExtLink href={g.sourceUrl}>{regText(r.sourceId, 'auth')}</ExtLink>}</td></tr> })}</tbody></table></div>
        <div className="grid md:grid-cols-2 gap-3"><SourceCard id={tc ? 'cn-immigration' : 'th-labour'} /><SourceCard id={tc ? 'cn-labor' : 'th-tax'} /></div>
      </Disclosure>
      <Disclosure title={t('ctr.title')} defaultOpen={openContract}><ContractSection /></Disclosure>
      <div className="flex gap-2 flex-wrap"><button className="btn-primary" onClick={() => { log('hist.employment'); go('roadmap') }}><Go>{t('emp.toPlan')}</Go></button></div>
      <Disclaimer />
    </div>
  )
}

/* ================= CONTRACT ================= */
const CFIELDS: (keyof ContractInput)[] = ['employer', 'employee', 'nationality', 'job', 'location', 'startDate', 'duration', 'salary', 'benefits', 'hours', 'leave', 'probation', 'other']
function ContractSection() {
  const { t, lang } = useI18n()
  const { profile, contract, employment, set, log } = useStore()
  const [out, setOut] = useState<ReturnType<typeof generateContract> | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [vLang, setVLang] = useState<Lang | null>(null)
  if (!profile) return null
  const cur = generateContract(contract, employment.mode)
  const gen = async () => {
    if (!cur.ready) { setOut(null); return setErr(t('ctr.e.min')) }
    setErr(''); setBusy(true)
    try { setOut(await aiService.generateContract(contract, employment.mode)); log('hist.contract') } catch { setErr(t('err.generic')) }
    setBusy(false)
  }
  const shown = out ?? cur
  const showLang = vLang ?? lang
  const pipe: [string, boolean][] = [['ctx', !!employment.mode], ['info', cur.missing.length === 0], ['review', !!out], ['missing', !!out && out.missing.length === 0], ['draft', !!out], ['lang', !!out], ['verify', !!out]]
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t('ctr.sub')}</p>
      <ol className="flex flex-wrap gap-2 text-xs" aria-label={t('ctr.pipe.aria')}>{pipe.map(([k, done], i) => (
        <li key={k} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${done ? 'bg-ok-bg text-ok-fg border-ok-line' : 'bg-surface text-muted border-line'}`}>{done ? <Icon name="check" size={13} /> : <span className="font-semibold">{i + 1}</span>}{tk('ctr.pipe', k)}</li>))}</ol>
      <Warn tone="info"><b>{draftNote()}</b></Warn>
      <div className="card"><h2 className="h2 mb-2">{t('ctr.context')}</h2>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          {[[t('emp.mode'), employment.mode ? tk('mode', employment.mode) : '-'], [t('emp.a.nationality'), dv(employment.nationality) || '-'], [t('emp.a.location'), dv(employment.location) || '-'], [t('emp.a.duration'), dv(employment.duration) || '-']].map(([k, v]) => <div key={k} className="card-i"><dt className="text-muted text-xs">{k}</dt><dd className="font-medium break-words">{v}</dd></div>)}</dl>
        {!employment.mode && <p className="text-sm text-muted mt-2">{t('ctr.noMode')} <button className="underline text-primary" onClick={() => go('employment')}>{t('tabs.emp1')}</button></p>}
      </div>
      <div className="card"><h2 className="h2 mb-3">{t('ctr.data')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{CFIELDS.map((k) => <div key={k} className={k === 'other' ? 'sm:col-span-2 lg:col-span-3' : ''}><label className="label" htmlFor={'c' + k}>{contractLabel(k)}{contractKeys.includes(k) ? ' *' : ''}</label><input id={'c' + k} className="input" value={dv(contract[k])} onChange={(e) => { set({ contract: { ...contract, [k]: e.target.value } }); setOut(null) }} /></div>)}</div>
        <div className="mt-4 flex items-center gap-3 flex-wrap"><div className="flex-1 min-w-[160px]"><div className="text-xs text-muted">{t('ctr.complete', { pct: cur.completeness })}</div><div className="h-2 rounded bg-surface3 overflow-hidden"><div className="h-2 bg-primary transition-all duration-500" style={{ width: cur.completeness + '%' }} /></div></div>
          <button className="btn-primary" disabled={busy} onClick={gen}><Icon name="ai" size={16} />{busy ? t('ctr.busy') : t('ctr.gen')}</button></div>
        {err && <p role="alert" className="text-danger-fg text-sm mt-2">{err}</p>}
      </div>
      {out && <>
        <div className="grid lg:grid-cols-2 gap-5">
          <div className="card"><h2 className="h2 mb-2">{t('ctr.missingT')}</h2>{shown.missing.length ? <ul className="list-disc ml-5 text-sm">{shown.missing.map((m) => <li key={m}>{contractLabel(m)} — {t('emp.n.review')}</li>)}</ul> : <p className="text-sm text-ok-fg"><Ok>{t('ctr.allOk')}</Ok></p>}</div>
          <div className="card"><h2 className="h2 mb-2">{t('ctr.checksT')}</h2><ul className="space-y-2 text-sm">{shown.checks.map((c) => <li key={c.t}>{c.t}<br /><VerifyBadge v={c.v} /> <span className="text-xs text-muted">{t('c.sample')}</span></li>)}</ul></div>
        </div>
        <div className="card"><div className="flex flex-wrap justify-between gap-2 mb-2"><h2 className="h2">{t('ctr.draftT')}</h2>
          <TabBar label={t('ctr.versions')} value={showLang} onChange={(id) => setVLang(id as Lang)} items={LANGS.map((l) => ({ id: l.id, label: l.label }))} /></div>
          <pre lang={LANGS.find((l) => l.id === showLang)!.html} className="whitespace-pre-wrap text-sm bg-surface2 border border-line rounded-lg p-4 font-sans">{shown.text[showLang]}</pre>
          <p className="text-sm mt-2"><b>{t('ctr.explainT')}</b> {t('ctr.explain')}</p><p className="text-xs text-muted mt-1">{t('ctr.sameData')}</p>
          <p className="text-xs font-semibold mt-2">{draftNote()}</p></div>
      </>}
    </div>
  )
}
/** /contract is the same page with the contract section opened. */
export const ContractPage = () => <EmploymentPage openContract />

/* ================= LANGUAGE & CULTURE ================= */
function CultureSituations() {
  const { t } = useI18n()
  const [i, setI] = useState(0)
  return (
    <div className="mt-3">
      <div className="mb-3"><TabBar label={t('cul.pick')} value={String(i)} onChange={(id) => setI(Number(id))} items={situations.map((k) => ({ id: String(k), label: tk('sit', `${k}.t`) }))} /></div>
      <div className="card-i !p-4 space-y-3"><p className="font-semibold">{tk('sit', `${i}.i`)}</p>
        <div className="grid md:grid-cols-2 gap-3">{situationPoints.map((p) => <div key={p}><b>{tk('sit', `${i}.p.${p}.t`)}</b><p className="text-sm text-muted">{tk('sit', `${i}.p.${p}.d`)}</p></div>)}</div>
        <div className="rounded-lg bg-brand text-brandfg px-3 py-2 text-sm flex gap-2"><Icon name="ai" size={16} className="mt-0.5" />{tk('sit', `${i}.a`)}</div></div>
    </div>
  )
}
export function LanguagePage() {
  const { t } = useI18n()
  const { profile } = useStore()
  return (
    <div className="space-y-5">
      <PageHead title={t('lng.title')} sub={t('lng.sub')} />
      <div className="card"><h2 className="h2">{t('cul.title')}</h2>
        <div className="mt-2"><Warn tone="info">{t('cul.warn')}{profile ? ` (${dv(profile.companyName)})` : ''}</Warn></div>
        <CultureSituations /></div>
      <Disclosure title={t('lng.table')}>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-surface3 text-left"><th className="p-2">{t('lng.col1')}</th><th className="p-2">{t('lng.col2')}</th><th className="p-2">{t('lng.col3')}</th></tr></thead><tbody>{terms.map((x) => <tr key={x.n} className="border-b border-line align-top"><td className="p-2 font-medium">{tk('term', `${x.n}.n`)}</td><td className="p-2" lang="zh">{x.orig}</td><td className="p-2 text-muted">{tk('term', `${x.n}.m`)}</td></tr>)}</tbody></table></div>
        <div className="text-xs text-muted">{t('lng.note')}</div>
      </Disclosure>
      <Disclaimer />
    </div>
  )
}
