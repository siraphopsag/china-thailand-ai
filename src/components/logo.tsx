/**
 * The C.A.L.L. logo (owner, Oct 2026: "C คุยกัน", option ข): the name in our own geometric letters, its C a speech bubble — talking
 * across languages, and a "call". Letters in indigo, the dots in teal (two sides, one name); lighter in the dark theme (index.css
 * --logo-a / --logo-b). The files for reports and slides are in the project folder "โลโก้ C.A.L.L."; the favicon and home-screen
 * icons are in /public.
 */
const S = 10
export function Wordmark({ className = '', title = 'C.A.L.L.' }: { className?: string; title?: string }) {
  const L = (x: number) => <path d={`M${x} 30 V78 H${x + 26}`} className="lg-s" fill="none" strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
  const D = (x: number) => <circle cx={x} cy="74" r="5.5" className="lg-b" />
  return (
    <svg viewBox="12 24 234 66" role="img" aria-label={title} className={`shrink-0 ${className}`}>
      <path d="M57.6 38.4 A22 22 0 1 0 57.6 69.6" className="lg-s" fill="none" strokeWidth={S} strokeLinecap="round" />
      <path d="M24 70 L31 77 L17 86 Z" className="lg-f" />
      <circle cx="36" cy="54" r="3.2" className="lg-f" /><circle cx="45" cy="54" r="3.2" className="lg-b" />
      {D(70)}
      <path d="M82 78 L102 30 L122 78 M89 62 H115" className="lg-s" fill="none" strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
      {D(134)}{L(148)}{D(186)}{L(198)}{D(236)}
    </svg>
  )
}
