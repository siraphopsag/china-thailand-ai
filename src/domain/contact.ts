// Contact details typed into free text (owner, 24 Nov 2026: "the phone number is caught, but an e-mail typed as
// 'name @ gmail.com' slips through"). Nobody should be pulled into a private chat where scams happen, so e-mail, links, phone
// numbers and chat-app ids are hidden in the chat and refused in posts, introductions and notes. The usual ways round a simple
// check are covered too: spaces round "@" and ".", "at" / "dot" written as words (Thai and Chinese too), Thai and full-width
// digits, numbers spelt out in words, and a number sent in pieces over several messages.
//
// Every rule is written once here and copied word for word into the database (supabase/migrations/0015_contact_rules.sql) — a
// test checks the two match — so it only uses regular-expression syntax JavaScript and PostgreSQL share: no \b or \w (they mean
// other things in PostgreSQL), letters in lower case (both sides match case-insensitively). Pure: no React, no storage.

const D = '[0-9๐-๙０-９]' // Arabic, Thai and full-width digits
const NUM = `(?:${D}|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|[零〇一二三四五六七八九幺]|(?<![a-z])(?:zero|one|two|three|four|five|six|seven|eight|nine)(?![a-z]))`
const SEP = '[\\s.()_–—-]*'
const AT = '(?:[@＠]|\\(at\\)|\\[at\\]|(?<![a-z])at(?![a-z])|แอท|แอ็ท|艾特)'
const DOT = '(?:[.．]|\\s*(?:\\(dot\\)|\\[dot\\]|(?<![a-z])dot(?![a-z])|ดอท|ด็อท|จุด|点|點)\\s*)'
const PROV = '(?:gmail|googlemail|hotmail|outlook|yahoo|icloud|qq|foxmail|163|126|sina|sohu|proton(?:mail)?|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)'
const LABEL = '(?:[a-z0-9-]+|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)'
const TLD = '(?:com|net|org|co|th|cn|io|me|info|biz|edu|ac|go|hk|tw|sg|jp|kr|us|uk|คอม|康)(?![a-z])'
const APP = '(?:we\\s*chat|weixin|telegram|whats\\s*app|instagram|facebook|kakao(?:talk)?|zalo|viber|tiktok|douyin|weibo|skype|discord|ไอดีไลน์|ไลน์|ไอจี|เฟส(?:บุ๊[คก])?|เฟซ(?:บุ๊[คก])?|วีแชท|วีแชต|เทเลแกรม|วอทส์แอป|ติ๊กต็อก|微信|威信|薇信|加微|v信|扣扣|企鹅号|电报|抖音|微博|脸书)'
const SHORT = '(?<![a-z])(?:line|vx|wx|tg|ig|fb|wa|qq)' // short or everyday words: only with "id", ":", "@" … after them
const ID = '@?[a-z0-9._-]{3,}'

/** the rules, in the order the database applies them (each one is a PostgreSQL and JavaScript regular expression) */
export const CONTACT_RULES: readonly string[] = [
  '[^\\s@]+@[^\\s@]+\\.[^\\s@]+', // e-mail as usually written
  `[a-z0-9._%+-]+\\s*[@＠]\\s*[a-z0-9-]+(?:\\s*[.．。]\\s*[a-z0-9-]+)+`, // e-mail with spaces: name @ gmail . com
  `[a-z0-9._%+-]+\\s*${AT}\\s*${LABEL}(?:${DOT}${LABEL})*${DOT}${TLD}`, // name at gmail dot com, ชื่อ แอท จีเมล ดอท คอม
  `[a-z0-9._%+-]{2,}\\s*${AT}\\s*${PROV}(?![a-z])`, // name at gmail
  `(?<![a-z0-9])${PROV}(?:${DOT}|\\s+)${TLD}`, // gmail.com on its own (the rest of the address sent in another message)
  '(https?://|www\\.)\\S+', // links
  '(?<![a-z0-9@.])[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.(?:com|net|org|me|ly|ee|io|co|th|cn|link|app|page|xyz|info|gl|to)(?![a-z0-9-])(?:/\\S*)?', // bit.ly/…, line.me/…, t.me/…
  `\\+?\\(?${NUM}(?:${SEP}${NUM}){8,}`, // 9+ digits, also Thai or full-width digits, in words (ศูนย์แปดหนึ่ง…, 零八一…), with dots and brackets
  '\\+?\\d[\\d\\s-]{6,}\\d', // shorter phone or id numbers (after the rule above, so the database hides "(081) 234 5678" whole)
  `(?<![a-z])${APP}\\s*(?:id|ไอดี)?\\s*(?:(?:[:：=]|คือ|是|号|號)\\s*){0,2}${ID}`, // WeChat abc123, ไลน์คือ shop99, 微信号：abc
  `${SHORT}\\s*(?:(?:id|ไอดี)\\s*[:：=]?|@|คือ|是|号|號)\\s*${ID}`, // line id shop99, line@shop, qq号 …
  '(?<![a-z])(?:vx|wx|tg|ig|fb|wa)\\s*[:：=]\\s*@?[a-z0-9._-]{3,}', // ig: name, wx: name
  '(?<![a-z])line\\s*[:：=]\\s*@?(?=[a-z._-]*[0-9._])[a-z0-9._-]{3,}', // line: shop_99 (not "production line: operators")
  '(?<![a-z])qq\\s*[:：号]?\\s*[0-9]{5,}', // qq 12345678
  '(?<![^\\s])@[a-z0-9._]{4,}', // @handle
]
const RES = CONTACT_RULES.map((r) => new RegExp(r, 'gi'))
/** zero-width characters someone might slip between digits */
const INVISIBLE = /[​-‍⁠﻿]/g
export const stripInvisible = (s: string) => s.replace(INVISIBLE, '')

/** where contact details are in the text: [start, end) pairs, merged and in order */
export function contactRanges(text: string): Array<[number, number]> {
  const rs: Array<[number, number]> = []
  for (const re of RES) { re.lastIndex = 0; for (let m = re.exec(text); m; m = re.exec(text)) { if (!m[0]) { re.lastIndex++; continue } rs.push([m.index, m.index + m[0].length]) } }
  rs.sort((a, b) => a[0] - b[0])
  const out: Array<[number, number]> = []
  for (const r of rs) { const last = out[out.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else out.push([...r]) }
  return out
}
const hide = (text: string, rs: Array<[number, number]>) => { let out = '', at = 0; for (const [s, e] of rs) { out += text.slice(at, s) + '[•••]'; at = e } return out + text.slice(at) }

export const hasContact = (text: string) => contactRanges(stripInvisible(text)).length > 0
export function maskContact(text: string): { text: string; masked: boolean } {
  const s = stripInvisible(text), rs = contactRanges(s)
  return { text: rs.length ? hide(s, rs) : s, masked: rs.length > 0 }
}
/**
 * The same, but a number or address sent in pieces is caught too: `earlier` are the sender's own messages just before this one
 * (oldest first). The part of this message that completes contact details begun earlier is hidden.
 */
export function maskAfter(earlier: readonly string[], text: string): { text: string; masked: boolean } {
  const s = stripInvisible(text), own = contactRanges(s)
  const before = earlier.map(stripInvisible).join(' ')
  const across: Array<[number, number]> = []
  if (before) {
    const off = before.length + 1
    for (const [a, b] of contactRanges(`${before} ${s}`)) if (a < off && b > off) across.push([0, b - off])
  }
  const rs = [...across, ...own].sort((x, y) => x[0] - y[0]).reduce<Array<[number, number]>>((o, r) => { const l = o[o.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else o.push([...r]); return o }, [])
  return { text: rs.length ? hide(s, rs) : s, masked: rs.length > 0 }
}
