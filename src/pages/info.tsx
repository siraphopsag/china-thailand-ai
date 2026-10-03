// Reference pages the matching prototype links to: language & culture and legal sources (from "Prepare") and privacy (footer).
// They came from the first business-planning tool, which was removed in Oct 2026.
import { useState } from 'react'
import { Disclaimer, Disclosure, PageHead, SourceCard, TabBar, Warn } from '../components/ui'
import { Icon } from '../components/icons'
import { situations, situationPoints, terms } from '../data/culture'
import { regText, regulations } from '../data/regulations'
import { tk, useI18n } from '../i18n'

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
  return (
    <div className="space-y-5">
      <PageHead title={t('lng.title')} sub={t('lng.sub')} />
      <div className="card"><h2 className="h2">{t('cul.title')}</h2>
        <div className="mt-2"><Warn tone="info">{t('cul.warn')}</Warn></div>
        <CultureSituations /></div>
      <Disclosure title={t('lng.table')}>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-surface3 text-left"><th className="p-2">{t('lng.col1')}</th><th className="p-2">{t('lng.col2')}</th><th className="p-2">{t('lng.col3')}</th></tr></thead><tbody>{terms.map((x) => <tr key={x.n} className="border-b border-line align-top"><td className="p-2 font-medium">{tk('term', `${x.n}.n`)}</td><td className="p-2" lang="zh">{x.orig}</td><td className="p-2 text-muted">{tk('term', `${x.n}.m`)}</td></tr>)}</tbody></table></div>
        <div className="text-xs text-muted">{t('lng.note')}</div>
      </Disclosure>
      <Disclaimer />
    </div>
  )
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
  const list = regulations.filter((r) => (c === 'ALL' || r.country === c) && (regText(r.id, 'title') + regText(r.id, 'auth') + regText(r.id, 'topic')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-5"><PageHead title={t('src.title')} sub={t('src.sub')} />
      <Warn>{t('src.warn', { v: regulations.filter((r) => r.trust === 'VERIFIED').length, n: regulations.length })}</Warn>
      <div className="card"><Filters c={c} setC={setC} q={q} setQ={setQ} />
        {list.length === 0 ? <p className="text-muted">{t('c.noData')}</p> : <div className="grid md:grid-cols-2 gap-3">{list.map((r) => <div key={r.id}><div className="text-xs font-semibold text-muted mb-1">{regText(r.id, 'topic')}</div><SourceCard id={r.id} /></div>)}</div>}</div>
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
