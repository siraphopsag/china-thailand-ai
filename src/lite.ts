// Fewer effects, decided per device (owner, Oct 2026). A friend's Redmi 13C (MediaTek Helio G85: 8 cores, 4–8 GB, Mali-G52 MC2)
// lagged: its CPU count and memory (8 GB models report 8) can look fine, but the small graphics chip struggles with frosted
// glass. So besides cores/memory (checked before the first paint in /theme-init.js), the site checks once:
//   1. the graphics chip's name against budget phone GPUs, and
//   2. how smoothly the page actually draws for 1.5 s.
// The verdict is kept on this device ('cnth-lite-auto'), so /theme-init.js applies it before the next first paint.
// Pure helpers are exported for tests; nothing here leaves the browser.

export const AUTO_KEY = 'cnth-lite-auto'
export type Verdict = 'on' | 'off'
export type Why = 'spec' | 'gpu' | 'slow'

/** budget phone graphics: Mali-400/T-series/G31/G51/G52/G57 MC1–2, PowerVR GE/SGX, Adreno 3xx–5xx and 610/612/613 */
export const weakGpu = (renderer: string) => /Mali-(4\d\d|T\d+|G31|G5[127])\b|PowerVR (Rogue )?(GE|SGX)|Adreno \(TM\) ([345]\d\d|61[0-3])\b/i.test(renderer)

/** frame gaps in ms → too slow when a quarter of the frames take longer than 28 ms (under ~36 frames a second) */
export function slowFrames(gaps: number[]): boolean | null {
  if (gaps.length < 20) return null // not enough to judge (tab in the background, window covered)
  const sorted = [...gaps].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length * 0.75)] > 28
}

export function readVerdict(): Verdict | null {
  try { const v = localStorage.getItem(AUTO_KEY); return v === 'on' || v === 'off' ? v : null } catch { return null }
}
const save = (v: Verdict) => { try { localStorage.setItem(AUTO_KEY, v) } catch { /* private mode */ } }

function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null
    if (!gl) return ''
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '')
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch { return '' }
}
function measure(ms: number): Promise<number[] | null> {
  return new Promise((done) => {
    const gaps: number[] = []
    let last = 0, start = 0, hidden = document.hidden
    const step = (t: number) => {
      if (document.hidden) hidden = true
      if (last) gaps.push(t - last)
      last = t; start ||= t
      if (t - start < ms) requestAnimationFrame(step); else done(hidden ? null : gaps)
    }
    requestAnimationFrame(step)
  })
}

/** once per device, a little after the page has settled: the graphics chip, then the frame rate. Resolves with the reason, or null. */
export async function judgeDevice(): Promise<Why | null> {
  if (typeof window === 'undefined' || readVerdict()) return null
  await new Promise((r) => setTimeout(r, 1500))
  if (weakGpu(gpuName())) { save('on'); return 'gpu' }
  const gaps = await measure(1500)
  const slow = gaps && slowFrames(gaps)
  if (slow === null || gaps === null) return null // judge another time
  save(slow ? 'on' : 'off')
  return slow ? 'slow' : null
}
