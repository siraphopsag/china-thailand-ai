import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { Modal } from './modal'

/**
 * "Are you sure?" inside the page (owner, Oct 2026). The browser's own confirm() box is blocked in some in-app browsers (e.g. a
 * link opened from LINE or Facebook): the delete and renew buttons then seemed to do nothing. This uses the site's own window
 * (focus kept inside, Esc = cancel) and resolves to true / false.
 */
export function useConfirm(): [(text: string, opts?: { yes?: string; danger?: boolean }) => Promise<boolean>, ReactNode] {
  const { t } = useI18n()
  const [ask, setAsk] = useState<{ text: string; yes?: string; danger?: boolean } | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const confirm = useCallback((text: string, opts?: { yes?: string; danger?: boolean }) => new Promise<boolean>((resolve) => {
    resolver.current?.(false) // a question still open counts as cancelled
    resolver.current = resolve
    setAsk({ text, ...opts })
  }), [])
  const answer = useCallback((v: boolean) => { resolver.current?.(v); resolver.current = null; setAsk(null) }, [])
  const dialog = (
    <Modal open={!!ask} onClose={() => answer(false)}>{(id) => ask && (<>
      <h2 id={id} className="h2 text-lg leading-snug">{ask.text}</h2>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => answer(false)}>{t('m.ask.no')}</button>
        <button type="button" className={ask.danger ? 'btn-primary btn-danger' : 'btn-primary'} onClick={() => answer(true)}>{ask.yes ?? t('m.ask.yes')}</button>
      </div></>)}</Modal>
  )
  return [confirm, dialog]
}
