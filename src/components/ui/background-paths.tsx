import { useState } from 'react'
import { useI18n } from '../../i18n'
import { Icon } from '../icons'

/* Background Paths (owner, Oct 2026): two sets of 36 curved lines that slowly draw along themselves, after the shadcn
 * "background-paths" component. Kept in components/ui (the shadcn convention) but rebuilt without framer-motion: the
 * movement is CSS (stroke-dashoffset on pathLength=1), so no extra libraries. Only the background is used — the hero
 * keeps its own title and button.
 * Accessibility: decorative (aria-hidden); faded behind the text so contrast is unchanged; WCAG 2.2.2 — it keeps moving,
 * so there is a pause button (remembered in this browser); reduced motion → still lines and no button. */

const KEY = 'call.motion.paused'
const readPaused = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

function FloatingPaths({ position }: { position: number }) {
  return (
    <svg className="bg-paths-svg" viewBox="0 0 696 316" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
      {Array.from({ length: 36 }, (_, i) => {
        const x = (n: number) => n - i * 5 * position
        const d = `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${x(152)} ${343 - i * 6}C${x(616)} ${470 - i * 6} ${x(684)} ${875 - i * 6} ${x(684)} ${875 - i * 6}`
        // fixed per-line timing (20–29 s, staggered) instead of Math.random, so server and browser render the same
        return <path key={i} d={d} pathLength={1} stroke="currentColor" strokeWidth={0.5 + i * 0.03} strokeOpacity={Math.min(1, 0.1 + i * 0.03)}
          style={{ animationDuration: `${20 + ((i * 7 + (position > 0 ? 0 : 3)) % 10)}s`, animationDelay: `-${(i * 1.3) % 20}s` }} />
      })}
    </svg>
  )
}

export function BackgroundPaths() {
  const { t } = useI18n()
  const [paused, setPaused] = useState(readPaused)
  const toggle = () => setPaused((p) => { try { localStorage.setItem(KEY, p ? '0' : '1') } catch { /* private mode: the choice just isn't remembered */ } return !p })
  return (
    <>
      <div className={'bg-paths pointer-events-none absolute inset-0' + (paused ? ' is-paused' : '')} aria-hidden>
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>
      <button type="button" className="bg-paths-toggle globe-ctl" onClick={toggle} aria-pressed={paused} aria-label={t('m.motion.pause')} title={t('m.motion.pause')}>
        <Icon name={paused ? 'play' : 'pause'} size={16} />
      </button>
    </>
  )
}
