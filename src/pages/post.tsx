import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { NavLink, go, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { capacityOf, caseBlocksDelete, localDay, type Outcome, type Problem } from '../domain/match/logic'
import { reachFor, scheduleOf, stageAt, capStage } from '../domain/match/release'
import { LEVELS, ME, MY_EMPLOYER, type Acceptance } from '../domain/match/types'
import { usePresence } from '../presence'
import { Icon } from '../components/icons'
import { Warn } from '../components/ui'
import { useConfirm } from '../components/confirm'
import { CaseLink } from './case'
import { AgencyLinks, Empty, LevelBadge, Page, PostFacts, Toast, useApplicantName, useFieldError, useGate, useNames, useRel } from './match'

/**
 * One post (owner, Oct 2026): details, the five release levels with their times, who else is looking at it right now, and —
 * for a job seeker — apply (or reserve a place in the queue when it is full) with a short introduction and a start date, or
 * withdraw; for its employer — confirm or decline applicants, see the queue, renew, edit, delete.
 */
const today = (now: number) => localDay(new Date(now).toISOString())
const plusDays = (now: number, d: number) => localDay(new Date(now + d * 86_400_000).toISOString())

export function PostPage() {
  const { t } = useI18n()
  const N = useNames()
  const { until } = useRel()
  const { st, now, mode, pool, counts, apply, withdraw, decide, renew, deletePost } = useMatch()
  const nameOf = useApplicantName()
  const id = useSearchParam('id')
  const [intro, setIntro] = useState(''), [from, setFrom] = useState(''), [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ask, askDialog] = useConfirm()
  const [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const fe = useFieldError()
  const p = st.posts.find((x) => x.id === id)
  const mine = !!p && p.employerId === MY_EMPLOYER
  const myApp = p ? st.acceptances.find((a) => a.postId === p.id && a.seekerId === ME) : undefined
  const caseOf = (accId: string) => st.cases.find((c) => c.accId === accId)
  const myCase = myApp ? caseOf(myApp.id) : undefined
  const reach = p && !mine ? reachFor(p, st.me.pins, pool, now) : null
  const canApply = !!p && !mine && !myApp && st.role === 'seeker' && !!reach?.visible
  const presence = usePresence(p?.id ?? null, mode === 'remote', canApply && (focused || intro !== '' || from !== ''))
  const gate = useGate(`post?id=${id}`)
  if (gate) return <Page title={t('m.pp.title')}>{gate}</Page>
  if (!p) return <Page title={t('m.pp.title')}><Empty icon="posts" text={t('m.pp.notFound')} to="board" action={t('m.board')} /></Page>

  const s = scheduleOf(p, pool, now), stage = capStage(stageAt(s, now), p)
  const c = counts[p.id] ?? { held: 0, pending: 0, reserved: 0 }, cap = capacityOf(p)
  const full = c.held >= cap
  const state = full ? (c.pending > 0 ? 'waiting' : 'closed') : 'open'
  const appsOf = st.acceptances.filter((a) => a.postId === p.id).sort((a, b) => a.at.localeCompare(b.at))
  const queue = appsOf.filter((a) => a.status === 'reserved')
  const levelEnds = [s.end1, s.end2, s.end3, s.end4, s.expiresAt]
  const problemText = (pr: Problem) => N.problem(pr)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setMsg(null); fe.clear()
    if (!from) { fe.set('ap-from', 'ap-from', problemText('available')); return }
    setBusy(true)
    const r = await apply(p.id, { intro: intro.trim(), availableFrom: from })
    setBusy(false)
    if (r.ok) { setIntro(''); setFrom(''); setMsg({ tone: 'info', text: t(r.value.status === 'reserved' ? 'm.ap.reservedDone' : 'm.ap.done') }); return }
    if (r.problem === 'intro' || r.problem === 'contact') fe.set('ap-intro', 'ap-intro', problemText(r.problem))
    else if (r.problem === 'available') fe.set('ap-from', 'ap-from', problemText(r.problem))
    else setMsg({ tone: 'danger', text: problemText(r.problem) })
  }
  const act = async (run: () => Promise<boolean | Outcome<unknown>>, done: string) => {
    setBusy(true); const r = await run(); setBusy(false)
    if (r === true || (typeof r === 'object' && r.ok)) setMsg({ tone: 'info', text: done })
    else setMsg({ tone: 'danger', text: typeof r === 'object' && !r.ok ? problemText(r.problem) : t('m.err.network') })
  }
  const statusLine = (a: Acceptance) => a.status === 'reserved' ? t('m.ap.inQueue', { n: c.reserved }) : t(`m.as.${a.status}` as never)

  return (
    <Page title={p.position} sub={`${p.company} · ${N.place(p.country, p.province)} · ${N.industry(p.industry)}`}>
      <div className="flex flex-wrap items-center gap-2">
        {stage !== 'expired' && <LevelBadge level={mine || !reach ? stage : reach.level} reached={mine || !reach} />}
        <span className="chip bg-surface3 border-line"><Icon name="users" size={12} />{t('m.cnt.held', { n: c.held, max: cap })}</span>
        {c.reserved > 0 && <span className="chip bg-info-bg text-info-fg border-info-line"><Icon name="ticket" size={12} />{t('m.cnt.reserved', { n: c.reserved })}</span>}
        {state !== 'open' && <span className="chip bg-warn-bg text-warn-fg border-warn-line">{t(state === 'waiting' ? 'm.state.waiting' : 'm.state.closed')}</span>}
        {p.verified ? <span className="chip bg-ok-bg text-ok-fg border-ok-line"><Icon name="shield" size={12} />{t('m.vf.badge')}</span>
          : <span className="chip bg-warn-bg text-warn-fg border-warn-line"><Icon name="warn" size={12} />{t('m.vf.unverified')}</span>}
      </div>
      {/* real people only: others who have this post open now, and how many are filling in the form (database mode) */}
      <div role="status" aria-live="polite" className="space-y-1">
        {presence && presence.viewing > 0 && <p className="text-sm font-medium text-primary flex items-center gap-1.5"><Icon name="eye" size={16} />{t('m.live.viewing', { n: presence.viewing })}</p>}
        {presence && presence.filling > 0 && <p className="text-sm font-medium text-warn-fg flex items-center gap-1.5"><Icon name="edit" size={16} />{t('m.live.filling', { n: presence.filling })}</p>}
      </div>
      {!p.verified && !mine && <Warn>{t('m.vf.warnSeeker')}</Warn>}
      <Toast msg={msg} />
      {askDialog}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* ---------- job seeker: apply / reserve / my application ---------- */}
          {!mine && st.role === 'seeker' && (
            <section className="card space-y-3" aria-labelledby="ap-h">
              {myApp ? (<>
                <h2 id="ap-h" className="h2">{t('m.ap.mine')}</h2>
                <p className="font-medium flex items-center gap-2"><Icon name={myApp.status === 'rejected' ? 'info' : 'ok'} size={18} className={myApp.status === 'rejected' ? 'text-muted' : 'text-ok-fg'} />{statusLine(myApp)}</p>
                {myApp.promotedAt && <p className="text-sm text-muted">{t('m.ap.promoted', { d: N.dayTime(Date.parse(myApp.promotedAt)) })}</p>}
                {myCase && <CaseLink c={myCase} />}
                {(myApp.status === 'confirmed' || myApp.status === 'forwarded') && <AgencyLinks />}
                {(myApp.status === 'accepted' || myApp.status === 'reserved' || (myApp.status === 'confirmed' && !myCase?.steps.submitted)) && (
                  <button type="button" className="btn-ghost text-danger-fg" disabled={busy} onClick={async () => { if (await ask(t('m.ap.withdraw.confirm'), { yes: t(myApp.status === 'reserved' ? 'm.ap.withdrawQueue' : 'm.ap.withdraw'), danger: true })) void act(() => withdraw(myApp.id), t('m.ap.withdrawn')) }}>{busy ? t('m.ask.busy') : t(myApp.status === 'reserved' ? 'm.ap.withdrawQueue' : 'm.ap.withdraw')}</button>)}
              </>) : canApply ? (
                <form className="space-y-3" onSubmit={submit} noValidate onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false) }}>
                  <h2 id="ap-h" className="h2">{t(full ? 'm.ap.reserveTitle' : 'm.ap.title')}</h2>
                  <p className="text-sm text-muted">{t(full ? 'm.ap.reserveLead' : 'm.ap.lead', { n: c.reserved })}</p>
                  <div><label className="block"><span className="label">{t('m.ap.intro')} <span className="font-normal text-muted">({t('m.opt')})</span></span>
                    <textarea id="ap-intro" className="input min-h-[96px]" maxLength={300} value={intro} aria-invalid={fe.invalid('ap-intro')} aria-describedby={fe.describe('ap-intro', 'ap-intro-hint')} onChange={(e) => { setIntro(e.target.value); fe.clear() }} /></label>
                    <span id="ap-intro-hint" className="block text-xs text-muted mt-1">{t('m.ap.introHint')}</span>{fe.msg('ap-intro')}</div>
                  <div><label className="block"><span className="label">{t('m.ap.from')}<span className="font-normal text-muted"> ({t('m.req')})</span></span>
                    <input id="ap-from" className="input" type="date" min={today(now)} max={plusDays(now, 730)} aria-required="true" value={from} aria-invalid={fe.invalid('ap-from')} aria-describedby={fe.describe('ap-from')} onChange={(e) => { setFrom(e.target.value); fe.clear() }} /></label>{fe.msg('ap-from')}</div>
                  <button type="submit" className="btn-primary" disabled={busy}><Icon name={full ? 'ticket' : 'send'} size={16} />{t(full ? 'm.ap.reserve' : 'm.ap.go')}</button>
                </form>
              ) : (<>
                <h2 id="ap-h" className="h2">{t('m.ap.title')}</h2>
                <p className="text-sm text-muted">{reach?.opensAt ? t('m.ap.notYetAt', { d: N.dayTime(reach.opensAt) }) : t('m.ap.notYet')}</p>
              </>)}
            </section>)}

          {/* ---------- employer: applicants, queue, renew ---------- */}
          {mine && (
            <section className="card space-y-3" aria-labelledby="em-h">
              <h2 id="em-h" className="h2">{t('m.em.title')}</h2>
              {now >= s.warnAt && <Warn>{t('m.em.expiring', { t: until(s.expiresAt) })}</Warn>}
              <p className="text-sm text-muted">{t('m.em.life', { d: N.dayTime(s.expiresAt) })}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" disabled={busy} onClick={async () => { if (await ask(t('m.em.renew.confirm'), { yes: t('m.em.renew') })) void act(() => renew(p.id), t('m.em.renewed')) }}><Icon name="renew" size={15} />{busy ? t('m.ask.busy') : t('m.em.renew')}</button>
                <NavLink to={`hire?edit=${p.id}`} className="btn-ghost text-sm"><Icon name="edit" size={15} />{t('m.post.edit')}</NavLink>
                <button type="button" className="btn-ghost text-sm text-danger-fg" disabled={busy} onClick={async () => {
                  if (caseBlocksDelete(st, p.id)) { setMsg({ tone: 'danger', text: problemText('caseStarted') }); return }
                  if (!(await ask(t('m.post.delete.confirm'), { yes: t('m.post.delete'), danger: true }))) return
                  setBusy(true); const ok = await deletePost(p.id); setBusy(false)
                  if (ok) go('hire'); else setMsg({ tone: 'danger', text: t('m.post.delete.fail') })
                }}><Icon name="trash" size={15} />{t('m.post.delete')}</button>
              </div>
              <h3 className="font-semibold pt-2 border-t border-line">{t('m.em.applicants', { n: appsOf.filter((a) => a.status !== 'reserved').length })}</h3>
              {!appsOf.some((a) => a.status !== 'reserved') ? <p className="text-sm text-muted">{t('m.em.noneYet')}</p> : (
                <ul className="space-y-2">{appsOf.filter((a) => a.status !== 'reserved').map((a) => (
                  <li key={a.id} className="card-i space-y-1.5 text-sm">
                    <p className="flex flex-wrap items-center justify-between gap-2"><b>{nameOf(a)}</b><span className="chip bg-surface3 border-line">{t(`m.as.${a.status}` as never)}</span></p>
                    {a.intro && <p className="text-muted">“{a.intro}”</p>}
                    {a.availableFrom && <p className="text-xs text-muted">{t('m.ap.fromShort', { d: N.day(a.availableFrom) })}{a.promotedAt ? ` · ${t('m.n.fromQueue')}` : ''}</p>}
                    {(() => { const c = caseOf(a.id); return c ? <div className="pt-1"><CaseLink c={c} /></div> : null })()}
                    {a.status === 'accepted' && <div className="flex flex-wrap gap-2 pt-1">
                      <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void act(() => decide(a.id, true), t('m.em.confirmed'))}><Icon name="ok" size={15} />{t('m.em.confirm')}</button>
                      <button type="button" className="btn-ghost text-sm" disabled={busy} onClick={async () => { if (await ask(t('m.em.decline.confirm'), { yes: t('m.em.decline'), danger: true })) void act(() => decide(a.id, false), t('m.em.declined')) }}>{t('m.em.decline')}</button>
                    </div>}
                  </li>))}</ul>)}
              <h3 className="font-semibold pt-2 border-t border-line">{t('m.em.queue', { n: queue.length })}</h3>
              {!queue.length ? <p className="text-sm text-muted">{t('m.em.queueNone')}</p> : (
                <ol className="space-y-1.5 text-sm list-decimal pl-5">{queue.map((a) => <li key={a.id}><b>{nameOf(a)}</b>{a.intro && <span className="text-muted"> — “{a.intro}”</span>}</li>)}</ol>)}
              <p className="text-xs text-muted">{t('m.em.queueHint')}</p>
            </section>)}

          {/* ---------- the release, level by level ---------- */}
          <section className="glass-card p-5 space-y-3" aria-labelledby="pp-tl"><h2 id="pp-tl" className="h2">{t('m.pp.timeline')}</h2>
            <p className="text-sm text-muted">{t(p.releasedAt !== p.createdAt ? 'm.pp.renewedOn' : 'm.pp.posted', { d: N.dayTime(Date.parse(p.releasedAt)) })}</p>
            {!p.verified && mine && <Warn>{t('m.vf.capNote')} <NavLink to="me" className="underline underline-offset-4 font-medium">{t('m.cs.goVerify')}</NavLink></Warn>}
            <ol className="space-y-3">{LEVELS.map((l, i) => {
              const done = stage !== 'expired' && l < stage, current = stage === l
              return (
                <li key={l} aria-current={current ? 'step' : undefined} className="flex items-start gap-3">
                  <span className={`w-7 h-7 shrink-0 rounded-full grid place-items-center text-xs font-bold ${done ? 'bg-ok-fg text-ok-bg' : current ? 'bg-primary text-onprimary' : 'bg-surface3 text-muted'}`}>{done ? <Icon name="check" size={14} /> : l}</span>
                  <div className={`text-sm ${current ? 'font-semibold' : done ? '' : 'text-muted'}`}>
                    <p>{t(`m.lv.${l}` as never)}</p>
                    <p className="text-xs font-normal text-muted">{l === 1 ? (s.groups.length ? t('m.pp.groups', { n: s.groups.length }) : t('m.pp.noGroups')) + ' · ' : ''}{t(i === 4 ? 'm.pp.until.expiry' : 'm.pp.until', { d: N.dayTime(levelEnds[i]) })}</p>
                  </div>
                </li>)
            })}</ol>
          </section>
        </div>
        <section className="glass-card p-5 space-y-4" aria-labelledby="pp-dt"><h2 id="pp-dt" className="h2">{t('m.pp.details')}</h2>
          <p className="text-sm">{t('jb.minYearsShort', { n: p.minYears })} · {p.skills.map(N.skill).join(', ')}</p>
          <PostFacts post={p} />
          {p.details && <p className="text-sm text-muted border-t border-line pt-3">{p.details}</p>}
        </section>
      </div>
    </Page>
  )
}
