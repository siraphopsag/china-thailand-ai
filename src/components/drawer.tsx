import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { Icon } from './icons'

/**
 * A details panel (owner, Oct 2026): slides in from the right on wide screens and up from the bottom on phones. A native modal
 * <dialog>, so focus stays inside, Esc closes it and the page behind is inert; focus returns to the opener when it closes.
 */
export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: (titleId: string) => ReactNode }) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
    const cancel = (e: Event) => { e.preventDefault(); onClose() }
    d.addEventListener('cancel', cancel); return () => d.removeEventListener('cancel', cancel)
  }, [open, onClose])
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={() => open && onClose()} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="drawer-panel text-ink p-0 backdrop:bg-black/45 backdrop:backdrop-blur-[2px]">
      {open && (
        <div className="relative p-5 sm:p-6 space-y-4">
          {/* phones: a grab bar — the panel is a sheet coming up from the bottom */}
          <span aria-hidden className="sm:hidden block mx-auto -mt-2 mb-1 w-10 h-1.5 rounded-full bg-surface3" />
          <button type="button" onClick={onClose} aria-label={t('m.bd.close')} className="absolute right-3 top-3 w-10 h-10 grid place-items-center rounded-full border border-line hover:bg-surface3"><Icon name="close" size={18} /></button>
          {children(titleId)}
        </div>)}
    </dialog>
  )
}
