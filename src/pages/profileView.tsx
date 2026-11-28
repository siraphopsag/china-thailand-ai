// Profiles that are pleasant to look at (owner, 28 Nov 2026): a job seeker's page like a social-network profile — cover, picture,
// introduction, work history and photos of work; an employer's page like a shop on a map — cover, logo, stars and reviews, what
// kind of business, where it hires, photos of the workplace and its open jobs. Route: profile?id=<account>&k=e|s (e = employer,
// s = job seeker); "me" is my own. The text comes from profileStore (SQL 0019), the photos from mediaStore (SQL 0025), the stars
// from the reviews (0014, 0018). Who may see what is decided by the database, not by this page.
import { useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { NavLink, useSearchParam } from '../store'
import { useMatch } from '../matchData'
import { useAuth } from '../auth'
import { ME, MY_EMPLOYER, type Post } from '../domain/match/types'
import { activePins } from '../domain/match/logic'
import { totalYears, type Business, type Work } from '../domain/profileExtra'
import { reviewSummary } from '../domain/match/aftercare'
import { useApplicantWork, useEmployerAbout, useMyBusiness, useMyWork } from '../profileStore'
import { useReviews } from '../aftercareStore'
import { useWorkerReviews } from '../workerReviewStore'
import { MAX_GALLERY, useMedia, type MediaKind, type Photo } from '../mediaStore'
import { Icon, type IconName } from '../components/icons'
import { Modal } from '../components/modal'
import { Warn } from '../components/ui'
import { EmployerRating, WorkerRating } from './aftercare'
import { SeekerBadge } from './seeker-verify'
import { Page, VerifyTick, useApplicantName, useNames, useShowName } from './match'

/** a soft colour per name, for the cover and the letter when there is no photo */
const tone = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 6 }

/** the top of a profile: cover, round picture, name, one line under it and small badges; on my own, buttons to change the photos */
export function ProfileHero({ owner, name, sub, badges, actions }: { owner: string; name: string; sub?: ReactNode; badges?: ReactNode; actions?: ReactNode }) {
  const { t } = useI18n()
  const { media, mine, add, remove, problem } = useMedia(owner)
  const [msg, setMsg] = useState<string | null>(null)
  const pick = async (kind: MediaKind, f: File | undefined) => {
    if (!f) return
    setMsg(t('pv.uploading'))
    const r = await add(kind, f)
    setMsg(r === 'ok' ? null : t(`pv.err.${r ?? 'network'}` as never, { n: MAX_GALLERY }))
  }
  const k = tone(name)
  return (
    <section className="card !p-0 overflow-hidden" aria-label={name}>
      <div className={`pv-cover pv-tone-${k}`}>
        {media.cover && <img src={media.cover} alt="" className="w-full h-full object-cover" />}
        {mine && (
          <div className="absolute right-2 bottom-2 flex gap-1.5">
            <label className="pv-cam"><input type="file" accept="image/*" className="sr-only" onChange={(e) => { void pick('cover', e.target.files?.[0]); e.target.value = '' }} /><Icon name="camera" size={16} /><span>{t(media.cover ? 'pv.cover.change' : 'pv.cover.add')}</span></label>
            {media.cover && <button type="button" className="pv-cam" onClick={() => void remove('cover')} aria-label={t('pv.cover.remove')}><Icon name="trash" size={16} /></button>}
          </div>)}
      </div>
      <div className="px-4 sm:px-6 pb-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className={`pv-avatar pv-tone-${k}`}>
          {media.avatar ? <img src={media.avatar} alt="" className="w-full h-full object-cover" /> : <span aria-hidden>{(name.trim()[0] ?? '?').toUpperCase()}</span>}
          {mine && <label className="pv-cam pv-cam-av" title={t('pv.avatar.change')}><input type="file" accept="image/*" className="sr-only" onChange={(e) => { void pick('avatar', e.target.files?.[0]); e.target.value = '' }} /><Icon name="camera" size={15} /><span className="sr-only">{t('pv.avatar.change')}</span></label>}
        </div>
        <div className="min-w-0 flex-1 sm:pb-1">
          <h2 className="text-xl sm:text-2xl font-bold leading-tight break-words">{name}</h2>
          {sub && <div className="text-sm text-muted mt-0.5">{sub}</div>}
          {badges && <div className="flex flex-wrap items-center gap-1.5 mt-2">{badges}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:pb-1">{actions}</div>}
      </div>
      {(msg || problem) && <div className="px-4 sm:px-6 pb-3"><Warn tone={msg === t('pv.uploading') ? 'info' : undefined}>{msg ?? t(problem === 'dbOld' ? 'pv.dbOld' : 'sh.network')}</Warn></div>}
      {mine && <p className="px-4 sm:px-6 pb-3 text-xs text-muted flex items-start gap-1.5"><Icon name="shield" size={13} className="mt-0.5 shrink-0" />{t('pv.privacy')}</p>}
    </section>
  )
}

/** photos of work or of the workplace: a grid, tap to see one large; on my own, add and remove */
export function Gallery({ owner, title, empty }: { owner: string; title: string; empty: string }) {
  const { t } = useI18n()
  const { media, mine, add, remove } = useMedia(owner)
  const [big, setBig] = useState<Photo | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const items = media.gallery
  if (!items.length && !mine) return null
  return (
    <section className="card space-y-3" aria-labelledby={`pv-g-${owner}`} id="pv-photos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`pv-g-${owner}`} className="h2 flex items-center gap-2"><Icon name="image" size={18} className="text-primary" />{title}<span className="text-sm text-muted font-normal">{items.length}/{MAX_GALLERY}</span></h3>
        {mine && items.length < MAX_GALLERY && <label className="btn-soft text-sm cursor-pointer"><input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; setMsg(t('pv.uploading')); const r = await add('gallery', f); setMsg(r === 'ok' ? null : t(`pv.err.${r ?? 'network'}` as never, { n: MAX_GALLERY })) }} /><Icon name="plus" size={15} />{t('pv.photo.add')}</label>}
      </div>
      {msg && <Warn tone={msg === t('pv.uploading') ? 'info' : undefined}>{msg}</Warn>}
      {!items.length ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="grid grid-cols-3 sm:grid-cols-4 auto-rows-[6.5rem] sm:auto-rows-[8.5rem] gap-1.5 sm:gap-2">{items.map((p, i) => (
          <li key={p.key} className={`relative ${i === 0 && items.length >= 3 ? 'col-span-2 row-span-2' : ''}`}>
            <button type="button" className="block w-full h-full overflow-hidden rounded-xl bg-surface3" onClick={() => setBig(p)} aria-label={t('pv.photo.open', { n: i + 1 })}>
              <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" /></button>
            {mine && <button type="button" className="pv-cam absolute top-1.5 right-1.5" onClick={() => void remove(p.key)} aria-label={t('pv.photo.remove', { n: i + 1 })}><Icon name="trash" size={14} /></button>}
          </li>))}</ul>)}
      <Modal open={!!big} onClose={() => setBig(null)} wide>{(titleId) => big && <div className="space-y-2"><h2 id={titleId} className="sr-only">{title}</h2><img src={big.url} alt="" className="w-full max-h-[75vh] object-contain rounded-xl" />
        <div className="flex justify-end"><button type="button" className="btn-ghost" onClick={() => setBig(null)}>{t('pv.close')}</button></div></div>}</Modal>
    </section>
  )
}

/** one fact with an icon, like the lines of a place on a map */
const Fact = ({ icon, children }: { icon: IconName; children: ReactNode }) => <li className="flex items-start gap-3 py-2"><Icon name={icon} size={18} className="text-primary mt-0.5 shrink-0" /><div className="min-w-0 text-sm">{children}</div></li>

/** an employer's page, like a shop on a map */
export function CompanyProfile({ owner, employerId, name, b, posts }: { owner: string; employerId: string; name: string; b: Business; posts: Post[] }) {
  const { t } = useI18n()
  const N = useNames()
  const s = reviewSummary(useReviews(employerId))
  const verified = posts.find((p) => p.verified)
  const places = [...new Set(posts.map((p) => N.place(p.country, p.province)))]
  return (
    <div className="space-y-4">
      <ProfileHero owner={owner} name={name}
        sub={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">{s ? <span className="inline-flex items-center gap-1 text-ink font-semibold"><Icon name="star" size={15} className="er-gold" />{s.avg.toFixed(1)}<span className="text-muted font-normal">({t('er.count', { n: s.n })})</span></span> : <span>{t('er.none')}</span>}
          {b.industry && <span>· {N.industry(b.industry)}</span>}</span>}
        badges={<>{verified && <span className="chip bg-ok-bg text-ok-fg border-ok-line"><VerifyTick post={verified} size={13} />{t('pv.verified')}</span>}
          {b.size && <span className="chip bg-surface3 border-line">{t('pe.b.people', { n: b.size })}</span>}{b.since && <span className="chip bg-surface3 border-line">{t('pe.b.sinceN', { y: b.since })}</span>}</>}
        actions={<>{posts.length > 0 && <a href="#pv-jobs" className="btn-soft text-sm"><Icon name="posts" size={15} />{t('pv.jobs.n', { n: posts.length })}</a>}<a href="#pv-reviews" className="btn-ghost text-sm"><Icon name="star" size={15} />{t('pv.reviews')}</a></>} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 items-start">
        <section className="card" aria-labelledby="pv-about">
          <h3 id="pv-about" className="h2 mb-1">{t('pv.about')}</h3>
          <ul className="divide-y divide-line">
            {b.about ? <Fact icon="info"><p className="whitespace-pre-wrap">{b.about}</p></Fact> : <Fact icon="info"><p className="text-muted">{t('pv.about.none')}</p></Fact>}
            {b.industry && <Fact icon="store">{N.industry(b.industry)}</Fact>}
            {places.length > 0 && <Fact icon="pin">{t('pv.hiresIn')}: {places.join(' · ')}</Fact>}
            {b.size && <Fact icon="users">{t('pe.b.people', { n: b.size })}</Fact>}
            {b.since && <Fact icon="calendar">{t('pe.b.sinceN', { y: b.since })}</Fact>}
          </ul>
        </section>
        <div className="space-y-4 min-w-0">
          <Gallery owner={owner} title={t('pv.photos.place')} empty={t('pv.photos.none')} />
          <section className="card space-y-2" id="pv-reviews" aria-labelledby="pv-rev-h"><h3 id="pv-rev-h" className="h2 flex items-center gap-2"><Icon name="star" size={18} className="er-gold" />{t('pv.reviews')}</h3>
            <EmployerRating employerId={employerId} /><p className="text-xs text-muted">{t('pv.reviews.anon')}</p></section>
        </div>
      </div>
      {posts.length > 0 && (
        <section className="card space-y-2" id="pv-jobs" aria-labelledby="pv-jobs-h">
          <h3 id="pv-jobs-h" className="h2 flex items-center gap-2"><Icon name="posts" size={18} className="text-primary" />{t('pv.jobs')}</h3>
          <ul className="divide-y divide-line">{posts.map((p) => (
            <li key={p.id}><NavLink to={`post?id=${p.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
              <span className="min-w-0"><span className="font-semibold block truncate">{p.position}</span><span className="text-xs text-muted">{N.place(p.country, p.province)}{p.salary ? ` · ${N.money(p.salary)}` : ''}</span></span>
              <Icon name="right" size={16} className="shrink-0 text-muted" /></NavLink></li>))}</ul>
        </section>)}
    </div>
  )
}

/** a job seeker's page, like a social-network profile */
export function PersonProfile({ owner, seekerId, name, w, sub, skills }: { owner: string; seekerId: string; name: string; w: Work; sub?: ReactNode; skills?: string[] }) {
  const { t } = useI18n()
  const N = useNames()
  const s = reviewSummary(useWorkerReviews(seekerId))
  const years = totalYears(w)
  return (
    <div className="space-y-4">
      <ProfileHero owner={owner} name={name} sub={sub}
        badges={<><SeekerBadge seekerId={seekerId} />{s && <span className="chip bg-surface3 border-line"><Icon name="star" size={13} className="er-gold" />{s.avg.toFixed(1)} · {t('er.count', { n: s.n })}</span>}
          {years > 0 && <span className="chip bg-surface3 border-line"><Icon name="employment" size={13} />{t('pv.years', { n: years })}</span>}</>} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <section className="card space-y-2" aria-labelledby="pv-intro"><h3 id="pv-intro" className="h2">{t('pv.intro')}</h3>
            {w.showcase ? <p className="text-sm whitespace-pre-wrap">{w.showcase}</p> : <p className="text-sm text-muted">{t('pv.intro.none')}</p>}
            {skills && skills.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{skills.map((k) => <span key={k} className="chip bg-brand text-brandfg border-primary text-xs">{N.skill(k as never)}</span>)}</div>}
          </section>
          <section className="card space-y-2" aria-labelledby="pv-wr"><h3 id="pv-wr" className="h2 flex items-center gap-2"><Icon name="star" size={18} className="er-gold" />{t('pv.wreviews')}</h3><WorkerRating seekerId={seekerId} /></section>
        </div>
        <div className="space-y-4 min-w-0">
          <section className="card space-y-3" aria-labelledby="pv-hist"><h3 id="pv-hist" className="h2 flex items-center gap-2"><Icon name="employment" size={18} className="text-primary" />{t('pv.history')}</h3>
            {!w.jobs.length ? <p className="text-sm text-muted">{t('pv.history.none')}</p> : (
              <ol className="pv-timeline">{w.jobs.map((j, i) => (
                <li key={i}><p className="font-semibold">{j.role}</p><p className="text-xs text-muted">{N.country(j.country)} · {t('pe.w.yearsN', { n: j.years })}{j.industry ? ` · ${N.industry(j.industry)}` : ''}</p></li>))}</ol>)}
          </section>
          <Gallery owner={owner} title={t('pv.photos.work')} empty={t('pv.photos.noneWork')} />
        </div>
      </div>
    </div>
  )
}

/** my own profile at the top of the profile page: how others see it, with the photo buttons */
export function MyProfile() {
  const { t } = useI18n()
  const N = useNames()
  const { st, limitNow } = useMatch()
  const { user } = useAuth()
  const show = useShowName()
  const [b] = useMyBusiness()
  const [w] = useMyWork()
  if (st.role === 'employer') {
    const posts = st.posts.filter((p) => p.employerId === MY_EMPLOYER && !p.hidden)
    return <CompanyProfile owner="me" employerId={MY_EMPLOYER} name={st.myCompany || t('m.role.employer')} b={b} posts={posts} />
  }
  if (st.role === 'seeker') {
    const pins = activePins(st.me, limitNow)
    const skills = [...new Set(pins.flatMap((p) => p.skills))]
    return <PersonProfile owner="me" seekerId={ME} name={show(user?.name || '') || t('m.role.seeker')} w={w} skills={skills}
      sub={st.me.origin ? t('m.seek.from', { p: N.place(st.me.origin.country, st.me.origin.province) }) : undefined} />
  }
  return null
}

/** someone else's page (or mine): profile?id=<account>&k=e|s */
export function ProfilePage() {
  const { t } = useI18n()
  const { st } = useMatch()
  const nameOf = useApplicantName()
  const id = useSearchParam('id') ?? 'me'
  const k = useSearchParam('k')
  const employer = k === 'e' || (k !== 's' && st.posts.some((p) => p.employerId === id))
  const me = id === 'me' || id === MY_EMPLOYER || id === ME
  const b = useEmployerAbout(employer ? id : MY_EMPLOYER)
  const w = useApplicantWork(!employer ? id : ME)
  if (me) return <Page title={t('pv.title.me')}><MyProfile /><p className="text-sm"><NavLink to="me" className="text-primary underline underline-offset-4">{t('pv.edit')}</NavLink></p></Page>
  if (employer) {
    const posts = st.posts.filter((p) => p.employerId === id && !p.hidden)
    const name = posts[0]?.company ?? t('m.role.employer')
    return <Page title={name}><CompanyProfile owner={id} employerId={id} name={name} b={b} posts={posts} /></Page>
  }
  const a = st.acceptances.find((x) => x.seekerId === id)
  const name = a ? nameOf(a) : t('m.role.seeker')
  const applied = st.acceptances.filter((x) => x.seekerId === id).map((x) => st.posts.find((p) => p.id === x.postId)?.position).filter(Boolean)
  return <Page title={name}><PersonProfile owner={id} seekerId={id} name={name} w={w} sub={applied.length ? t('pv.appliedTo', { p: applied.join(' · ') }) : undefined} />
    <p className="text-xs text-muted">{t('pv.whoSees')}</p></Page>
}
