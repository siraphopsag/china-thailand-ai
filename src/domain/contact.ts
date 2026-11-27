// Contact details typed into free text (owner, 24 Nov 2026: "the phone number is caught, but an e-mail typed as
// 'name @ gmail.com' slips through"). Nobody should be pulled into a private chat where scams happen, so e-mail, links, phone
// numbers and chat-app ids are hidden in the chat and refused in posts, introductions and notes. The usual ways round a simple
// check are covered too: spaces round "@" and ".", "at" / "dot" written as words (Thai and Chinese too), Thai and full-width
// digits, numbers spelt out in words, and a number sent in pieces over several messages.
//
// Every rule is written once here and copied word for word into the database (supabase/migrations/0015_contact_rules.sql) — a
// test checks the two match — so it only uses regular-expression syntax JavaScript and PostgreSQL share: no \b or \w (they mean
// other things in PostgreSQL), letters in lower case (both sides match case-insensitively). Pure: no React, no storage.

// Review, 27 Nov 2026 (now that the 3rd hidden message ends a match): phone numbers are recognised by their shape — a Thai number
// starts with 0 (or +66), a Chinese mobile with 13–19 (or +86) — so salary ranges, dates and times are left alone; digits written
// another way (Thai or full-width digits, words) are caught as before; commas and brackets no longer split a number.
const OBF = '(?:[๐-๙０-９]|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|[零〇一二三四五六七八九幺]|(?<![a-z])(?:zero|one|two|three|four|five|six|seven|eight|nine)(?![a-z]))'
const ANY = `(?:[0-9]|${OBF})`
const SEP = '[\\s.()_–—,-]*'
const PSEP = '[\\s,()-]*'
const AT = '(?:[@＠]|\\(at\\)|\\[at\\]|(?<![a-z])at(?![a-z])|แอท|แอ็ท|艾特)'
const DOT = '(?:[.．]|\\s*(?:\\(dot\\)|\\[dot\\]|(?<![a-z])dot(?![a-z])|ดอท|ด็อท|จุด|点|點)\\s*)'
const PROV_A = '(?:gmail|googlemail|hotmail|outlook|yahoo|icloud|qq|foxmail|sina|sohu|proton(?:mail)?|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)'
const PROV = '(?:gmail|googlemail|hotmail|outlook|yahoo|icloud|qq|foxmail|163|126|sina|sohu|proton(?:mail)?|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)'
const LABEL = '(?:[a-z0-9-]+|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)'
const TLD = '(?:com|net|org|co|th|cn|io|me|info|biz|edu|ac|go|hk|tw|sg|jp|kr|us|uk|คอม|康)(?![a-z])'
/** chat and social apps written in Latin letters: an id only after a separator, the word "id", or when it looks like an id (has a digit, _ or .) */
const APP_LAT = '(?:we\\s*chat|weixin|telegram|whats\\s*app|instagram|facebook|kakao(?:talk)?|zalo|viber|tiktok|douyin|weibo|skype|discord|ไอจี|เฟส(?:บุ๊[คก])?|เฟซ(?:บุ๊[คก])?|ติ๊กต็อก|抖音|微博|脸书)'
/** messaging apps written in Thai or Chinese: whatever Latin word follows is taken as the id */
const APP_MSG = '(?:ไอดีไลน์|ไลน์|วีแชท|วีแชต|เทเลแกรม|วอทส์แอป|微信|威信|薇信|加微|v信|扣扣|企鹅号|电报)'
const SHORT = '(?<![a-z])(?:line|vx|wx|tg|ig|fb|wa|qq)' // short or everyday words: only with "id", ":", "@" … after them
const ID = '@?[a-z0-9._-]{3,}'
const SEPW = '(?:[:：=]|คือ|是|号|號)'

/** the rules, in the order the database applies them (each one is a PostgreSQL and JavaScript regular expression) */
export const CONTACT_RULES: readonly string[] = [
  '[^\\s@]+@[^\\s@]+\\.[^\\s@]+', // e-mail as usually written
  `[a-z0-9._%+-]+\\s*[@＠]\\s*[a-z0-9-]+(?:\\s*[.．。]\\s*[a-z0-9-]+)+`, // e-mail with spaces: name @ gmail . com
  `[a-z0-9._%+-]+\\s*${AT}\\s*${LABEL}(?:${DOT}${LABEL})*${DOT}${TLD}`, // name at gmail dot com, ชื่อ แอท จีเมล ดอท คอม
  `[a-z0-9._%+-]{2,}\\s*${AT}\\s*${PROV_A}(?![a-z0-9])`, // name at gmail (not "at 163 Moo 5")
  `(?<![a-z0-9])${PROV}(?:${DOT}|\\s+)${TLD}`, // gmail.com on its own (the rest of the address sent in another message)
  '(https?://|www\\.)\\S+', // links
  '(?<![a-z0-9@.])(?:[a-z0-9-]+\\.)+(?:com|th|cn|ly|ee|me|gl|link|page|to)(?![a-z0-9-])(?:/\\S*)?', // bit.ly/…, line.me/…, t.me/… (not ASP.NET, Socket.io)
  `(?:[0-9]${SEP}){0,4}${OBF}(?:${SEP}${ANY}){6,}`, // 8+ digits written another way: ๐๘๑…, ０８１…, ศูนย์แปดหนึ่ง…, 零八一…
  `(?<![0-9])\\(?(?:\\+?66${PSEP}[1-9]|0[0-9])(?:${PSEP}[0-9]){7,8}(?![0-9])`, // Thai phone: 0X…, +66 …
  `(?<![0-9])\\(?(?:\\+?86${PSEP})?1[3-9][0-9](?:${PSEP}[0-9]){8}(?![0-9])`, // Chinese mobile: 13x–19x, +86 …
  '(?<![0-9.])(?:0[0-9]{1,2}\\.[0-9]{3,4}|1[3-9][0-9]\\.[0-9]{4})\\.[0-9]{3,4}(?![0-9])', // dotted: 081.234.5678, 138.1234.5678 (not times like 08.00)
  `(?<![a-z])${APP_LAT}\\s*(?:(?:id|ไอดี)\\s*)?(?:${SEPW}\\s*){1,2}${ID}`, // WeChat: abc, IG คือ name, 微博号：abc
  `(?<![a-z])${APP_LAT}\\s*(?:id|ไอดี)\\s+${ID}`, // WeChat id abc
  `(?<![a-z])${APP_LAT}\\s+@?(?=[a-z._-]*[0-9_.])[a-z0-9._-]{3,}`, // wechat sira99 (not "Facebook page")
  `${APP_MSG}\\s*(?:id|ไอดี)?\\s*(?:${SEPW}\\s*){0,2}${ID}`, // ไลน์ siraooja, ไลน์คือ shop99, 微信号：abc
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
