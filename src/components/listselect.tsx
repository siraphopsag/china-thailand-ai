import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from './icons'

/**
 * Select-only combobox (WAI-ARIA APG pattern) whose list always opens BELOW the field, with optional groups and a limited
 * visible height (the rest scrolls). Built because the browser's own <select> list is placed by the operating system
 * (on Windows it opens over the field) and cannot show a greyed "coming soon" group.
 *
 * Keyboard: Enter / Space / ↓ / ↑ open; ↑ ↓ Home End PageUp PageDown move; typing jumps to a matching name;
 * Enter / Space pick; Esc closes; Tab leaves. Focus stays on the field; the highlighted option is announced via
 * aria-activedescendant.
 */
export interface ListGroup { label?: string; muted?: boolean; options: { value: string; label: string }[] }
const ROW = 40, HEAD = 28

export function ListSelect({ id, labelId, value, onChange, groups, placeholder, disabled, maxRows, invalid, describedBy, required }: {
  id: string; labelId: string; value: string | null; onChange: (v: string) => void; groups: ListGroup[]; placeholder: string
  disabled?: boolean; maxRows: number; invalid?: boolean; describedBy?: string; required?: boolean
}) {
  const uid = useId()
  const listId = `${uid}-list`
  const flat = useMemo(() => groups.flatMap((g, gi) => g.options.map((o) => ({ ...o, gi, muted: !!g.muted }))), [groups])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
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
  const heads = groups.filter((g) => g.label).length
  const maxHeight = maxRows * ROW + heads * HEAD + 8

  return (
    <div ref={box} className="relative">
      <button id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-labelledby={labelId}
        aria-activedescendant={open && active >= 0 ? optId(active) : undefined} aria-required={required || undefined} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        disabled={disabled} onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}
        className="input flex items-center justify-between gap-2 text-left disabled:opacity-60 disabled:cursor-not-allowed">
        <span className={`truncate ${selected ? '' : 'text-muted'}`}>{selected ? selected.label : placeholder}</span>
        <Icon name={open ? 'up' : 'down'} size={18} className="shrink-0 text-muted" />
      </button>
      <ul ref={list} id={listId} role="listbox" aria-labelledby={labelId} hidden={!open} style={{ maxHeight }}
        className="list-pop absolute z-30 left-0 right-0 top-full mt-1.5 overflow-y-auto overscroll-contain rounded-xl border border-line p-1">
        {groups.map((g, gi) => {
          const headId = `${uid}-g${gi}`
          const items = flat.map((o, i) => ({ o, i })).filter((x) => x.o.gi === gi)
          const rows = items.map(({ o, i }) => (
            <li key={o.value} id={optId(i)} role="option" aria-selected={o.value === value}
              onPointerDown={(e) => e.preventDefault()} onClick={() => pick(i)} onPointerMove={() => active !== i && setActive(i)}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 cursor-pointer text-sm ${o.muted ? 'text-muted' : 'text-ink'} ${i === active ? 'bg-surface3' : ''} ${o.value === value ? 'font-semibold' : ''}`}
              style={{ minHeight: ROW }}>
              <span className="truncate">{o.label}</span>{o.value === value && <Icon name="check" size={16} className="shrink-0 text-primary" />}
            </li>))
          return g.label ? (
            <li key={gi} role="presentation">
              <div id={headId} className={`px-3 flex items-center text-xs font-semibold ${g.muted ? 'text-muted' : 'text-ink'}`} style={{ height: HEAD }}>{g.label}</div>
              <ul role="group" aria-labelledby={headId}>{rows}</ul>
            </li>
          ) : rows
        })}
      </ul>
    </div>
  )
}
