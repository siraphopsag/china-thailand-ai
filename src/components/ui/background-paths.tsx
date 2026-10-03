import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../i18n'
import { Icon } from '../icons'

/* Background Paths (owner, Oct 2026): two sets of 36 curved lines after the shadcn "background-paths" component, kept in
 * components/ui (the shadcn convention) but without framer-motion. The lines are drawn whole and stay still; light moves on them.
 *  A (default): short soft lights run along every other line, one way, in a seamless loop (stroke-dashoffset). This repaints
 *    every frame, so a frame-rate guard watches it: below ~45 fps for 1.5 s (after a 2 s warm-up, as
 *    page load itself can drop frames) → switch to B for this browsing session.
 *    Devices that report low memory/cores or data saver start on B.
 *  B: a band of light sweeps across — a brighter copy of the lines seen through a moving window that slides back by the same
 *    amount; only transforms move (GPU, no repaint), so it is smooth almost everywhere.
 *  Prototype only: ?fx=a or ?fx=b forces a mode (no guard) so the owner can compare.
 * Accessibility: decorative (aria-hidden); faded over the text column so contrast holds; WCAG 2.2.2 — play/pause button,
 * remembered in this browser; "reduce motion" devices start still and can press play; nothing moves off-screen. */

type Fx = 'a' | 'b'
const KEY = 'call.motion.paused', SLOW = 'call.fx.slow'
const startPaused = () => {
  try { const v = localStorage.getItem(KEY); if (v === '1' || v === '0') return v === '1' } catch { /* storage blocked: use the device setting */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
const forcedFx = (): Fx | null => { try { const f = new URLSearchParams(location.search).get('fx'); return f === 'a' || f === 'b' ? f : null } catch { return null } }
const lowSpec = () => {
  if (typeof navigator === 'undefined') return false
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  return n.connection?.saveData === true || (n.deviceMemory ?? 8) <= 2 || (n.hardwareConcurrency || 8) <= 2
}
const startFx = (): Fx => { try { if (sessionStorage.getItem(SLOW) === '1') return 'b' } catch { /* no storage */ } return lowSpec() ? 'b' : 'a' }

/** Frame-rate guard: feed it animation-frame timestamps. After a warm-up, it counts frames in half-second buckets and calls
 *  onSlow once when `need` buckets in a row fall below `min` fps. reset() starts over (e.g. after the tab was hidden). */
export function fpsGuard(onSlow: () => void, { min = 45, warmup = 2000, bucket = 500, need = 3 } = {}) {
  let start: number | null = null, from: number | null = null, frames = 0, low = 0, done = false
  return {
    frame(t: number) {
      if (done) return
      if (start === null) { start = t; return }
      if (t - start < warmup) return
      if (from === null) { from = t; frames = 0; return }
      frames++
      if (t - from < bucket) return
      low = (frames * 1000) / (t - from) < min ? low + 1 : 0
      from = t; frames = 0
      if (low >= need) { done = true; onSlow() }
    },
    reset() { start = null; from = null; frames = 0; low = 0 },
  }
}

function Lines({ position, every = 1 }: { position: number; every?: number }) {
  return (
    <>{Array.from({ length: 36 }, (_, i) => {
      if (i % every) return null
      const x = (n: number) => n - i * 5 * position
      const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${x(152)} ${343 - i * 6}C${x(616)} ${470 - i * 6} ${x(684)} ${875 - i * 6} ${x(684)} ${875 - i * 6}`
      const common = { d, stroke: 'currentColor', strokeWidth: 0.5 + i * 0.03, strokeOpacity: Math.min(1, 0.1 + i * 0.03) }
      if (every === 1) return <path key={i} {...common} />
      // a running light: one short dash per line (pathLength 1), its own speed (18–28 s) and start point
      const style = { '--d': `${18 + ((i * 7 + (position > 0 ? 0 : 5)) % 11)}s`, '--delay': `-${(i * 1.7 + (position > 0 ? 0 : 4)) % 18}s` } as CSSProperties
      return <path key={i} {...common} pathLength={1} style={style} />
    })}</>
  )
}
const Svg = ({ every, className = '' }: { every?: number; className?: string }) => (
  <svg className={('bg-paths-svg ' + className).trim()} viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
    <Lines position={1} every={every} /><Lines position={-1} every={every} />
  </svg>
)

export function BackgroundPaths() {
  const { t } = useI18n()
  const [paused, setPaused] = useState(startPaused)
  const [forced] = useState(forcedFx)
  const [fx, setFx] = useState<Fx>(() => forced ?? startFx())
  const [away, setAway] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current; if (!el || typeof IntersectionObserver !== 'function') return
    const io = new IntersectionObserver(([e]) => setAway(!e.isIntersecting)); io.observe(el)
    return () => io.disconnect()
  }, [])
  // frame-rate guard for A (not when the owner forced a mode)
  useEffect(() => {
    if (paused || away || fx !== 'a' || forced || typeof requestAnimationFrame !== 'function') return
    const g = fpsGuard(() => { try { sessionStorage.setItem(SLOW, '1') } catch { /* no storage */ } setFx('b') })
    let id = requestAnimationFrame(function loop(ts) { g.frame(ts); id = requestAnimationFrame(loop) })
    const vis = () => g.reset()
    document.addEventListener('visibilitychange', vis)
    return () => { cancelAnimationFrame(id); document.removeEventListener('visibilitychange', vis) }
  }, [paused, away, fx, forced])
  const toggle = () => setPaused((p) => { try { localStorage.setItem(KEY, p ? '0' : '1') } catch { /* private mode: the choice just isn't remembered */ } return !p })
  const label = t(paused ? 'm.motion.play' : 'm.motion.pause')
  return (
    <>
      <div ref={box} data-fx={fx} className={'bg-paths pointer-events-none absolute inset-0' + (paused ? '' : ' is-on') + (away ? ' is-away' : '')} aria-hidden>
        <Svg />
        <div className="bg-sheen-wrap">
          {fx === 'a' ? <Svg every={2} className="bg-flow" /> : <div className="bg-sheen"><div className="bg-sheen-lines"><Svg /></div></div>}
        </div>
      </div>
      <button type="button" className="bg-paths-toggle globe-ctl" onClick={toggle} aria-label={label} title={label}>
        <Icon name={paused ? 'play' : 'pause'} size={16} />
      </button>
    </>
  )
}
