import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon, type IconName } from './icons'

/**
 * Select-only combobox (WAI-ARIA APG pattern) whose list always opens BELOW the field, with optional groups and a limited
 * visible height (the rest scrolls). Built because the browser's own <select> list is placed by the operating system
 * (on Windows it opens over the field) and cannot show a greyed "coming soon" group.
 *
 * Keyboard: Enter / Space / ↓ / ↑ open; ↑ ↓ Home End PageUp PageDown move; typing jumps to a matching name;
 * Enter / Space pick; Esc closes; Tab leaves. Focus stays on the field; the highlighted option is announced via
 * aria-activedescendant.
 */
/**
 * A group of options. `muted` marks a planned group (owner, Oct 2026: "coming soon" must be clearly not open yet): a thin rule
 * above it, a darker band, grey names, a small icon after each name (`itemIcon`), a header icon and note, and `badge` shown
 * inside the field when one of its options is chosen. `dot` puts a status dot before an open group's header.
 */
export interface ListGroup { label?: string; muted?: boolean; dot?: boolean; icon?: IconName; note?: string; badge?: string; itemIcon?: IconName; options: { value: string; label: string }[] }
const ROW = 40, HEAD = 28, NOTE = 16
/** the nearest box that scrolls (the page itself on phones) */
const scrollerOf = (el: HTMLElement): HTMLElement => {
  for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}

export function ListSelect({ id, labelId, value, onChange, groups, placeholder, disabled, maxRows, invalid, describedBy, required }: {
  id: string; labelId: string; value: string | null; onChange: (v: string) => void; groups: ListGroup[]; placeholder: string
  disabled?: boolean; maxRows: number; invalid?: boolean; describedBy?: string; required?: boolean
}) {
  const uid = useId()
  const listId = `${uid}-list`
  const flat = useMemo(() => groups.flatMap((g, gi) => g.options.map((o) => ({ ...o, gi, muted: !!g.muted }))), [groups])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [fitH, setFitH] = useState<number | null>(null) // a shorter list when the screen has no room for the full one
  const box = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const selectedIndex = flat.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? flat[selectedIndex] : null
  const optId = (i: number) => `${uid}-o${i}`

  // close on a press outside the field and its list
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away); return () => document.removeEventListener('pointerdown', away)
  }, [open])
  // keep the highlighted option in view
  useEffect(() => {
    if (!open || active < 0) return
    list.current?.querySelector<HTMLElement>(`#${CSS.escape(optId(active))}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active]) // eslint-disable-line react-hooks/exhaustive-deps -- optId is derived from a stable id

  const show = (at = selectedIndex >= 0 ? selectedIndex : 0) => { setActive(at); setOpen(true) }
  const pick = (i: number) => { const o = flat[i]; if (o) onChange(o.value); setOpen(false) }
  const move = (to: number) => setActive(Math.max(0, Math.min(flat.length - 1, to)))
  const onKey = (e: KeyboardEvent) => {
    if (disabled) return
    const k = e.key
    if (!open) {
      if (k === 'Enter' || k === ' ' || k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); show() }
      else if (k.length === 1) { e.preventDefault(); show(); typeAhead(k) }
      return
    }
    if (k === 'ArrowDown') { e.preventDefault(); move(active + 1) }
    else if (k === 'ArrowUp') { e.preventDefault(); move(active - 1) }
    else if (k === 'Home') { e.preventDefault(); move(0) }
    else if (k === 'End') { e.preventDefault(); move(flat.length - 1) }
    else if (k === 'PageDown') { e.preventDefault(); move(active + maxRows) }
    else if (k === 'PageUp') { e.preventDefault(); move(active - maxRows) }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); pick(active) }
    else if (k === 'Escape') { e.preventDefault(); setOpen(false) }
    else if (k === 'Tab') setOpen(false)
    else if (k.length === 1) { e.preventDefault(); typeAhead(k) }
  }
  const typeAhead = (ch: string) => {
    const now = Date.now(), t = typed.current
    t.text = now - t.at > 700 ? ch : t.text + ch; t.at = now
    const q = t.text.toLocaleLowerCase()
    const hit = flat.findIndex((o) => o.label.toLocaleLowerCase().startsWith(q))
    if (hit >= 0) setActive(hit)
  }
  const heads = groups.filter((g) => g.label).length, notes = groups.filter((g) => g.note).length
  const maxHeight = maxRows * ROW + heads * HEAD + notes * NOTE + 12
  // QA, Oct 2026: on a phone the list ran past the bottom of the screen and under the menu bar (one option visible).
  // When it opens, the page scrolls up just enough for the list to fit above the bar (never moving the field under the
  // header); if the screen is still too short, the list gets shorter and scrolls inside (at least 3 rows).
  useLayoutEffect(() => {
    if (!open) { setFitH(null); return }
    const field = box.current, ul = list.current
    if (!field || !ul) return
    const viewH = window.visualViewport?.height ?? window.innerHeight
    const bar = document.querySelector('nav.mn-h')?.getBoundingClientRect() // the phone menu bar (not shown on larger screens)
    const bottom = (bar && bar.height > 0 ? Math.min(viewH, bar.top) : viewH) - 8
    const top = (document.querySelector('header')?.getBoundingClientRect().bottom ?? 0) + 8
    const want = Math.min(maxHeight, ul.scrollHeight)
    let r = field.getBoundingClientRect()
    const over = r.bottom + 6 + want - bottom
    if (over > 0) {
      // how far the page can scroll without the open list (the list makes it taller only until it is shortened below)
      const sc = scrollerOf(field)
      ul.style.display = 'none'; const canScroll = Math.max(0, sc.scrollHeight - sc.clientHeight - sc.scrollTop); ul.style.display = ''
      const by = Math.min(over, Math.max(0, r.top - top), canScroll)
      if (by > 0) { sc.scrollBy({ top: by, behavior: 'instant' as ScrollBehavior }); r = field.getBoundingClientRect() }
      const room = bottom - r.bottom - 6
      setFitH(room < want ? Math.max(ROW * 3, Math.floor(room)) : null)
    } else setFitH(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- measured once each time it opens
  const badge = selected ? groups[selected.gi]?.badge : undefined

  return (
    <div ref={box} className="relative">
      <button id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={labelId}
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined} aria-required={required || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        disabled={disabled} onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}
        className="input flex items-center justify-between gap-2 text-left disabled:opacity-60 disabled:cursor-not-allowed">
        <span className={`truncate ${selected ? '' : 'text-muted'}`}>{selected ? selected.label : placeholder}</span>
        <span className="flex items-center gap-2 shrink-0">
          {badge && <span className="chip bg-info-bg text-info-fg border-info-line"><Icon name="clock" size={12} />{badge}</span>}
          <Icon name={open ? 'up' : 'down'} size={18} className="text-muted" />
        </span>
      </button>
      <ul ref={list} id={listId} role="listbox" aria-labelledby={labelId} hidden={!open} style={{ maxHeight: fitH ?? maxHeight }}
        className="list-pop absolute z-30 left-0 right-0 top-full mt-1.5 overflow-y-auto overscroll-contain rounded-xl border border-line p-1">
        {groups.map((g, gi) => {
          const headId = `${uid}-g${gi}`
          const items = flat.map((o, i) => ({ o, i })).filter((x) => x.o.gi === gi)
          const rows = items.map(({ o, i }) => (
            <li key={o.value} id={optId(i)} role="option" aria-selected={o.value === value}
              onPointerDown={(e) => e.preventDefault()} onClick={() => pick(i)} onPointerMove={() => active !== i && setActive(i)}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 cursor-pointer text-sm ${o.muted ? 'text-muted' : 'text-ink'} ${i === active ? 'bg-surface3 ring-2 ring-inset ring-primary' : ''} ${o.value === value ? 'font-semibold' : ''}`}
              style={{ minHeight: ROW }}>
              <span className="truncate">{o.label}</span>
              {o.value === value ? <Icon name="check" size={16} className="shrink-0 text-primary" /> : g.itemIcon && <Icon name={g.itemIcon} size={14} className="shrink-0 text-muted" />}
            </li>))
          return g.label ? (
            <li key={gi} role="presentation" className={g.muted ? 'list-group-muted' : undefined}>
              <div id={headId} className={`px-3 pt-1.5 text-xs font-semibold ${g.muted ? 'text-muted' : 'text-ink'}`} style={{ minHeight: HEAD }}>
                <span className="flex items-center gap-1.5">{g.dot && <span className="w-2 h-2 rounded-full bg-ok-fg" aria-hidden />}{g.icon && <Icon name={g.icon} size={13} />}{g.label}</span>
                {g.note && <span className="block font-normal" style={{ lineHeight: `${NOTE}px` }}>{g.note}</span>}
              </div>
              <ul role="group" aria-labelledby={headId}>{rows}</ul>
            </li>
          ) : rows
        })}
      </ul>
    </div>
  )
}
