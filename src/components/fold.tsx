import { useId, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { Icon, type IconName } from './icons'

/**
 * A folding group of a long form (owner, 28 Nov 2026: "the form is plain and has so many boxes to tick that nobody knows what to
 * pick — split it into groups that open when tapped"). Closed, the bar says what was chosen so far; a group with a required field
 * says so; a group holding a field with an error opens by itself (`force`), so the error and its field can be seen and focused.
 * The contents stay mounted while closed (hidden), so nothing typed is lost.
 */
export function Fold({ icon, title, summary, req, open: start = false, force, children, tone }: {
  icon: IconName; title: string; summary?: string; req?: boolean; open?: boolean; force?: boolean; children: ReactNode; tone?: 'final'
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(start)
  const shown = open || !!force
  const id = useId()
  return (
    <section className={`fold ${tone === 'final' ? 'fold-final' : ''} ${shown ? 'fold-open' : ''}`}>
      <h3 className="m-0">
        <button type="button" className="fold-bar" aria-expanded={shown} aria-controls={id} onClick={() => setOpen(!shown)}>
          <span className="fold-ic" aria-hidden><Icon name={icon} size={18} /></span>
          <span className="min-w-0 flex-1 text-left">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-semibold">{title}{req && <span className="fold-req">{t('m.req')}</span>}</span>
            {summary && <span className="block text-xs text-muted font-normal truncate">{summary}</span>}
          </span>
          <Icon name="down" size={18} className="fold-chev shrink-0" />
        </button>
      </h3>
      <div id={id} hidden={!shown} className="fold-body">{children}</div>
    </section>
  )
}
