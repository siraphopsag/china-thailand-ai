import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { NavLink } from '../store'
import { Icon, type IconName } from './icons'

/**
 * "Meniscus" menu (owner, Oct 2026, after a reference video): one plate whose edge dips into a smooth socket under a coloured
 * bead. The bead sits on the current item; choosing another item (or dragging the bead) makes it flow there on a spring, the
 * socket following like a liquid surface — the trailing shoulder draws out, the leading one tightens. Each item has its own
 * colour. Horizontal on phones (bead above the bar), vertical on computers (bead out to the right of the rail).
 * The links stay ordinary links (keyboard, screen readers); the bead and the plate are decoration. Reduced motion: no flowing.
 */
export interface Hue { bead: string; light: string; dark: string }
export interface Slot {
  key: string; label: string; aria: string; icon: IconName; hue: Hue; current: boolean
  badge?: number; split?: boolean
  /** a link … */
  to?: string
  /** … or a button (the phone "More") */
  onPress?: () => void; expanded?: boolean; controls?: string; btnRef?: Ref<HTMLButtonElement>
}

/* ---------- geometry (pure; exported for tests) ---------- */
export interface Notch { u: number; dc: number; rb: number; sL: number; sR: number }
const f = (n: number) => Math.round(n * 100) / 100
/** how far along the edge a shoulder of radius s reaches from the bowl centre: the shoulder circle (inside the plate, touching the
 *  edge) and the bowl (outside the plate) touch, so |C1C2| = s + rb */
export const reach = (s: number, rb: number, dc: number) => Math.sqrt(Math.max(0, (s + rb) ** 2 - (dc - s) ** 2))
/** keep the socket inside the straight part of the edge (between the rounded ends) */
export function clampNotch(n: Notch, from: number, to: number): Notch {
  const lo = from + reach(n.sL, n.rb, n.dc) + 2, hi = to - reach(n.sR, n.rb, n.dc) - 2
  return { ...n, u: Math.min(hi, Math.max(lo, n.u)) }
}
/** the edge with its socket, in (u along the edge, d into the plate) mapped to x/y by `p` */
function notchPath(n: Notch, p: (u: number, d: number) => string): string {
  const uL = n.u - reach(n.sL, n.rb, n.dc), uR = n.u + reach(n.sR, n.rb, n.dc)
  const kL = n.sL / (n.sL + n.rb), kR = n.sR / (n.sR + n.rb)
  const PL = { u: uL + (n.u - uL) * kL, d: n.sL + (n.dc - n.sL) * kL }
  const PR = { u: uR + (n.u - uR) * kR, d: n.sR + (n.dc - n.sR) * kR }
  const large = (PL.d + PR.d) / 2 < n.dc ? 1 : 0
  return `L ${p(uL, 0)} A ${f(n.sL)} ${f(n.sL)} 0 0 1 ${p(PL.u, PL.d)} A ${f(n.rb)} ${f(n.rb)} 0 ${large} 0 ${p(PR.u, PR.d)} A ${f(n.sR)} ${f(n.sR)} 0 0 1 ${p(uR, 0)} `
}
/** the whole plate: a rounded bar (horizontal: edge on top; vertical: edge on the right) with a socket where the bead is */
export function platePath(vertical: boolean, w: number, h: number, head: number, r: number, notch: Notch | null): string {
  if (!vertical) {
    const T = head, B = h
    const p = (u: number, d: number) => `${f(u)} ${f(T + d)}`
    const n = notch ? notchPath(clampNotch(notch, r, w - r), p) : ''
    return `M 0 ${f(T + r)} A ${r} ${r} 0 0 1 ${r} ${T} ${n}L ${f(w - r)} ${T} A ${r} ${r} 0 0 1 ${f(w)} ${f(T + r)} L ${f(w)} ${f(B - r)} A ${r} ${r} 0 0 1 ${f(w - r)} ${f(B)} L ${r} ${f(B)} A ${r} ${r} 0 0 1 0 ${f(B - r)} Z`
  }
  const E = w - head
  const p = (u: number, d: number) => `${f(E - d)} ${f(u)}`
  const n = notch ? notchPath(clampNotch(notch, r, h - r), p) : ''
  return `M ${f(E - r)} 0 A ${r} ${r} 0 0 1 ${f(E)} ${r} ${n}L ${f(E)} ${f(h - r)} A ${r} ${r} 0 0 1 ${f(E - r)} ${f(h)} L ${r} ${f(h)} A ${r} ${r} 0 0 1 0 ${f(h - r)} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`
}
/** the shoulders lean with the speed: trailing one longer, leading one shorter (v in px per frame along the edge) */
export function shoulders(base: number, v: number): [number, number] {
  const q = Math.max(-1, Math.min(1, v / 14))
  const sL = base * (1 + 0.65 * Math.max(q, 0) - 0.35 * Math.max(-q, 0))
  const sR = base * (1 + 0.65 * Math.max(-q, 0) - 0.35 * Math.max(q, 0))
  return [Math.max(base * 0.5, sL), Math.max(base * 0.5, sR)]
}

/** one frame of the spring that carries the bead to its target (about 60 frames a second) */
export function springStep(s: { u: number; v: number; target: number }) {
  const a = (s.target - s.u) * 0.09
  s.v = (s.v + a) * 0.7; s.u += s.v // about 7 % overshoot, settled in ~0.7 s
  if (Math.abs(s.target - s.u) < 0.25 && Math.abs(s.v) < 0.05) { s.u = s.target; s.v = 0 }
}

const BEAD = 46, GAP = 8, DC = -1, FILLET = 16
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function Meniscus({ slots, vertical, label, className = '', style, onSelect }: {
  slots: Slot[]; vertical?: boolean; label: string; className?: string; style?: React.CSSProperties
  /** activate a slot when the bead is dropped on it (navigation is done by the caller) */
  onSelect: (s: Slot) => void
}) {
  const head = 24, plate = vertical ? 64 : 60, radius = vertical ? 32 : 30
  const box = useRef<HTMLDivElement>(null), svgPath = useRef<SVGPathElement>(null), blur = useRef<HTMLDivElement>(null), bead = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLLIElement | null)[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [ver, setVer] = useState(0)
  const last = useRef(-2)
  const centers = useRef<number[]>([])
  const active = slots.findIndex((s) => s.current)
  const [shown, setShown] = useState(active)
  const sim = useRef({ u: -1, v: 0, target: -1, dragging: false, raf: 0 })

  const nearest = (u: number) => { let best = 0; centers.current.forEach((c, i) => { if (Math.abs(c - u) < Math.abs(centers.current[best] - u)) best = i }); return best }
  const draw = useCallback(() => {
    const { w, h } = size; if (!w || !h) return
    const s = sim.current, has = s.u >= 0 && (active >= 0 || s.dragging)
    const [sL, sR] = shoulders(FILLET, s.v)
    const notch = has ? { u: s.u, dc: DC, rb: BEAD / 2 + GAP, sL, sR } : null
    const d = platePath(!!vertical, w, h, head, radius, notch)
    svgPath.current?.setAttribute('d', d)
    if (blur.current) blur.current.style.clipPath = `path('${d}')`
    if (bead.current) {
      const len = vertical ? h : w
      const c = notch ? clampNotch(notch, radius, len - radius).u : s.u
      const x = vertical ? w - head - DC : c, y = vertical ? c : head + DC
      bead.current.style.transform = `translate(${f(x - BEAD / 2)}px, ${f(y - BEAD / 2)}px)`
      bead.current.style.opacity = has ? '1' : '0'
    }
    if (has) { const n = nearest(s.u); setShown((o) => (o === n ? o : n)) }
  }, [size, vertical, active, head, radius])

  const step = useCallback(() => {
    const s = sim.current
    if (!s.dragging) springStep(s)
    else s.v *= 0.85
    draw()
    s.raf = s.dragging || s.v !== 0 || s.u !== s.target ? requestAnimationFrame(step) : 0
  }, [draw])
  const kick = useCallback(() => { if (!sim.current.raf) sim.current.raf = requestAnimationFrame(step) }, [step])

  // measure the box and where each item sits along the edge
  useLayoutEffect(() => {
    const el = box.current; if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize((o) => (o.w === r.width && o.h === r.height ? o : { w: r.width, h: r.height }))
      centers.current = items.current.slice(0, slots.length).map((li) => { if (!li) return 0; const b = li.getBoundingClientRect(); return vertical ? b.top - r.top + b.height / 2 : b.left - r.left + b.width / 2 })
      setVer((v) => v + 1)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null; ro?.observe(el)
    return () => ro?.disconnect()
  }, [vertical, slots.length])
  // the bead goes to the current item: straight there the first time (and with reduced motion), flowing afterwards
  useEffect(() => {
    const s = sim.current
    if (active < 0 || !centers.current.length) { draw(); return }
    const to = centers.current[active]
    s.target = to
    // a new current item flows there; the same item after a layout change (resize, more items) just moves
    if (s.u < 0 || reduced() || document.hidden || last.current === active) { s.u = to; s.v = 0; draw() } else kick()
    last.current = active
    setShown(active)
  }, [active, ver, draw, kick])
  useEffect(() => () => cancelAnimationFrame(sim.current.raf), [])

  // drag the bead along the bar; it drops on the nearest item
  const along = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return vertical ? e.clientY - r.top : e.clientX - r.left }
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (active < 0 && !sim.current.dragging) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    sim.current.dragging = true; kick()
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = sim.current; if (!s.dragging) return
    const c = centers.current, u = Math.min(c[c.length - 1], Math.max(c[0], along(e)))
    s.v = u - s.u; s.u = u; s.target = u
  }
  const up = () => {
    const s = sim.current; if (!s.dragging) return
    s.dragging = false
    const i = nearest(s.u); s.target = centers.current[i]; kick()
    if (!slots[i].current) onSelect(slots[i])
  }

  const cur = slots[shown >= 0 ? shown : 0]
  const hueVars = (h: Hue) => ({ '--hue': h.bead, '--hue-l': h.light, '--hue-d': h.dark }) as React.CSSProperties
  return (
    <nav aria-label={label} className={`mn ${vertical ? 'mn-v' : 'mn-h'} ${className}`} style={{ ...style, ...hueVars(cur.hue) }}>
      <div ref={box} className="relative" style={vertical ? { paddingRight: head } : { paddingTop: head }}>
        {/* the plate: blurred glass clipped to the same shape, then the drawn outline */}
        <div ref={blur} className="mn-blur absolute inset-0" aria-hidden />
        <svg className="mn-svg absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-hidden><path ref={svgPath} className="mn-plate" /></svg>
        <span className="mn-glow" aria-hidden />
        <ul className={`relative flex ${vertical ? 'flex-col items-center gap-1.5 py-2' : 'items-stretch justify-around px-1'}`} style={vertical ? { width: plate } : { height: plate }}>
          {slots.map((s, i) => {
            const under = i === shown && (active >= 0 || sim.current.dragging)
            const inner = (<>
              <span className={`mn-icon ${under ? 'opacity-0' : ''}`}><Icon name={s.icon} size={vertical ? 22 : 21} />
                {!!s.badge && <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-danger-fg text-page text-[10px] font-bold grid place-items-center" aria-hidden>{s.badge}</span>}</span>
              {!vertical && <span className={`mn-label ${under ? 'opacity-100' : 'opacity-0'}`} style={hueVars(s.hue)} aria-hidden>{s.label}</span>}
              {vertical && <span className="nav-tip" aria-hidden>{s.label}</span>}
            </>)
            const cls = `mn-item ${vertical ? 'w-12 h-12 group' : 'flex-1 h-full'} ${s.current ? 'mn-on' : ''}`
            return (
              <li key={s.key} ref={(el) => { items.current[i] = el }} className={`${vertical ? '' : 'flex-1 flex'} ${s.split ? 'nav-split' : ''}`}>
                {s.to !== undefined
                  ? <NavLink to={s.to} aria-current={s.current ? 'page' : undefined} aria-label={s.aria} className={cls}>{inner}</NavLink>
                  : <button ref={s.btnRef} type="button" aria-label={s.aria} aria-expanded={s.expanded} aria-controls={s.controls} onClick={s.onPress} className={cls}>{inner}</button>}
              </li>)
          })}
        </ul>
        {/* the bead: the current item's colour and icon; drag it along the bar */}
        <div ref={bead} className="mn-bead" aria-hidden onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <Icon name={cur.icon} size={22} />
          {!!cur.badge && <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-danger-fg text-page text-[10px] font-bold grid place-items-center">{cur.badge}</span>}
        </div>
      </div>
    </nav>
  )
}
