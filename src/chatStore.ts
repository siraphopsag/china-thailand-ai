// Chats and interview times per match on this device (v2 model, owner Nov 2026). Prototype only: localStorage 'call.chat.v1';
// both sides can be tried on one device with the side switch. In the real service messages would be stored by C.A.L.L.
import { useCallback, useEffect, useState } from 'react'
import type { Chat } from './domain/match/chat'

export interface ChatRecord extends Chat { postId: string }
const KEY = 'call.chat.v1', EVT = 'call-chat'
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
function readAll(): Record<string, ChatRecord> {
  try { const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return isObj(v) ? (v as Record<string, ChatRecord>) : {} } catch { return {} }
}
export function loadChat(accId: string, postId: string): ChatRecord {
  const v = readAll()[accId]
  return isObj(v) && Array.isArray(v.msgs) ? { postId, msgs: v.msgs as ChatRecord['msgs'], ...(isObj(v.interview) ? { interview: v.interview as unknown as ChatRecord['interview'] } : {}) } : { postId, msgs: [] }
}
export function saveChat(accId: string, c: ChatRecord) {
  try { const all = readAll(); all[accId] = c; localStorage.setItem(KEY, JSON.stringify(all)); window.dispatchEvent(new Event(EVT)) } catch { /* storage blocked */ }
}
export function clearChat(accId: string) {
  try { const all = readAll(); delete all[accId]; localStorage.setItem(KEY, JSON.stringify(all)); window.dispatchEvent(new Event(EVT)) } catch { /* ignore */ }
}
/** booked interviews (for the calendar) */
export function bookedInterviews(): { accId: string; postId: string; at: string; mode: 'video' | 'onsite' }[] {
  return Object.entries(readAll()).flatMap(([accId, c]) => (isObj(c) && isObj(c.interview) && typeof c.interview.chosen === 'string'
    ? [{ accId, postId: String(c.postId ?? ''), at: c.interview.chosen, mode: c.interview.mode === 'onsite' ? 'onsite' as const : 'video' as const }] : []))
}
export function useChat(accId: string, postId: string): [ChatRecord, (c: ChatRecord) => void] {
  const [c, setC] = useState(() => loadChat(accId, postId))
  useEffect(() => { setC(loadChat(accId, postId)); const on = () => setC(loadChat(accId, postId)); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on) }, [accId, postId])
  const save = useCallback((n: ChatRecord) => { setC(n); saveChat(accId, n) }, [accId])
  return [c, save]
}
