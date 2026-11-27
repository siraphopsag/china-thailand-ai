// Chat and interview booking (v2 model, owner Nov 2026: "easier interviews and chat"). A chat opens once both sides are interested
// (the worker accepted the offer). Ready-made phrases are sent in Thai and Chinese at once; typed text keeps the platform safe:
// phone numbers, e-mail, links and LINE / WeChat ids are hidden, so nobody is pulled into a private chat where scams happen. The
// employer offers up to three interview times; the worker picks one and it goes into both calendars. Pure: no React, no storage.
import { maskAfter, maskContact } from '../contact'

export type Side = 'employer' | 'seeker'
export interface ChatMsg { id: string; from: Side; at: string; text: string; /** a ready-made phrase (locale ch.p.*) instead of text */ phrase?: string; masked?: boolean }
export interface Interview { slots: string[]; mode: 'video' | 'onsite'; offeredAt: string; chosen?: string; chosenAt?: string }
export interface Chat { msgs: ChatMsg[]; interview?: Interview }

/** phrases each side can send in one tap (shown in both languages) */
export const PHRASES: Record<Side, readonly string[]> = {
  employer: ['hello', 'askStart', 'askExp', 'sendDocs', 'interviewInvite', 'thanks'],
  seeker: ['hello', 'canStart', 'askHousing', 'askHours', 'askContract', 'thanks'],
}
export const MAX_TEXT = 500
/**
 * Owner's blueprint (27 Nov 2026): typing contact details is a violation. The 1st and 2nd are hidden with a warning; the 3rd ends
 * the match and locks the chat for both sides (messages are kept as a record, never deleted). Counted per side from the stored
 * messages, so the website and the database (SQL 0017) agree.
 */
export const MAX_STRIKES = 3
export const strikesOf = (chat: Chat, side: Side) => chat.msgs.filter((m) => m.from === side && m.masked).length
/** the side whose violations ended the match, or null while the chat is open */
export const closedBy = (chat: Chat): Side | null => (['seeker', 'employer'] as const).find((s) => strikesOf(chat, s) >= MAX_STRIKES) ?? null
export const MAX_SLOTS = 3

/** contact details are hidden: e-mail, links, phone numbers, and LINE / WeChat / Telegram / WhatsApp ids, in any spelling (contact.ts) */
export { maskContact }
/** a number or address sent in pieces: the sender's own typed messages just before, since the other side last wrote, within 30 minutes */
export function earlierPieces(chat: Chat, from: Side, at: string, max = 3): string[] {
  const out: string[] = []
  for (let i = chat.msgs.length - 1; i >= 0 && out.length < max; i--) {
    const m = chat.msgs[i]
    if (m.from !== from || m.phrase || Date.parse(at) - Date.parse(m.at) > 30 * 60_000) break
    out.unshift(m.text)
  }
  return out
}
export type ChatProblem = 'empty' | 'long' | 'phrase' | 'closed'
export function newMessage(chat: Chat, from: Side, input: { text?: string; phrase?: string }, id: string, at: string): { ok: true; value: Chat; masked: boolean } | { ok: false; problem: ChatProblem } {
  if (closedBy(chat)) return { ok: false, problem: 'closed' }
  if (input.phrase) {
    if (!PHRASES[from].includes(input.phrase)) return { ok: false, problem: 'phrase' }
    return { ok: true, value: { ...chat, msgs: [...chat.msgs, { id, from, at, text: '', phrase: input.phrase }] }, masked: false }
  }
  const raw = (input.text ?? '').trim()
  if (!raw) return { ok: false, problem: 'empty' }
  if (raw.length > MAX_TEXT) return { ok: false, problem: 'long' }
  const m = maskAfter(earlierPieces(chat, from, at), raw)
  return { ok: true, value: { ...chat, msgs: [...chat.msgs, { id, from, at, text: m.text, ...(m.masked ? { masked: true } : {}) }] }, masked: m.masked }
}

/** times are "YYYY-MM-DDTHH:mm" in the viewer's own time; offers are 1–3 different times, all later than now */
export type SlotProblem = 'none' | 'many' | 'past' | 'same'
export function offerSlots(chat: Chat, slots: string[], mode: Interview['mode'], now: string, nowLocal: string): { ok: true; value: Chat } | { ok: false; problem: SlotProblem } {
  const xs = slots.filter(Boolean)
  if (closedBy(chat)) return { ok: false, problem: 'none' }
  if (!xs.length) return { ok: false, problem: 'none' }
  if (xs.length > MAX_SLOTS) return { ok: false, problem: 'many' }
  if (new Set(xs).size !== xs.length) return { ok: false, problem: 'same' }
  if (xs.some((s) => !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || s <= nowLocal)) return { ok: false, problem: 'past' }
  return { ok: true, value: { ...chat, interview: { slots: [...xs].sort(), mode, offeredAt: now } } }
}
export function pickSlot(chat: Chat, slot: string, now: string): Chat | null {
  const iv = chat.interview
  if (closedBy(chat)) return null
  if (!iv || iv.chosen || !iv.slots.includes(slot)) return null
  return { ...chat, interview: { ...iv, chosen: slot, chosenAt: now } }
}
