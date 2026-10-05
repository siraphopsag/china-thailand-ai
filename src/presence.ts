import { useEffect, useRef, useState } from 'react'
import { getClient } from './auth'

/**
 * Who else has this post open right now, and whether they are filling in the application form (owner, Oct 2026: it nudges job
 * seekers to decide sooner). Supabase Realtime presence: each open page joins the channel "post:<id>" with a random key and
 * only { filling } — no name, no account id. Only real numbers are shown; nothing is invented, and in the local demo there is none.
 */
export interface Presence { viewing: number; filling: number }
export function usePresence(postId: string | null, enabled: boolean, filling: boolean): Presence | null {
  const [state, setState] = useState<Presence | null>(null)
  const chan = useRef<{ track: (p: { filling: boolean }) => Promise<unknown> } | null>(null)
  const fillingRef = useRef(filling); fillingRef.current = filling
  useEffect(() => {
    if (!enabled || !postId) { setState(null); return }
    let alive = true, cleanup: (() => void) | null = null
    const me = Math.random().toString(36).slice(2, 12)
    void getClient().then((sb) => {
      if (!alive) return
      const ch = sb.channel(`post:${postId}`, { config: { presence: { key: me } } })
      ch.on('presence', { event: 'sync' }, () => {
        const all = ch.presenceState() as Record<string, { filling?: boolean }[]>
        const others = Object.entries(all).filter(([k]) => k !== me)
        setState({ viewing: others.length, filling: others.filter(([, metas]) => metas.some((m) => m.filling)).length })
      })
      ch.subscribe((status) => { if (status === 'SUBSCRIBED') void ch.track({ filling: fillingRef.current }) })
      chan.current = ch
      cleanup = () => { chan.current = null; void sb.removeChannel(ch) }
    }, () => undefined)
    return () => { alive = false; cleanup?.(); setState(null) }
  }, [postId, enabled])
  // tell the others when this visitor starts or stops filling in the form
  useEffect(() => { void chan.current?.track({ filling }) }, [filling])
  return state
}
