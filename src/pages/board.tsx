import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { activePins, capacityOf, isCountry, pinQuota, postQuota } from '../domain/match/logic'
import { reportedIds } from '../domain/match/reports'
import { reachFor, scheduleOf, stageAt, capStage } from '../domain/match/release'
import { CURRENCIES, LEVELS, ME, MY_EMPLOYER, SKILLS, type Currency, type Level, type Post, type Skill } from '../domain/match/types'
import type { GeoCode } from '../geo'
import { GeoMap } from '../components/geomap'
import { Icon } from '../components/icons'
import { Drawer } from '../components/drawer'
import { Pager, useFit, useFitGrid, usePaged } from '../components/pager'
import { Empty, LevelBadge, Page, PinList, PostFacts, QuotaBar, SampleBadge, SortToggle, useGate, useNames, useRel } from './match'
import { ReportButton } from './safety'

/**
 * The board (owner, Oct 2026): one place to see the posts, built like a game shop with five levels. Job seekers see the posts
 * open to them — level 1 matches their pins best, level 5 is international — as the release reaches them. Employers see every
 * live post (their own and other employers', at the level each has reached) and can narrow it to their own. The map shows where
 * posts (or pins) are — counts only.
 * Layout after the owner's reference (the "Team" page): title with the main button, one row of pill filters with the count,
 * centred cards in a grid of four, a card/map switch, and a details panel that slides in without leaving the board.
 */
interface Filter { q: string; country: '' | 'TH' | 'CN'; province: string; skill: '' | Skill; salary: string; currency: Currency }
const NO_FILTER: Filter = { q: '', country: '', province: '', skill: '', salary: '', currency: 'THB' }
const pill = (on: boolean) => `min-h-[34px] px-3 sm:px-3.5 rounded-full text-sm inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors ${on ? 'bg-primary text-onprimary font-semibold shadow-sm' : 'text-ink hover:bg-surface3'}`
const SEG = 'inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1'
const SEG_SCROLL = 'flex sm:inline-flex flex-nowrap sm:flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1 overflow-x-auto max-w-full no-scrollbar'

export function BoardPage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, limitNow, pool, pinsByProvince } = useMatch()
  const [tab, setTab] = useState<'all' | Level>('all')
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [order, setOrder] = useState<'new' | 'old'>('new')
  const asked = useSearchParam('q') // from the header search
  const [f, setF] = useState<Filter>(() => ({ ...NO_FILTER, q: asked }))
  useEffect(() => { if (asked) setF((x) => ({ ...x, q: asked })) }, [asked])
  const [more, setMore] = useState(false)
  const [view, setView] = useState<'cards' | 'map'>('cards')
  const [mapOf, setMapOf] = useState<'posts' | 'pins' | null>(null)
  const [pinsOpen, setPinsOpen] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const fit = useFit()
  const [gridRef, dim] = useFitGrid(250, 16, 4, `${tab}|${scope}|${view}|${more}|${pinsOpen}`)
  const gate = useGate('board')
  if (gate) return <Page title={t('m.board.title')}>{gate}</Page>
  if (!st.role) return <Page title={t('m.board.title')} sub={t('m.board.sub')}><Empty icon="posts" text={t('m.profile.none')} to="choose-role" action={t('hero.cta')} /></Page>
  const seeker = st.role === 'seeker'
  const showMap = mapOf ?? (seeker ? 'posts' : 'pins')

  // seekers: the posts open to them (and any they applied to), at their level · employers: every live post at the level it reached
  const mineApplied = new Set(st.acceptances.filter((a) => a.seekerId === ME).map((a) => a.postId))
  const reported = reportedIds(st) // posts I reported leave my board
  const items: { post: Post; level: Level }[] = seeker
    ? st.posts.filter((p) => p.employerId !== MY_EMPLOYER && (!reported.has(p.id) || mineApplied.has(p.id))).flatMap((p) => { const r = reachFor(p, st.me.pins, pool, now); return r.visible || mineApplied.has(p.id) ? [{ post: p, level: r.level }] : [] })
    : st.posts.filter((p) => scope === 'all' || p.employerId === MY_EMPLOYER).flatMap((p) => { const s = capStage(stageAt(scheduleOf(p, pool, now), now), p); return s === 'expired' ? [] : [{ post: p, level: s }] })
  const myOpen = st.posts.filter((p) => p.employerId === MY_EMPLOYER && capStage(stageAt(scheduleOf(p, pool, now), now), p) !== 'expired')
  const matches = (p: Post) => {
    const q = f.q.trim().toLowerCase()
    if (q) {
      const hay = [p.company, p.position, N.industry(p.industry), N.prov(p.province), N.country(p.country), ...p.skills.map(N.skill)].join(' ').toLowerCase()
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false
    }
    if (f.country && p.country !== f.country) return false
    if (f.province && p.province !== f.province) return false
    if (f.skill && !p.skills.includes(f.skill)) return false
    const min = Number(f.salary)
    if (f.salary.trim() && Number.isFinite(min) && min > 0 && (!p.salary || p.salary.currency !== f.currency || p.salary.max < min)) return false
    return true
  }
  const found = items.filter((x) => matches(x.post))
  const perLevel = (l: Level) => found.filter((x) => x.level === l).length
  const shown = found.filter((x) => tab === 'all' || x.level === tab)
    .sort((a, b) => (order === 'new' ? b.post.releasedAt.localeCompare(a.post.releasedAt) : a.post.releasedAt.localeCompare(b.post.releasedAt)))
  const filtering = JSON.stringify(f) !== JSON.stringify(NO_FILTER)

  // map: posts or job seekers' pins per province (counts only)
  const postsByProvince = items.map((x) => x.post).reduce<Record<string, number>>((m, p) => ({ ...m, [p.province]: (m[p.province] ?? 0) + 1 }), {})
  const mapCounts = showMap === 'posts' ? postsByProvince : pinsByProvince
  const top = Object.entries(mapCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const q = seeker ? pinQuota(st, limitNow) : postQuota(st, limitNow)
  const set = (patch: Partial<Filter>) => setF((x) => ({ ...x, ...patch }))
  const waiting = st.acceptances.filter((a) => a.status === 'accepted' && myOpen.some((p) => p.id === a.postId)).length
  const current = open ? items.find((x) => x.post.id === open) : undefined

  return (
    <Page title={t('m.board.title')} sub={t(seeker ? 'm.board.subSeeker' : 'm.board.subEmployer2')} fit body="flex flex-col gap-3"
      actions={<NavLink to={seeker ? 'seek' : 'hire'} className="btn-primary !rounded-full"><Icon name="plus" size={16} />{t(seeker ? 'm.pin.go' : 'm.emp.post')}</NavLink>}>
      {/* my allowance and what I have running, in one line */}
      <section className="shrink-0 glass-card px-3 py-2 sm:p-3 sm:px-4 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm" aria-label={t(seeker ? 'm.board.mePins' : 'm.board.mePosts')}>
        <div className="flex-1 min-w-[220px]"><QuotaBar q={q} kind={seeker ? 'pin' : 'post'} /></div>
        {seeker
          ? <button type="button" className="btn-ghost text-sm !rounded-full" aria-expanded={pinsOpen} aria-controls="bd-pins" onClick={() => setPinsOpen((x) => !x)}><Icon name="pin" size={15} />{t('m.bd.myPinsN', { n: activePins(st.me, limitNow).length })}<Icon name={pinsOpen ? 'up' : 'down'} size={14} /></button>
          : <p className="text-sm flex flex-wrap gap-x-4 gap-y-1"><span>{t('m.board.open', { n: myOpen.length })}</span><span className="text-muted">{t('m.bd.waitingN', { n: waiting })}</span></p>}
      </section>
      {seeker && pinsOpen && <section id="bd-pins" className="shrink-0 fit:max-h-[40%] fit:overflow-y-auto" aria-label={t('m.board.myPins')}><PinList /></section>}

      {/* one row of pill filters with the count (owner's reference) */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
          {!seeker && (
            <div className={SEG} role="group" aria-label={t('m.bd.scope')}>
              {(['all', 'mine'] as const).map((s) => <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={pill(scope === s)}>{t(s === 'all' ? 'm.bd.scope.all' : 'm.bd.scope.mine')}</button>)}
            </div>)}
          <div className={SEG_SCROLL} role="group" aria-label={t('m.board.levels')}>
            <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')} className={pill(tab === 'all')}>{t('m.bd.all')}</button>
            {LEVELS.map((l) => <button key={l} type="button" aria-pressed={tab === l} onClick={() => setTab(l)} className={pill(tab === l)}>{t('m.lv.short', { n: l })}<span className="text-xs opacity-75">{perLevel(l)}</span></button>)}
          </div>
        </div>
        <p className="text-sm text-muted" role="status">{t('m.board.count', { n: shown.length })}</p>
      </div>
      {tab !== 'all' && <p className="shrink-0 text-xs text-muted -mt-2 fit:mt-0">{t(`m.lv.d${tab}` as never)}</p>}

      <form role="search" className="shrink-0 flex flex-wrap items-center gap-2" onSubmit={(e) => e.preventDefault()} aria-label={t('m.board.search')}>
        <label className="block flex-1 min-w-[160px]"><span className="sr-only">{t('m.board.search')}</span>
          <span className="relative block"><Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" className="input pl-9 !rounded-full" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('m.board.searchHint')} /></span></label>
        <button type="button" className="btn-ghost text-sm !rounded-full" aria-expanded={more} aria-controls="bd-more" onClick={() => setMore((x) => !x)}><Icon name="filter" size={15} /><span className="sr-only sm:not-sr-only">{t(more ? 'm.bd.fewer' : 'm.bd.more')}</span></button>
        <SortToggle order={order} onChange={setOrder} />
        <div className={SEG} role="group" aria-label={t('m.bd.viewAs')}>
          {(['cards', 'map'] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={pill(view === v)} aria-label={t(v === 'cards' ? 'm.bd.view.cards' : 'm.bd.view.map')}><Icon name={v === 'cards' ? 'overview' : 'globe'} size={15} /><span className="hidden sm:inline">{t(v === 'cards' ? 'm.bd.view.cards' : 'm.bd.view.map')}</span></button>)}
        </div>
      </form>
      <div id="bd-more" className={`${more ? 'grid' : 'hidden'} shrink-0 card sm:grid-cols-2 lg:grid-cols-4 gap-3`}>
        <label className="block"><span className="label">{t('m.country')}</span><select className="input" value={f.country} onChange={(e) => set({ country: e.target.value as Filter['country'], province: '' })}><option value="">{t('m.board.any')}</option>{(['TH', 'CN'] as const).map((c) => <option key={c} value={c}>{N.country(c)}</option>)}</select></label>
        <label className="block"><span className="label">{t('m.province')}</span><select className="input" value={f.province} disabled={!f.country} onChange={(e) => set({ province: e.target.value })}><option value="">{t('m.board.any')}</option>{f.country && N.provList(f.country).map((p) => <option key={p} value={p}>{N.prov(p)}</option>)}</select></label>
        <label className="block"><span className="label">{t('m.board.skill')}</span><select className="input" value={f.skill} onChange={(e) => set({ skill: e.target.value as Filter['skill'] })}><option value="">{t('m.board.any')}</option>{SKILLS.map((s) => <option key={s} value={s}>{N.skill(s)}</option>)}</select></label>
        <div><span className="label" id="bd-sal">{t('m.board.salary')}</span>
          <div className="grid grid-cols-[1fr_auto] gap-2" role="group" aria-labelledby="bd-sal">
            <input className="input" type="number" min={0} inputMode="numeric" aria-label={t('m.f.salaryMin')} placeholder={t('m.f.salaryMin')} value={f.salary} onChange={(e) => set({ salary: e.target.value })} />
            <select className="input !w-auto" aria-label={t('m.f.currency')} value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c} value={c}>{t(`m.cur.${c}` as never)}</option>)}</select>
          </div></div>
        {filtering && <div className="sm:col-span-2 lg:col-span-4"><button type="button" className="btn-ghost text-sm" onClick={() => setF(NO_FILTER)}><Icon name="close" size={15} />{t('m.board.clear')}</button></div>}
      </div>

      {view === 'map' && (
        <section className="glass-card p-4 space-y-2 fit:flex-1 fit:min-h-0 fit:flex fit:flex-col" aria-labelledby="bd-map">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bd-map" className="h2 flex items-center gap-2"><Icon name="globe" size={18} className="text-primary" />{t('m.bd.map')}</h2>
            <div className={SEG} role="group" aria-label={t('m.board.mapShow')}>
              {(['posts', 'pins'] as const).map((k) => <button key={k} type="button" aria-pressed={showMap === k} onClick={() => setMapOf(k)} className={pill(showMap === k)}><Icon name={k === 'posts' ? 'posts' : 'pin'} size={14} />{t(k === 'posts' ? 'm.board.mapPosts' : 'm.board.mapPins')}</button>)}
            </div>
          </div>
          <GeoMap className="h-[300px] sm:h-[340px] fit:h-auto fit:flex-1 fit:min-h-0" label={t('m.board.mapLabel')} country={f.country || null} province={f.province || null} counts={mapCounts}
            onPickCountry={(c: GeoCode) => set({ country: isCountry(c) ? c : '', province: '' })} onPickProvince={(p) => set({ province: p ?? '' })} />
          <p className="text-xs text-muted">{top.length ? t('m.board.top', { list: top.map(([p, n]) => `${N.prov(p)} ${n}`).join(' · ') }) : t('m.board.topNone')}</p>
          <p className="text-xs text-muted">{t('m.board.mapHint')}</p>
        </section>)}

      {view === 'cards' && (!shown.length ? <Empty icon={seeker ? 'pin' : 'posts'} text={t(items.length ? 'm.board.noneFound' : seeker ? 'm.board.noneSeeker' : 'm.board.noneEmployer')} to={items.length ? undefined : seeker ? 'seek' : 'hire'} action={items.length ? undefined : t(seeker ? 'm.pin.go' : 'm.emp.post')} /> : (
        <CardGrid shown={shown} fit={fit} dim={dim} gridRef={gridRef} label={t(seeker ? 'm.board.shop' : 'm.bd.listEmployer')}
          card={({ post, level }) => <BoardCard key={post.id} post={post} level={level} reached={!seeker} applied={mineApplied.has(post.id)} viewer={st.role!} onOpen={() => setOpen(post.id)} />} />))}
      {view === 'map' && shown.length > 0 && <p className="shrink-0 text-xs text-muted">{t('m.board.count', { n: shown.length })} — {t('m.bd.mapCards')}</p>}

      <Drawer open={!!current} onClose={() => setOpen(null)}>{(titleId) => current && <PostPanel titleId={titleId} post={current.post} level={current.level} reached={!seeker} applied={mineApplied.has(current.post.id)} viewer={st.role!} />}</Drawer>
    </Page>
  )
}

/** the cards: on a computer exactly as many as fit the space (whole rows), then pages; elsewhere all of them */
function CardGrid({ shown, fit, dim, gridRef, label, card }: { shown: { post: Post; level: Level }[]; fit: boolean; dim: { cols: number; rows: number }; gridRef: React.RefObject<HTMLDivElement | null>; label: string; card: (x: { post: Post; level: Level }) => React.ReactNode }) {
  const pg = usePaged(shown, fit ? dim.cols * dim.rows : Infinity)
  return (
    <div className="fit:flex-1 fit:min-h-0 fit:flex fit:flex-col gap-2">
      <h2 id="bd-list" className="sr-only">{label}</h2>
      <div ref={gridRef} className="fit:flex-1 fit:min-h-0 fit:overflow-y-auto">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 fit:items-start" style={fit ? { gridTemplateColumns: `repeat(${dim.cols}, minmax(0, 1fr))` } : undefined} aria-labelledby="bd-list">
          {pg.items.map(card)}
        </ul>
      </div>
      <Pager page={pg.page} pages={pg.pages} onPage={pg.setPage} className="shrink-0" />
    </div>
  )
}

/** what the main button says: my post → manage · an employer looking at another's post → view · a job seeker → apply / my application */
const actionKey = (post: Post, viewer: 'seeker' | 'employer', applied: boolean) =>
  post.employerId === MY_EMPLOYER ? 'm.bd.manage' : viewer === 'employer' ? 'm.bd.view' : applied ? 'm.bd.applied' : 'm.bd.apply'

/** one post on the board, centred like the reference cards: letter badge, title, company, level, places, fill, two actions */
function BoardCard({ post, level, reached, applied, viewer, onOpen }: { post: Post; level: Level; reached: boolean; applied: boolean; viewer: 'seeker' | 'employer'; onOpen: () => void }) {
  const { t } = useI18n()
  const N = useNames()
  const { ago } = useRel()
  const { counts } = useMatch()
  const c = counts[post.id] ?? { held: 0, pending: 0, reserved: 0 }, cap = capacityOf(post)
  const pct = Math.min(100, Math.round((c.held / cap) * 100))
  const act = t(actionKey(post, viewer, applied))
  return (
    <li data-fit-item className="bd-card p-3.5 sm:p-5 fit:p-4 flex flex-row sm:flex-col items-start sm:items-center text-left sm:text-center gap-3 sm:gap-2 fit:gap-1.5">
      <div className="relative shrink-0">
        <span aria-hidden className={`rar-${level} rar-avatar w-14 h-14 sm:w-16 sm:h-16 fit:w-14 fit:h-14 rounded-full grid place-items-center text-xl font-bold`}>{post.company.trim().charAt(0).toUpperCase()}</span>
        <span className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full grid place-items-center ring-2 ring-[rgb(var(--surface))] ${post.verified ? 'bg-ok-bg text-ok-fg' : 'bg-warn-bg text-warn-fg'}`} title={t(post.verified ? 'm.vf.badge' : 'm.vf.unverified')}>
          <Icon name={post.verified ? 'shield' : 'warn'} size={13} /><span className="sr-only">{t(post.verified ? 'm.vf.badge' : 'm.vf.unverified')}</span></span>
      </div>
      <div className="flex-1 min-w-0 w-full flex flex-col sm:items-center gap-1.5 sm:gap-2 fit:gap-1.5">
      <h3 className="font-semibold leading-snug sm:mt-1 line-clamp-2"><button type="button" onClick={onOpen} className="text-left sm:text-center hover:underline underline-offset-4">{post.position}</button></h3>
      <p className="text-sm text-muted -mt-1 line-clamp-1">{post.company}</p>
      <div className="flex flex-wrap sm:justify-center gap-1.5"><LevelBadge level={level} reached={reached} />{post.sample && <SampleBadge />}</div>
      <p className="text-xs text-muted bd-opt">{N.place(post.country, post.province)} · {ago(post.releasedAt)}</p>
      <div className="grid grid-cols-2 w-full border-t border-line pt-2 sm:pt-3 sm:mt-1 divide-x divide-line text-center">
        <div><p className="text-base sm:text-lg font-bold">{c.held}/{cap}</p><p className="text-xs text-muted">{t('m.bd.places')}</p></div>
        <div><p className="text-base sm:text-lg font-bold">{c.reserved}</p><p className="text-xs text-muted">{t('m.bd.queue')}</p></div>
      </div>
      <div className="w-full text-left bd-opt">
        <p className="flex justify-between text-xs text-muted"><span>{t('m.bd.fill')}</span><span>{pct}%</span></p>
        <div className="fill-bar mt-1" role="img" aria-label={`${t('m.bd.fill')} ${pct}%`}><span style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full mt-auto sm:pt-1">
        <button type="button" className="btn-ghost text-sm justify-center !rounded-full" onClick={onOpen} aria-label={`${t('m.bd.details')}: ${post.position}`}>{t('m.bd.details')}</button>
        <NavLink to={`post?id=${post.id}`} className="btn-primary text-sm justify-center !rounded-full" aria-label={`${act}: ${post.position}`}>{act}</NavLink>
      </div>
      </div>
    </li>
  )
}

/** the details panel: everything about the post, where it is, and what to do next — without leaving the board */
function PostPanel({ titleId, post, level, reached, applied, viewer }: { titleId: string; post: Post; level: Level; reached: boolean; applied: boolean; viewer: 'seeker' | 'employer' }) {
  const { t } = useI18n()
  const N = useNames()
  const { ago } = useRel()
  const { counts } = useMatch()
  const c = counts[post.id] ?? { held: 0, pending: 0, reserved: 0 }, cap = capacityOf(post)
  const mine = post.employerId === MY_EMPLOYER
  return (<>
    <div className="flex flex-col items-center text-center gap-2 pt-2">
      <span aria-hidden className={`rar-${level} rar-avatar w-16 h-16 rounded-full grid place-items-center text-2xl font-bold`}>{post.company.trim().charAt(0).toUpperCase()}</span>
      <h2 id={titleId} className="h2 px-8">{post.position}</h2>
      <p className="text-sm text-muted">{post.company}</p>
      <p className="text-xs text-muted flex flex-wrap justify-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1"><Icon name="pin" size={13} />{N.place(post.country, post.province)}</span><span className="inline-flex items-center gap-1"><Icon name="business" size={13} />{N.industry(post.industry)}</span><span className="inline-flex items-center gap-1"><Icon name="clock" size={13} />{ago(post.releasedAt)}</span></p>
      <div className="flex flex-wrap justify-center gap-1.5"><LevelBadge level={level} reached={reached} />
        {post.verified ? <span className="chip bg-ok-bg text-ok-fg border-ok-line"><Icon name="shield" size={12} />{t('m.vf.badge')}</span> : <span className="chip bg-warn-bg text-warn-fg border-warn-line"><Icon name="warn" size={12} />{t('m.vf.unverified')}</span>}
        {post.sample && <SampleBadge />}</div>
    </div>
    <dl className="grid grid-cols-3 gap-2 text-center">
      {([[`${c.held}/${cap}`, 'm.bd.places'], [c.reserved, 'm.bd.queue'], [`${post.minYears}+`, 'm.bd.years']] as const).map(([v, k]) => (
        <div key={k} className="card-i !p-3"><dd className="text-lg font-bold">{v}</dd><dt className="text-xs text-muted">{t(k)}</dt></div>))}
    </dl>
    {post.sample && <p className="text-xs text-muted">{t('m.sample.d')}</p>}
    {!post.verified && !mine && viewer === 'seeker' && <p className="text-xs text-warn-fg">{t('m.vf.warnSeeker')}</p>}
    <PostFacts post={post} />
    <p className="text-sm">{post.skills.map(N.skill).join(' · ')}</p>
    {post.details && <p className="text-sm text-muted border-t border-line pt-3">{post.details}</p>}
    <div className="rounded-xl overflow-hidden border border-line">
      <GeoMap className="h-[220px]" label={t('m.bd.where', { p: N.place(post.country, post.province) })} country={post.country} province={post.province}
        pins={[{ country: post.country, province: post.province, label: post.position, tone: 'post' }]} onPickCountry={() => {}} onPickProvince={() => {}} />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <NavLink to={`post?id=${post.id}`} className="btn-ghost text-sm justify-center !rounded-full">{t('m.bd.openFull')}</NavLink>
      <NavLink to={`post?id=${post.id}`} className="btn-primary text-sm justify-center !rounded-full">{t(actionKey(post, viewer, applied))}</NavLink>
    </div>
    {!mine && viewer === 'seeker' && <div className="border-t border-line pt-3"><ReportButton postId={post.id} /></div>}
  </>)
}
