/** Atmospheric backdrop for C.A.L.L. hero surfaces: a soft two-tone glow and a low-contrast perspective grid
 *  (structured information, connectivity). Pure CSS — no images, no WebGL; the slow drift stops for reduced motion (see index.css). */
export function RetroGrid({ className = '' }: { className?: string }) {
  return (
    <div className={'retro-grid pointer-events-none absolute inset-0 overflow-hidden ' + className} aria-hidden>
      <div className="retro-plane"><div className="retro-lines" /></div>
      <div className="retro-fade" />
    </div>
  )
}
export function Glow() {
  return <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
}
