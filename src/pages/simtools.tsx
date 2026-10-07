import { useState } from 'react'
import { useI18n } from '../i18n'
import { useMatch } from '../matchData'
import { INDUSTRIES, type Country, type Industry } from '../domain/match/types'
import { PIN_DAYS_MAX, SIM_DEFAULTS, STARTER, simPins, simPosts, type SimOptions } from '../domain/match/simulate'
import { pinActive } from '../domain/match/release'
import { Icon } from '../components/icons'
import { useConfirm } from '../components/confirm'
import { Toast, useNames } from './match'

/**
 * The administrator's simulated-data tools (owner, Oct 2026: "so I don't have to ask you to make new ones every time" — pins
 * last 30 days): the starter set (32 posts + 50 pins), making posts or pins at random or with chosen details, and clearing them.
 * Everything made here is stored as simulated and shown with the yellow "ข้อมูลจำลอง" label.
 */
const pick = (on: boolean) => `min-h-[40px] px-3.5 rounded-lg border text-sm ${on ? 'border-primary bg-brand text-brandfg font-semibold' : 'border-control hover:bg-surface3'}`
const clamp = (v: string, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

export function SimTools() {
  const { t } = useI18n()
  const N = useNames()
  const { st, now, pinGroups, addSamples, clearSamples } = useMatch()
  const [kind, setKind] = useState<'posts' | 'pins'>('posts')
  const [custom, setCustom] = useState(false)
  const [count, setCount] = useState('10')
  const [country, setCountry] = useState<'any' | Country>('any'), [province, setProvince] = useState('')
  const [industry, setIndustry] = useState<'any' | Industry>('any')
  const [headMin, setHeadMin] = useState('1'), [headMax, setHeadMax] = useState('12')
  const [daysMin, setDaysMin] = useState('0'), [daysMax, setDaysMax] = useState('60')
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const [ask, askDialog] = useConfirm()
  const simPostsNow = st.posts.filter((p) => p.sample).length
  const simPinsNow = pinGroups.reduce((s, g) => s + (g.sample ?? 0), 0) + st.seekers.filter((x) => x.id === 'seeker:sim').flatMap((x) => x.pins).filter((p) => pinActive(p, now)).length

  const run = async (posts: number, pins: number, o: SimOptions) => {
    setBusy(true); setMsg(null)
    const r = await addSamples(simPosts(posts, o, Date.now()), simPins(pins, o, Date.now()))
    setBusy(false)
    setMsg(r.ok ? { tone: 'info', text: t('m.sim.done', { p: r.value.posts, n: r.value.pins }) } : { tone: 'danger', text: N.problem(r.problem) })
  }
  const make = () => {
    const n = clamp(count, 1, 50, 10)
    const o: SimOptions = custom
      ? { country, province: country !== 'any' && province ? province : null, industry, headMin: clamp(headMin, 1, 99, 1), headMax: clamp(headMax, 1, 99, 12), daysMin: clamp(daysMin, 0, 150, 0), daysMax: clamp(daysMax, 0, 150, 60) }
      : SIM_DEFAULTS
    return run(kind === 'posts' ? n : 0, kind === 'pins' ? n : 0, o)
  }
  const clear = async (posts: boolean) => {
    if (!(await ask(t('m.sim.clear.confirm'), { yes: t(posts ? 'm.sim.clearPosts' : 'm.sim.clearPins'), danger: true }))) return
    setBusy(true); const r = await clearSamples(posts, !posts); setBusy(false)
    setMsg(r.ok ? { tone: 'info', text: t('m.sim.cleared', { p: r.value.posts, n: r.value.pins }) } : { tone: 'danger', text: N.problem(r.problem) })
  }

  return (
    <div className="space-y-3 fit:overflow-y-auto fit:min-h-0 fit:pr-1">
      <p className="text-sm text-muted">{t('m.sim.lead')}</p>
      <p className="text-sm font-medium inline-flex items-center gap-1.5 text-warn-fg"><Icon name="sim" size={15} />{t('m.sim.now', { p: simPostsNow, n: simPinsNow })}</p>
      <Toast msg={msg} />
      {askDialog}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3 items-start">
        <div className="space-y-3">
          <section className="card space-y-2" aria-labelledby="sim-start">
            <h3 id="sim-start" className="font-semibold flex items-center gap-2"><Icon name="wand" size={16} className="text-primary" />{t('m.sim.starter')}</h3>
            <p className="text-sm text-muted">{t('m.sim.starter.d')}</p>
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void run(STARTER.posts, STARTER.pins, SIM_DEFAULTS)}><Icon name="wand" size={16} />{busy ? t('m.sim.busy') : t('m.sim.starter.go')}</button>
          </section>
          <section className="card space-y-2" aria-labelledby="sim-clear">
            <h3 id="sim-clear" className="font-semibold flex items-center gap-2"><Icon name="eraser" size={16} className="text-danger-fg" />{t('m.sim.clear')}</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-ghost text-sm text-danger-fg" disabled={busy} onClick={() => void clear(true)}><Icon name="trash" size={15} />{t('m.sim.clearPosts')}</button>
              <button type="button" className="btn-ghost text-sm text-danger-fg" disabled={busy} onClick={() => void clear(false)}><Icon name="trash" size={15} />{t('m.sim.clearPins')}</button>
            </div>
          </section>
        </div>
        <section className="card space-y-3" aria-labelledby="sim-make">
          <h3 id="sim-make" className="font-semibold flex items-center gap-2"><Icon name="sim" size={16} className="text-primary" />{t('m.sim.make')}</h3>
          <fieldset><legend className="label">{t('m.sim.what')}</legend><div className="flex flex-wrap gap-2">
            {(['posts', 'pins'] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={pick(kind === k)}>{t(k === 'posts' ? 'm.sim.posts' : 'm.sim.pins')}</button>)}</div></fieldset>
          <label className="block max-w-[12rem]"><span className="label">{t('m.sim.count')}</span><input className="input" type="number" min={1} max={50} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} /></label>
          <fieldset><legend className="label">{t('m.sim.mode')}</legend><div className="flex flex-wrap gap-2">
            {([false, true] as const).map((c) => <button key={String(c)} type="button" aria-pressed={custom === c} onClick={() => setCustom(c)} className={pick(custom === c)}>{t(c ? 'm.sim.custom' : 'm.sim.random')}</button>)}</div></fieldset>
          {custom && (
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block"><span className="label">{t('m.country')}</span>
                <select className="input" value={country} onChange={(e) => { setCountry(e.target.value as 'any' | Country); setProvince('') }}>
                  <option value="any">{t('m.sim.any')}</option>{(['TH', 'CN'] as const).map((c) => <option key={c} value={c}>{N.country(c)}</option>)}</select></label>
              <label className="block"><span className="label">{t('m.province')}</span>
                <select className="input" value={province} disabled={country === 'any'} onChange={(e) => setProvince(e.target.value)}>
                  <option value="">{t('m.sim.any')}</option>{country !== 'any' && N.provList(country).map((p) => <option key={p} value={p}>{N.prov(p)}</option>)}</select></label>
              <label className="block"><span className="label">{t('m.sim.industry')}</span>
                <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value as 'any' | Industry)}>
                  <option value="any">{t('m.sim.any')}</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{N.industry(i)}</option>)}</select></label>
              {kind === 'posts' && (
                <div><span className="label" id="sim-heads">{t('m.sim.heads')}</span>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="sim-heads">
                    <input className="input" type="number" min={1} max={99} inputMode="numeric" aria-label={t('m.sim.heads')} value={headMin} onChange={(e) => setHeadMin(e.target.value)} />
                    <input className="input" type="number" min={1} max={99} inputMode="numeric" aria-label={t('m.sim.heads')} value={headMax} onChange={(e) => setHeadMax(e.target.value)} /></div></div>)}
              <div className="sm:col-span-2"><span className="label" id="sim-days">{t('m.sim.days')}</span>
                <div className="grid grid-cols-2 gap-2 max-w-sm" role="group" aria-labelledby="sim-days">
                  <input className="input" type="number" min={0} max={150} inputMode="numeric" aria-label={t('m.sim.days')} value={daysMin} onChange={(e) => setDaysMin(e.target.value)} />
                  <input className="input" type="number" min={0} max={150} inputMode="numeric" aria-label={t('m.sim.days')} value={daysMax} onChange={(e) => setDaysMax(e.target.value)} /></div>
                {kind === 'pins' && <span className="block text-xs text-muted mt-1">{t('m.sim.daysPin', { n: PIN_DAYS_MAX })}</span>}</div>
            </div>)}
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void make()}><Icon name="sim" size={16} />{busy ? t('m.sim.busy') : t('m.sim.go')}</button>
        </section>
      </div>
    </div>
  )
}
