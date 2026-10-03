import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { Icon } from '../icons'

/* Background Paths (owner, Oct 2026): two sets of 36 curved lines after the shadcn "background-paths" component, kept in
 * components/ui (the shadcn convention) but without framer-motion.
 * Motion = option B (owner's choice): the lines stay still and a soft band of light sweeps across them. The band is a
 * brighter copy of the lines seen through a moving window: the window slides one way and the copy slides back by the same
 * amount, so the light stays on the lines. Only transforms move (GPU), nothing is redrawn per frame, so it stays smooth on
 * low-end phones too. (Option A — light running along each line — needs a redraw per frame; kept for later.)
 * Accessibility: decorative (aria-hidden); faded over the text column so contrast holds; WCAG 2.2.2 — play/pause button,
 * remembered in this browser; "reduce motion" devices start still and can press play. */

const KEY = 'call.motion.paused'
const startPaused = () => {
  try { const v = localStorage.getItem(KEY); if (v === '1' || v === '0') return v === '1' } catch { /* storage blocked: use the device setting */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function Lines({ position }: { position: number }) {
  return (
    <>{Array.from({ length: 36 }, (_, i) => {
      const x = (n: number) => n - i * 5 * position
      const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${x(152)} ${343 - i * 6}C${x(616)} ${470 - i * 6} ${x(684)} ${875 - i * 6} ${x(684)} ${875 - i * 6}`
      return <path key={i} d={d} stroke="currentColor" strokeWidth={0.5 + i * 0.03} strokeOpacity={Math.min(1, 0.1 + i * 0.03)} />
    })}</>
  )
}
const Svg = () => (
  <svg className="bg-paths-svg" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
    <Lines position={1} /><Lines position={-1} />
  </svg>
)

export function BackgroundPaths() {
  const { t } = useI18n()
  const [paused, setPaused] = useState(startPaused)
  const [away, setAway] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  // nothing moves while the hero is scrolled out of view
  useEffect(() => {
    const el = box.current; if (!el || typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting)); io.observe(el)
    return () => io.disconnect()
  }, [])
  const toggle = () => setPaused((p) => { try { localStorage.setItem(KEY, p ? '0' : '1') } catch { /* private mode: the choice just isn't remembered */ } return !p })
  const label = t(paused ? 'm.motion.play' : 'm.motion.pause')
  return (
    <>
      <div ref={box} className={'bg-paths pointer-events-none absolute inset-0' + (paused ? '' : ' is-on') + (away ? ' is-away' : '')} aria-hidden>
        <Svg />
        <div className="bg-sheen-wrap"><div className="bg-sheen"><div className="bg-sheen-lines"><Svg /></div></div></div>
      </div>
      <button type="button" className="bg-paths-toggle globe-ctl" onClick={toggle} aria-label={label} title={label}>
        <Icon name={paused ? 'play' : 'pause'} size={16} />
      </button>
    </>
  )
}
