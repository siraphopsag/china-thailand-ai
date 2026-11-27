-- C.A.L.L. — fixes from the code review of 27 Nov 2026. Run once in Supabase → SQL Editor AFTER 0019_profile_extra.sql. Safe to
-- run again: it only replaces functions and triggers.
--
--  1. Contact rules (now that the 3rd hidden chat message ends a match): phone numbers are recognised by their shape (a Thai
--     number starts with 0 or +66, a Chinese mobile with 13–19 or +86), so salary ranges ("15000-20000"), dates and times are
--     no longer hidden or counted; "TikTok Shop", "Facebook page", "ASP.NET", "at 163 Moo 5" are left alone; numbers split
--     with commas or dots are caught. Word for word the same as src/domain/contact.ts (a test checks this).
--  2. Chat: the database decides whether a message had contact details (the website sends what was typed); a "masked" flag
--     sent by the website no longer counts, so nobody can strike themselves to end a match they confirmed.
--  3. Applications: ended_for / ended_by cannot be set when applying (0017 guarded only later changes).
--  4. Worker review: open from the 30th day after arrival by the Thai calendar day, the same rule as the website.

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
  b := regexp_replace(b, '[a-z0-9._%+-]{2,}\s*(?:[@＠]|\(at\)|\[at\]|(?<![a-z])at(?![a-z])|แอท|แอ็ท|艾特)\s*(?:gmail|googlemail|hotmail|outlook|yahoo|icloud|qq|foxmail|sina|sohu|proton(?:mail)?|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)(?![a-z0-9])', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z0-9])(?:gmail|googlemail|hotmail|outlook|yahoo|icloud|qq|foxmail|163|126|sina|sohu|proton(?:mail)?|จีเมล|ฮอตเมล|ยาฮู|เอาท์ลุค)(?:(?:[.．]|\s*(?:\(dot\)|\[dot\]|(?<![a-z])dot(?![a-z])|ดอท|ด็อท|จุด|点|點)\s*)|\s+)(?:com|net|org|co|th|cn|io|me|info|biz|edu|ac|go|hk|tw|sg|jp|kr|us|uk|คอม|康)(?![a-z])', '[•••]', 'gi');
  b := regexp_replace(b, '(https?://|www\.)\S+', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z0-9@.])(?:[a-z0-9-]+\.)+(?:com|th|cn|ly|ee|me|gl|link|page|to)(?![a-z0-9-])(?:/\S*)?', '[•••]', 'gi');
  b := regexp_replace(b, '(?:[0-9][\s.()_–—,-]*){0,4}(?:[๐-๙０-９]|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|[零〇一二三四五六七八九幺]|(?<![a-z])(?:zero|one|two|three|four|five|six|seven|eight|nine)(?![a-z]))(?:[\s.()_–—,-]*(?:[0-9]|(?:[๐-๙０-９]|ศูนย์|หนึ่ง|สอง|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|[零〇一二三四五六七八九幺]|(?<![a-z])(?:zero|one|two|three|four|five|six|seven|eight|nine)(?![a-z])))){6,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![0-9])\(?(?:\+?66[\s,()-]*[1-9]|0[0-9])(?:[\s,()-]*[0-9]){7,8}(?![0-9])', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![0-9])\(?(?:\+?86[\s,()-]*)?1[3-9][0-9](?:[\s,()-]*[0-9]){8}(?![0-9])', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![0-9.])(?:0[0-9]{1,2}\.[0-9]{3,4}|1[3-9][0-9]\.[0-9]{4})\.[0-9]{3,4}(?![0-9])', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:we\s*chat|weixin|telegram|whats\s*app|instagram|facebook|kakao(?:talk)?|zalo|viber|tiktok|douyin|weibo|skype|discord|ไอจี|เฟส(?:บุ๊[คก])?|เฟซ(?:บุ๊[คก])?|ติ๊กต็อก|抖音|微博|脸书)\s*(?:(?:id|ไอดี)\s*)?(?:(?:[:：=]|คือ|是|号|號)\s*){1,2}@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:we\s*chat|weixin|telegram|whats\s*app|instagram|facebook|kakao(?:talk)?|zalo|viber|tiktok|douyin|weibo|skype|discord|ไอจี|เฟส(?:บุ๊[คก])?|เฟซ(?:บุ๊[คก])?|ติ๊กต็อก|抖音|微博|脸书)\s*(?:id|ไอดี)\s+@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:we\s*chat|weixin|telegram|whats\s*app|instagram|facebook|kakao(?:talk)?|zalo|viber|tiktok|douyin|weibo|skype|discord|ไอจี|เฟส(?:บุ๊[คก])?|เฟซ(?:บุ๊[คก])?|ติ๊กต็อก|抖音|微博|脸书)\s+@?(?=[a-z._-]*[0-9_.])[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?:ไอดีไลน์|ไลน์|วีแชท|วีแชต|เทเลแกรม|วอทส์แอป|微信|威信|薇信|加微|v信|扣扣|企鹅号|电报)\s*(?:id|ไอดี)?\s*(?:(?:[:：=]|คือ|是|号|號)\s*){0,2}@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:line|vx|wx|tg|ig|fb|wa|qq)\s*(?:(?:id|ไอดี)\s*[:：=]?|@|คือ|是|号|號)\s*@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])(?:vx|wx|tg|ig|fb|wa)\s*[:：=]\s*@?[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])line\s*[:：=]\s*@?(?=[a-z._-]*[0-9._])[a-z0-9._-]{3,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![a-z])qq\s*[:：号]?\s*[0-9]{5,}', '[•••]', 'gi');
  b := regexp_replace(b, '(?<![^\s])@[a-z0-9._]{4,}', '[•••]', 'gi');
  return b;
end;
$$;

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
      if n_all > n_prev + n_new then b := '[•••]'; end if;
    end if;
    new.masked := b <> btrim(new.body); -- decided here, never by the sender
    new.body := b;
  end if;
  return new;
end;
$$;

create or replace function public.keep_ended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.ended_for := null; new.ended_by := null;
  elsif coalesce(current_setting('call.ending', true), '') <> 'on' then
    new.ended_for := old.ended_for; new.ended_by := old.ended_by;
  end if;
  return new;
end;
$$;
drop trigger if exists acceptances_keep_ended on public.acceptances;
create trigger acceptances_keep_ended before insert or update on public.acceptances for each row execute function public.keep_ended();

create or replace function public.worker_review_save(p_case uuid, p_stars int, p_good text[], p_bad text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare c public.cases%rowtype; arrived timestamptz;
begin
  select * into c from public.cases where id = p_case;
  if not found or c.employer_id is distinct from auth.uid() then raise exception 'not_allowed' using errcode = '42501'; end if;
  arrived := least((c.steps ->> 'arrived')::timestamptz, c.seeker_arrived_at);
  if arrived is null or (now() at time zone 'Asia/Bangkok')::date < (arrived at time zone 'Asia/Bangkok')::date + 29 then
    raise exception 'bad_state' using errcode = 'P0001';
  end if;
  insert into public.worker_reviews (case_id, seeker_id, employer_id, stars, good, bad, at)
  values (c.id, c.seeker_id, c.employer_id, p_stars, coalesce(p_good, '{}'), coalesce(p_bad, '{}'), now())
  on conflict (case_id) do update set stars = excluded.stars, good = excluded.good, bad = excluded.bad, at = now();
end;
$$;
