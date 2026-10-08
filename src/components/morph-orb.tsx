/**
 * "Thinking orb" while the AI works (owner, Oct 2026 — from the sample component and screen recording the owner sent): the question
 * pill shrinks into a ball, flies up and grows into a turning sphere of dots with rotating status words; when the answer arrives the
 * dots turn green, condense into a glossy ball and unfold into the answer card. Ported from the owner's MorphOrb (timelines, easing,
 * dotted sphere) and fitted to our page: it lives in a stage box (not the whole window), copy comes from the page in three languages,
 * the answer card then grows into the full answer the page renders (children), a failed answer returns to the pill.
 * Reduced motion or the lite mode → cross-fades only and a still sphere. Styles: index.css (.mo-*).
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motionOff } from './ui/background-paths'

export interface OrbCopy { placeholder: string; labels: [string, string, string, string]; done: string; answerTitle: string; reset: string; send: string; field: string }
export interface MorphOrbProps {
  copy: OrbCopy
  /** ask the AI: resolves to true when an answer is ready (the page renders it as children), false to go back to the pill */
  onSubmit: (text: string) => Promise<boolean>
  /** called when the person starts a new question */
  onReset?: () => void
  /** the full answer, shown in the card once the orb has unfolded */
  children?: ReactNode
  /** a chip next to the answer title (e.g. "answered from the legal records") */
  badge?: ReactNode
  disabled?: boolean
  maxLength?: number
  minThinkMs?: number
  /** fewer effects (lite mode): treated like reduced motion */
  lite?: boolean
  /** put this text in the pill and ask at once (example questions); change `nonce` to ask again */
  preset?: { text: string; nonce: number } | null
}

type Phase = 'idle' | 'launch' | 'assemble' | 'think' | 'resolve' | 'condense' | 'unfold' | 'answered' | 'reset'

/* ─────────── geometry (relative to the stage box) ─────────── */
const PILL_H = 60, BALL_SMALL = 60, ORB_D = 150, ORB_R = 66, CANVAS = 220, CARD_H = 64
/** the working orb is drawn on a 220 canvas shown at this size (radius 66 → 75 px); the resting sphere is smaller (index.css) */
const ORB_PX = 250
/** pw: pill width · cw: answer-card width · (sx, sy): where the pill sits, relative to the orb point · lift: how far the card rises while it unfolds */
interface Geo { pw: number; cw: number; sx: number; sy: number; lift: number; dir: number; ax: number; ay: number; rest: boolean; pop0: number }

/* ─────────── math + easing ─────────── */
type Ease = (t: number) => number
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4)
const TAU = Math.PI * 2
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  const solve = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) { const e = sx(t) - x; if (Math.abs(e) < 1e-6) return t; const d = dx(t); if (Math.abs(d) < 1e-6) break; t -= e / d }
    let lo = 0, hi = 1; t = x
    for (let i = 0; i < 40; i++) { const e = sx(t); if (Math.abs(e - x) < 1e-6) break; if (x > e) lo = t; else hi = t; t = (hi - lo) / 2 + lo }
    return t
  }
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solve(x)))
}
const E = {
  out: cubicBezier(0.22, 1, 0.36, 1), io: cubicBezier(0.65, 0, 0.35, 1), in: cubicBezier(0.4, 0, 1, 1), fly: cubicBezier(0.5, 0, 0.1, 1),
  grow: cubicBezier(0.3, 0, 0.2, 1), vortex: cubicBezier(0.6, 0, 0.2, 1), spring: cubicBezier(0.34, 1.4, 0.64, 1), card: cubicBezier(0.65, 0, 0.2, 1),
}
const bez = (t: number, p0: number, c: number, p2: number) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * c + t * t * p2

/* ─────────── timelines ─────────── */
interface Track { ch: string; from: number; to: number; t0: number; t1: number; ease: Ease }
const T = (ch: string, from: number, to: number, t0: number, t1: number, ease: Ease = E.io): Track => ({ ch, from, to, t0, t1, ease })
/** the pill folds up in place: it narrows into a ball and sinks away (no flight — the orb waits in the chat) */
const collapseTracks = (g: Geo): Track[] => [
  T('oInput', 1, 0, 0, 160, E.in), T('inScale', 1, 0.6, 0, 160, E.in), T('oGlow', 1, 0, 0, 260, E.out), T('oAur', 1, 0, 0, 260, E.out),
  T('w', g.pw, BALL_SMALL, 60, 440, E.io), T('oPill', 1, 0, 220, 440, E.out), T('oBall', 0, 1, 220, 440, E.out),
  T('w', BALL_SMALL, 6, 440, 660, E.in), T('h', PILL_H, 6, 440, 660, E.in), T('oBall', 1, 0, 540, 680, E.out),
]
/** the resting sphere comes alive and glides to its place under the question */
const takeoverTracks = (g: Geo, spin0: number): Track[] => [T('orb.alpha', 0, 1, 0, 220, E.out), T('orb.pop', g.pop0, 1, 120, 720, E.out), T('orb.spin', spin0, 0.9, 0, 800, E.out),
  T('cHalo', 0, 0.6, 0, 600, E.out), T('sOp', 0, 1, 450, 750, E.out), T('sTy', 6, 0, 450, 750, E.out)]
const ASSEMBLE: Track[] = [
  T('oRing', 1, 0, 0, 300, E.out), T('oBall', 1, 0, 0, 260, E.out), T('orb.k', 0, 1, 0, 800, E.out), T('orb.alpha', 0, 1, 0, 800, E.out),
  T('orb.spin', 0, 0.9, 0, 800, E.out), T('orb.pop', 1, 1.05, 0, 420, E.out), T('orb.pop', 1.05, 1, 420, 800, E.io),
  T('sOp', 0, 1, 300, 620, E.out), T('sTy', 6, 0, 300, 620, E.out),
]
const RESOLVE: Track[] = [
  T('orb.sweep', 0, 1, 0, 700, E.io), T('orb.spin', 0.9, 0.3, 0, 700, E.out), T('orb.gain', 1, 0, 0, 700, E.out),
  T('orb.floor', 0, 0.95, 400, 900, E.out), T('orb.rad', 0, 0.15, 400, 900, E.out), T('orb.pop', 1, 1.04, 600, 800, E.out), T('orb.pop', 1.04, 1, 800, 900, E.out),
]
const CONDENSE: Track[] = [
  T('orb.pop', 1, 1.06, 0, 120, E.out), T('sOp', 1, 0, 0, 160, E.in), T('sTy', 0, -6, 0, 160, E.in),
  T('orb.k', 1, 0, 120, 640, E.vortex), T('orb.vortex', 0, 1.6, 120, 640, E.vortex),
  T('oGreen', 0, 1, 260, 700, E.spring), T('gs', 0.55, 1, 260, 700, E.spring), T('pulse', 0, 1, 320, 760, E.out),
  T('oHalo', 0, 0.35, 380, 700, E.out), T('orb.alpha', 1, 0, 500, 800, E.out),
]
const unfoldTracks = (g: Geo): Track[] => [
  T('w', ORB_D, 124, 0, 90, E.in), T('h', ORB_D, 124, 0, 90, E.in), T('yOff', 0, -g.lift, 90, 700, E.card),
  T('w', 124, g.cw, 90, 700, E.card), T('h', 124, CARD_H, 90, 700, E.out), T('r', ORB_D / 2, 20, 90, 700, E.io),
  T('oGreen', 1, 0, 200, 560, E.out), T('oCard', 0, 1, 200, 560, E.out), T('oHalo', 0.35, 0, 300, 700, E.out), T('cHalo', 0.6, 0.22, 300, 700, E.out),
  T('hOp', 0, 1, 520, 840, E.out), T('dotS', 0, 1, 520, 840, E.spring),
]
/* a failed answer: the dots turn amber and fade, the pill comes back */
const FAIL: Track[] = [
  T('orb.warn', 0, 1, 0, 400, E.out), T('orb.spin', 0.9, 0.2, 0, 600, E.out), T('orb.gain', 1, 0, 0, 400, E.out), T('orb.floor', 0, 0.8, 0, 400, E.out),
]
/* reduced motion / lite: cross-fades only */
const R_OUT: Track[] = [T('oInput', 1, 0, 0, 140, E.out), T('oPill', 1, 0, 0, 200, E.out), T('oGlow', 1, 0, 0, 200, E.out), T('oAur', 1, 0, 0, 200, E.out), T('oRing', 1, 0, 0, 200, E.out)]
const R_IN: Track[] = [T('orb.alpha', 0, 1, 0, 200, E.out), T('sOp', 0, 1, 0, 200, E.out), T('cHalo', 0, 0.6, 0, 200, E.out)]
const R_RESOLVE: Track[] = [T('orb.sweep', 0, 1, 0, 250, E.io), T('orb.floor', 0, 0.95, 0, 250, E.out)]
const R_CONDENSE: Track[] = [T('oGreen', 0, 1, 0, 250, E.out), T('orb.alpha', 1, 0, 0, 250, E.out), T('sOp', 1, 0, 0, 250, E.out)]
const R_CARD: Track[] = [T('oGreen', 1, 0, 0, 120, E.out), T('oCard', 0, 1, 0, 250, E.out), T('hOp', 0, 1, 0, 250, E.out)]

const FADE = ['oGlow', 'oAur', 'oPill', 'oBall', 'oGreen', 'oCard', 'oRing', 'oInput', 'oHalo', 'sOp', 'orb.alpha', 'trail']
const INIT: Record<string, number> = {
  h: PILL_H, r: 999, oGlow: 1, oHalo: 0, oPill: 1, oBall: 0, oGreen: 0, oCard: 0, oRing: 1, oInput: 1, inScale: 1, oAur: 1,
  gs: 0.55, hOp: 0, dotS: 0, u: 0, yOff: 0, trail: 0, pulse: -1, sOp: 0, sTy: 6, cHalo: 0,
  'orb.k': 0, 'orb.alpha': 0, 'orb.spin': 0, 'orb.pop': 1, 'orb.sweep': 0, 'orb.vortex': 0, 'orb.gain': 1, 'orb.floor': 0, 'orb.rad': 0, 'orb.warn': 0,
}

/* ─────────── async helpers ─────────── */
const ABORT = Symbol('abort')
function sleep(ms: number, sig: AbortSignal) {
  return new Promise<void>((res) => {
    if (sig.aborted) return res()
    let id = 0
    const onAbort = () => { window.clearTimeout(id); res() }
    id = window.setTimeout(() => { sig.removeEventListener('abort', onAbort); res() }, Math.max(0, ms))
    sig.addEventListener('abort', onAbort, { once: true })
  })
}
function abortable<V>(p: Promise<V>, sig: AbortSignal) {
  return new Promise<V | undefined>((res) => {
    if (sig.aborted) return res(undefined)
    const onAbort = () => res(undefined)
    sig.addEventListener('abort', onAbort, { once: true })
    p.then((v) => { sig.removeEventListener('abort', onAbort); res(v) }, () => { sig.removeEventListener('abort', onAbort); res(undefined) })
  })
}

/* ─────────── the dotted sphere (canvas) ─────────── */
const RINGS = 16
const DOT_LIST = (() => {
  const rand = mulberry32(7)
  const out: { x: number; y: number; z: number; u: number; seed: number }[] = []
  for (let k = 0; k < RINGS; k++) {
    const y = 1 - ((k + 0.5) / RINGS) * 2, r = Math.sqrt(1 - y * y), m = Math.max(4, Math.round(30 * r))
    for (let j = 0; j < m; j++) { const a = (j / m) * TAU + k * 0.35; out.push({ x: Math.cos(a) * r, y, z: Math.sin(a) * r, u: (1 - y) / 2, seed: rand() * 6.283 }) }
  }
  return out
})()
const N = DOT_LIST.length
const DX = Float32Array.from(DOT_LIST, (d) => d.x), DY = Float32Array.from(DOT_LIST, (d) => d.y), DZ = Float32Array.from(DOT_LIST, (d) => d.z)
const DU = Float32Array.from(DOT_LIST, (d) => d.u), DS = Float32Array.from(DOT_LIST, (d) => d.seed)
const G_STEPS = 24, A_STEPS = 48
type RGB = [number, number, number]
/** base dot colour → green (done) / amber (failed); light dots for the dark stage, dark dots for the light stage */
const palette = (from: RGB, to: RGB) => {
  const out: string[] = []
  for (let gi = 0; gi <= G_STEPS; gi++) {
    const g = gi / G_STEPS, r = Math.round(lerp(from[0], to[0], g)), gg = Math.round(lerp(from[1], to[1], g)), b = Math.round(lerp(from[2], to[2], g))
    for (let ai = 0; ai <= A_STEPS; ai++) out.push(`rgba(${r},${gg},${b},${(ai / A_STEPS).toFixed(3)})`)
  }
  return out
}
let TABLES: { dark: [string[], string[]]; light: [string[], string[]] } | null = null // built on first use (not while rendering on the server)
const DOT_DARK: RGB = [235, 235, 235], DOT_LIGHT: RGB = [38, 38, 46]

interface OrbParams { k: number; alpha: number; spin: number; rot: number; sweep: number; pop: number; vortex: number; gain: number; floor: number; rad: number; prog: number; warn: number; tilt: number }
const ORB_KEYS = ['k', 'alpha', 'spin', 'sweep', 'pop', 'vortex', 'gain', 'floor', 'rad', 'warn', 'tilt'] as const

function createOrb(canvas: HTMLCanvasElement, isReduced: () => boolean, isLight: () => boolean, tick?: (P: OrbParams, dt: number) => void, keepAlive?: () => boolean) {
  const P: OrbParams = { k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1, vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0, warn: 0, tilt: 0.35 }
  const ctx = canvas.getContext('2d')
  const lit = new Float32Array(N), SX = new Float32Array(N), SY = new Float32Array(N), SR = new Float32Array(N), SD = new Float32Array(N), SC = new Int16Array(N)
  const pw = [1, 0, 0, 0]
  let time = 0, raf = 0, last = 0, dead = false
  const reset = () => {
    Object.assign(P, { k: 0, alpha: 0, spin: 0, rot: 0, sweep: 0, pop: 1, vortex: 0, gain: 1, floor: 0, rad: 0, prog: 0, warn: 0, tilt: 0.35 })
    lit.fill(0); pw[0] = 1; pw[1] = 0; pw[2] = 0; pw[3] = 0
    time = isReduced() ? 1.2 : 0
  }
  reset()
  if (!ctx) return { P, ensure() {}, reset, destroy() {}, paint() {} }
  TABLES ??= { dark: [palette(DOT_DARK, [52, 211, 153]), palette(DOT_DARK, [251, 146, 60])], light: [palette(DOT_LIGHT, [5, 150, 105]), palette(DOT_LIGHT, [217, 119, 6])] }
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(CANVAS * dpr); canvas.height = Math.round(CANVAS * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const S = 0.6, C0 = CANVAS / 2

  const draw = (dt: number) => {
    ctx.clearRect(0, 0, CANVAS, CANVAS)
    time += dt
    tick?.(P, dt)
    P.rot += P.spin * dt
    const CP = Math.cos(P.tilt), SP = Math.sin(P.tilt)
    const yaw = P.rot + P.vortex, cyw = Math.cos(yaw), syw = Math.sin(yaw)
    const stepW = dt / 0.35
    for (let q = 0; q < 4; q++) { const d = (q === P.prog ? 1 : 0) - pw[q]; pw[q] += Math.abs(d) <= stepW ? d : d > 0 ? stepW : -stepW }
    const decay = Math.exp(-dt / 0.5)
    const h0 = (time * 300) % N, h3 = (time * 480) % N
    const a1 = time * 0.8, b1 = Math.sin(time * 0.5) * 0.9
    const f1x = Math.cos(b1) * Math.cos(a1), f1y = Math.sin(b1), f1z = Math.cos(b1) * Math.sin(a1)
    const a2 = time * 0.55 + 2.1, b2 = Math.cos(time * 0.42) * 0.9
    const f2x = Math.cos(b2) * Math.cos(a2), f2y = Math.sin(b2), f2z = Math.cos(b2) * Math.sin(a2)
    const lat = Math.sin(time * 2.2), swirlK = P.vortex * 1.5
    const tt = isLight() ? TABLES!.light : TABLES!.dark, table = P.warn > 0.5 ? tt[1] : tt[0]
    const sweep = Math.max(P.sweep, P.warn)
    for (let n = 0; n < N; n++) {
      const dx = DX[n], dy = DY[n], dz = DZ[n], u = DU[n]
      // the lights move over the dots in turn: four programs, one per status word
      let pulse = 0
      if (pw[0] > 0.001) { let dd = Math.abs(n - h0); if (dd > N - dd) dd = N - dd; const v = Math.max(0, 1 - dd / 16); pulse = Math.max(pulse, v * v * pw[0]) }
      if (pw[1] > 0.001) { const v = Math.max(Math.max(0, (dx * f1x + dy * f1y + dz * f1z - 0.72) / 0.28), Math.max(0, (dx * f2x + dy * f2y + dz * f2z - 0.72) / 0.28)); pulse = Math.max(pulse, v * v * pw[1]) }
      if (pw[2] > 0.001) { const e = dy - lat; const v = Math.max(0, 1 - (e * e) / 0.02); pulse = Math.max(pulse, v * v * pw[2]) }
      if (pw[3] > 0.001) { let dd = Math.abs(n - h3); if (dd > N - dd) dd = N - dd; const v = Math.max(0, 1 - dd / 22); pulse = Math.max(pulse, v * v * pw[3]) }
      const l = Math.max(lit[n] * decay, pulse * P.gain)
      lit[n] = l
      // dots appear from the top and leave from the bottom
      const ki = clamp01(P.k * (1 + S) - S * u)
      if (ki <= 0.001) { SC[n] = -1; continue }
      const eo = E.out(ki), kk = eo * P.pop
      const x1 = dx * cyw + dz * syw, z1 = -dx * syw + dz * cyw
      const y2 = dy * CP - z1 * SP, z2 = dy * SP + z1 * CP
      const f = 2.8 / (2.8 - z2), depth = (z2 + 1) / 2
      let ox = x1 * ORB_R * kk * f, oy = -y2 * ORB_R * kk * f
      if (swirlK > 0.001) { const sw = (1 - ki) * swirlK, cc = Math.cos(sw), ss = Math.sin(sw); const tx = ox * cc - oy * ss; oy = ox * ss + oy * cc; ox = tx }
      const g = clamp01((sweep * 1.4 - u) / 0.4)
      let a = 0.1 + 0.035 * Math.sin(DS[n] + time * 1.6) * (1 - g) + 0.32 * depth * depth + 0.75 * l * (1 - g) + g * (0.55 + 0.4 * depth) + 2 * g * (1 - g)
      a = Math.max(a, P.floor * (0.7 + 0.3 * depth))
      if (a > 1) a = 1
      a *= eo * P.alpha
      SX[n] = C0 + ox; SY[n] = C0 + oy; SD[n] = depth
      SR[n] = (1.15 * (0.45 + 0.75 * depth) * f + 0.9 * l + g * 0.25) * (1 + P.rad) * (0.4 + 0.6 * eo)
      const ai = Math.round(a * A_STEPS), gi = Math.round(g * G_STEPS)
      SC[n] = ai <= 0 ? -1 : gi * (A_STEPS + 1) + ai
    }
    for (let pass = 0; pass < 2; pass++) for (let n = 0; n < N; n++) {
      const c = SC[n]
      if (c < 0 || (SD[n] >= 0.5) !== (pass === 1)) continue
      ctx.fillStyle = table[c]; ctx.beginPath(); ctx.arc(SX[n], SY[n], SR[n], 0, TAU); ctx.fill()
    }
  }
  const frame = (now: number) => {
    raf = 0
    if (dead) return
    // the sphere always turns while it is shown: it is the sign that the AI is working (owner, Oct 2026) — never frozen
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000))
    last = now
    draw(dt)
    if (P.alpha > 0.002 && (!keepAlive || keepAlive())) raf = requestAnimationFrame(frame); else if (P.alpha <= 0.002) ctx.clearRect(0, 0, CANVAS, CANVAS)
  }
  const ensure = () => { if (raf || dead || P.alpha <= 0.002) return; last = performance.now(); raf = requestAnimationFrame(frame) }
  /** draw once now (a still frame) */
  const paint = () => { if (!dead) draw(0) }
  const destroy = () => { dead = true; if (raf) cancelAnimationFrame(raf); raf = 0 }
  return { P, ensure, reset, destroy, paint }
}

/* ─────────── runtime ─────────── */
interface UI { handoff(): { rot: number; tilt: number; spin: number };  answered(): void; failed(): void; setPhase(p: Phase): void; swapLabel(name: string): void; resetLabel(): void; clearInput(): void; live(s: string): void; lock(on: boolean): void; idleReady(): void; focusAnswer(): void }
interface Env {
  root: HTMLElement; mover: HTMLElement; actor: HTMLElement; form: HTMLElement; ghosts: HTMLElement[]; canvas: HTMLCanvasElement; pulse: HTMLElement; status: HTMLElement
  ui: UI; isReduced: () => boolean; isLight: () => boolean; copy: () => OrbCopy; geo: () => Geo
}
interface Runtime { start(text: string, ask: (t: string) => Promise<boolean>, minThink: number): boolean; reset(): void; escape(): void; hard(): void; home(): void; busy(): boolean; destroy(): void }
interface Sample { t: number; x: number; y: number; d: number }
function sampleAt(h: Sample[], t: number, out: Sample) {
  const n = h.length
  const copy = (s: Sample) => { out.x = s.x; out.y = s.y; out.d = s.d }
  if (n === 0) { out.x = 0; out.y = 0; out.d = 0; return }
  if (t <= h[0].t) return copy(h[0])
  for (let i = n - 1; i > 0; i--) {
    const a = h[i - 1], b = h[i]
    if (t >= a.t) { if (t >= b.t) return copy(b); const k = (t - a.t) / (b.t - a.t || 1); out.x = lerp(a.x, b.x, k); out.y = lerp(a.y, b.y, k); out.d = lerp(a.d, b.d, k); return }
  }
  copy(h[n - 1])
}

function createRuntime(env: Env): Runtime {
  const { actor, mover, root, status, pulse, ghosts, form } = env
  const life = new AbortController()
  let geo = env.geo()
  const orb = createOrb(env.canvas, env.isReduced, env.isLight)
  const vals: Record<string, number> = {}
  const dirty = new Set<string>()
  const CH: Record<string, (v: number) => void> = {}
  let current: AbortController | null = null, idleCtl: AbortController | null = null
  let busy = false, idling = false, epoch = 0
  let curX = 0, curY = 0, curD = BALL_SMALL, trailVis = 0, ghostsShown = false
  let fromX = geo.sx, fromY = geo.sy
  const hist: Sample[] = []
  const tmp: Sample = { t: 0, x: 0, y: 0, d: 0 }
  const child = () => { const ac = new AbortController(); if (life.signal.aborted) ac.abort(); else life.signal.addEventListener('abort', () => ac.abort(), { once: true }); return ac }

  const renderTrail = () => {
    if (trailVis <= 0.001) { if (ghostsShown) { ghosts.forEach((g) => (g.style.opacity = '0')); ghostsShown = false } return }
    ghostsShown = true
    const now = performance.now()
    for (let i = 0; i < ghosts.length; i++) {
      sampleAt(hist, now - (i + 1) * 45, tmp)
      const k = (tmp.d * (1 - 0.08 * (i + 1))) / 100, g = ghosts[i]
      g.style.transform = `translate3d(${(tmp.x - curX).toFixed(2)}px,${(tmp.y - curY).toFixed(2)}px,0) translate(-50%,-50%) scale(${k.toFixed(3)})`
      g.style.opacity = (0.28 * Math.pow(1 - i / 6, 1.5) * trailVis).toFixed(3)
    }
  }
  // the flight: a curve from the pill (sx, sy) to the orb point (0, 0); across the page it arcs upward, down the page it swings sideways
  const applyPath = () => {
    const u = vals.u ?? 0, sx = fromX, sy = fromY, len = Math.hypot(sx, sy) || 1
    let px = -sy / len, py = sx / len
    if (Math.abs(sx) > Math.abs(sy)) { if (py > 0) { px = -px; py = -py } } else { px *= geo.dir; py *= geo.dir }
    const cx = sx / 2 + px * 0.3 * len, cy = sy / 2 + py * 0.3 * len
    curX = bez(u, sx, cx, 0)
    curY = bez(u, sy, cy, 0) + (vals.yOff ?? 0)
    mover.style.transform = `translate3d(${curX.toFixed(2)}px,${curY.toFixed(2)}px,0)`
    const now = performance.now()
    hist.push({ t: now, x: curX, y: curY, d: curD })
    while (hist.length > 2 && hist[0].t < now - 500) hist.shift()
    renderTrail()
  }
  ;['oGlow', 'oHalo', 'oPill', 'oBall', 'oGreen', 'oCard', 'oRing', 'oInput', 'oAur', 'gs', 'hOp', 'dotS'].forEach((n) => { CH[n] = (v) => actor.style.setProperty('--' + n, fmt(v)) })
  ;['w', 'h', 'r'].forEach((n) => { CH[n] = (v) => { actor.style.setProperty('--' + n, fmt(v) + 'px'); if (n === 'w') curD = v } })
  CH.inScale = (v) => { actor.style.setProperty('--inScale', fmt(v)); form.style.filter = v >= 0.999 ? 'none' : `blur(${fmt((1 - v) * 15)}px)` }
  CH.sOp = (v) => status.style.setProperty('--sOp', fmt(v))
  CH.sTy = (v) => status.style.setProperty('--sTy', fmt(v))
  CH.cHalo = (v) => root.style.setProperty('--oCenter', fmt(v))
  CH.u = () => applyPath()
  CH.yOff = () => applyPath()
  CH.trail = (v) => { trailVis = v; renderTrail() }
  CH.pulse = (v) => { if (v < 0) { pulse.style.opacity = '0'; return } pulse.style.opacity = fmt(0.5 * (1 - v)); pulse.style.transform = `translate(-50%,-50%) scale(${fmt(1 + v)})` }
  ORB_KEYS.forEach((name) => { CH['orb.' + name] = (v) => { orb.P[name] = v; if (name === 'alpha') orb.ensure() } })
  const set = (ch: string, v: number) => { vals[ch] = v; dirty.add(ch) }
  const flush = () => { dirty.forEach((ch) => CH[ch]?.(vals[ch])); dirty.clear() }
  const setNow = (ch: string, v: number) => { vals[ch] = v; CH[ch]?.(v) }
  const resetChannels = () => { fromX = geo.sx; fromY = geo.sy; setNow('w', geo.pw); for (const ch of Object.keys(INIT)) setNow(ch, INIT[ch]) }

  const play = (tracks: Track[], sig: AbortSignal) => new Promise<void>((res) => {
    if (sig.aborted) return res()
    const end = tracks.reduce((m, k) => Math.max(m, k.t1), 0)
    const done = new Set<Track>()
    let raf = 0, t = 0, last = performance.now()
    const onAbort = () => { cancelAnimationFrame(raf); res() }
    const finish = () => { sig.removeEventListener('abort', onAbort); res() }
    const step = (now: number) => {
      t += Math.max(0, Math.min(100, now - last)); last = now
      for (const k of tracks) {
        if (done.has(k) || t < k.t0) continue
        const p = Math.min(1, (t - k.t0) / Math.max(1, k.t1 - k.t0))
        set(k.ch, k.from + (k.to - k.from) * k.ease(p))
        if (p === 1) done.add(k)
      }
      flush()
      if (t >= end) finish(); else raf = requestAnimationFrame(step)
    }
    sig.addEventListener('abort', onAbort, { once: true })
    raf = requestAnimationFrame(step)
  })

  const labelLoop = async (sig: AbortSignal, ctl: { stop: boolean }) => {
    let i = 0
    for (;;) {
      await sleep(1700, sig)
      if (sig.aborted || ctl.stop) return
      i = (i + 1) % 4
      orb.P.prog = i
      env.ui.swapLabel(env.copy().labels[i])
    }
  }

  const run = async (text: string, sig: AbortSignal, ask: (t: string) => Promise<boolean>, minThink: number) => {
    const reduced = env.isReduced()
    const go = async (tracks: Track[]) => { await play(tracks, sig); if (sig.aborted) throw ABORT }
    try {
      env.ui.setPhase('launch')
      hist.length = 0
      // ask at once: the AI works while the pill turns into the orb
      const pending = Promise.resolve().then(() => ask(text)).then((v) => v === true, () => false)
      // the pill folds up where it is; the orb is already in the chat: the resting sphere comes alive (first question),
      // or a new one gathers under the new question (follow-ups)
      await go(reduced ? R_OUT : collapseTracks(geo))
      fromX = geo.ax; fromY = geo.ay
      setNow('oPill', 0); setNow('oInput', 0); setNow('oBall', 0); setNow('oRing', 0); setNow('oGlow', 0); setNow('oAur', 0)
      setNow('w', ORB_D); setNow('h', ORB_D); setNow('r', ORB_D / 2); setNow('inScale', 1)
      env.ui.setPhase('assemble')
      if (geo.rest) {
        // first question: the resting sphere becomes the working orb right where it is (no move)
        const was = env.ui.handoff()
        orb.P.rot = was.rot; orb.P.tilt = was.tilt
        setNow('orb.k', 1); setNow('u', 1)
        if (!reduced) { setNow('orb.pop', geo.pop0); await go([...takeoverTracks(geo, Math.max(0, Math.min(3, Math.abs(was.spin)))), { ch: 'orb.tilt', from: was.tilt, to: 0.35, t0: 0, t1: 700, ease: E.io }]) }
        else { setNow('sTy', 0); await go(R_IN) }
      } else {
        setNow('u', 1)
        if (!reduced) await go(ASSEMBLE.filter((k) => k.ch !== 'oRing' && k.ch !== 'oBall'))
        else { setNow('sTy', 0); setNow('orb.k', 1); await go(R_IN) }
      }
      env.ui.setPhase('think')
      env.ui.live(env.copy().labels[0])
      const ctl = { stop: false }
      void labelLoop(sig, ctl)
      const t0 = performance.now()
      const ok = await abortable(pending, sig)
      if (sig.aborted) throw ABORT
      await sleep(minThink - (performance.now() - t0), sig)
      ctl.stop = true
      if (sig.aborted) throw ABORT
      if (!ok) {
        // no answer: amber dots, then back to the pill (the page says why)
        env.ui.swapLabel('…')
        await go(FAIL)
        await sleep(500, sig)
        if (sig.aborted) throw ABORT
        env.ui.failed()
        busy = true; void toIdle('esc', true)
        return
      }
      env.ui.setPhase('resolve')
      env.ui.swapLabel(env.copy().done)
      if (!reduced) {
        await go(RESOLVE)
        env.ui.setPhase('condense')
        await go(CONDENSE)
        env.ui.setPhase('unfold')
        await go(unfoldTracks(geo))
      } else {
        await go(R_RESOLVE)
        await sleep(350, sig)
        if (sig.aborted) throw ABORT
        env.ui.setPhase('condense')
        setNow('gs', 1)
        await go(R_CONDENSE)
        env.ui.setPhase('unfold')
        setNow('w', geo.cw); setNow('h', CARD_H); setNow('r', 20); setNow('dotS', 1); setNow('yOff', -geo.lift)
        await go(R_CARD)
      }
      // the answer now stands in the chat; the card fades and the pill comes back for the next question
      env.ui.setPhase('answered')
      env.ui.answered()
      busy = true; void toIdle('reset')
    } catch (e) {
      if (e === ABORT) return
      hard()
    }
  }

  const toIdle = async (kind: 'reset' | 'esc', keepText = false) => {
    if (idling) return
    idling = true
    const my = ++epoch
    const ac = child()
    idleCtl = ac
    const sig = ac.signal
    const outMs = kind === 'reset' ? 240 : 200, inMs = kind === 'reset' ? 420 : 200
    env.ui.setPhase('reset')
    const out: Track[] = [T('cHalo', vals.cHalo ?? 0, 0, 0, outMs, E.out)]
    for (const ch of FADE) { const v = vals[ch] ?? 0; if (v > 0.001) out.push(T(ch, v, 0, 0, outMs, E.out)) }
    await play(out, sig)
    if (sig.aborted || my !== epoch) return
    setNow('pulse', -1)
    env.ui.resetLabel()
    if (!keepText) env.ui.clearInput()
    orb.reset()
    hist.length = 0
    geo = env.geo()
    resetChannels()
    const pillCh = ['oPill', 'oInput', 'oGlow', 'oAur', 'oRing']
    pillCh.forEach((ch) => setNow(ch, 0))
    setNow('yOff', kind === 'reset' ? 8 : 0)
    const inn: Track[] = pillCh.map((ch) => T(ch, 0, 1, 0, inMs, E.out))
    if (kind === 'reset') inn.push(T('yOff', 8, 0, 0, inMs, E.out))
    await play(inn, sig)
    if (sig.aborted || my !== epoch) return
    resetChannels()
    current = null; idleCtl = null; busy = false; idling = false
    env.ui.lock(false)
    env.ui.setPhase('idle')
    env.ui.idleReady()
  }

  function hard() {
    epoch++
    current?.abort(); current = null
    idleCtl?.abort(); idleCtl = null
    orb.reset(); hist.length = 0
    env.ui.resetLabel()
    geo = env.geo()
    resetChannels()
    setNow('pulse', -1)
    busy = false; idling = false
    env.ui.lock(false)
    env.ui.setPhase('idle')
  }

  resetChannels()
  return {
    start(text, ask, minThink) {
      if (busy) return false
      busy = true
      const dir = -geo.dir
      geo = { ...env.geo(), dir }
      orb.reset()
      setNow('u', 0)
      const ac = child()
      current = ac
      env.ui.lock(true)
      void run(text, ac.signal, ask, minThink)
      return true
    },
    escape() { if (!busy || idling) return; current?.abort(); void toIdle('esc', true) },
    reset() { if (!busy || idling) return; void toIdle('reset') },
    hard,
    home() { if (busy) return; geo = { ...env.geo(), dir: geo.dir }; fromX = geo.sx; fromY = geo.sy; setNow('w', geo.pw); setNow('u', 0) },
    busy: () => busy,
    destroy() { life.abort(); orb.destroy() },
  }
}

/* ─────────── words of the answer appear one by one (Thai has no spaces: split with the browser's word breaker) ─────────── */
export function splitWords(text: string, lang: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: 'word' }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter
  if (!Seg) return text.split(/(\s+)/).filter(Boolean)
  return Array.from(new Seg(lang, { granularity: 'word' }).segment(text), (s) => s.segment)
}
export function RevealText({ text, lang }: { text: string; lang: string }) {
  const lines = text.split('\n')
  let i = 0
  const parts = lines.map((l) => splitWords(l, lang))
  const total = parts.reduce((n, p) => n + p.length, 0)
  const stagger = total > 1 ? Math.min(28, 1400 / total) : 0 // the whole answer appears within about 1.5 s
  return <>{parts.map((ws, li) => (
    <Fragment key={li}>{li > 0 && <br />}{ws.map((w, wi) => <span key={wi} className="mo-w" style={{ animationDelay: `${Math.round(i++ * stagger)}ms` }}>{w}</span>)}</Fragment>
  ))}</>
}

/* ─────────── the resting sphere (owner, Oct 2026): turns slowly; drag it to spin it any way, it then eases back to its slow turn ─────────── */
const REST_SPIN = 0.32
function useRestingOrb(canvasRef: { current: HTMLCanvasElement | null }, active: boolean, moving: boolean, light: boolean) {
  const st = useRef({ drag: false, x: 0, y: 0, t: 0, v: 0, orb: null as ReturnType<typeof createOrb> | null })
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !active) return
    const s = st.current
    const base = () => (moving ? REST_SPIN : 0)
    const tick = (P: OrbParams, dt: number) => {
      if (s.drag) { P.spin = 0; return }
      const k = 1 - Math.exp(-dt / 1.4)
      P.spin += (base() - P.spin) * k // a fast spin from a flick slows back to the resting turn
      P.tilt += (0.35 - P.tilt) * (1 - Math.exp(-dt / 0.9))
    }
    const alive = () => s.drag || moving || Math.abs(s.orb?.P.spin ?? 0) > 0.01 || Math.abs((s.orb?.P.tilt ?? 0.35) - 0.35) > 0.002
    const orb = createOrb(c, () => false, isLightTheme, tick, alive)
    s.orb = orb
    Object.assign(orb.P, { k: 1, alpha: 1, spin: base(), gain: 0.55, floor: 0.42, rot: 0.6 })
    orb.paint(); orb.ensure()
    const down = (e: PointerEvent) => { s.drag = true; s.x = e.clientX; s.y = e.clientY; s.t = performance.now(); s.v = 0; c.setPointerCapture(e.pointerId); orb.ensure() }
    const move = (e: PointerEvent) => {
      if (!s.drag) return
      const now = performance.now(), dt = Math.max(1, now - s.t) / 1000, dx = e.clientX - s.x, dy = e.clientY - s.y
      orb.P.rot += dx * 0.012
      orb.P.tilt = Math.max(-0.6, Math.min(1.2, orb.P.tilt + dy * 0.008))
      s.v = s.v * 0.5 + ((dx * 0.012) / dt) * 0.5
      s.x = e.clientX; s.y = e.clientY; s.t = now
      orb.ensure()
    }
    const up = () => { if (!s.drag) return; s.drag = false; orb.P.spin = Math.max(-14, Math.min(14, s.v)); orb.ensure() }
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up)
    return () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); orb.destroy(); s.orb = null }
  }, [active, moving]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { st.current.orb?.paint() }, [light]) // the theme changed: redraw with the other dot colour
  return () => { const P = st.current.orb?.P; return { rot: P?.rot ?? 0.6, tilt: P?.tilt ?? 0.35, spin: P?.spin ?? 0 } }
}
const isLightTheme = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'

/** the light theme, followed live (the stage swaps light dots for dark ones) */
export function useLightTheme() {
  const [light, setLight] = useState(false)
  useEffect(() => {
    const read = () => setLight(isLightTheme())
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return light
}

/**
 * The small thinking orb for the AI check before posting (owner, Oct 2026: "ใช้แบบใหม่"): a turning sphere of dots in a small stage,
 * the five kinds of issue ticked off one by one while the AI reads the post (a sign of progress — the AI checks all five at once);
 * when the result arrives the dots turn green and onDone fires, then the page shows the result.
 */
export function ThinkingOrb({ chips, label, doneText, summing, done, onDone, lite }: { chips: string[]; label: (chip: string) => string; doneText: string; summing: string; done: boolean; onDone: () => void; lite?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const light = useLightTheme()
  const [step, setStep] = useState(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const orbRef = useRef<ReturnType<typeof createOrb> | null>(null)
  const reduced = () => !!lite || (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const tween = (to: Partial<Record<'k' | 'alpha' | 'spin' | 'sweep' | 'gain' | 'floor', number>>, ms: number) => new Promise<void>((res) => {
    const o = orbRef.current
    if (!o) return res()
    const from = Object.fromEntries(Object.keys(to).map((k) => [k, o.P[k as keyof OrbParams] as number]))
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / Math.max(1, ms)), e = E.out(p)
      for (const [k, v] of Object.entries(to)) (o.P as unknown as Record<string, number>)[k] = from[k] + ((v as number) - from[k]) * e
      o.ensure()
      if (p < 1) requestAnimationFrame(tick); else res()
    }
    requestAnimationFrame(tick)
  })
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const o = createOrb(c, reduced, isLightTheme)
    orbRef.current = o
    void tween({ k: 1, alpha: 1, spin: 0.9 }, reduced() ? 1 : 700)
    return () => { o.destroy(); orbRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (done) return
    const id = window.setInterval(() => setStep((s) => Math.min(chips.length, s + 1)), 1600)
    return () => window.clearInterval(id)
  }, [done, chips.length])
  useEffect(() => { if (orbRef.current) orbRef.current.P.prog = step % 4 }, [step])
  useEffect(() => {
    if (!done) return
    let live = true
    void (async () => {
      await tween({ sweep: 1, spin: 0.3, gain: 0, floor: 0.95 }, reduced() ? 1 : 700)
      await new Promise((r) => setTimeout(r, reduced() ? 50 : 300))
      if (live) doneRef.current()
    })()
    return () => { live = false }
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`mo-mini${light ? ' is-light' : ''}`} role="status" aria-live="polite">
      <canvas ref={canvasRef} className="mo-mini-orb" aria-hidden="true" />
      <p className={done ? 'mo-mini-label is-done' : 'mo-mini-label'}>{done ? doneText : <>{step >= chips.length ? summing : label(chips[step])}<span className="mo-dots" aria-hidden="true"><i /><i /><i /></span></>}</p>
      <div className="mo-mini-chips">{chips.map((c, i) => <span key={c} className={done || i < step ? 'is-done' : i === step ? 'is-now' : ''}>{done || i < step ? '✓ ' : ''}{c}</span>)}</div>
    </div>
  )
}

/* ─────────── component: a chat — the question card (left on computers, at the bottom on phones) and the conversation ─────────── */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/** one exchange: the question, and the page's result once there is one (null while the AI works) */
export interface ChatTurn<R> { id: number; q: string; res: R | null }
export interface MorphChatProps<R> {
  copy: OrbCopy
  turns: ChatTurn<R>[]
  /** a new question: the page adds the turn and asks the AI; resolves true when an answer is ready, false for none */
  onAsk: (text: string) => Promise<boolean>
  /** how a finished turn looks (the answer bubble; also the "no answer" bubble) */
  renderAnswer: (t: ChatTurn<R>) => ReactNode
  label: string
  note: ReactNode
  /** example questions (a list on computers; small cards above the pill on phones, only while the chat is empty) */
  examples: string[]
  examplesTitle: string
  idleHint: string
  idleChips?: string[]
  /** shown at the top of the conversation (e.g. uses left today) */
  meta?: ReactNode
  disabled?: boolean
  maxLength?: number
  minThinkMs?: number
  lite?: boolean
}

export default function MorphChat<R>(props: MorphChatProps<R>) {
  const { copy, turns, disabled = false, maxLength = 600 } = props
  const [phase, setPhaseState] = useState<Phase>('idle')
  const [flight, setFlight] = useState<number | null>(null) // the turn whose answer is still on its way (orb shown in its place)
  const [resting, setResting] = useState(false) // the first question was sent: the resting sphere stays until the orb takes over
  const [fading, setFading] = useState(false) // …and fades as the live orb appears on top of it
  const empty = turns.length === 0
  const [value, setValue] = useState('')
  const [still] = useState(() => typeof window === 'undefined' || motionOff())
  const light = useLightTheme()
  const [lbl, setLbl] = useState<{ cur: string; prev: string | null; n: number }>({ cur: copy.labels[0], prev: null, n: 0 })
  const wrapRef = useRef<HTMLDivElement>(null), slotRef = useRef<HTMLDivElement>(null), threadRef = useRef<HTMLDivElement>(null)
  const moverRef = useRef<HTMLDivElement>(null), actorRef = useRef<HTMLDivElement>(null), stillRef = useRef<HTMLCanvasElement>(null)
  const formRef = useRef<HTMLFormElement>(null), inputRef = useRef<HTMLInputElement>(null), canvasRef = useRef<HTMLCanvasElement>(null)
  const pulseRef = useRef<HTMLDivElement>(null), statusRef = useRef<HTMLDivElement>(null), pendRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)
  const ghostRefs = useRef<(HTMLSpanElement | null)[]>([])
  const propsRef = useRef(props)
  propsRef.current = props
  const phaseRef = useRef<Phase>('idle')
  const reducedRef = useRef(false)
  const rtRef = useRef<Runtime | null>(null)
  const timers = useRef<{ typing?: number; shake?: number }>({})
  const nextId = useRef(1)

  // the theme decides the stage: dark dots on light, light dots on dark (follows the theme switch live)
  // the resting sphere: alive while the chat is empty; draggable until a question is sent
  const restState = useRestingOrb(stillRef, empty || resting, !still, light) // slow turn while motion is on (Settings)
  const restRef = useRef(restState)
  restRef.current = restState

  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current, slot = slotRef.current, mover = moverRef.current, actor = actorRef.current, canvas = canvasRef.current
    const pulse = pulseRef.current, status = statusRef.current, form = formRef.current
    const ghosts = ghostRefs.current.filter((g): g is HTMLSpanElement => !!g)
    if (!wrap || !slot || !mover || !actor || !canvas || !pulse || !status || !form) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedRef.current = mq.matches
    const onMq = (e: MediaQueryListEvent) => { reducedRef.current = e.matches }
    mq.addEventListener('change', onMq)
    // measure: the orb point is the waiting place in the chat (or the middle of the empty chat); the pill sits in its slot
    const geo = (): Geo => {
      const w = wrap.getBoundingClientRect(), sl = slot.getBoundingClientRect(), still = stillRef.current?.getBoundingClientRect()
      const pend = pendRef.current, th = threadRef.current
      let ox: number, oy: number, lift = 0, cw = 300
      if (pend) {
        const p = pend.getBoundingClientRect()
        ox = p.left - w.left + p.width / 2; oy = p.top - w.top + 92
        lift = 92 - CARD_H / 2 // the card ends at the top of the waiting place, where the answer bubble then stands
        cw = Math.max(220, p.width)
      } else if (th) {
        const t = th.getBoundingClientRect()
        ox = t.left - w.left + t.width / 2; oy = t.top - w.top + t.height * 0.42
        cw = Math.max(220, t.width - 32)
      } else { ox = w.width / 2; oy = 200 }
      const orbPx = canvas.getBoundingClientRect().width || ORB_PX // the working orb's size on screen (smaller on phones)
      const rest = !!still && still.width > 0 && !!pend
      let pop0 = 1
      if (rest && pend) {
        const p = pend.getBoundingClientRect()
        ox = still!.left - w.left + still!.width / 2; oy = still!.top - w.top + still!.height / 2
        lift = oy - (p.top - w.top) - CARD_H / 2 // the card unfolds where the orb is, then rises to where the answer stands
        pop0 = still!.width / orbPx
      }
      mover.style.left = ox + 'px'; mover.style.top = oy + 'px'
      status.style.left = ox + 'px'; status.style.top = oy + orbPx * 0.42 + 'px'
      return { pw: sl.width, cw, sx: sl.left - w.left + sl.width / 2 - ox, sy: sl.top - w.top + sl.height / 2 - oy, lift, dir: -1, ax: 0, ay: 0, rest, pop0 }
    }
    const rt = createRuntime({
      root: wrap, mover, actor, form, ghosts, canvas, pulse, status, geo,
      isReduced: () => reducedRef.current || !!propsRef.current.lite,
      isLight: isLightTheme,
      copy: () => propsRef.current.copy,
      ui: {
        handoff: () => { const was = restRef.current(); setFading(true); window.setTimeout(() => { setResting(false); setFading(false) }, 260); return was },
        answered: () => setFlight(null),
        failed: () => { setFlight(null); setResting(false) },
        setPhase: (p) => { phaseRef.current = p; setPhaseState(p) },
        swapLabel: (name) => setLbl((l) => (l.cur === name ? l : { cur: name, prev: l.cur, n: l.n + 1 })),
        resetLabel: () => setLbl((l) => ({ cur: propsRef.current.copy.labels[0], prev: null, n: l.n + 1 })),
        clearInput: () => setValue(''),
        live: (s) => { if (liveRef.current) liveRef.current.textContent = s },
        lock: (on) => { form.toggleAttribute('inert', on) },
        idleReady: () => { if (!window.matchMedia('(max-width: 1023px)').matches) inputRef.current?.focus({ preventScroll: true }) },
        focusAnswer: () => {},
      },
    })
    rtRef.current = rt
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phaseRef.current !== 'idle' && phaseRef.current !== 'reset' && phaseRef.current !== 'answered') { e.preventDefault(); rt.escape(); setFlight(null) } }
    // keep the pill on its slot whenever anything around it moves (phone toolbars, fonts, the examples strip, rotation)
    const rehome = () => { if (phaseRef.current === 'idle' && !rt.busy()) rt.home() }
    const ro = new ResizeObserver(rehome)
    ro.observe(wrap); ro.observe(slot); if (slot.parentElement) ro.observe(slot.parentElement)
    window.addEventListener('resize', rehome); window.addEventListener('orientationchange', rehome)
    void document.fonts?.ready.then(rehome)
    const late = window.setTimeout(rehome, 600)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey); ro.disconnect(); mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', rehome); window.removeEventListener('orientationchange', rehome); window.clearTimeout(late)
      window.clearTimeout(timers.current.typing); window.clearTimeout(timers.current.shake)
      rt.destroy(); rtRef.current = null
    }
  }, [])

  // phones: the chat fills the screen down to the menu bar (like an AI chat app); computers use the CSS height
  useEffect(() => {
    const fit = () => {
      const w = wrapRef.current
      if (!w) return
      if (!window.matchMedia('(max-width: 1023px)').matches) { w.style.height = ''; return }
      const top = w.getBoundingClientRect().top + window.scrollY
      w.style.height = Math.max(360, Math.round(window.innerHeight - top - 104)) + 'px'
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  // keep the newest message in view
  const scrollEnd = (smooth: boolean) => { const th = threadRef.current; if (th) th.scrollTo({ top: th.scrollHeight, behavior: smooth && !reducedRef.current ? 'smooth' : 'auto' }) }
  useEffect(() => { if (phaseRef.current === 'idle' || phaseRef.current === 'reset' || phaseRef.current === 'answered') scrollEnd(true) }, [turns])

  const ask = (text: string) => {
    const rt = rtRef.current
    if (!rt || rt.busy() || phaseRef.current !== 'idle' || propsRef.current.disabled) return
    const id = nextId.current++
    setFlight(id)
    if (propsRef.current.turns.length === 0) setResting(true)
    const done = propsRef.current.onAsk(text)
    // wait for the new question bubble and the waiting place to be drawn, scroll to them, then fly
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollEnd(false)
      rt.start(text, () => done, propsRef.current.minThinkMs ?? 2600)
    }))
  }
  const shake = () => {
    const a = actorRef.current
    if (!a) return
    a.removeAttribute('data-shake'); void a.offsetWidth; a.setAttribute('data-shake', '')
    window.clearTimeout(timers.current.shake)
    timers.current.shake = window.setTimeout(() => a.removeAttribute('data-shake'), 260)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const text = value.trim()
    if (text.length < 4) { shake(); return }
    ask(text)
  }
  const pick = (q: string) => { if (phaseRef.current !== 'idle' || disabled) return; setValue(q); requestAnimationFrame(() => ask(q)) }
  const ready = value.trim().length >= 4 && !disabled
  const lastId = turns.length ? turns[turns.length - 1].id : null
  const waiting = flight !== null
  const labelInner = (name: string) => name === copy.done ? <span className="mo-lab-done">{name}</span> : <><span>{name}</span><span className="mo-dots" aria-hidden="true"><i /><i /><i /></span></>
  const exampleButtons = (cls: string) => props.examples.map((q) => <button key={q} type="button" disabled={disabled} onClick={() => pick(q)} className={cls}>{q}</button>)

  return (
    <div className={`mo-wrap${still ? '' : ' is-on'}${light ? ' is-light' : ''}${empty ? ' is-empty' : ''}`} ref={wrapRef} data-phase={phase}>
      {/* the conversation */}
      <section className="mo-root" aria-label={props.label}>
        <div className="mo-bg" aria-hidden="true" />
        {props.meta && <div className="mo-meta">{props.meta}</div>}
        <div className="mo-thread" ref={threadRef} aria-live="polite" aria-busy={waiting}>
          {(empty || resting) && (
            <div className={`mo-idle${resting ? ' is-sending' : ''}${fading ? ' is-fading' : ''}`}>
              <canvas className="mo-still" ref={stillRef} aria-hidden="true" />
              <p className="mo-idle-hint">{props.idleHint}</p>
              {props.idleChips && <div className="mo-idle-chips">{props.idleChips.map((c) => <span key={c}>{c}</span>)}</div>}
            </div>
          )}
          {turns.map((t) => (
            <Fragment key={t.id}>
              <div className="mo-q"><span>{t.q}</span></div>
              {waiting && t.id === lastId ? <div className="mo-pend" ref={pendRef} aria-hidden="true" /> : t.res !== null && <div className="mo-a">{props.renderAnswer(t)}</div>}
            </Fragment>
          ))}
        </div>
      </section>
      {/* the question card: computers — heading, pill, note, examples; phones — the pill at the bottom, examples above it while empty */}
      <section className="card mo-qcard">
        <label htmlFor="mo-field" className="label mo-qlabel">{props.label}</label>
        {empty && <div className="mo-ex-strip">{exampleButtons('mo-ex-chip')}</div>}
        <div className="mo-slot" ref={slotRef} />
        <div className="mo-note"><span>{props.note}</span><span className="shrink-0">{value.length}/{maxLength}</span></div>
        <div className="mo-ex-list"><p className="text-xs text-muted mb-1.5">{props.examplesTitle}</p>
          <div className="flex flex-col gap-1.5">{exampleButtons('text-left text-sm rounded-lg border border-control px-3 py-2 hover:bg-surface3 disabled:opacity-60')}</div></div>
      </section>
      {/* the status words under the orb, and the travelling shape (pill → ball → orb → card), drawn over everything */}
      <div className="mo-status" ref={statusRef} aria-hidden="true">
        {lbl.prev !== null && <span key={'p' + lbl.n} className="mo-lab mo-out">{labelInner(lbl.prev)}</span>}
        <span key={'c' + lbl.n} className="mo-lab mo-in">{labelInner(lbl.cur)}</span>
      </div>
      <div className="mo-layer">
        <div className="mo-mover" ref={moverRef}>
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className="mo-trail" aria-hidden="true" ref={(el) => { ghostRefs.current[i] = el }} />)}
          <div className="mo-actor" ref={actorRef}>
            <div className="mo-underglow" aria-hidden="true" />
            <div className="mo-halo-green" aria-hidden="true" />
            <div className="mo-surface" aria-hidden="true"><div className="mo-aurora"><i /><i /><i /><i /></div></div>
            <div className="mo-ball" aria-hidden="true" />
            <div className="mo-green" aria-hidden="true" />
            <div className="mo-card" aria-hidden="true"><div className="mo-a-head"><i className="mo-a-dot" />{copy.answerTitle}</div></div>
            <div className="mo-ring" aria-hidden="true" />
            <form className="mo-input" ref={formRef} onSubmit={onSubmit} autoComplete="off">
              <svg className="mo-spark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 3.5l1.7 4.8 4.8 1.7-4.8 1.7L10 16.5l-1.7-4.8L3.5 10l4.8-1.7L10 3.5z" /><path d="M18 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
              </svg>
              <input id="mo-field" ref={inputRef} className="mo-field" type="text" value={value} maxLength={maxLength} placeholder={empty ? copy.placeholder : copy.field} disabled={disabled} spellCheck={false} enterKeyHint="send"
                onChange={(e) => {
                  setValue(e.target.value)
                  const a = actorRef.current
                  if (a) { a.setAttribute('data-typing', ''); window.clearTimeout(timers.current.typing); timers.current.typing = window.setTimeout(() => a.removeAttribute('data-typing'), 300) }
                }} />
              <button type="submit" className="mo-send" aria-label={copy.send} data-ready={ready ? '' : undefined} disabled={disabled}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M5.5 11.5L12 5l6.5 6.5" /></svg>
              </button>
            </form>
            <canvas className="mo-orb" ref={canvasRef} aria-hidden="true" />
            <div className="mo-pulse" ref={pulseRef} aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="mo-live sr-only" ref={liveRef} role="status" aria-live="polite" />
    </div>
  )
}
