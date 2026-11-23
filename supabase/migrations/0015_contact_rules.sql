-- C.A.L.L. — contact details in any spelling (owner, 24 Nov 2026: "the phone number is caught, but an e-mail typed as
-- 'name @ gmail.com' slips through"). Run once in Supabase → SQL Editor AFTER 0014_shared_records.sql. Safe to run again: it
-- only replaces functions.
--
--  • mask_contact(text) hides e-mail, links, phone numbers and chat-app ids with [•••], also when they are written to get round a
--    simple check: spaces round "@" and ".", "at" / "dot" as words (แอท, ดอท, 艾特, 点 …), Thai and full-width digits, numbers
--    spelt out in words (ศูนย์แปดหนึ่ง…, 零八一…), and LINE / WeChat / IG … ids. The rules are the same, word for word, as
--    src/domain/contact.ts in the website (a test checks this).
--  • Chat: a number or address sent in pieces over several messages is caught too — when this message completes contact details
--    begun in the sender's own messages just before (since the other side last wrote, within 30 minutes), it is hidden.
--  • no_contact(text), which posts, introductions and case notes already use, now uses the same rules. Rows saved before are not
--    checked again; only new or changed text is.

create or replace function public.mask_contact(t text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare b text := regexp_replace(coalesce(t, ''), '[\u200b-\u200d\u2060\ufeff]', '', 'g'); -- zero-width characters
begin
  b := regexp_replace(b, '[^\s@]+@[^\s@]+\.[^\s@]+', '[•••]', 'gi');
  b := regexp_replace(b, '[a-z0-9._%+-]+\s*[@＠]\s*[a-z0-9-]+(?:\s*[.．。]\s*[a-z0-9-]+)+', '[•••]', 'gi');
  b := regexp_replace(b, '[a-z0-9._%+-]+\s*(?:[@＠]|\(at\)|\[at\]|(?<![a-z])at(?![a-z])|แอท|แอ็ท|艾特)\s*(?:[a-z0-9-]+|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)(?:(?:[.．]|\s*(?:\(dot\)|\[dot\]|(?<![a-z])dot(?![a-z])|ดอท|ด็อท|จุด|点|點)\s*)(?:[a-z0-9-]+|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค))*(?:[.．]|\s*(?:\(dot\)|\[dot\]|(?<![a-z])dot(?![a-z])|ดอท|ด็อท|จุด|点|點)\s*)(?:com|net|org|co|th|cn|io|me|info|biz|edu|ac|go|hk|tw|sg|jp|kr|us|uk|คอม|康)(?![a-z])', '[•••]', 'gi');
  b := regexp_replace(b, '[a-z0-9._%+-]{2,}\s*(?:[@＠]|\(at\)|\[at\]|(?<![a-z])at(?![a-z])|แอท|แอ็ท|艾特)\s*(?:gmail|googlemail|hotmail|outlook|yahoo|icloud|qq|foxmail|163|126|sina|sohu|proton(?:mail)?|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)(?![a-z])', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z0-9])(?:gmail|googlemail|hotmail|outlook|yahoo|icloud|qq|foxmail|163|126|sina|sohu|proton(?:mail)?|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)(?:(?:[.．]|\s*(?:\(dot\)|\[dot\]|(?<![a-z])dot(?![a-z])|ดอท|ด็อท|จุด|点|點)\s*)|\s+)(?:com|net|org|co|th|cn|io|me|info|biz|edu|ac|go|hk|tw|sg|jp|kr|us|uk|คอม|康)(?![a-z])', '[•••]', 'gi');
  b := regexp_replace(b, '(https?://|www\.)\S+', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z0-9@.])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|me|ly|ee|io|co|th|cn|link|app|page|xyz|info|gl|to)(?![a-z0-9-])(?:/\S*)?', '[•••]', 'gi');
  b := regexp_replace(b, '\+?\(?(?:[0-9๐-๙０-９]|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|[零〇一二三四五六七八九幺]|(?<![a-z])(?:zero|one|two|three|four|five|six|seven|eight|nine)(?![a-z]))(?:[\s.()_–—-]*(?:[0-9๐-๙０-９]|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|[零〇一二三四五六七八九幺]|(?<![a-z])(?:zero|one|two|three|four|five|six|seven|eight|nine)(?![a-z]))){8,}', '[•••]', 'gi');
  b := regexp_replace(b, '\+?\d[\d\s-]{6,}\d', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:we\s*chat|weixin|telegram|whats\s*app|instagram|facebook|kakao(?:talk)?|zalo|viber|tiktok|douyin|weibo|skype|discord|ไอดีไลน์|ไลน์|ไอจี|เฟส(?:บุ๊[คก])?|เฟซ(?:บุ๊[คก])?|วีแชท|วีแชต|เทเลแกรม|วอทส์แอป|ติ๊กต็อก|微信|威信|薇信|加微|v信|扣扣|企鹅号|电报|抖音|微博|脸书)\s*(?:id|ไอดี)?\s*(?:(?:[:：=]|คือ|是|号|號)\s*){0,2}@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:line|vx|wx|tg|ig|fb|wa|qq)\s*(?:(?:id|ไอดี)\s*[:：=]?|@|คือ|是|号|號)\s*@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:vx|wx|tg|ig|fb|wa)\s*[:：=]\s*@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])line\s*[:：=]\s*@?(?=[a-z._-]*[0-9._])[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])qq\s*[:：号]?\s*[0-9]{5,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![^\s])@[a-z0-9._]{4,}', '[•••]', 'gi');
  return b;
end;
$$;
grant execute on function public.mask_contact(text) to anon, authenticated;

create or replace function public.no_contact(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t is null or not (t ~* '[^\s@]+@[^\s@]+'
    or public.mask_contact(t) <> regexp_replace(t, '[\u200b-\u200d\u2060\ufeff]', '', 'g'));
$$;

-- chat messages: the same as 0014, with the new rules and the check across messages
create or replace function public.check_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare b text; prev text; n_prev int; n_new int; n_all int;
begin
  new.side := public.chat_side(new.acceptance_id);
  if new.side is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  new.created_at := now();
  if new.phrase is not null then
    if not (new.phrase = any (case new.side when 'seeker' then array['hello', 'canStart', 'askHousing', 'askHours', 'askContract', 'thanks']
                                            else array['hello', 'askStart', 'askExp', 'sendDocs', 'interviewInvite', 'thanks'] end)) then
      raise exception 'bad_phrase' using errcode = 'P0001';
    end if;
    new.body := ''; new.masked := false;
  else
    b := public.mask_contact(btrim(new.body));
    -- the sender's own typed messages just before this one (up to 3, since the other side last wrote, within 30 minutes)
    select string_agg(x.body, ' ' order by x.created_at) into prev from (
      select m.body, m.created_at from public.chat_messages m
      where m.acceptance_id = new.acceptance_id and m.side = new.side and m.phrase is null and m.created_at > now() - interval '30 minutes'
        and m.created_at > coalesce((select max(o.created_at) from public.chat_messages o
                                     where o.acceptance_id = new.acceptance_id and o.side <> new.side), '-infinity')
      order by m.created_at desc limit 3) x;
    if prev is not null then
      n_prev := (char_length(public.mask_contact(prev)) - char_length(replace(public.mask_contact(prev), '[•••]', ''))) / 5;
      n_new := (char_length(b) - char_length(replace(b, '[•••]', ''))) / 5;
      n_all := (char_length(public.mask_contact(prev || ' ' || b)) - char_length(replace(public.mask_contact(prev || ' ' || b), '[•••]', ''))) / 5;
      if n_all > n_prev + n_new then b := '[•••]'; end if; -- contact details completed by this message
    end if;
    new.masked := new.masked or b <> btrim(new.body);
    new.body := b;
  end if;
  return new;
end;
$$;
