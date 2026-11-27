// Job-seeker verification (v2 model, owner Nov 2026: "verify both employers and workers"). Two steps: a mobile number confirmed with
// a one-time code (shown on screen in the prototype, as for employers), then the passport's machine-readable lines checked against
// the name and date of birth (ICAO 9303, domain/match/mrz.ts). Applying needs no verification; a case goes ahead with the C.A.L.L.
// team only once the worker is verified. Only what is needed is kept — the last 4 digits of the phone and of the passport number,
// the nationality and the expiry date, never the full numbers (PDPA s.22–23 data minimisation): on the person's own profile in the
// database when signed in (SQL 0014; employers see only "verified" for people who applied to them), on this device in the local demo.
import { useEffect, useState, type FormEvent } from 'react'
import { tk, useI18n } from '../i18n'
import { cleanPhone, isMobile, oneTimeCode, phoneLast4 } from '../domain/match/verify'
import { identityCheck, parseMrz, type IdRecord } from '../domain/match/mrz'
import { localDay } from '../domain/match/logic'
import { ME, type Country } from '../domain/match/types'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { useRemoteSeekerRow, useSeekerBadges, type SeekerRow, type SyncProblem } from '../shared'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { SAMPLE_MRZ, SAMPLE_RECORD } from './contract-steps'
import { useNames } from './match'

export interface SeekerVerify { country: Country; phone4: string; phoneAt: string; passport?: { last4: string; nationality: string; expiry: string; at: string } }
const KEY = 'call.seekerVerify.v1', EVT = 'call-seeker-verify'
export function loadSeekerVerify(): SeekerVerify | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SeekerVerify | null; return v && typeof v.phone4 === 'string' ? v : null } catch { return null }
}
function saveSeekerVerify(v: SeekerVerify | null) {
  try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); window.dispatchEvent(new Event(EVT)) } catch { /* storage blocked */ }
}
/** job seeker: phone and a valid passport = full; the phone only = partial (owner's blueprint, 24 Nov 2026) */
export const seekerLevel = (v: SeekerVerify | null): 'full' | 'partial' | 'none' => (isVerifiedSeeker(v) ? 'full' : v ? 'partial' : 'none')
export const isVerifiedSeeker = (v: SeekerVerify | null) => !!v?.passport && (!v.passport.expiry || v.passport.expiry >= new Date().toISOString().slice(0, 10))
function useLocalSeekerVerify(): SeekerVerify | null {
  const [v, setV] = useState(loadSeekerVerify)
  useEffect(() => { const on = () => setV(loadSeekerVerify()); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [])
  return v
}
/** the profile columns (database) ↔ what the page works with */
export function rowToVerify(r: SeekerRow | null): SeekerVerify | null {
  if (!r?.seeker_phone4) return null
  return { country: r.seeker_phone_country === 'CN' ? 'CN' : 'TH', phone4: r.seeker_phone4, phoneAt: r.seeker_phone_at ?? '',
    ...(r.seeker_pp_last4 ? { passport: { last4: r.seeker_pp_last4, nationality: r.seeker_pp_nat ?? '', expiry: r.seeker_pp_expiry ?? '', at: r.seeker_pp_at ?? '' } } : {}) }
}
export const verifyToRow = (v: SeekerVerify | null): SeekerRow => ({ seeker_phone_country: v?.country ?? null, seeker_phone4: v?.phone4 ?? null, seeker_phone_at: v?.phoneAt || null,
  seeker_pp_last4: v?.passport?.last4 ?? null, seeker_pp_nat: v?.passport?.nationality ?? null, seeker_pp_expiry: v?.passport?.expiry || null, seeker_pp_at: v?.passport?.at || null })
/** my verification and how to change it: my profile in the database when signed in, this device in the local demo */
export function useSeekerVerifyStore(): { v: SeekerVerify | null; save: (v: SeekerVerify | null) => void; problem: SyncProblem; loading: boolean } {
  const { mode } = useMatch()
  const { user } = useAuth()
  const remote = mode === 'remote' && !!user
  const local = useLocalSeekerVerify()
  const r = useRemoteSeekerRow(remote ? user!.id : null)
  if (!remote) return { v: local, save: saveSeekerVerify, problem: null, loading: false }
  return { v: rowToVerify(r.row), save: (v) => void r.save(verifyToRow(v)), problem: r.problem, loading: r.row === null && !r.problem }
}
export const useSeekerVerify = () => useSeekerVerifyStore().v
/** is this job seeker verified? me: my own record; others: what the database tells employers and the team (sample people in the local demo) */
export function useSeekerVerified(seekerId: string): boolean {
  const { mode } = useMatch()
  const { user } = useAuth()
  const remote = mode === 'remote' && !!user, me = seekerId === ME
  const local = useLocalSeekerVerify()
  const mine = useRemoteSeekerRow(remote && me ? user!.id : null).row
  const badges = useSeekerBadges(remote && !me)
  if (!remote) return me ? isVerifiedSeeker(local) : sampleVerified(seekerId)
  return me ? isVerifiedSeeker(rowToVerify(mine)) : !!badges[seekerId]
}
/** sample job seekers of the local demo: about two in three are shown as verified (fixed by their id, labelled as sample data) */
export const sampleVerified = (id: string) => [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % 3 !== 0

/** the level as a chip (owner's blueprint: full / partial / none) */
export function LevelChip({ level }: { level: 'full' | 'partial' | 'none' }) {
  const { t } = useI18n()
  const tone = level === 'full' ? 'bg-ok-bg text-ok-fg border-ok-line' : level === 'partial' ? 'bg-warn-bg text-warn-fg border-warn-line' : 'bg-danger-bg text-danger-fg border-danger-line'
  return <span className={`chip ${tone}`}><Icon name={level === 'none' ? 'warn' : 'personCheck'} size={12} />{t('vl.h')}: {t(`vl.${level}`)}</span>
}
/** before the first pin: what is missing, and the verification right here */
export function NeedVerifySeeker() {
  const { t } = useI18n()
  return <div className="space-y-3"><Warn tone="info">{t('vl.need.seek')}</Warn><SeekerVerifyCard /></div>
}

/** the badge employers see next to an applicant */
export function SeekerBadge({ seekerId }: { seekerId: string }) {
  const { t } = useI18n()
  const ok = useSeekerVerified(seekerId)
  return ok ? <span className="chip bg-ok-bg text-ok-fg border-ok-line text-xs"><Icon name="personCheck" size={12} />{t('sv.badge')}</span>
    : <span className="chip bg-surface3 text-muted border-line text-xs">{t('sv.badgeNo')}</span>
}

const CODE_LIFE_MS = 5 * 60_000
export function SeekerVerifyCard() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now } = useMatch()
  const { v, save: saveVerify, problem } = useSeekerVerifyStore()
  const home: Country = st.me.origin?.country ?? 'TH'
  const [country, setCountry] = useState<Country>(v?.country ?? home)
  const [phone, setPhone] = useState(''), [sent, setSent] = useState<{ code: string; at: number } | null>(null), [code, setCode] = useState('')
  const [rec, setRec] = useState<IdRecord>({ surname: '', given: '', birth: '', nationality: home === 'TH' ? 'THA' : 'CHN' })
  const [mrz, setMrz] = useState(''), [err, setErr] = useState('')
  const today = localDay(new Date(now).toISOString())
  const sendCode = (e: FormEvent) => { e.preventDefault(); if (!isMobile(country, cleanPhone(country, phone))) { setErr(N.problem('phone')); return } setErr(''); setSent({ code: oneTimeCode(), at: Date.now() }) }
  const confirmCode = (e: FormEvent) => {
    e.preventDefault(); if (!sent) return
    if (Date.now() - sent.at > CODE_LIFE_MS) { setErr(t('m.vf.codeOld')); return }
    if (code.trim() !== sent.code) { setErr(N.problem('code')); return }
    setErr(''); setSent(null); saveVerify({ country, phone4: phoneLast4(cleanPhone(country, phone)), phoneAt: new Date(now).toISOString() })
  }
  const parsed = mrz.trim() ? parseMrz(mrz, today) : null
  // the country of work decides the youngest working age: a worker from Thailand works in China and the other way round
  const findings = parsed?.ok ? identityCheck(parsed.value, rec, home === 'TH' ? 'CN' : 'TH', today) : null
  const high = findings?.filter((f) => f.severity === 'high') ?? []
  const checkPassport = (e: FormEvent) => {
    e.preventDefault()
    if (!parsed?.ok || !v) return
    if (high.length) { setErr(t('sv.pp.fail')); return }
    setErr(''); saveVerify({ ...v, passport: { last4: parsed.value.number.slice(-4), nationality: parsed.value.nationality, expiry: parsed.value.expiry, at: new Date(now).toISOString() } })
  }
  const set = (p: Partial<IdRecord>) => setRec((r) => ({ ...r, ...p }))
  return (
    <section id="seeker-verify" className="card space-y-3" aria-labelledby="sv-h">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="sv-h" className="h2 flex items-center gap-2"><Icon name="personCheck" size={18} className="text-primary" />{t('sv.h')}</h2><LevelChip level={seekerLevel(v)} /></div>
      <p className="text-sm text-muted">{t('sv.lead')}</p>
      <ol className="grid sm:grid-cols-2 gap-2">
        <li className={`rounded-xl border p-2.5 text-sm ${v ? 'border-ok-line bg-ok-bg text-ok-fg' : 'border-line'}`}><b>1 · {t('sv.s1')}</b><br />{v ? t('sv.s1.done', { d: v.phone4 }) : t('mid.st.todo')}</li>
        <li className={`rounded-xl border p-2.5 text-sm ${v?.passport ? 'border-ok-line bg-ok-bg text-ok-fg' : 'border-line'}`}><b>2 · {t('sv.s2')}</b><br />{v?.passport ? t('sv.s2.done', { d: v.passport.last4, e: N.day(v.passport.expiry) }) : t('mid.st.todo')}</li>
      </ol>
      {isVerifiedSeeker(v) ? (
        <div className="flex flex-wrap items-center gap-2"><span className="chip bg-ok-bg text-ok-fg border-ok-line"><Icon name="personCheck" size={13} />{t('sv.badge')}</span>
          <button type="button" className="btn-ghost text-sm" onClick={() => saveVerify(null)}>{t('sv.reset')}</button></div>
      ) : !v ? (
        sent ? (
          <form className="space-y-2" onSubmit={confirmCode}>
            <Warn tone="info">{t('m.vf.codeDemo', { c: sent.code })}</Warn>
            <label className="block space-y-1 text-sm"><span className="font-medium">{t('m.vf.code')}</span><input className="input w-40 font-mono tracking-widest" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></label>
            <button type="submit" className="btn-primary">{t('sv.confirm')}</button>
          </form>
        ) : (
          <form className="flex flex-wrap items-end gap-2" onSubmit={sendCode}>
            <label className="space-y-1 text-sm"><span className="font-medium">{t('m.vf.country')}</span>
              <select className="input" value={country} onChange={(e) => setCountry(e.target.value as Country)}>{(['TH', 'CN'] as Country[]).map((c) => <option key={c} value={c}>{tk('country', c)}</option>)}</select></label>
            <label className="space-y-1 text-sm flex-1 min-w-[12rem]"><span className="font-medium">{t('m.vf.phone')}</span><input className="input w-full" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <button type="submit" className="btn-primary">{t('m.vf.sendCode')}</button>
          </form>
        )
      ) : (
        <form className="space-y-2" onSubmit={checkPassport}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{t('sv.pp.lead')}</p>
            <button type="button" className="btn-ghost text-sm" onClick={() => { setRec(SAMPLE_RECORD); setMrz(SAMPLE_MRZ) }}>{t('id.sample.good')}</button></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
            <label className="space-y-1"><span className="font-medium">{t('id.f.surname')}</span><input className="input w-full uppercase" value={rec.surname} onChange={(e) => set({ surname: e.target.value })} /></label>
            <label className="space-y-1"><span className="font-medium">{t('id.f.given')}</span><input className="input w-full uppercase" value={rec.given} onChange={(e) => set({ given: e.target.value })} /></label>
            <label className="space-y-1"><span className="font-medium">{t('id.f.birth')}</span><input className="input w-full" type="date" value={rec.birth} onChange={(e) => set({ birth: e.target.value })} /></label>
            <label className="space-y-1"><span className="font-medium">{t('id.f.nat')}</span><select className="input w-full" value={rec.nationality} onChange={(e) => set({ nationality: e.target.value })}>{['THA', 'CHN'].map((n) => <option key={n} value={n}>{t(`id.nat.${n}` as never)}</option>)}</select></label>
          </div>
          <label className="block space-y-1 text-sm"><span className="font-medium">{t('id.mrz.label')}</span>
            <textarea className="input w-full font-mono text-xs leading-relaxed min-h-[70px] uppercase" spellCheck={false} value={mrz} onChange={(e) => setMrz(e.target.value)} /></label>
          {parsed && !parsed.ok && <p className="text-sm text-danger-fg">{t(`id.err.${parsed.problem}` as never)}</p>}
          {findings && findings.length > 0 && <ul className="space-y-1 text-sm">{findings.map((f) => <li key={f.flag} className={f.severity === 'high' ? 'text-danger-fg' : 'text-warn-fg'}>• {t(`id.flag.${f.flag}` as never, (f.vars ?? {}) as never)}</li>)}</ul>}
          <button type="submit" className="btn-primary" disabled={!parsed?.ok}><Icon name="personCheck" size={16} />{t('sv.pp.check')}</button>
          <p className="text-xs text-muted">{t('sv.privacy')}</p>
        </form>
      )}
      {err && <p className="text-sm text-danger-fg" role="alert">{err}</p>}
      {problem && <p className="text-sm text-danger-fg" role="alert">{t(problem === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</p>}
    </section>
  )
}
