-- C.A.L.L. — chat, contracts, job-seeker verification and the end system shared through the database (owner, 23 Nov 2026:
-- "the worker applied and introduced himself, but the employer never saw the chat"). Until now these four parts were kept in each
-- browser only, so the two sides of a match never saw each other's work. Run once in Supabase → SQL Editor AFTER
-- 0013_arrival_both_sides.sql (safe to run again: it only adds what is missing and replaces functions/policies).
--
-- Who may see what is enforced here (row level security), not in the website:
--   • chat_messages / chat_interviews — only the two people of one application: the job seeker and the employer of the post.
--     Not the C.A.L.L. team (a private conversation). Messages cannot be edited or deleted. E-mail addresses, links and phone
--     numbers are replaced by [•••] here as well as in the website, so the hiding cannot be skipped.
--   • contracts — the job seeker and the employer of the case, and the C.A.L.L. team (administrators) to read. Each side can sign
--     only for itself; signatures sent at the same moment by both sides are both kept. The passport lines are stored because the
--     contract itself names the worker and the passport number (PDPA s.24(3): needed to make the contract).
--   • job-seeker verification — new columns on the person's own profile: only the last 4 digits of the phone and of the passport,
--     the nationality and the expiry date (never the full numbers). An employer sees only "verified / not verified" for people
--     who applied to their posts (seeker_badges); the team sees it for everyone.
--   • aftercare (check-ins, the secret word, complaints) — the worker and the C.A.L.L. team only, never the employer.
--     The employer review the worker gives after day 30 is copied into employer_reviews, which nobody reads directly: posts show
--     only the anonymous list of stars and points (employer_reviews_of), without who gave them or for which case.
-- New messages, interview times and signatures reach the other side at once through Supabase Realtime (free plan).

-- ───────────── who is who in one application ─────────────
-- 'seeker' / 'employer' for the signed-in person in this application, null when they are not part of it
create or replace function public.chat_side(p_acc uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when a.seeker_id = auth.uid() then 'seeker' when p.employer_id = auth.uid() then 'employer' end
  from public.acceptances a join public.posts p on p.id = a.post_id
  where a.id = p_acc;
$$;
revoke all on function public.chat_side(uuid) from public, anon;
grant execute on function public.chat_side(uuid) to authenticated;

-- ───────────── chat ─────────────
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  acceptance_id uuid not null references public.acceptances (id) on delete cascade,
  sender uuid not null default auth.uid() references auth.users (id) on delete cascade,
  side text not null default 'seeker' check (side in ('seeker', 'employer')),
  body text not null default '' check (char_length(body) <= 500),
  phrase text check (phrase is null or phrase ~ '^[A-Za-z]{2,24}$'),
  masked boolean not null default false,
  created_at timestamptz not null default now(),
  check (phrase is not null or char_length(btrim(body)) > 0)
);
create index if not exists chat_messages_acc on public.chat_messages (acceptance_id, created_at);
alter table public.chat_messages enable row level security;
drop policy if exists "the two sides read their chat" on public.chat_messages;
create policy "the two sides read their chat" on public.chat_messages
  for select to authenticated using (public.chat_side(acceptance_id) is not null);
drop policy if exists "the two sides write in an open chat" on public.chat_messages;
create policy "the two sides write in an open chat" on public.chat_messages
  for insert to authenticated with check (
    sender = auth.uid() and public.chat_side(acceptance_id) is not null
    and exists (select 1 from public.acceptances a where a.id = acceptance_id and a.status in ('accepted', 'confirmed', 'forwarded')));
revoke update, delete on public.chat_messages from anon, authenticated;

-- the side comes from the application (never from the website); contact details are hidden; ready-made phrases must belong to
-- the sender's side (the same lists as src/domain/match/chat.ts)
create or replace function public.check_chat_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare b text;
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
    b := btrim(new.body);
    b := regexp_replace(b, '[^\s@]+@[^\s@]+\.[^\s@]+', '[•••]', 'g');
    b := regexp_replace(b, '(https?://|www\.)\S+', '[•••]', 'gi');
    b := regexp_replace(b, '\+?\d[\d\s-]{6,}\d', '[•••]', 'g');
    new.masked := new.masked or b <> btrim(new.body);
    new.body := b;
  end if;
  return new;
end;
$$;
drop trigger if exists chat_messages_check on public.chat_messages;
create trigger chat_messages_check before insert on public.chat_messages for each row execute function public.check_chat_message();

-- interview times: the employer offers 1–3 later times, the job seeker picks one (stored as real times, shown in each side's own
-- time zone — Thailand and China are one hour apart)
create table if not exists public.chat_interviews (
  acceptance_id uuid primary key references public.acceptances (id) on delete cascade,
  slots timestamptz[] not null check (cardinality(slots) between 1 and 3),
  mode text not null check (mode in ('video', 'onsite')),
  offered_at timestamptz not null default now(),
  chosen timestamptz,
  chosen_at timestamptz,
  check (chosen is null or chosen = any (slots))
);
alter table public.chat_interviews enable row level security;
drop policy if exists "the two sides read the interview" on public.chat_interviews;
create policy "the two sides read the interview" on public.chat_interviews
  for select to authenticated using (public.chat_side(acceptance_id) is not null);
revoke insert, update, delete on public.chat_interviews from anon, authenticated; -- only through the two functions below

create or replace function public.chat_offer_interview(p_acc uuid, p_slots timestamptz[], p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.chat_side(p_acc) is distinct from 'employer' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.acceptances where id = p_acc and status in ('accepted', 'confirmed', 'forwarded')) then raise exception 'not_open' using errcode = 'P0001'; end if;
  if p_mode not in ('video', 'onsite') or coalesce(cardinality(p_slots), 0) not between 1 and 3
     or (select count(distinct u.s) from unnest(p_slots) as u(s)) <> cardinality(p_slots)
     or exists (select 1 from unnest(p_slots) as u(s) where u.s <= now()) then
    raise exception 'bad_state' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.chat_interviews where acceptance_id = p_acc and chosen is not null) then raise exception 'bad_state' using errcode = 'P0001'; end if;
  insert into public.chat_interviews (acceptance_id, slots, mode, offered_at)
  values (p_acc, (select array_agg(u.s order by u.s) from unnest(p_slots) as u(s)), p_mode, now())
  on conflict (acceptance_id) do update set slots = excluded.slots, mode = excluded.mode, offered_at = now(), chosen = null, chosen_at = null;
end;
$$;
revoke all on function public.chat_offer_interview(uuid, timestamptz[], text) from public, anon;
grant execute on function public.chat_offer_interview(uuid, timestamptz[], text) to authenticated;

create or replace function public.chat_pick_interview(p_acc uuid, p_slot timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.chat_side(p_acc) is distinct from 'seeker' then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.chat_interviews set chosen = p_slot, chosen_at = now()
    where acceptance_id = p_acc and chosen is null and p_slot = any (slots);
  if not found then raise exception 'bad_state' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.chat_pick_interview(uuid, timestamptz) from public, anon;
grant execute on function public.chat_pick_interview(uuid, timestamptz) to authenticated;

-- my conversations for the chat list and the unread counts: the last message, and when the other side wrote (the last 50)
create or replace function public.my_chats()
returns table (acceptance_id uuid, my_side text, last_at timestamptz, last_side text, last_body text, last_phrase text, other_times timestamptz[])
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, public.chat_side(a.id), l.created_at, l.side, l.body, l.phrase,
    coalesce((select array_agg(o.created_at order by o.created_at desc) from (
      select m.created_at from public.chat_messages m where m.acceptance_id = a.id and m.side <> public.chat_side(a.id) order by m.created_at desc limit 50) o), '{}')
  from public.acceptances a
  join public.posts p on p.id = a.post_id
  left join lateral (select m.created_at, m.side, m.body, m.phrase from public.chat_messages m where m.acceptance_id = a.id order by m.created_at desc limit 1) l on true
  where a.seeker_id = auth.uid() or p.employer_id = auth.uid();
$$;
revoke all on function public.my_chats() from public, anon;
grant execute on function public.my_chats() to authenticated;

-- ───────────── contracts (the middle system) ─────────────
create table if not exists public.contracts (
  case_id uuid primary key references public.cases (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 600000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.contracts enable row level security;
drop policy if exists "people of the case read the contract" on public.contracts;
create policy "people of the case read the contract" on public.contracts
  for select to authenticated using (exists (select 1 from public.cases c where c.id = case_id and (c.seeker_id = auth.uid() or c.employer_id = auth.uid() or public.is_admin())));
revoke insert, update, delete on public.contracts from anon, authenticated; -- only through contract_save

-- save part of the work (top-level keys replace what was there); p_clear starts again. A signature can be added only by its own
-- side; when both sides sign the same text at the same moment, both signatures are kept.
create or replace function public.contract_save(p_case uuid, p_patch jsonb, p_clear boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare c public.cases%rowtype; me text; v_old jsonb; s_old jsonb; s_new jsonb;
begin
  select * into c from public.cases where id = p_case;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  me := case when c.seeker_id = auth.uid() then 'worker' when c.employer_id = auth.uid() then 'employer' end;
  if me is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_clear then delete from public.contracts where case_id = p_case; return; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then raise exception 'bad_state' using errcode = 'P0001'; end if;
  select data into v_old from public.contracts where case_id = p_case for update;
  v_old := coalesce(v_old, '{}'::jsonb);
  if p_patch ? 'sign' and jsonb_typeof(p_patch -> 'sign') = 'object' then
    s_old := coalesce(v_old -> 'sign', '{}'::jsonb); s_new := p_patch -> 'sign';
    -- someone else's signature cannot be put in or changed from here
    if (s_new -> 'worker') is not null and (s_new -> 'worker') is distinct from (s_old -> 'worker') and me <> 'worker' then raise exception 'not_allowed' using errcode = '42501'; end if;
    if (s_new -> 'employer') is not null and (s_new -> 'employer') is distinct from (s_old -> 'employer') and me <> 'employer' then raise exception 'not_allowed' using errcode = '42501'; end if;
    -- the same text and way of signing: keep the other side's signature that arrived meanwhile
    if s_old ->> 'hash' = s_new ->> 'hash' and s_old ->> 'mode' = s_new ->> 'mode' then
      p_patch := jsonb_set(p_patch, '{sign}', s_old || s_new);
    end if;
  end if;
  insert into public.contracts (case_id, data, updated_at, updated_by) values (p_case, v_old || p_patch, now(), auth.uid())
  on conflict (case_id) do update set data = excluded.data, updated_at = now(), updated_by = auth.uid();
end;
$$;
revoke all on function public.contract_save(uuid, jsonb, boolean) from public, anon;
grant execute on function public.contract_save(uuid, jsonb, boolean) to authenticated;

-- ───────────── job-seeker verification (the front system) ─────────────
alter table public.profiles add column if not exists seeker_phone_country text check (seeker_phone_country in ('TH', 'CN'));
alter table public.profiles add column if not exists seeker_phone4 text check (seeker_phone4 ~ '^[0-9]{4}$');
alter table public.profiles add column if not exists seeker_phone_at timestamptz;
alter table public.profiles add column if not exists seeker_pp_last4 text check (seeker_pp_last4 ~ '^[A-Z0-9]{4}$');
alter table public.profiles add column if not exists seeker_pp_nat text check (seeker_pp_nat ~ '^[A-Z]{3}$');
alter table public.profiles add column if not exists seeker_pp_expiry date;
alter table public.profiles add column if not exists seeker_pp_at timestamptz;
do $$ begin
  alter table public.profiles add constraint profiles_seeker_pp_needs_phone check (seeker_pp_last4 is null or seeker_phone4 is not null);
exception when duplicate_object then null; end $$;
grant update (seeker_phone_country, seeker_phone4, seeker_phone_at, seeker_pp_last4, seeker_pp_nat, seeker_pp_expiry, seeker_pp_at) on public.profiles to authenticated;

-- "verified / not verified" of the people who applied to my posts (the team: of every job seeker) — nothing else of their profile
create or replace function public.seeker_badges()
returns table (seeker_id uuid, verified boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, (p.seeker_phone4 is not null and p.seeker_pp_last4 is not null and coalesce(p.seeker_pp_expiry, current_date) >= current_date)
  from public.profiles p
  where p.id in (select a.seeker_id from public.acceptances a join public.posts po on po.id = a.post_id where po.employer_id = auth.uid())
     or (public.is_admin() and p.user_type = 'seeker');
$$;
revoke all on function public.seeker_badges() from public, anon;
grant execute on function public.seeker_badges() to authenticated;

-- ───────────── aftercare (the end system) ─────────────
create table if not exists public.aftercare (
  seeker_id uuid not null references auth.users (id) on delete cascade,
  case_key text not null check (case_key = 'nocase' or case_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  case_id uuid references public.cases (id) on delete cascade,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 200000),
  updated_at timestamptz not null default now(),
  primary key (seeker_id, case_key)
);
alter table public.aftercare enable row level security;
drop policy if exists "the worker and the team read aftercare" on public.aftercare;
create policy "the worker and the team read aftercare" on public.aftercare
  for select to authenticated using (seeker_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.aftercare from anon, authenticated; -- only through aftercare_save

create table if not exists public.employer_reviews (
  case_id uuid primary key references public.cases (id) on delete cascade,
  employer_id uuid not null references auth.users (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  good text[] not null default '{}' check (good <@ array['paidOnTime', 'fairHours', 'safeWork', 'goodHousing', 'respect']),
  bad text[] not null default '{}' check (bad <@ array['latePay', 'longHours', 'unsafeWork', 'poorHousing', 'deductions']),
  at timestamptz not null default now()
);
create index if not exists employer_reviews_employer on public.employer_reviews (employer_id);
alter table public.employer_reviews enable row level security; -- no policies: read only through employer_reviews_of
revoke all on public.employer_reviews from anon, authenticated;

-- the worker saves their own aftercare; the team (administrators) saves a worker's complaints as they act on them
create or replace function public.aftercare_save(p_seeker uuid, p_key text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare cid uuid; emp uuid; r jsonb;
begin
  if p_seeker is distinct from auth.uid() and not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' then raise exception 'bad_state' using errcode = 'P0001'; end if;
  if p_key <> 'nocase' then
    select id, employer_id into cid, emp from public.cases where id::text = p_key and seeker_id = p_seeker;
    if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  end if;
  insert into public.aftercare (seeker_id, case_key, case_id, data, updated_at) values (p_seeker, p_key, cid, p_data, now())
  on conflict (seeker_id, case_key) do update set data = excluded.data, updated_at = now();
  -- the review the worker gave (only the worker's own save counts)
  r := p_data -> 'review';
  if cid is not null and emp is not null and p_seeker = auth.uid() then
    if jsonb_typeof(r) = 'object' and (r ->> 'stars') ~ '^[1-5]$' then
      insert into public.employer_reviews (case_id, employer_id, stars, good, bad, at)
      values (cid, emp, (r ->> 'stars')::int,
        coalesce((select array_agg(e.v) from jsonb_array_elements_text(case when jsonb_typeof(r -> 'good') = 'array' then r -> 'good' else '[]'::jsonb end) as e(v) where e.v = any (array['paidOnTime', 'fairHours', 'safeWork', 'goodHousing', 'respect'])), '{}'),
        coalesce((select array_agg(e.v) from jsonb_array_elements_text(case when jsonb_typeof(r -> 'bad') = 'array' then r -> 'bad' else '[]'::jsonb end) as e(v) where e.v = any (array['latePay', 'longHours', 'unsafeWork', 'poorHousing', 'deductions'])), '{}'),
        now())
      on conflict (case_id) do update set stars = excluded.stars, good = excluded.good, bad = excluded.bad, at = now();
    else
      delete from public.employer_reviews where case_id = cid;
    end if;
  end if;
end;
$$;
revoke all on function public.aftercare_save(uuid, text, jsonb) from public, anon;
grant execute on function public.aftercare_save(uuid, text, jsonb) to authenticated;

-- the anonymous reviews of one employer, for the total on their posts
create or replace function public.employer_reviews_of(p_employer uuid)
returns table (stars int, good text[], bad text[], at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.stars, r.good, r.bad, r.at from public.employer_reviews r where r.employer_id = p_employer order by r.at desc limit 200;
$$;
revoke all on function public.employer_reviews_of(uuid) from public, anon;
grant execute on function public.employer_reviews_of(uuid) to authenticated;

-- ───────────── live updates (Supabase Realtime) ─────────────
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['chat_messages', 'chat_interviews', 'contracts'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
