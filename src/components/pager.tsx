import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { Icon } from './icons'

/**
 * Fitting a page to a computer screen (owner, Oct 2026: "on a computer people should rarely have to scroll"). From 1024 px wide
 * and 600 px tall the app pages take exactly the screen ("fit" in tailwind.config); long lists are split into pages that hold as
 * many rows as the space allows. Phones and short windows keep the normal scrolling page.
 */
export const FIT_QUERY = '(min-width: 1024px) and (min-height: 600px)'
export const useFit = () => useSyncExternalStore((cb) => { const m = window.matchMedia(FIT_QUERY); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
  () => window.matchMedia(FIT_QUERY).matches, () => false)

/** how many rows of `rowH` px (with `gap`) fit in the measured box; `min` at least */
export function useFitRows(rowH: number, gap = 0, min = 1) {
  const ref = useRef<HTMLDivElement>(null)
  const [n, setN] = useState(min)
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setN(Math.max(min, Math.floor((el.clientHeight + gap) / (rowH + gap))))
    measure()
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => ro.disconnect()
  }, [rowH, gap, min])
  return [ref, n] as const
}

/**
 * A grid that fills the measured box: as many columns of at least `minColW` px as fit (up to `maxCols`) and as many rows as the
 * real item height allows (items carry `data-fit-item`). `key` re-measures when what is shown changes.
 */
export function useFitGrid(minColW: number, gap: number, maxCols: number, key: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState({ cols: maxCols, rows: 1 })
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const cols = Math.max(1, Math.min(maxCols, Math.floor((el.clientWidth + gap) / (minColW + gap))))
      const itemH = el.querySelector<HTMLElement>('[data-fit-item]')?.offsetHeight || 300
      const rows = Math.max(1, Math.floor((el.clientHeight + gap) / (itemH + gap)))
      setDim((d) => (d.cols === cols && d.rows === rows ? d : { cols, rows }))
    }
    measure()
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure); ro.observe(el)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [minColW, gap, maxCols, key])
  return [ref, dim] as const
}

/** one page of `items` (all of them when `size` is Infinity); the page number stays inside the range when the list shrinks */
export function usePaged<T>(items: T[], size: number) {
  const [page, setPage] = useState(0)
  const per = Number.isFinite(size) && size > 0 ? size : Math.max(1, items.length)
  const pages = Math.max(1, Math.ceil(items.length / per))
  const p = Math.min(page, pages - 1)
  return { items: items.slice(p * per, p * per + per), page: p, pages, setPage }
}

/**
 * A list that fills the height it is given on a fit screen and splits into pages of as many rows as fit (rows of about `rowH` px);
 * elsewhere it is a plain list. `empty` shows when there is nothing.
 */
export function PagedList<T>({ items, rowH, gap = 8, render, keyOf, empty, className = '' }: {
  items: T[]; rowH: number; gap?: number; render: (item: T) => ReactNode; keyOf: (item: T) => string; empty?: ReactNode; className?: string
}) {
  const fit = useFit()
  const [ref, rows] = useFitRows(rowH, gap)
  const pg = usePaged(items, fit ? rows : Infinity)
  if (!items.length) return <>{empty}</>
  return (
    <div className={`fit:h-full fit:flex fit:flex-col gap-2 ${className}`}>
      <div ref={ref} className="fit:flex-1 fit:min-h-0 fit:overflow-hidden">
        <ul className="flex flex-col" style={{ gap }}>{pg.items.map((x) => <li key={keyOf(x)}>{render(x)}</li>)}</ul>
      </div>
      <Pager page={pg.page} pages={pg.pages} onPage={pg.setPage} className="shrink-0" />
    </div>
  )
}

/** previous / next with "page 2 of 5"; nothing when everything fits */
export function Pager({ page, pages, onPage, className = '' }: { page: number; pages: number; onPage: (p: number) => void; className?: string }) {
  const { t } = useI18n()
  if (pages <= 1) return null
  const btn = 'w-9 h-9 grid place-items-center rounded-full border border-control hover:bg-surface3 disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <nav className={`flex items-center justify-center gap-3 ${className}`} aria-label={t('m.pg.nav')}>
      <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page === 0} aria-label={t('m.pg.prev')}><Icon name="left" size={17} /></button>
      <span className="text-sm text-muted tabular-nums" aria-live="polite">{t('m.pg.of', { p: page + 1, n: pages })}</span>
      <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages - 1} aria-label={t('m.pg.next')}><Icon name="right" size={17} /></button>
    </nav>
  )
}
