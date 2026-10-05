import { useState } from 'react'
import { useI18n } from '../i18n'
import { NavLink } from '../store'
import { useMatch } from '../matchData'
import { activePins, isCountry, pinQuota, postQuota } from '../domain/match/logic'
import { reachFor, scheduleOf, stageAt, capStage } from '../domain/match/release'
import { CURRENCIES, LEVELS, ME, MY_EMPLOYER, SKILLS, type Currency, type Level, type Post, type Skill } from '../domain/match/types'
import type { GeoCode } from '../geo'
import { GeoMap } from '../components/geomap'
import { Icon } from '../components/icons'
import { Empty, LevelBadge, MAP_SIZE, MapLayout, Page, PinList, PostCard, QuotaBar, SortToggle, useGate, useNames } from './match'

/**
 * The board (owner, Oct 2026): one place to see where things stand, built like a game shop. Job seekers see the posts open to
 * them sorted into five levels — level 1 matches their pins best, level 5 is international (posts nobody took, pushed down by
 * newer ones) — with search, filters, newest/oldest first, and their own pins. Employers see their own posts with the level each
 * has reached, places and reservations, and their weekly allowance. The map shows where posts (or pins) are — counts only.
 */
interface Filter { q: string; country: '' | 'TH' | 'CN'; province: string; skill: '' | Skill; salary: string; currency: Currency }
const NO_FILTER: Filter = { q: '', country: '', province: '', skill: '', salary: '', currency: 'THB' }

export function BoardPage() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, limitNow, pool, pinsByProvince } = useMatch()
  const [tab, setTab] = useState<'all' | Level>('all')
  const [order, setOrder] = useState<'new' | 'old'>('new')
  const [f, setF] = useState<Filter>(NO_FILTER)
  const [mapOf, setMapOf] = useState<'posts' | 'pins' | null>(null)
  const gate = useGate('board')
  if (gate) return <Page title={t('m.board.title')}>{gate}</Page>
  if (!st.role) return <Page title={t('m.board.title')} sub={t('m.board.sub')}><Empty icon="posts" text={t('m.profile.none')} to="choose-role" action={t('hero.cta')} /></Page>
  const seeker = st.role === 'seeker'
  const showMap = mapOf ?? (seeker ? 'posts' : 'pins')

  // seekers: the posts open to them (and any they applied to), at their level · employers: their own posts, at the level reached
  const mineApplied = new Set(st.acceptances.filter((a) => a.seekerId === ME).map((a) => a.postId))
  const items: { post: Post; level: Level }[] = seeker
    ? st.posts.filter((p) => p.employerId !== MY_EMPLOYER).flatMap((p) => { const r = reachFor(p, st.me.pins, pool, now); return r.visible || mineApplied.has(p.id) ? [{ post: p, level: r.level }] : [] })
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
  const counts = showMap === 'posts' ? postsByProvince : pinsByProvince
  const top = Object.entries(counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const q = seeker ? pinQuota(st, limitNow) : postQuota(st, limitNow)
  const set = (patch: Partial<Filter>) => setF((x) => ({ ...x, ...patch }))

  return (
    <Page title={t('m.board.title')} sub={t(seeker ? 'm.board.subSeeker' : 'm.board.subEmployer')}>
      <MapLayout map={<>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('m.board.mapShow')}>
          {(['posts', 'pins'] as const).map((k) => <button key={k} type="button" aria-pressed={showMap === k} onClick={() => setMapOf(k)} className={`min-h-[40px] px-3 rounded-lg border text-sm inline-flex items-center gap-1.5 ${showMap === k ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}><Icon name={k === 'posts' ? 'posts' : 'pin'} size={15} />{t(k === 'posts' ? 'm.board.mapPosts' : 'm.board.mapPins')}</button>)}
        </div>
        <GeoMap className={MAP_SIZE} label={t('m.board.mapLabel')} country={f.country || null} province={f.province || null} counts={counts}
          onPickCountry={(c: GeoCode) => set({ country: isCountry(c) ? c : '', province: '' })} onPickProvince={(p) => set({ province: p ?? '' })} />
        <p className="text-xs text-muted">{top.length ? t('m.board.top', { list: top.map(([p, n]) => `${N.prov(p)} ${n}`).join(' · ') }) : t('m.board.topNone')}</p>
        <p className="text-xs text-muted">{t('m.board.mapHint')}</p>
      </>}>
        {/* my standing: allowance and what I have running */}
        <section className="glass-card p-4 space-y-3" aria-labelledby="bd-me">
          <h2 id="bd-me" className="h2">{t(seeker ? 'm.board.mePins' : 'm.board.mePosts')}</h2>
          <QuotaBar q={q} kind={seeker ? 'pin' : 'post'} />
          <p className="text-sm flex flex-wrap items-center justify-between gap-2">
            <span>{seeker ? t('m.pin.active', { n: activePins(st.me, limitNow).length }) : t('m.board.open', { n: items.length })}</span>
            <NavLink to={seeker ? 'seek' : 'hire'} className="btn-primary text-sm">{t(seeker ? 'm.pin.go' : 'm.emp.post')}<Icon name="next" size={15} /></NavLink>
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="bd-list">
          <h2 id="bd-list" className="h2 flex items-center gap-2"><Icon name="store" size={20} className="text-primary" />{t(seeker ? 'm.board.shop' : 'm.board.myPosts')}</h2>
          {/* levels as shop shelves; the count shows what each holds with the current search */}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('m.board.levels')}>
            <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')} className={`min-h-[40px] px-3 rounded-lg border text-sm ${tab === 'all' ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`}>{t('m.board.all', { n: found.length })}</button>
            {LEVELS.map((l) => <button key={l} type="button" aria-pressed={tab === l} onClick={() => setTab(l)} className={`min-h-[40px] px-3 rounded-lg border text-sm inline-flex items-center gap-1.5 rar-tab rar-${l} ${tab === l ? 'is-on font-semibold' : ''}`}>{t('m.lv.short', { n: l })}<span className="text-xs opacity-80">({perLevel(l)})</span></button>)}
          </div>
          {tab !== 'all' && <p className="text-xs text-muted">{t(`m.lv.d${tab}` as never)}</p>}

          <form role="search" className="card space-y-3" onSubmit={(e) => e.preventDefault()} aria-label={t('m.board.search')}>
            <label className="block"><span className="label">{t('m.board.search')}</span>
              <span className="relative block"><Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input type="search" className="input pl-9" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t('m.board.searchHint')} /></span></label>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
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

          <p className="text-sm text-muted" role="status">{t('m.board.count', { n: shown.length })}</p>
          {!shown.length ? <Empty icon={seeker ? 'pin' : 'posts'} text={t(items.length ? 'm.board.noneFound' : seeker ? 'm.board.noneSeeker' : 'm.board.noneEmployer')} to={items.length ? undefined : seeker ? 'seek' : 'hire'} action={items.length ? undefined : t(seeker ? 'm.pin.go' : 'm.emp.post')} /> : (
            <ul className="grid xl:grid-cols-2 gap-3">{shown.map(({ post, level }) => <PostCard key={post.id} post={post} level={level} reached={!seeker} />)}</ul>)}
        </section>

        {seeker && (
          <section className="space-y-2" aria-labelledby="bd-pins">
            <h2 id="bd-pins" className="h2">{t('m.board.myPins')}</h2>
            <PinList />
          </section>)}
      </MapLayout>
      {!seeker && <p className="text-xs text-muted flex items-center gap-1.5"><LevelBadge level={1} /> → <LevelBadge level={5} /> {t('m.board.levelsNote')}</p>}
    </Page>
  )
}
