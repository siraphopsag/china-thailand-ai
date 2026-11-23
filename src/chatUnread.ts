// How many messages from the other side I have not opened yet, over all my conversations (the menu badge). Signed in only: the
// local demo plays both sides on one device, so nothing there is "unread".
import { useAuth } from './auth'
import { useMatch } from './matchData'
import { unreadOf, useChatSummaries, useReadMarks } from './shared'

export function useChatUnread(): number {
  const { mode } = useMatch()
  const { user } = useAuth()
  const on = mode === 'remote' && !!user
  const { list } = useChatSummaries(on)
  const marks = useReadMarks()
  return on && user ? list.reduce((n, s) => n + unreadOf(s, user.id, marks), 0) : 0
}
