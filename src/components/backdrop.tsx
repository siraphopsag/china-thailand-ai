/** Atmospheric backdrop for C.A.L.L. hero surfaces: a soft two-tone glow. Pure CSS — no images, no WebGL.
 *  (The perspective grid that used to sit under it was replaced by components/ui/background-paths.tsx, owner Oct 2026.) */
export function Glow() {
  return <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
}
