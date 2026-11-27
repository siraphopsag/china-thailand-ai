// Help after the job starts (v2 model, owner Nov 2026: the "end system"). Emergency numbers come first and work at once (tel:
// links, no form, no sign-in); a quick-exit button leaves the page in one tap; the worker's location can be shared from their
// own phone. Below, the report pack: what happened → the evidence to keep → the agency and its office in the province → a
// summary to print or save (path 1), or a complaint C.A.L.L. checks and files with the agency (path 2, v2 end system).
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { useMatch } from '../matchData'
import { HELPLINES, type HelpCountry } from '../data/helplines'
import { AGENCIES, EVIDENCE, PROBLEMS, URGENT, officeNear, officeSearch, osmEmbed, packText, type ProblemKind } from '../domain/match/reportPack'
import { ME } from '../domain/match/types'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { Page, useNames } from './match'
import { useSearchParam } from '../store'
import { useAftercare } from '../aftercareStore'
import { actComplaint, checkinFlags, fileComplaint, type ComplaintAction } from '../domain/match/aftercare'
import { ComplaintCard, arrivalDay } from './aftercare'


export function SosPage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now } = useMatch()
  // the country of work of my latest case, else Thailand
  const myCase = useMemo(() => [...st.cases].reverse().find((c) => c.seekerId === ME), [st.cases])
  const myPost = myCase && st.posts.find((p) => p.id === myCase.postId)
  const [country, setCountry] = useState<HelpCountry>(myPost?.country ?? 'TH')
  const [province, setProvince] = useState<string>(myPost?.province ?? (country === 'CN' ? 'CN-GD' : 'TH-10'))
  const [problem, setProblem] = useState<ProblemKind | null>(null)
  const [have, setHave] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [loc, setLoc] = useState<{ lat: number; lng: number } | 'busy' | 'denied' | null>(null)
  const [showMap, setShowMap] = useState(false) // the map is loaded from OpenStreetMap only when asked (it receives the point)
  const lines = HELPLINES[country]
  const switchCountry = (c: HelpCountry) => { setCountry(c); setProvince(c === 'CN' ? 'CN-GD' : 'TH-10') }
  const share = () => {
    if (!navigator.geolocation) { setLoc('denied'); return }
    setLoc('busy')
    navigator.geolocation.getCurrentPosition((p) => setLoc({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }), () => setLoc('denied'), { enableHighAccuracy: true, timeout: 15000 })
  }
  const mapLink = (l: { lat: number; lng: number }) => (country === 'CN' ? `https://uri.amap.com/marker?position=${l.lng},${l.lat}` : `https://maps.google.com/?q=${l.lat},${l.lng}`)
  const shareText = (l: { lat: number; lng: number }) => t('hp.loc.msg', { link: mapLink(l) })
  const sendLoc = async (l: { lat: number; lng: number }) => {
    const text = shareText(l)
    try { if (navigator.share) { await navigator.share({ text }); return } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(text) } catch { /* shown on the page anyway */ }
  }
  const tt = (k: string, v?: Record<string, string | number>) => t(k as never, v)
  const provName = N.prov(province)
  // path 2: C.A.L.L. files it (checked first, urgent ones at once) — kept with the case it belongs to
  const caseParam = useSearchParam('case')
  const caseKey = caseParam || myCase?.id || 'nocase'
  const [aft, saveAft] = useAftercare(caseKey)
  const arrived = caseKey === 'demo' || !!(myCase && caseKey === myCase.id && arrivalDay(myCase))
  const flags = aft.checkins.flatMap(checkinFlags)
  const fileToCall = () => {
    if (!problem) return
    const at = new Date(now).toISOString()
    saveAft({ ...aft, complaints: [fileComplaint({ loc: typeof loc === 'object' ? loc : null, id: `cm-${now}-${aft.complaints.length}`, caseId: caseKey, problem, country, province, note, evidence: have, at, hasCase: caseKey !== 'nocase', arrived, flags }), ...aft.complaints] })
  }
  const actOn = (id: string, x: ComplaintAction) => {
    const cm = aft.complaints.find((y) => y.id === id)
    const n = cm && actComplaint(cm, x.kind === 'addEvidence' ? { ...x, flags, hasCase: caseKey !== 'nocase', arrived } : x, new Date(now).toISOString())
    if (n) saveAft({ ...aft, complaints: aft.complaints.map((y) => (y.id === id ? n : y)) })
  }
  const download = () => {
    if (!problem) return
    const text = packText({ problem, country, province, note, evidence: have, when: N.dayTime(now), loc: loc && typeof loc === 'object' ? { ...loc, link: mapLink(loc) } : null }, tt, provName)
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'report-pack.txt'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Page title={t('hp.title')} sub={t('hp.sub')}>
      <div role="tablist" aria-label={t('hp.where')} className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 w-fit">
        {(['TH', 'CN'] as HelpCountry[]).map((c) => <button key={c} type="button" role="tab" aria-selected={country === c} onClick={() => switchCountry(c)} className={`min-h-[36px] px-4 rounded-lg text-sm ${country === c ? 'seg-on' : 'hover:bg-surface3'}`}>{t(`hp.in.${c}` as never)}</button>)}
      </div>

      <section className="card space-y-3" aria-labelledby="hp-lines">
        <h2 id="hp-lines" className="h2">{t('hp.lines')}</h2>
        {lines.length === 0 ? <p className="text-sm text-muted">{t('hp.lines.none')}</p> : (
          <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">{lines.map((l) => (
            <li key={l.tel}><a href={`tel:${l.tel}`} className={`flex items-center gap-3 rounded-xl border p-3 min-h-touch ${l.urgent ? 'border-danger-line bg-danger-bg text-danger-fg' : 'border-line bg-surface hover:bg-surface3'}`}>
              <span className="text-2xl font-bold tabular-nums shrink-0">{l.show}</span><span className="text-sm leading-snug">{t(l.key as never)}</span></a></li>))}</ul>)}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <button type="button" className="btn-soft" onClick={share} disabled={loc === 'busy'}><Icon name="target" size={16} />{loc === 'busy' ? t('hp.loc.busy') : t('hp.loc.get')}</button>
          {loc && typeof loc === 'object' && <>
            <span className="text-sm tabular-nums">{loc.lat}, {loc.lng}</span>
            <a className="text-sm text-primary underline" href={mapLink(loc)} target="_blank" rel="noopener noreferrer">{t('hp.loc.map')}</a>
            <button type="button" className="btn-ghost text-sm" onClick={() => void sendLoc(loc)}><Icon name="send" size={14} />{t('hp.loc.share')}</button>
            <span className="basis-full text-xs text-ok-fg">{t('hp.loc.attach')}</span></>}
          {loc === 'denied' && <span className="text-sm text-danger-fg">{t('hp.loc.denied')}</span>}
        </div>
        <p className="text-xs text-muted">{t('hp.loc.note')}</p>
      </section>

      <section className="card space-y-3" aria-labelledby="hp-pack">
        <h2 id="hp-pack" className="h2">{t('rp.h')}</h2>
        <p className="text-sm text-muted">{t('rp.sub')}</p>
        <fieldset className="space-y-1.5"><legend className="text-sm font-medium mb-1">{t('rp.what')}</legend>
          <div className="flex flex-wrap gap-2">{PROBLEMS.map((p) => (
            <label key={p} className={`chip cursor-pointer min-h-[36px] px-3 ${problem === p ? 'seg-on' : 'bg-surface border-line'}`}>
              <input type="radio" name="rp-problem" className="sr-only" checked={problem === p} onChange={() => { setProblem(p); setHave([]) }} />{t(`rp.p.${p}` as never)}</label>))}</div>
        </fieldset>
        {problem && <>
          {URGENT.includes(problem) && <Warn tone="danger">{t('rp.urgent')}</Warn>}
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="space-y-2"><h3 className="font-semibold text-sm">{t('rp.pack.evidence')}</h3>
              <ul className="space-y-1.5">{EVIDENCE[problem].map((e) => (
                <li key={e}><label className="flex items-start gap-2 text-sm min-h-[28px]"><input type="checkbox" className="mt-1" checked={have.includes(e)} onChange={(x) => setHave((h) => (x.target.checked ? [...h, e] : h.filter((y) => y !== e)))} /><span>{t(`rp.ev.${e}` as never)}</span></label></li>))}</ul>
              <label className="block space-y-1 text-sm"><span className="font-medium">{t('rp.pack.note')}</span>
                <textarea className="input w-full min-h-[90px]" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} aria-describedby="rp-note-h" /></label>
              <p id="rp-note-h" className="text-xs text-muted">{t('rp.note.hint')}</p>
              <details className="text-sm rounded-xl border border-line p-3"><summary className="cursor-pointer font-medium">{t('hp.tips.h')}</summary>
                <ul className="mt-2 space-y-1 list-disc pl-5 text-muted">{(['photo', 'chat', 'money', 'people', 'copy', 'safe'] as const).map((k) => <li key={k}>{t(`hp.tips.${k}`)}</li>)}</ul></details>
            </div>
            <div className="space-y-2"><h3 className="font-semibold text-sm">{t('rp.pack.agency')}</h3>
              {loc && typeof loc === 'object' ? (showMap ? (
                <figure className="space-y-1"><iframe title={t('hp.near.map')} src={osmEmbed(loc)} className="w-full h-56 rounded-xl border border-line" loading="lazy" referrerPolicy="no-referrer" />
                  <figcaption className="text-xs text-muted">{t('hp.near.cap')}</figcaption></figure>
              ) : <div className="space-y-1"><button type="button" className="btn-soft text-sm" onClick={() => setShowMap(true)}><Icon name="globe" size={15} />{t('hp.near.show')}</button><p className="text-xs text-muted">{t('hp.near.privacy')}</p></div>) : <p className="text-xs text-muted flex items-center gap-1.5"><Icon name="target" size={13} />{t('hp.near.need')}</p>}
              <label className="block space-y-1 text-sm"><span className="font-medium">{t('rp.province')}</span>
                <select className="input w-full" value={province} onChange={(e) => setProvince(e.target.value)}>{N.provList(country).map((p) => <option key={p} value={p}>{N.prov(p)}</option>)}</select></label>
              <ul className="space-y-2">{AGENCIES[problem][country].map((a) => (
                <li key={a} className="rounded-lg border border-line p-3 text-sm space-y-1">
                  <p className="font-medium">{t(`rp.ag.${a}` as never)}</p>
                  <p className="text-xs text-muted">{t(`rp.agd.${a}` as never)}</p>
                  {loc && typeof loc === 'object' && <a className="text-primary underline inline-flex items-center gap-1 min-h-[24px] mr-3" href={officeNear(country, t(`rp.ag.${a}` as never), loc)} target="_blank" rel="noopener noreferrer"><Icon name="target" size={13} />{t('hp.near.find')}</a>}
                  <a className="text-primary underline inline-flex items-center gap-1 min-h-[24px]" href={officeSearch(country, provName, t(`rp.ag.${a}` as never))} target="_blank" rel="noopener noreferrer"><Icon name="pin" size={14} />{t('rp.office', { p: provName })}</a>
                </li>))}</ul>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3 border-t border-line pt-3">
            <div className="rounded-xl border border-line p-3 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2"><Icon name="pin" size={16} />{t('cr.path.self')}</p>
              <p className="text-xs text-muted">{t('cr.path.self.d')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-ghost" onClick={() => window.print()}><Icon name="documents" size={16} />{t('rp.print')}</button>
                <button type="button" className="btn-soft" onClick={download}><Icon name="download" size={16} />{t('rp.save')}</button>
              </div>
              <p className="text-xs text-muted">{t('rp.private')}</p>
            </div>
            <div className="rounded-xl border border-primary/60 bg-brand/30 p-3 space-y-2">
              <p className="font-semibold text-sm flex items-center gap-2"><Icon name="shield" size={16} className="text-primary" />{t('cr.path.call')}</p>
              <p className="text-xs text-muted">{t('cr.path.call.d')}</p>
              <button type="button" className="btn-primary" onClick={fileToCall}><Icon name="send" size={16} />{t('cr.send')}</button>
            </div>
          </div>
        </>}
        {aft.complaints.length > 0 && <div className="space-y-2 border-t border-line pt-3"><h3 className="font-semibold text-sm">{t('cr.mine')}</h3>
          {aft.complaints.map((cm) => <ComplaintCard key={cm.id} cm={cm} viewer="worker" onAct={(x) => actOn(cm.id, x as ComplaintAction)} />)}</div>}
      </section>
    </Page>
  )
}
