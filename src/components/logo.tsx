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
    // owner, 17 Oct 2026 (option ข): 7 units of clear space between each dot and the letters beside it — the dots used to nearly
    // touch the next letter, which made the name look crooked
    <svg viewBox="12 24 268 66" role="img" aria-label={title} className={`shrink-0 ${className}`}>
      <path d="M57.6 38.4 A22 22 0 1 0 57.6 69.6" className="lg-s" fill="none" strokeWidth={S} strokeLinecap="round" />
      <path d="M24 70 L31 77 L17 86 Z" className="lg-f" />
      <circle cx="36" cy="54" r="3.2" className="lg-f" /><circle cx="45" cy="54" r="3.2" className="lg-b" />
      {D(75)}
      <path d="M92.5 78 L112.5 30 L132.5 78 M99.5 62 H125.5" className="lg-s" fill="none" strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
      {D(150)}{L(167.5)}{D(211)}{L(228.5)}{D(272)}
    </svg>
  )
}
