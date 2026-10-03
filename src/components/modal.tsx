import { useEffect, useId, useRef, type ReactNode } from 'react'

/**
 * Modal window on the browser's own <dialog>: focus moves inside and stays there, Esc closes (onClose), the page behind is inert,
 * and focus returns to where it was when the window closes. Content brings its own heading (pass its id via the render prop).
 */
export function Modal({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: (titleId: string) => ReactNode; wide?: boolean }) {
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
    <dialog ref={ref} aria-labelledby={titleId} onClose={() => open && onClose()}
      className={`modal-panel !m-auto rounded-3xl border border-line text-ink p-0 w-[calc(100%-2rem)] ${wide ? 'max-w-lg' : 'max-w-md'} backdrop:bg-black/55 backdrop:backdrop-blur-sm`}>
      {open && <div className="p-6 space-y-4">{children(titleId)}</div>}
    </dialog>
  )
}
