// Contract check before signing (v2 model, owner Nov 2026: the "middle system"). A draft contract is built from the job post; both
// sides can see it, change the clauses and check it against the post and the law of the country of work (rules in
// domain/match/contract.ts). The draft is shown in Thai and Chinese side by side. Sample data only; nothing is signed or sent,
// and the page says it is not legal advice.
import { useMemo, useState } from 'react'
import { tr, type Lang } from '../i18n/core'
import { useI18n } from '../i18n'
import { useMatch } from '../matchData'
import { useSearchParam } from '../store'
import { CLAUSES, checkContract, draftFromPost, riskyDraft, termsProblem, type ContractFinding, type ContractTerms } from '../domain/match/contract'
import { minMonthlyWage } from '../domain/match/minwage'
import { ME, MY_EMPLOYER, type Country, type Currency, type Salary } from '../domain/match/types'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { Page, useNames } from './match'
import { useAuth } from '../auth'
import { aiContract } from '../ai/client'
import type { AiCheck, AiResponse } from '../ai/spec'
import { AiCheckResult } from './ask'

/** the post a contract is checked against (a real post of one of my cases, or the training sample from the slides) */
interface ContractPost { id: string; company: string; position: string; country: Country; province: string; salary: Salary | null; sample: boolean }
/** the slides' sample: a quality inspector in Shenzhen at 6,000 yuan a month (Chinese law applies) */
export const SAMPLE_POST: ContractPost = { id: 'sample', company: '@c2.sample.company', position: '@c2.sample.position', country: 'CN', province: 'CN-GD', salary: { min: 6000, max: 6000, currency: 'CNY' }, sample: true }

const fmt = (n: number) => n.toLocaleString('en-US')

export function ContractPage() {
  const { t, lang } = useI18n()
  const N = useNames()
  const { st } = useMatch()
  const { status, online } = useAuth()
  const [ai, setAi] = useState<AiResponse<AiCheck> | 'busy' | null>(null)
  const canAi = status === 'signedIn' && online !== false
  const fromCase = useSearchParam('case')
  const [caseId, setCaseId] = useState(fromCase)
  // the posts of my cases (as the worker or as the employer), then the sample
  const choices = useMemo(() => {
    const mine = st.cases.flatMap((c) => {
      const p = st.posts.find((x) => x.id === c.postId)
      if (!p || (c.seekerId !== ME && p.employerId !== MY_EMPLOYER)) return []
      return [{ caseId: c.id, post: { id: p.id, company: p.company, position: p.position, country: p.country, province: p.province, salary: p.salary, sample: !!p.sample } as ContractPost }]
    })
    return [...mine, { caseId: 'sample', post: SAMPLE_POST }]
  }, [st.cases, st.posts])
  const chosen = choices.find((c) => c.caseId === caseId) ?? choices[choices.length - 1]
  const post = chosen.post
  const [terms, setTerms] = useState<ContractTerms>(() => draftFromPost(post))
  const [findings, setFindings] = useState<ContractFinding[] | null>(null)
  const [postKey, setPostKey] = useState(post.id)
  if (postKey !== post.id) { setPostKey(post.id); setTerms(draftFromPost(post)); setFindings(null) } // another post: start again from it
  const set = (patch: Partial<ContractTerms>) => { setTerms((x) => ({ ...x, ...patch })); setFindings(null); setAi(null) }
  const askAi = async () => {
    setAi('busy')
    const clauses = CLAUSES.map((k) => tr(`c2.cl.${k}` as never, clauseVars(terms, post, lang), lang))
    setAi(await aiContract({ country: post.country, province: post.province, position: name(post.position), postSalary: post.salary, clauses }, lang))
  }
  const bad = termsProblem(terms)
  const name = (s: string) => (s.startsWith('@') ? t(s.slice(1) as never) : s)
  const min = minMonthlyWage(post.country, post.province)
  const cur = (c: Currency) => t(`m.cur.${c}` as never)
  const num = (v: string) => (v.trim() === '' ? 0 : Number(v))

  return (
    <Page title={t('c2.title')} sub={t('c2.sub')}>
      <Warn tone="info">{t('c2.note')}</Warn>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-start">
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
        </section>

        <section className="card space-y-3" aria-labelledby="c2-terms">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="c2-terms" className="h2">{t('c2.terms.h')}</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => { setTerms(draftFromPost(post)); setFindings(null) }}>{t('c2.reset')}</button>
              <button type="button" className="btn-soft text-sm" onClick={() => { setTerms(riskyDraft(post)); setFindings(null) }}>{t('c2.risky')}</button>
            </div></div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1"><span className="font-medium">{t('c2.f.pay')} ({cur(terms.currency)})</span>
              <input className="input w-full" inputMode="numeric" value={terms.pay} onChange={(e) => set({ pay: num(e.target.value) })} aria-invalid={bad === 'pay'} /></label>
            <label className="space-y-1"><span className="font-medium">{t('c2.f.daysOff')}</span>
              <select className="input w-full" value={terms.daysOff} onChange={(e) => set({ daysOff: Number(e.target.value) })}>{[0, 1, 2].map((d) => <option key={d} value={d}>{t('c2.days', { n: d })}</option>)}</select></label>
            <label className="space-y-1"><span className="font-medium">{t('c2.f.deposit')} ({cur(terms.currency)})</span>
              <input className="input w-full" inputMode="numeric" value={terms.deposit} onChange={(e) => set({ deposit: num(e.target.value) })} aria-invalid={bad === 'deposit'} /></label>
            <label className="space-y-1"><span className="font-medium">{t('c2.f.deduct')}</span>
              <input className="input w-full" inputMode="numeric" value={terms.deductPct} onChange={(e) => set({ deductPct: num(e.target.value) })} aria-invalid={bad === 'deduct'} /></label>
            <label className="sm:col-span-2 flex items-start gap-2 min-h-control"><input type="checkbox" className="mt-1" checked={terms.keepsPassport} onChange={(e) => set({ keepsPassport: e.target.checked })} /><span>{t('c2.f.passport')}</span></label>
          </div>
          {bad && <p className="text-sm text-danger-fg" role="alert">{t('c2.bad')}</p>}
          <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!!bad} onClick={() => setFindings(checkContract(terms, post))}><Icon name="ok" size={16} />{t('c2.check')}</button></div>
          {findings && <Findings list={findings} />}
          {findings && (canAi
            ? <div className="space-y-2 border-t border-line pt-3">
                <button type="button" className="btn-soft" disabled={ai === 'busy'} onClick={() => void askAi()}><Icon name="ai" size={16} />{ai === 'busy' ? t('c2.ai.busy') : t('c2.ai.go')}</button>
                {ai && ai !== 'busy' && (ai.ok ? <AiCheckResult res={ai.result} left={ai.left} /> : <p className="text-sm text-muted">{t('c2.ai.fail', { why: t(`ai.why.${ai.reason}` as never) })}</p>)}
              </div>
            : <p className="text-xs text-muted border-t border-line pt-3">{t('c2.ai.signin')}</p>)}
        </section>
      </div>

      <details className="card group">
        <summary className="cursor-pointer font-semibold min-h-control flex items-center">{t('c2.draft.h')}</summary>
        <p className="text-xs text-muted mt-1">{t('c2.draft.note')}</p>
        <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm">
          {(['th', 'zh'] as Lang[]).map((lg) => (
            <ol key={lg} lang={lg === 'zh' ? 'zh-CN' : 'th'} className="space-y-2 list-decimal pl-5">
              {CLAUSES.map((k) => <li key={k}>{tr(`c2.cl.${k}` as never, clauseVars(terms, post, lg), lg)}</li>)}
            </ol>))}
        </div>
      </details>
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

function Findings({ list }: { list: ContractFinding[] }) {
  const { t } = useI18n()
  if (!list.length) return <p className="text-sm text-ok-fg flex items-center gap-1.5" role="status"><Icon name="ok" size={16} />{t('c2.ok')}</p>
  const vars = (f: ContractFinding) => Object.fromEntries(Object.entries(f.vars ?? {}).map(([k, v]) => [k, k === 'cur' ? t(`m.cur.${v}` as never) : typeof v === 'number' ? fmt(v) : v]))
  return (
    <div className="space-y-2" role="status">
      <p className="text-sm font-semibold text-danger-fg flex items-center gap-1.5"><Icon name="alert" size={16} />{t('c2.found', { n: list.length })}</p>
      <ul className="space-y-2">{list.map((f) => (
        <li key={f.flag} className={`rounded-lg border p-3 text-sm space-y-1 ${f.severity === 'high' ? 'border-danger-line bg-danger-bg text-danger-fg' : 'border-warn-line bg-warn-bg text-warn-fg'}`}>
          <p className="font-medium">{t('c2.clause', { n: f.clause })} · {t(`c2.flag.${f.flag}` as never, vars(f))}</p>
          <p className="text-xs">{t(`c2.why.${f.flag}` as never)}</p>
          <p className="flex flex-wrap gap-1.5">{f.laws.map((l) => <span key={l} className="chip bg-surface3 text-ink border-line text-xs">{t(l as never)}</span>)}</p>
        </li>))}</ul>
      <p className="text-xs text-muted">{t('c2.notLegal')}</p>
    </div>
  )
}
