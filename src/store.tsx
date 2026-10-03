// In-app navigation: clean URLs (e.g. /hire), Back that never leaves the site, links that route without a reload.
// (This file used to hold the business-planning tool's store too; that tool was removed in Oct 2026.)
import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

const ROUTE_EVENT = 'app:navigate'
const current = () => window.location.pathname.split('/').filter(Boolean).join('/')
/** how many in-app pages lie behind the current history entry (0 = the visitor arrived here directly) */
export const appDepth = (): number => { const d = (window.history.state as { d?: unknown } | null)?.d; return typeof d === 'number' ? d : 0 }
export const go = (r: string) => {
  // compare path + query, so going from /post?id=… to another post is a real navigation (paths without a query behave as before)
  if (window.location.pathname + window.location.search !== '/' + r) window.history.pushState({ d: appDepth() + 1 }, '', '/' + r)
  window.dispatchEvent(new Event(ROUTE_EVENT)); window.scrollTo(0, 0)
}
/** "Back": the previous in-app page when there is one, otherwise the given parent page (never leaves the site) */
export const goBack = (parent: string) => { if (appDepth() > 0) window.history.back(); else go(parent) }
/** In-app link: a real <a href> (so it is announced as a link and can be opened in a new tab) that routes without a reload on a plain click. */
export function NavLink({ to, onNavigate, children, ...rest }: { to: string; onNavigate?: () => void; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>) {
  return <a href={'/' + to} {...rest} onClick={(e) => { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); onNavigate?.(); go(to) }}>{children}</a>
}
export function useRoute() {
  const [r, setR] = useState(current)
  useEffect(() => {
    const f = () => setR(current())
    window.addEventListener('popstate', f); window.addEventListener(ROUTE_EVENT, f)
    return () => { window.removeEventListener('popstate', f); window.removeEventListener(ROUTE_EVENT, f) }
  }, [])
  return r
}
/** One query-string value of the current URL (e.g. `id` in /post?id=post-s1); '' when absent or when there is no window. Treat it as untrusted input. */
export function useSearchParam(name: string): string {
  const read = () => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get(name) ?? '')
  const [v, setV] = useState(read)
  useEffect(() => {
    const f = () => setV(read())
    window.addEventListener('popstate', f); window.addEventListener(ROUTE_EVENT, f)
    return () => { window.removeEventListener('popstate', f); window.removeEventListener(ROUTE_EVENT, f) }
  }, [name])
  return v
}
