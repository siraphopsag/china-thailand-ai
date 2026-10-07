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
  /** the bead goes here even though another item is the current page (the phone "More" while its list is open) */
  focus?: boolean
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
/** the bead may go right to the ends (the first and last items sit there); only keep each shoulder on its own side of it */
export function clampNotch(n: Notch, len: number): Notch {
  const m = Math.max(n.sL, n.sR) + 2
  return { ...n, u: Math.min(len - m, Math.max(m, n.u)) }
}
/**
 * One shoulder, measured from its own end of the bar (x = distance from that end to the bowl centre).
 * Away from the end it touches the edge (and the end's corner on that side shrinks to make room); close to the end — the first
 * or last item — it slides into the plate and becomes the corner itself, touching the end instead of the edge. Both cases meet
 * when the shoulder touches edge and end at once, so the outline changes smoothly as the bead moves.
 */
function shoulder(s: number, x: number, n: Notch, W: number, r: number) {
  const a = x - reach(s, n.rb, n.dc)
  const atEdge = a >= s
  const c = atEdge ? { a, d: s } : { a: s, d: n.dc + Math.sqrt(Math.max(0, (s + n.rb) ** 2 - (x - s) ** 2)) }
  const k = s / (s + n.rb)
  return { atEdge, c, corner: Math.min(r, a), far: atEdge ? r : Math.max(0, Math.min(r, W - c.d)), P: { a: c.a + (x - c.a) * k, d: c.d + (n.dc - c.d) * k } }
}
/** the whole plate: a rounded bar (horizontal: edge on top; vertical: edge on the right) with a socket where the bead is */
export function platePath(vertical: boolean, w: number, h: number, head: number, r: number, notch: Notch | null): string {
  // in (u along the edge, d into the plate); the vertical bar is the horizontal one turned a quarter, so the arc flags hold
  const W = (vertical ? w : h) - head, L = vertical ? h : w
  const p = (u: number, d: number) => (vertical ? `${f(w - head - d)} ${f(u)}` : `${f(u)} ${f(head + d)}`)
  const arc = (rad: number, large: number, sweep: number, u: number, d: number) => (rad > 0.01 ? `A ${f(rad)} ${f(rad)} 0 ${large} ${sweep} ${p(u, d)} ` : `L ${p(u, d)} `)
  let fL = r, fR = r, edge: string
  if (!notch) edge = `L ${p(0, r)} ${arc(r, 0, 1, r, 0)}L ${p(L - r, 0)} ${arc(r, 0, 1, L, r)}`
  else {
    const n = clampNotch(notch, L)
    const l = shoulder(n.sL, n.u, n, W, r), q = shoulder(n.sR, L - n.u, n, W, r)
    fL = l.far; fR = q.far
    const PL = { u: l.P.a, d: l.P.d }, PR = { u: L - q.P.a, d: q.P.d }
    // the bowl turns the other way (concave) from PL to PR; more than half a circle only if the shoulders ride high
    const span = (Math.atan2(PL.d - n.dc, PL.u - n.u) - Math.atan2(PR.d - n.dc, PR.u - n.u) + 4 * Math.PI) % (2 * Math.PI)
    edge = (l.atEdge ? `L ${p(0, l.corner)} ${arc(l.corner, 0, 1, l.corner, 0)}L ${p(l.c.a, 0)} ` : `L ${p(0, l.c.d)} `)
      + arc(n.sL, 0, 1, PL.u, PL.d) + arc(n.rb, span > Math.PI ? 1 : 0, 0, PR.u, PR.d)
      + (q.atEdge ? `${arc(n.sR, 0, 1, L - q.c.a, 0)}L ${p(L - q.corner, 0)} ${arc(q.corner, 0, 1, L, q.corner)}` : arc(n.sR, 0, 1, L, q.c.d))
  }
  return `M ${p(0, W - fL)} ${edge}L ${p(L, W - fR)} ${arc(fR, 0, 1, L - fR, W)}L ${p(fL, W)} ${arc(fL, 0, 1, 0, W - fL)}Z`
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
  // owner, Oct 2026: the bead flows to "More" the moment its list opens, not only after a page in it is chosen
  const focused = slots.findIndex((s) => s.focus)
  const active = focused >= 0 ? focused : slots.findIndex((s) => s.current)
  const [shown, setShown] = useState(active)
  const sim = useRef({ u: -1, v: 0, target: -1, dragging: false, raf: 0 })
  const press = useRef({ from: 0, moved: 0 }) // a tap on the bead (moved < 6 px) presses the item under it

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
      // the bead stays on its item (the socket follows it, not the other way round)
      const c = notch ? clampNotch(notch, vertical ? h : w).u : s.u
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
    press.current = { from: along(e), moved: 0 }
    sim.current.dragging = true; kick()
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = sim.current; if (!s.dragging) return
    press.current.moved = Math.max(press.current.moved, Math.abs(along(e) - press.current.from))
    const c = centers.current, u = Math.min(c[c.length - 1], Math.max(c[0], along(e)))
    s.v = u - s.u; s.u = u; s.target = u
  }
  const up = () => {
    const s = sim.current; if (!s.dragging) return
    s.dragging = false
    const i = nearest(s.u); s.target = centers.current[i]; kick()
    if (i !== active) onSelect(slots[i])
    // tapping the bead again on a button item (the phone "More") opens or closes it (owner, Oct 2026: people tap the same
    // place again and nothing happened, because the bead covers that button)
    else if (press.current.moved < 6) slots[i].onPress?.()
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
        {/* room at the ends, so the first and last items' socket curls round the end of the bar instead of cutting it off */}
        <ul className={`relative flex ${vertical ? 'flex-col items-center gap-1.5 py-5' : 'items-stretch justify-around px-[22px]'}`} style={vertical ? { width: plate } : { height: plate }}>
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
