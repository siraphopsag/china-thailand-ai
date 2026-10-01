import { useMemo } from 'react'
import { go, useStore } from '../store'
import { BackLink, Disclaimer, EmptyState, ExtLink, Go, LangText, PageHead, Warn } from '../components/ui'
import { Icon } from '../components/icons'
import { useRouteText } from '../components/ui'
import { DOMAINS, authorityOf } from '../data/legal/kb'
import { EC_OPTIONS, contextFrom, ecCounts, evaluateEmployeeCheck, retrieveRequirements, viewRequirement, type EcStatus, type EmployeeCheck, type RequirementView } from '../services/compliance'
import { targetCountry } from '../services/engines'
import { messages, type MsgKey } from '../locales'
import { tk, useI18n } from '../i18n'

const K = (s: string) => s as MsgKey
export const reqChip: Record<RequirementView['status'], string> = {
  ACTIVE: 'bg-ok-bg text-ok-fg border-ok-line', NEEDS_VERIFICATION: 'bg-warn-bg text-warn-fg border-warn-line',
  SUPERSEDED: 'bg-danger-bg text-danger-fg border-danger-line', DRAFT: 'bg-surface3 text-muted border-line',
}
export const ReqBadge = ({ s }: { s: RequirementView['status'] }) => { useI18n(); return <span className={`chip font-medium ${reqChip[s]}`}>{tk('kb.s', s)}</span> }
const ecChip: Record<EcStatus, string> = {
  VERIFIED: 'bg-ok-bg text-ok-fg border-ok-line', NEEDS_INFORMATION: 'bg-warn-bg text-warn-fg border-warn-line', NEEDS_VERIFICATION: 'bg-info-bg text-info-fg border-info-line',
  POTENTIAL_COMPLIANCE_ISSUE: 'bg-danger-bg text-danger-fg border-danger-line', NOT_APPLICABLE: 'bg-surface3 text-muted border-line',
}
/** Province codes of one country, from the names the app ships (the same list the map uses). */
export const provincesOf = (c: string) => Object.keys(messages).filter((k) => k.startsWith(`prov.${c}-`)).map((k) => k.slice(5)).sort((a, b) => tk('prov', a).localeCompare(tk('prov', b)))

/* ================= DOCUMENT & GOVERNMENT OFFICE NAVIGATOR ================= */
function RequirementCard({ v }: { v: RequirementView }) {
  const { t } = useI18n()
  const row = (label: string, body: React.ReactNode) => <div className="text-sm"><div className="text-xs font-semibold text-muted mb-0.5">{label}</div>{body}</div>
  return (
    <article className="card space-y-3 !p-4" aria-label={v.requirement}>
      <div className="flex flex-wrap justify-between gap-2 items-start">
        <h3 className="font-semibold min-w-0"><LangText text={v.requirement} />{v.optional && <span className="ml-2 chip bg-surface3 text-muted border-line">{t('nv.optional')}</span>}</h3>
        <ReqBadge s={v.status} />
      </div>
      {row(t('nv.what'), <p><LangText text={v.description} /></p>)}
      <div className="grid sm:grid-cols-2 gap-3">
        {row(t('nv.authority'), <p className="flex flex-wrap items-center gap-x-2">{v.responsible_authority}{v.authority_url && <ExtLink href={v.authority_url}>{t('nv.site')}</ExtLink>}</p>)}
        {row(t('nv.office'), <p className={v.office.resolved ? '' : 'text-warn-fg font-medium'}>{v.office.text}{v.office.local && <span className="block text-xs text-muted">{t('kb.office.verifyArea')}</span>}</p>)}
        {row(t('nv.channel'), <p className="text-warn-fg">{t('nv.channelVerify')}</p>)}
      </div>
      {v.required_documents.some((d) => d.issued) && row(t('nv.receives'), <p><LangText text={v.required_documents.filter((d) => d.issued).map((d) => d.name + ' — ' + d.issuer).join(' · ')} /></p>)}
      {row(t('nv.docs'), v.required_documents.some((d) => !d.issued) ? (
        <ul className="space-y-2">{v.required_documents.filter((d) => !d.issued).map((d) => (
          <li key={d.id} className="card-i !p-2.5"><div className="font-medium"><LangText text={d.name} /></div>
            <dl className="grid sm:grid-cols-3 gap-x-3 text-xs mt-1"><div><dt className="text-muted">{t('nv.doc.why')}</dt><dd>{d.purpose}</dd></div><div><dt className="text-muted">{t('nv.doc.issuer')}</dt><dd><LangText text={d.issuer} /></dd></div><div><dt className="text-muted">{t('nv.doc.submit')}</dt><dd><LangText text={d.submitTo} /></dd></div></dl></li>))}
          <li className="text-xs text-muted">{t('nv.doc.more')}</li></ul>
      ) : <p className="text-muted">{t('nv.docsNone')}</p>)}
      {v.required_documents.some((d) => !d.issued) && row(t('nv.prepare'), <p><LangText text={v.required_documents.filter((d) => !d.issued).map((d) => d.name).join(' · ')} /></p>)}
      {row(t('nv.next'), <p className="font-medium">{v.procedure}</p>)}
      <div className="text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-2">
        <span>{t('nv.source')}:</span>
        {v.official_source.length ? v.official_source.map((s) => <ExtLink key={s.id} href={s.url}><LangText text={s.title} /></ExtLink>) : <span className="text-warn-fg">{t('nv.noSource')}</span>}
        <span>· {t('nv.lastVerified')}: {v.last_verified ?? t('nv.never')}</span>
        {v.effective_date && <span>· {t('nv.effective')}: {v.effective_date}</span>}
      </div>
    </article>
  )
}

export function NavigatorPage() {
  const { t, lang } = useI18n()
  const { profile, employeeCheck } = useStore()
  const route = useRouteText()
  const views = useMemo(() => {
    if (!profile) return []
    const ctx = contextFrom(profile, employeeCheck)
    return retrieveRequirements(ctx).map((r) => viewRequirement(r, ctx.province, lang))
  }, [profile, employeeCheck, lang])
  if (!profile) return <div><PageHead title={t('nv.title')} /><EmptyState /></div>
  const verified = views.filter((v) => v.status === 'ACTIVE').length
  return (
    <div className="space-y-5">
      <BackLink to="analysis" label={t('nav.backAnalysis')} />
      <PageHead title={t('nv.title')} sub={t('nv.sub')}>
        <button className="btn-ghost" onClick={() => go('employee')}><Icon name="business" size={16} />{t('nv.toCheck')}</button>
      </PageHead>
      <div className="card-i !p-3 text-sm flex flex-wrap gap-x-4 gap-y-1"><span><b>{t('nv.where')}:</b> {route}</span><span className="text-muted">{t('nv.count', { n: views.length, v: verified, u: views.length - verified })}</span></div>
      <Warn tone="info">{t('nv.legend')}</Warn>
      {!views.length && <div className="card text-muted">{t('nv.empty')}</div>}
      {DOMAINS.filter((d) => views.some((v) => v.legal_domain === d)).map((d) => (
        <section key={d} className="space-y-3" aria-label={tk('kb.d', d)}>
          <h2 className="h2">{tk('kb.d', d)}</h2>
          {views.filter((v) => v.legal_domain === d).map((v) => <RequirementCard key={v.id} v={v} />)}
        </section>
      ))}
      <Disclaimer />
    </div>
  )
}

/* ================= EMPLOYEE COMPLIANCE CHECK ================= */
export function EmployeeCheckPage() {
  const { t } = useI18n()
  const { profile, employeeCheck: ec, destinationProvince, set } = useStore()
  if (!profile) return <div><PageHead title={t('ec.title')} /><EmptyState text={t('ec.empty')} /></div>
  const country = targetCountry(profile)
  const e: EmployeeCheck = { ...ec, province: ec.province || (destinationProvince?.startsWith(country + '-') ? destinationProvince : '') }
  const up = (patch: Partial<EmployeeCheck>) => set({ employeeCheck: { ...e, ...patch } })
  const items = ec.nationality ? evaluateEmployeeCheck(e, country) : []
  const c = ecCounts(items)
  const sel = (id: string, field: 'nationality' | 'type' | 'stay' | 'auth', opts: readonly string[], prefix: string) => (
    <div><label className="label" htmlFor={id}>{t(K('ec.f.' + field))}</label>
      <select id={id} className="input" value={e[field]} onChange={(x) => up({ [field]: x.target.value } as Partial<EmployeeCheck>)}>
        <option value="">{t('ec.choose')}</option>{opts.map((o) => <option key={o} value={o}>{tk(prefix, o)}</option>)}</select></div>
  )
  return (
    <div className="space-y-5">
      <BackLink to="analysis" label={t('nav.backAnalysis')} />
      <PageHead title={t('ec.title')} sub={t('ec.sub')} />
      <div className="card-i !p-3 text-sm"><b>{t('ec.work')}:</b> {tk('country', country)}{e.province ? ' · ' + tk('prov', e.province) : ''}</div>
      <Warn tone="info">{t('ec.disclaimer')}</Warn>
      <div className="card space-y-3">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sel('ecnat', 'nationality', EC_OPTIONS.nationality, 'ec.o.nat')}
          <div><label className="label" htmlFor="ecrole">{t('ec.f.role')}</label><input id="ecrole" className="input" maxLength={120} value={e.role} onChange={(x) => up({ role: x.target.value })} /></div>
          <div><label className="label" htmlFor="ecemp">{t('ec.f.employer')}</label><input id="ecemp" className="input" maxLength={120} value={e.employer} onChange={(x) => up({ employer: x.target.value })} /></div>
          <div><label className="label" htmlFor="ecprov">{t('ec.f.province')}</label>
            <select id="ecprov" className="input" value={e.province} onChange={(x) => up({ province: x.target.value })}><option value="">{t('ec.choose')}</option>{provincesOf(country).map((p) => <option key={p} value={p}>{tk('prov', p)}</option>)}</select></div>
          {sel('ectype', 'type', EC_OPTIONS.type, 'ec.o.type')}
          <div><label className="label" htmlFor="ecstart">{t('ec.f.start')}</label><input id="ecstart" type="date" className="input" value={e.start} onChange={(x) => up({ start: x.target.value })} /></div>
          {sel('ecstay', 'stay', EC_OPTIONS.stay, 'ec.o.stay')}
          {sel('ecauth', 'auth', EC_OPTIONS.auth, 'ec.o.auth')}
        </div>
        <fieldset><legend className="label">{t('ec.f.docs')}</legend>
          <div className="flex flex-wrap gap-2">{EC_OPTIONS.docs.map((d) => { const on = e.docs.includes(d); return (
            <label key={d} className={`flex items-center gap-2 rounded-lg border px-3 py-2 min-h-[44px] cursor-pointer ${on ? 'border-primary bg-brand text-brandfg' : 'border-control'}`}>
              <input type="checkbox" checked={on} onChange={() => up({ docs: on ? e.docs.filter((x) => x !== d) : [...e.docs, d] })} />{tk('ec.o.doc', d)}</label>) })}</div></fieldset>
      </div>
      {items.length > 0 && <section className="space-y-3" aria-label={t('ec.result')}>
        <div className="flex flex-wrap justify-between items-center gap-2"><h2 className="h2">{t('ec.result')}</h2><p className="text-sm text-muted">{t('ec.summary', c)}</p></div>
        <ul className="space-y-2">{items.map((i) => (
          <li key={i.id} className="card !p-3 space-y-1.5">
            <div className="flex flex-wrap justify-between gap-2 items-center"><b>{t(K('ec.i.' + i.id + '.t'))}</b><span className={`chip font-medium ${ecChip[i.status]}`}>{tk('ec.s', i.status)}</span></div>
            <p className="text-sm text-muted">{i.note ? t(i.note) : t(K('ec.m.' + i.status))}</p>
            {i.status !== 'NOT_APPLICABLE' && <>
              {i.evidence.length > 0 && <p className="text-xs"><b>{t('ec.evidence')}:</b> <LangText text={i.evidence.map((d) => tk('kb.doc', d)).join(' · ')} /></p>}
              <p className="text-xs flex flex-wrap gap-x-2 items-center"><b>{t('ec.verifyWith')}:</b>{i.authorityIds.map((a) => { const au = authorityOf(a); return <span key={a}>{tk('kb.a', a)}{au?.url && <> <ExtLink href={au.url}>{t('nv.site')}</ExtLink></>}</span> })}</p>
              {i.status !== 'VERIFIED' && <p className="text-sm"><b>{t('ec.next')}:</b> {t(K('ec.i.' + i.id + '.next'))}</p>}
            </>}
          </li>))}</ul>
        <div className="flex gap-2 flex-wrap">
          <button className="btn-primary" onClick={() => go('contract')}><Go>{t('ec.toContract')}</Go></button>
          <button className="btn-ghost" onClick={() => go('navigator')}>{t('ec.toDocs')}</button>
        </div>
      </section>}
      <Disclaimer />
    </div>
  )
}
