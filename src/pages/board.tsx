import { useEffect, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../i18n'
import { NavLink, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { activePins, capacityOf, isCountry, pinQuota, postQuota } from '../domain/match/logic'
import { reportedIds } from '../domain/match/reports'
import { reachFor, scheduleOf, stageAt, capStage } from '../domain/match/release'
import { CURRENCIES, LEVELS, ME, MY_EMPLOYER, SKILLS, type Currency, type Level, type Post, type Skill } from '../domain/match/types'
import type { GeoCode } from '../geo'
import { GeoMap } from '../components/geomap'
import { Icon, type IconName } from '../components/icons'
import { Drawer } from '../components/drawer'
import { Empty, LevelBadge, Page, PinList, PostFacts, QuotaBar, SortToggle, useGate, useNames, useRel } from './match'
import { ReportButton } from './safety'

/**
 * The board (owner, Oct 2026): one place to see where things stand, built like a game shop. Job seekers see the posts open to
 * them sorted into five levels — level 1 matches their pins best, level 5 is international (posts nobody took, pushed down by
 * newer ones) — with search, filters, newest/oldest first, and their own pins. Employers see their own posts with the level each
 * has reached, places and reservations, and their weekly allowance. The map shows where posts (or pins) are — counts only.
 * Layout (owner's design reference, Oct 2026): a row of key numbers, level chips, a grid of cards, a side panel with the map,
 * and a details panel that slides in without leaving the board.
 */
interface Filter { q: string; country: '' | 'TH' | 'CN'; province: string; skill: '' | Skill; salary: string; currency: Currency }
const NO_FILTER: Filter = { q: '', country: '', province: '', skill: '', salary: '', currency: 'THB' }
/** wide screens (≥ 1024 px) keep the map in the side panel; narrower ones show it under the filters on request — only one map is built */
const WIDE = '(min-width: 1024px)'
const useWide = () => useSyncExternalStore((cb) => { const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) }, () => window.matchMedia(WIDE).matches, () => true)
const chip = (on: boolean) => `min-h-[40px] px-3.5 rounded-full border text-sm inline-flex items-center gap-1.5 ${on ? 'border-primary bg-primary text-onprimary font-semibold' : 'border-control hover:bg-surface3'}`

export function BoardPage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, limitNow, pool, pinsByProvince, counts } = useMatch()
  const [tab, setTab] = useState<'all' | Level>('all')
  const [order, setOrder] = useState<'new' | 'old'>('new')
  const asked = useSearchParam('q') // from the header search
  const [f, setF] = useState<Filter>(() => ({ ...NO_FILTER, q: asked }))
  useEffect(() => { if (asked) setF((x) => ({ ...x, q: asked })) }, [asked])
  const [more, setMore] = useState(false)
  const [mapOf, setMapOf] = useState<'posts' | 'pins' | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const wide = useWide()
  const gate = useGate('board')
  if (gate) return <Page title={t('m.board.title')}>{gate}</Page>
  if (!st.role) return <Page title={t('m.board.title')} sub={t('m.board.sub')}><Empty icon="posts" text={t('m.profile.none')} to="choose-role" action={t('hero.cta')} /></Page>
  const seeker = st.role === 'seeker'
  const showMap = mapOf ?? (seeker ? 'posts' : 'pins')

  // seekers: the posts open to them (and any they applied to), at their level · employers: their own posts, at the level reached
  const mineApplied = new Set(st.acceptances.filter((a) => a.seekerId === ME).map((a) => a.postId))
  const reported = reportedIds(st) // posts I reported leave my board
  const items: { post: Post; level: Level }[] = seeker
    ? st.posts.filter((p) => p.employerId !== MY_EMPLOYER && (!reported.has(p.id) || mineApplied.has(p.id))).flatMap((p) => { const r = reachFor(p, st.me.pins, pool, now); return r.visible || mineApplied.has(p.id) ? [{ post: p, level: r.level }] : [] })
    : st.posts.filter((p) => p.employerId === MY_EMPLOYER).flatMap((p) => { const s = capStage(stageAt(scheduleOf(p, pool, now), now), p); return s === 'expired' ? [] : [{ post: p, level: s }] })
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

  // map: active posts or active pins per province (counts only)
  const postsByProvince = (seeker ? items.map((x) => x.post) : st.posts).reduce<Record<string, number>>((m, p) => ({ ...m, [p.province]: (m[p.province] ?? 0) + 1 }), {})
  const mapCounts = showMap === 'posts' ? postsByProvince : pinsByProvince
  const top = Object.entries(mapCounts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const q = seeker ? pinQuota(st, limitNow) : postQuota(st, limitNow)
  const set = (patch: Partial<Filter>) => setF((x) => ({ ...x, ...patch }))

  // key numbers
  const mine = new Set(items.map((x) => x.post.id))
  const kpis: { icon: IconName; label: string; value: string | number }[] = seeker
    ? [{ icon: 'store', label: t('m.bd.kpi.open'), value: items.length }, { icon: 'star', label: t('m.bd.kpi.l1'), value: items.filter((x) => x.level === 1).length },
      { icon: 'send', label: t('m.bd.kpi.applied'), value: mineApplied.size }, { icon: 'pin', label: t('m.bd.kpi.pinsLeft'), value: `${q.left}/${q.limit}` }]
    : [{ icon: 'posts', label: t('m.bd.kpi.posts'), value: items.length }, { icon: 'users', label: t('m.bd.kpi.waiting'), value: st.acceptances.filter((a) => mine.has(a.postId) && a.status === 'accepted').length },
      { icon: 'ticket', label: t('m.bd.kpi.reserved'), value: items.reduce((n, x) => n + (counts[x.post.id]?.reserved ?? 0), 0) }, { icon: 'renew', label: t('m.bd.kpi.postsLeft'), value: `${q.left}/${q.limit}` }]
  const current = open ? items.find((x) => x.post.id === open) : undefined

  const mapCard = (
    <section className="glass-card p-4 space-y-2" aria-labelledby="bd-map">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="bd-map" className="h2 flex items-center gap-2"><Icon name="globe" size={18} className="text-primary" />{t('m.bd.map')}</h2>
        <div className="flex gap-1.5" role="group" aria-label={t('m.board.mapShow')}>
          {(['posts', 'pins'] as const).map((k) => <button key={k} type="button" aria-pressed={showMap === k} onClick={() => setMapOf(k)} className={`min-h-[36px] px-2.5 rounded-lg border text-xs inline-flex items-center gap-1 ${showMap === k ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}><Icon name={k === 'posts' ? 'posts' : 'pin'} size={13} />{t(k === 'posts' ? 'm.board.mapPosts' : 'm.board.mapPins')}</button>)}
        </div>
      </div>
      <GeoMap className="h-[300px] lg:h-[360px]" label={t('m.board.mapLabel')} country={f.country || null} province={f.province || null} counts={mapCounts}
        onPickCountry={(c: GeoCode) => set({ country: isCountry(c) ? c : '', province: '' })} onPickProvince={(p) => set({ province: p ?? '' })} />
      <p className="text-xs text-muted">{top.length ? t('m.board.top', { list: top.map(([p, n]) => `${N.prov(p)} ${n}`).join(' · ') }) : t('m.board.topNone')}</p>
      <p className="text-xs text-muted">{t('m.board.mapHint')}</p>
    </section>)

  return (
    <Page title={t('m.board.title')} sub={t(seeker ? 'm.board.subSeeker' : 'm.board.subEmployer')}>
      {/* key numbers */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis.map((k, i) => (
        <div key={k.label} className={`rounded-2xl p-4 border ${i === 0 ? 'bg-primary text-onprimary border-primary' : 'glass-card'}`}>
          <dt className={`text-xs flex items-center justify-between gap-2 ${i === 0 ? 'opacity-90' : 'text-muted'}`}>{k.label}<Icon name={k.icon} size={15} /></dt>
          <dd className="text-3xl font-bold mt-1">{k.value}</dd>
        </div>))}</dl>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
        <section className="space-y-3 min-w-0" aria-labelledby="bd-list">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bd-list" className="h2 flex items-center gap-2"><Icon name="store" size={20} className="text-primary" />{t(seeker ? 'm.board.shop' : 'm.board.myPosts')}</h2>
            <NavLink to={seeker ? 'seek' : 'hire'} className="btn-primary text-sm"><Icon name="plus" size={15} />{t(seeker ? 'm.pin.go' : 'm.emp.post')}</NavLink>
          </div>
          {/* levels as shop shelves; the count shows what each holds with the current search */}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('m.board.levels')}>
            <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')} className={chip(tab === 'all')}>{t('m.board.all', { n: found.length })}</button>
            {LEVELS.map((l) => <button key={l} type="button" aria-pressed={tab === l} onClick={() => setTab(l)} className={`min-h-[40px] px-3.5 rounded-full border text-sm inline-flex items-center gap-1.5 rar-tab rar-${l} ${tab === l ? 'is-on font-semibold' : ''}`}>{t('m.lv.short', { n: l })}<span className="text-xs opacity-80">({perLevel(l)})</span></button>)}
          </div>
          {tab !== 'all' && <p className="text-xs text-muted">{t(`m.lv.d${tab}` as never)}</p>}

          <form role="search" className="card space-y-3" onSubmit={(e) => e.preventDefault()} aria-label={t('m.board.search')}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block flex-1 min-w-[200px]"><span className="sr-only">{t('m.board.search')}</span>
                <span className="relative block"><Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" className="input pl-9" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('m.board.searchHint')} /></span></label>
              <button type="button" className="btn-ghost text-sm" aria-expanded={more} aria-controls="bd-more" onClick={() => setMore((x) => !x)}><Icon name="filter" size={15} />{t(more ? 'm.bd.fewer' : 'm.bd.more')}</button>
              <button type="button" className="btn-ghost text-sm lg:hidden" aria-expanded={mapOpen} onClick={() => setMapOpen((x) => !x)}><Icon name="globe" size={15} />{t(mapOpen ? 'm.bd.mapHide' : 'm.bd.mapShow')}</button>
            </div>
            <div id="bd-more" className={`${more ? 'grid' : 'hidden'} sm:grid-cols-2 lg:grid-cols-3 gap-2`}>
              <label className="block"><span className="label">{t('m.country')}</span><select className="input" value={f.country} onChange={(e) => set({ country: e.target.value as Filter['country'], province: '' })}><option value="">{t('m.board.any')}</option>{(['TH', 'CN'] as const).map((c) => <option key={c} value={c}>{N.country(c)}</option>)}</select></label>
              <label className="block"><span className="label">{t('m.province')}</span><select className="input" value={f.province} disabled={!f.country} onChange={(e) => set({ province: e.target.value })}><option value="">{t('m.board.any')}</option>{f.country && N.provList(f.country).map((p) => <option key={p} value={p}>{N.prov(p)}</option>)}</select></label>
              <label className="block"><span className="label">{t('m.board.skill')}</span><select className="input" value={f.skill} onChange={(e) => set({ skill: e.target.value as Filter['skill'] })}><option value="">{t('m.board.any')}</option>{SKILLS.map((s) => <option key={s} value={s}>{N.skill(s)}</option>)}</select></label>
              <div className="sm:col-span-2 lg:col-span-3"><span className="label" id="bd-sal">{t('m.board.salary')}</span>
                <div className="grid grid-cols-[1fr_auto] gap-2" role="group" aria-labelledby="bd-sal">
                  <input className="input" type="number" min={0} inputMode="numeric" aria-label={t('m.f.salaryMin')} placeholder={t('m.f.salaryMin')} value={f.salary} onChange={(e) => set({ salary: e.target.value })} />
                  <select className="input !w-auto" aria-label={t('m.f.currency')} value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>{CURRENCIES.map((c) => <option key={c} value={c}>{t(`m.cur.${c}` as never)}</option>)}</select>
                </div></div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SortToggle order={order} onChange={setOrder} />
              {filtering && <button type="button" className="btn-ghost text-sm" onClick={() => setF(NO_FILTER)}><Icon name="close" size={15} />{t('m.board.clear')}</button>}
            </div>
          </form>
          {!wide && mapOpen && mapCard}

          <p className="text-sm text-muted" role="status">{t('m.board.count', { n: shown.length })}</p>
          {!shown.length ? <Empty icon={seeker ? 'pin' : 'posts'} text={t(items.length ? 'm.board.noneFound' : seeker ? 'm.board.noneSeeker' : 'm.board.noneEmployer')} to={items.length ? undefined : seeker ? 'seek' : 'hire'} action={items.length ? undefined : t(seeker ? 'm.pin.go' : 'm.emp.post')} /> : (
            <ul className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-3">{shown.map(({ post, level }) => (
              <BoardCard key={post.id} post={post} level={level} reached={!seeker} applied={mineApplied.has(post.id)} onOpen={() => setOpen(post.id)} />))}</ul>)}
        </section>

        {/* side panel: the map, my allowance, my pins */}
        <aside className="space-y-4 min-w-0 lg:sticky lg:top-20" aria-label={t('m.bd.side')}>
          {wide && mapCard}
          <section className="glass-card p-4 space-y-3" aria-labelledby="bd-me">
            <h2 id="bd-me" className="h2">{t(seeker ? 'm.board.mePins' : 'm.board.mePosts')}</h2>
            <QuotaBar q={q} kind={seeker ? 'pin' : 'post'} />
            <p className="text-sm">{seeker ? t('m.pin.active', { n: activePins(st.me, limitNow).length }) : t('m.board.open', { n: items.length })}</p>
          </section>
          {seeker && (
            <section className="space-y-2" aria-labelledby="bd-pins">
              <h2 id="bd-pins" className="h2">{t('m.board.myPins')}</h2>
              <PinList />
            </section>)}
          {!seeker && <p className="text-xs text-muted flex flex-wrap items-center gap-1.5"><LevelBadge level={1} /> → <LevelBadge level={5} /> {t('m.board.levelsNote')}</p>}
        </aside>
      </div>

      <Drawer open={!!current} onClose={() => setOpen(null)}>{(titleId) => current && <PostPanel titleId={titleId} post={current.post} level={current.level} reached={!seeker} applied={mineApplied.has(current.post.id)} />}</Drawer>
    </Page>
  )
}

/** one post on the board: letter badge, title, place, places taken, and two actions */
function BoardCard({ post, level, reached, applied, onOpen }: { post: Post; level: Level; reached: boolean; applied: boolean; onOpen: () => void }) {
  const { t } = useI18n()
  const N = useNames()
  const { ago } = useRel()
  const { counts } = useMatch()
  const c = counts[post.id] ?? { held: 0, pending: 0, reserved: 0 }, cap = capacityOf(post)
  const pct = Math.min(100, Math.round((c.held / cap) * 100))
  const mine = post.employerId === MY_EMPLOYER
  return (
    <li className={`glass-card rar-card rar-edge-${level} p-4 flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={`rar-${level} rar-avatar w-12 h-12 shrink-0 rounded-full grid place-items-center text-lg font-bold`}>{post.company.trim().charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold leading-snug"><button type="button" onClick={onOpen} className="text-left hover:underline underline-offset-4">{post.position}</button></h3>
          <p className="text-sm text-muted truncate">{post.company}</p>
          <p className="text-xs text-muted">{N.place(post.country, post.province)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <LevelBadge level={level} reached={reached} />
        {post.verified ? <span className="chip bg-ok-bg text-ok-fg border-ok-line"><Icon name="shield" size={12} />{t('m.vf.badge')}</span>
          : <span className="chip bg-warn-bg text-warn-fg border-warn-line"><Icon name="warn" size={12} />{t('m.vf.unverified')}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center border-t border-line pt-3">
        <div><p className="text-lg font-bold">{c.held}/{cap}</p><p className="text-xs text-muted">{t('m.bd.places')}</p></div>
        <div><p className="text-lg font-bold">{c.reserved}</p><p className="text-xs text-muted">{t('m.bd.queue')}</p></div>
      </div>
      <div>
        <p className="flex justify-between text-xs text-muted"><span>{t('m.bd.fill')}</span><span>{pct}%</span></p>
        <div className="fill-bar mt-1" role="img" aria-label={`${t('m.bd.fill')} ${pct}%`}><span style={{ width: `${pct}%` }} /></div>
      </div>
      <p className="text-xs text-muted inline-flex items-center gap-1"><Icon name="clock" size={13} />{t(post.releasedAt !== post.createdAt ? 'm.ago.renewed' : 'm.ago.posted', { t: ago(post.releasedAt) })}</p>
      <div className="grid grid-cols-2 gap-2 mt-auto">
        <button type="button" className="btn-ghost text-sm justify-center" onClick={onOpen} aria-label={`${t('m.bd.details')}: ${post.position}`}>{t('m.bd.details')}</button>
        <NavLink to={`post?id=${post.id}`} className="btn-primary text-sm justify-center" aria-label={`${t(mine ? 'm.bd.manage' : applied ? 'm.bd.applied' : 'm.bd.apply')}: ${post.position}`}>{t(mine ? 'm.bd.manage' : applied ? 'm.bd.applied' : 'm.bd.apply')}</NavLink>
      </div>
    </li>
  )
}

/** the details panel: everything about the post, where it is, and what to do next — without leaving the board */
function PostPanel({ titleId, post, level, reached, applied }: { titleId: string; post: Post; level: Level; reached: boolean; applied: boolean }) {
  const { t } = useI18n()
  const N = useNames()
  const { ago } = useRel()
  const { counts } = useMatch()
  const c = counts[post.id] ?? { held: 0, pending: 0, reserved: 0 }, cap = capacityOf(post)
  const mine = post.employerId === MY_EMPLOYER
  return (<>
    <div className="flex flex-col items-center text-center gap-2 pt-2">
      <span aria-hidden className={`rar-${level} rar-avatar w-16 h-16 rounded-full grid place-items-center text-2xl font-bold`}>{post.company.trim().charAt(0).toUpperCase()}</span>
      <h2 id={titleId} className="h2 pr-8 pl-8">{post.position}</h2>
      <p className="text-sm text-muted">{post.company}</p>
      <p className="text-xs text-muted flex flex-wrap justify-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1"><Icon name="pin" size={13} />{N.place(post.country, post.province)}</span><span className="inline-flex items-center gap-1"><Icon name="business" size={13} />{N.industry(post.industry)}</span><span className="inline-flex items-center gap-1"><Icon name="clock" size={13} />{ago(post.releasedAt)}</span></p>
      <div className="flex flex-wrap justify-center gap-1.5"><LevelBadge level={level} reached={reached} />
        {post.verified ? <span className="chip bg-ok-bg text-ok-fg border-ok-line"><Icon name="shield" size={12} />{t('m.vf.badge')}</span> : <span className="chip bg-warn-bg text-warn-fg border-warn-line"><Icon name="warn" size={12} />{t('m.vf.unverified')}</span>}</div>
    </div>
    <dl className="grid grid-cols-3 gap-2 text-center">
      {([[`${c.held}/${cap}`, 'm.bd.places'], [c.reserved, 'm.bd.queue'], [`${post.minYears}+`, 'm.bd.years']] as const).map(([v, k]) => (
        <div key={k} className="card-i !p-3"><dd className="text-lg font-bold">{v}</dd><dt className="text-xs text-muted">{t(k)}</dt></div>))}
    </dl>
    {!post.verified && !mine && <p className="text-xs text-warn-fg">{t('m.vf.warnSeeker')}</p>}
    <PostFacts post={post} />
    <p className="text-sm">{post.skills.map(N.skill).join(' · ')}</p>
    {post.details && <p className="text-sm text-muted border-t border-line pt-3">{post.details}</p>}
    <div className="rounded-xl overflow-hidden border border-line">
      <GeoMap className="h-[220px]" label={t('m.bd.where', { p: N.place(post.country, post.province) })} country={post.country} province={post.province}
        pins={[{ country: post.country, province: post.province, label: post.position, tone: 'post' }]} onPickCountry={() => {}} onPickProvince={() => {}} />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <NavLink to={`post?id=${post.id}`} className="btn-ghost text-sm justify-center">{t('m.bd.openFull')}</NavLink>
      <NavLink to={`post?id=${post.id}`} className="btn-primary text-sm justify-center">{t(mine ? 'm.bd.manage' : applied ? 'm.bd.applied' : 'm.bd.apply')}</NavLink>
    </div>
    {!mine && <div className="border-t border-line pt-3"><ReportButton postId={post.id} /></div>}
  </>)
}
