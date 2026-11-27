// The middle system: a safe contract (v2 model, owner Nov 2026). Four steps on one page:
//   1. check the contract against the job post and the law of the country of work (domain/match/contract.ts, plus AI wording)
//   2. check the worker's passport against the record (domain/match/mrz.ts)
//   3. optionally send it to a partner law firm in the country of work (sample firms in the prototype)
//   4. sign on screen (bound to a fingerprint of the text) or print and sign on paper (domain/match/sign.ts)
// The draft is in Thai and Chinese side by side. Work in progress is shared by both sides of a real case through the database when
// signed in (shared.ts, SQL 0014: each signs on their own device and sees the other's signature at once); the sample and the local
// demo keep it on this device (contractStore.ts). Not legal advice.
import { useEffect, useMemo, useState } from 'react'
import { tr, type Lang } from '../i18n/core'
import { useI18n } from '../i18n'
import { useMatch } from '../matchData'
import { useSearchParam } from '../store'
import { CLAUSES, checkContract, draftFromPost, riskyDraft, termsProblem, type ContractFinding, type ContractTerms } from '../domain/match/contract'
import { identityCheck, parseMrz, type IdRecord } from '../domain/match/mrz'
import { addSignature, reviewNotes, sha256, signBlock, signStatus, type Review, type Side, type SignState } from '../domain/match/sign'
import { minMonthlyWage } from '../domain/match/minwage'
import { localDay } from '../domain/match/logic'
import { ME, MY_EMPLOYER, type Country, type Currency, type Salary } from '../domain/match/types'
import { clearContract, cleanContract, loadContract, saveContract, type ContractSave } from '../contractStore'
import { isUuid, useRemoteContract } from '../shared'
import { Icon, type IconName } from '../components/icons'
import { Warn } from '../components/ui'
import { Page, useNames } from './match'
import { useAuth } from '../auth'
import { aiContract } from '../ai/client'
import type { AiCheck, AiResponse } from '../ai/spec'
import { AiCheckResult } from './ask'
import { IdentityStep, ReviewStep, SignStep, SAMPLE_MRZ, SAMPLE_RECORD, badSampleMrz, idHigh } from './contract-steps'

/** the post a contract is checked against (a real post of one of my cases, or the training sample from the slides) */
interface ContractPost { id: string; company: string; position: string; country: Country; province: string; salary: Salary | null; sample: boolean }
/** the sample case (24 Nov 2026): an invented Chinese worker, 李明, in guest relations at an invented Bangkok hotel (Thai law applies) */
export const SAMPLE_POST: ContractPost = { id: 'sample', company: '@c2.sample.company', position: '@c2.sample.position', country: 'TH', province: 'TH-10', salary: { min: 36000, max: 36000, currency: 'THB' }, sample: true }

const fmt = (n: number) => n.toLocaleString('en-US')
const STEPS = ['check', 'id', 'review', 'sign'] as const
type Step = (typeof STEPS)[number]
const STEP_ICON: Record<Step, IconName> = { check: 'documents', id: 'personCheck', review: 'legal', sign: 'edit' }
/** the worker comes from the other country: a job in China is for a Thai worker, a job in Thailand for a Chinese one */
const emptyRecord = (country: Country): IdRecord => ({ surname: '', given: '', birth: '', nationality: country === 'CN' ? 'THA' : 'CHN' })

export function ContractPage() {
  const { t, lang } = useI18n()
  const N = useNames()
  const { st, now, mode } = useMatch()
  const { status, online } = useAuth()
  const today = localDay(new Date(now).toISOString())
  const [ai, setAi] = useState<AiResponse<AiCheck> | 'busy' | null>(null)
  const canAi = status === 'signedIn' && online !== false
  const fromCase = useSearchParam('case')
  const [caseId, setCaseId] = useState(fromCase)
  // the posts of my cases (as the worker or as the employer), then the sample
  const choices = useMemo(() => {
    const mine = st.cases.flatMap((c) => {
      const p = st.posts.find((x) => x.id === c.postId)
      if (!p || (c.seekerId !== ME && p.employerId !== MY_EMPLOYER)) return []
      const sides: Side[] = [...(c.seekerId === ME ? ['worker' as const] : []), ...(p.employerId === MY_EMPLOYER ? ['employer' as const] : [])]
      return [{ caseId: c.id, sides, post: { id: p.id, company: p.company, position: p.position, country: p.country, province: p.province, salary: p.salary, sample: !!p.sample } as ContractPost }]
    })
    return [...mine, { caseId: 'sample', sides: ['worker', 'employer'] as Side[], post: SAMPLE_POST }]
  }, [st.cases, st.posts])
  const chosen = choices.find((c) => c.caseId === caseId) ?? choices[choices.length - 1]
  const post = chosen.post, key = chosen.caseId, isSample = key === 'sample'
  const remote = mode === 'remote' && isUuid(key)
  const doc = useRemoteContract<ContractSave & Record<string, unknown>>(remote ? key : null)

  // everything the four steps work on, kept on this device per case
  const fresh = () => {
    const s = remote ? cleanContract(doc.data) : loadContract(key)
    return { terms: s.terms ?? draftFromPost(post), checked: s.checked ?? false, record: s.record ?? (isSample ? SAMPLE_RECORD : emptyRecord(post.country)),
      mrz: s.mrz ?? '', idChecked: !!s.mrz && !!s.record, review: s.review ?? null, sign: s.sign ?? null }
  }
  const [w, setW] = useState(fresh)
  const [loaded, setLoaded] = useState(key)
  if (loaded !== key) { setLoaded(key); setW(fresh()); setAi(null) } // another case: load its own work
  // shared contract: what either side saved (a signature, a changed clause) replaces the screen's copy as it arrives
  const [seenVer, setSeenVer] = useState(0)
  if (remote && doc.ver !== seenVer) { setSeenVer(doc.ver); setW(fresh()) }
  const [step, setStep] = useState<Step>('check')
  const save = (patch: Partial<typeof w>) => {
    setW((x) => ({ ...x, ...patch }))
    const { idChecked: _i, ...rest } = patch; void _i
    if (remote) doc.save(rest as never); else saveContract(key, rest as never)
  }
  const setTerms = (terms: ContractTerms) => { save({ terms, checked: false }); setAi(null) }
  const set = (patch: Partial<ContractTerms>) => setTerms({ ...w.terms, ...patch })

  const findings: ContractFinding[] | null = w.checked && !termsProblem(w.terms) ? checkContract(w.terms, post) : null
  const parsed = w.mrz.trim() ? parseMrz(w.mrz, today) : null
  const idFindings = w.idChecked && parsed?.ok ? identityCheck(parsed.value, w.record, post.country, today) : null
  const contractHigh = findings ? findings.filter((f) => f.severity === 'high').length : 0
  const block = signBlock({ checked: !!findings, contractHigh, idChecked: !!idFindings, idHigh: idHigh(idFindings) })

  const name = (s: string) => (s.startsWith('@') ? t(s.slice(1) as never) : s)
  const workerName = parsed?.ok ? `${parsed.value.given} ${parsed.value.surname}`.trim() : `${w.record.given} ${w.record.surname}`.trim()
  const passportNo = parsed?.ok ? parsed.value.number : ''
  const docs = useMemo(() => ({ th: contractLines(w.terms, post, workerName, passportNo, 'th'), zh: contractLines(w.terms, post, workerName, passportNo, 'zh') }), [w.terms, post, workerName, passportNo])
  const [hash, setHash] = useState('')
  useEffect(() => { let live = true; void sha256(JSON.stringify(docs)).then((h) => { if (live) setHash(h) }); return () => { live = false } }, [docs])

  const askAi = async () => {
    setAi('busy')
    const clauses = CLAUSES.map((k) => tr(`c2.cl.${k}` as never, clauseVars(w.terms, post, lang), lang))
    setAi(await aiContract({ country: post.country, province: post.province, position: name(post.position), postSalary: post.salary, clauses }, lang))
  }
  const sendReview = () => { const at = new Date(now).toISOString(); save({ review: { firm: post.country, status: 'sent', sentAt: at, at, notes: [] } }) }
  const advanceReview = () => {
    if (!w.review) return
    const at = new Date(now).toISOString()
    if (w.review.status === 'sent') { save({ review: { ...w.review, status: 'reviewing', at } }); return }
    const open = [...(findings ?? []).map((f) => ({ text: t('rv.fix', { what: t(`c2.flag.${f.flag}` as never, flagVars(f, t)) }) })),
      ...(idFindings ?? []).map((f) => ({ text: t('rv.fix', { what: t(`id.flag.${f.flag}` as never, (f.vars ?? {}) as never) }) }))]
    const review: Review = { ...w.review, status: 'done', at, notes: [...reviewNotes(open, t('rv.okNote')), { kind: 'ok', text: t('rv.lawNote') }] }
    save({ review })
  }
  const onSign = (side: Side, nm: string, img: string) => { const s = addSignature(w.sign, side, { at: new Date(now).toISOString(), name: nm, img }, hash); if (s) save({ sign: s }) }
  const onMode = (mode: 'online' | 'paper') => save({ sign: { ...(w.sign && w.sign.hash === hash ? w.sign : { hash }), mode } as SignState })
  const onPaper = (f: File) => save({ sign: { mode: 'paper', hash, paper: { name: f.name.slice(0, 80), size: f.size, at: new Date(now).toISOString() } } })
  const restart = () => { if (remote) doc.clear(); else clearContract(key); setW({ terms: draftFromPost(post), checked: false, record: isSample ? SAMPLE_RECORD : emptyRecord(post.country), mrz: '', idChecked: false, review: null, sign: null }); setAi(null); setStep('check') }

  const sStatus = signStatus(w.sign, hash)
  const state: Record<Step, 'done' | 'warn' | 'todo'> = {
    check: findings ? (contractHigh ? 'warn' : 'done') : 'todo',
    id: idFindings ? (idHigh(idFindings) ? 'warn' : 'done') : 'todo',
    review: w.review?.status === 'done' ? 'done' : 'todo',
    sign: sStatus === 'signed' || sStatus === 'paperSigned' ? 'done' : sStatus === 'changed' ? 'warn' : 'todo',
  }
  const min = minMonthlyWage(post.country, post.province)
  const cur = (c: Currency) => t(`m.cur.${c}` as never)
  const num = (v: string) => (v.trim() === '' ? 0 : Number(v))
  const bad = termsProblem(w.terms)
  const at = STEPS.indexOf(step)

  return (
    <Page title={t('c2.title')} sub={t('c2.sub')}>
      <Warn tone="info">{t('c2.note')}</Warn>
      {remote && doc.problem && <Warn>{t(doc.problem === 'dbOld' ? 'sh.dbOld' : 'sh.network')}</Warn>}
      {remote && !doc.problem && <p className="text-xs text-muted flex items-center gap-1.5" role="status"><Icon name={doc.data ? 'users' : 'clock'} size={13} />{t(doc.data ? 'sh.contract.shared' : 'c.loading')}</p>}
      {/* the four steps of the middle system, each with where it stands */}
      <nav aria-label={t('mid.steps')} className="mid-steps">
        <ol className="grid grid-cols-2 md:grid-cols-4 gap-2">{STEPS.map((s, i) => (
          <li key={s}><button type="button" aria-current={step === s ? 'step' : undefined} onClick={() => setStep(s)} className={`mid-step mid-${state[s]} ${step === s ? 'mid-on' : ''}`}>
            <span className="mid-num">{state[s] === 'done' ? <Icon name="check" size={16} /> : state[s] === 'warn' ? <Icon name="warn" size={15} /> : i + 1}</span>
            <span className="min-w-0 text-left"><span className="block text-sm font-semibold leading-tight">{t(`mid.${s}` as never)}</span>
              <span className="block text-[0.6875rem] opacity-80">{t(`mid.st.${s === 'review' && state[s] === 'todo' ? 'optional' : state[s]}` as never)}</span></span>
            <Icon name={STEP_ICON[s]} size={18} className="ml-auto opacity-70 shrink-0" />
          </button></li>))}</ol>
      </nav>

      <div className="grid xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] gap-4 items-start">
        <section className="card space-y-3" aria-labelledby="c2-post">
          <h2 id="c2-post" className="h2">{t('c2.post.h')}</h2>
          <label className="block space-y-1 text-sm"><span className="font-medium">{t('c2.pick')}</span>
            <select className="input w-full" value={chosen.caseId} onChange={(e) => setCaseId(e.target.value)}>
              {choices.map((c) => <option key={c.caseId} value={c.caseId}>{c.caseId === 'sample' ? t('c2.pick.sample') : `${name(c.post.position)} · ${name(c.post.company)}`}</option>)}
            </select></label>
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-muted">{t('c2.post.position')}</dt><dd>{name(post.position)}</dd>
            <dt className="text-muted">{t('c2.post.company')}</dt><dd>{name(post.company)}{post.sample && <span className="chip ml-2 bg-surface3 text-muted border-line">{t('c.sample')}</span>}</dd>
            <dt className="text-muted">{t('c2.post.place')}</dt><dd>{N.place(post.country, post.province)}</dd>
            <dt className="text-muted">{t('c2.post.pay')}</dt><dd>{post.salary ? N.money(post.salary) : t('c2.post.noPay')}</dd>
            <dt className="text-muted">{t('c2.post.min')}</dt><dd>{min ? `${fmt(min.monthly)} ${cur(min.currency)}${t('m.perMonth')}` : t('c2.post.noMin')}</dd>
            <dt className="text-muted">{t('c2.post.law')}</dt><dd>{t(post.country === 'CN' ? 'c2.lawOf.CN' : 'c2.lawOf.TH')}</dd>
          </dl>
          <button type="button" className="btn-ghost text-sm w-full justify-center" onClick={restart}><Icon name="renew" size={15} />{t('mid.restart')}</button>
        </section>

        <div className="space-y-4 min-w-0">
          {step === 'check' && (<>
            <section className="card space-y-3" aria-labelledby="c2-terms">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="c2-terms" className="h2">{t('c2.terms.h')}</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost text-sm" onClick={() => setTerms(draftFromPost(post))}>{t('c2.reset')}</button>
                  <button type="button" className="btn-soft text-sm" onClick={() => setTerms(riskyDraft(post))}>{t('c2.risky')}</button>
                </div></div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <label className="space-y-1"><span className="font-medium">{t('c2.f.pay')} ({cur(w.terms.currency)})</span>
                  <input className="input w-full" inputMode="numeric" value={w.terms.pay} onChange={(e) => set({ pay: num(e.target.value) })} aria-invalid={bad === 'pay'} /></label>
                <label className="space-y-1"><span className="font-medium">{t('c2.f.daysOff')}</span>
                  <select className="input w-full" value={w.terms.daysOff} onChange={(e) => set({ daysOff: Number(e.target.value) })}>{[0, 1, 2].map((d) => <option key={d} value={d}>{t('c2.days', { n: d })}</option>)}</select></label>
                <label className="space-y-1"><span className="font-medium">{t('c2.f.deposit')} ({cur(w.terms.currency)})</span>
                  <input className="input w-full" inputMode="numeric" value={w.terms.deposit} onChange={(e) => set({ deposit: num(e.target.value) })} aria-invalid={bad === 'deposit'} /></label>
                <label className="space-y-1"><span className="font-medium">{t('c2.f.deduct')}</span>
                  <input className="input w-full" inputMode="numeric" value={w.terms.deductPct} onChange={(e) => set({ deductPct: num(e.target.value) })} aria-invalid={bad === 'deduct'} /></label>
                <label className="sm:col-span-2 flex items-start gap-2 min-h-control"><input type="checkbox" className="mt-1" checked={w.terms.keepsPassport} onChange={(e) => set({ keepsPassport: e.target.checked })} /><span>{t('c2.f.passport')}</span></label>
              </div>
              {bad && <p className="text-sm text-danger-fg" role="alert">{t('c2.bad')}</p>}
              <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!!bad} onClick={() => save({ checked: true })}><Icon name="ok" size={16} />{t('c2.check')}</button></div>
              {findings && <Findings list={findings} />}
              {findings && (canAi
                ? <div className="space-y-2 border-t border-line pt-3">
                    <button type="button" className="btn-soft" disabled={ai === 'busy'} onClick={() => void askAi()}><Icon name="ai" size={16} />{ai === 'busy' ? t('c2.ai.busy') : t('c2.ai.go')}</button>
                    {ai && ai !== 'busy' && (ai.ok ? <AiCheckResult res={ai.result} left={ai.left} /> : <p className="text-sm text-muted">{t('c2.ai.fail', { why: t(`ai.why.${ai.reason}` as never) })}</p>)}
                  </div>
                : <p className="text-xs text-muted border-t border-line pt-3">{t('c2.ai.signin')}</p>)}
            </section>
            <details className="card group">
              <summary className="cursor-pointer font-semibold min-h-control flex items-center">{t('c2.draft.h')}</summary>
              <p className="text-xs text-muted mt-1">{t('c2.draft.note')}</p>
              <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm">
                {(['th', 'zh'] as Lang[]).map((lg) => (
                  <ol key={lg} lang={lg === 'zh' ? 'zh-CN' : 'th'} className="space-y-2 list-decimal pl-5">
                    {CLAUSES.map((k) => <li key={k}>{tr(`c2.cl.${k}` as never, clauseVars(w.terms, post, lg), lg)}</li>)}
                  </ol>))}
              </div>
            </details>
          </>)}
          {step === 'id' && <IdentityStep record={w.record} mrz={w.mrz} country={post.country} today={today} checked={w.idChecked} sample={isSample}
            onRecord={(record) => save({ record, idChecked: false })} onMrz={(mrz) => save({ mrz, idChecked: false })} onCheck={() => setW((x) => ({ ...x, idChecked: true }))}
            onSample={(isBad) => save({ record: SAMPLE_RECORD, mrz: isBad ? badSampleMrz(today) : SAMPLE_MRZ, idChecked: false })} />}
          {step === 'review' && <ReviewStep country={post.country} review={w.review} canSend={!!findings} onSend={sendReview} onAdvance={advanceReview} />}
          {step === 'sign' && <SignStep sign={w.sign} hash={hash} block={block} sides={chosen.sides} docs={docs} companyName={name(post.company)} workerName={workerName}
            onSign={onSign} onMode={onMode} onPaper={onPaper} />}
          <div className="flex justify-between gap-2">
            <button type="button" className="btn-ghost" disabled={at === 0} onClick={() => setStep(STEPS[at - 1])}><Icon name="back" size={16} />{t('mid.prev')}</button>
            {at < STEPS.length - 1 && <button type="button" className="btn-soft" onClick={() => setStep(STEPS[at + 1])}>{t('mid.next', { s: t(`mid.${STEPS[at + 1]}` as never) })}<Icon name="next" size={16} /></button>}
          </div>
        </div>
      </div>
    </Page>
  )
}

/** the values a clause shows, in one language */
function clauseVars(terms: ContractTerms, post: ContractPost, lg: Lang) {
  const nm = (s: string) => (s.startsWith('@') ? tr(s.slice(1) as never, undefined, lg) : s)
  return {
    company: nm(post.company), position: nm(post.position), place: `${tr(`prov.${post.province}` as never, undefined, lg)}`,
    pay: fmt(terms.pay), cur: tr(`m.cur.${terms.currency}` as never, undefined, lg), daysOff: terms.daysOff,
    deposit: fmt(terms.deposit), deduct: terms.deductPct,
    passport: tr(terms.keepsPassport ? 'c2.cl.passport.kept' : 'c2.cl.passport.own', undefined, lg),
    law: tr(post.country === 'CN' ? 'c2.lawOf.CN' : 'c2.lawOf.TH', undefined, lg),
  }
}
/** the contract text in one language: the clauses, then who the worker is (the text the signatures are bound to) */
function contractLines(terms: ContractTerms, post: ContractPost, worker: string, passport: string, lg: Lang): string[] {
  const lines = CLAUSES.map((k) => tr(`c2.cl.${k}` as never, clauseVars(terms, post, lg), lg))
  return worker ? [...lines, tr('sg.workerLine' as never, { n: worker, p: passport || '—' }, lg)] : lines
}
const flagVars = (f: ContractFinding, t: (k: never) => string) => Object.fromEntries(Object.entries(f.vars ?? {}).map(([k, v]) => [k, k === 'cur' ? t(`m.cur.${v}` as never) : typeof v === 'number' ? fmt(v) : v])) as never

function Findings({ list }: { list: ContractFinding[] }) {
  const { t } = useI18n()
  if (!list.length) return <p className="text-sm text-ok-fg flex items-center gap-1.5" role="status"><Icon name="ok" size={16} />{t('c2.ok')}</p>
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm font-semibold text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={16} />{t('c2.found', { n: list.length })}</p>
      <ul className="space-y-2">{list.map((f) => (
        <li key={f.flag} className={`rounded-lg border p-3 text-sm space-y-1 ${f.severity === 'high' ? 'border-danger-line bg-danger-bg text-danger-fg' : 'border-warn-line bg-warn-bg text-warn-fg'}`}>
          <p className="font-medium">{t('c2.clause', { n: f.clause })} · {t(`c2.flag.${f.flag}` as never, flagVars(f, t as never))}</p>
          <p className="text-xs">{t(`c2.why.${f.flag}` as never)}</p>
          <p className="flex flex-wrap gap-1.5">{f.laws.map((l) => <span key={l} className="chip bg-surface3 text-ink border-line text-xs">{t(l as never)}</span>)}</p>
        </li>))}</ul>
      <p className="text-xs text-muted">{t('c2.notLegal')}</p>
    </div>
  )
}
