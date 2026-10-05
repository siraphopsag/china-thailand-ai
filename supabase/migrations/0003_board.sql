-- C.A.L.L. — the board, the five-level release, reservations and weekly cycles (Oct 2026). Run once AFTER 0001 and 0002:
-- Supabase → SQL Editor → paste this file → Run. Safe to run again (it only adds what is missing, replaces functions/policies).
--
-- What changes (owner, Oct 2026):
--   • weekly allowances are cycles: a cycle starts with its first use and lasts 7 days, then the whole allowance is back.
--     New posts and renewals share one allowance (3, or 10 with the simulated membership); pins have their own (5).
--     Every use is logged in quota_events, so deleting a post or a pin does not give the use back.
--   • a post lasts 6 months from its (re)release (released_at); renew_post() starts the release again and uses the allowance.
--   • a pin lasts a month; one pin per province + field at a time.
--   • applications carry a short introduction and a start date; once a post is full, new ones wait as reservations; the
--     employer confirms or declines (decide_application); a freed place goes to the earliest reservation; seekers may withdraw.
--   • pin_stats() and post_counts(): anonymous numbers for the release and the board — never who.
--   • purge_expired() removes posts after 6 months and pins after a month (ping() runs it, so the keep-alive cleans up too).
-- The release levels themselves are worked out in the website (src/domain/match/release.ts) from these numbers.

-- ───────────── uses of the weekly allowances ─────────────
create table if not exists public.quota_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('post', 'renew', 'pin')),
  created_at timestamptz not null default now()
);
create index if not exists quota_events_user on public.quota_events (user_id, kind, created_at);
alter table public.quota_events enable row level security;
drop policy if exists "read own uses" on public.quota_events;
create policy "read own uses" on public.quota_events
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.quota_events from anon, authenticated; -- written only by the functions below

-- the posts and pins made before this file count as uses (only on the first run)
insert into public.quota_events (user_id, kind, created_at)
select employer_id, 'post', created_at from public.posts where not is_sample and employer_id is not null and not exists (select 1 from public.quota_events)
union all
select seeker_id, 'pin', created_at from public.pins where not exists (select 1 from public.quota_events);

-- uses in the running cycle (0 when no cycle is running)
create or replace function public.cycle_used(p_user uuid, p_kinds text[])
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare t timestamptz; start timestamptz := null; n int := 0;
begin
  for t in select created_at from public.quota_events where user_id = p_user and kind = any (p_kinds) order by created_at loop
    if start is null or t >= start + interval '7 days' then start := t; n := 1; else n := n + 1; end if;
  end loop;
  if start is null or now() >= start + interval '7 days' then return 0; end if;
  return n;
end;
$$;
revoke all on function public.cycle_used(uuid, text[]) from public, anon, authenticated;

create or replace function public.post_limit(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select case when member then 10 else 3 end from public.profiles where id = p_user), 3);
$$;
revoke all on function public.post_limit(uuid) from public, anon, authenticated;

-- ───────────── posts: release time, cycles, renewal, 6-month life ─────────────
alter table public.posts add column if not exists released_at timestamptz;
update public.posts set released_at = created_at where released_at is null;
alter table public.posts alter column released_at set default now();
alter table public.posts alter column released_at set not null;
create index if not exists posts_released on public.posts (released_at);

create or replace function public.check_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_sample then
      if public.cycle_used(new.employer_id, array['post', 'renew']) >= public.post_limit(new.employer_id) then raise exception 'quota' using errcode = 'P0001'; end if;
      insert into public.quota_events (user_id, kind) values (new.employer_id, 'post');
      new.created_at := now(); new.released_at := now();
    end if;
    new.released_at := coalesce(new.released_at, new.created_at);
  else
    new.created_at := old.created_at; new.employer_id := old.employer_id; new.is_sample := old.is_sample;
    -- only renew_post() moves the release time
    if coalesce(current_setting('call.renewing', true), '') <> 'on' then new.released_at := old.released_at; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.renew_post(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare emp uuid;
begin
  select employer_id into emp from public.posts where id = p_id for update;
  if not found or emp is distinct from auth.uid() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if public.cycle_used(emp, array['post', 'renew']) >= public.post_limit(emp) then raise exception 'quota' using errcode = 'P0001'; end if;
  insert into public.quota_events (user_id, kind) values (emp, 'renew');
  perform set_config('call.renewing', 'on', true);
  update public.posts set released_at = now() where id = p_id;
  perform set_config('call.renewing', 'off', true);
  return now();
end;
$$;
revoke all on function public.renew_post(uuid) from public, anon;
grant execute on function public.renew_post(uuid) to authenticated;

-- expired posts disappear for everyone except their employer and admins (purge_expired() then removes them)
drop policy if exists "signed-in people read posts" on public.posts;
create policy "signed-in people read posts" on public.posts
  for select to authenticated using (released_at > now() - interval '182 days' or is_sample or employer_id = auth.uid() or public.is_admin());

-- ───────────── pins: 5 per cycle, one per province + field, a month long ─────────────
create or replace function public.check_pin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.cycle_used(new.seeker_id, array['pin']) >= 5 then raise exception 'pin_limit' using errcode = 'P0001'; end if;
  if exists (select 1 from public.pins where seeker_id = new.seeker_id and country = new.country and province = new.province
             and industry = new.industry and created_at > now() - interval '30 days') then
    raise exception 'pin_duplicate' using errcode = 'P0001';
  end if;
  insert into public.quota_events (user_id, kind) values (new.seeker_id, 'pin');
  new.created_at := now();
  return new;
end;
$$;

-- anonymous: how many active pins per place, field and hour made (the release groups level 1 by that hour) — never who
create or replace function public.pin_stats()
returns table (country text, province text, industry text, skills text[], hour timestamptz, n bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.country, p.province, p.industry, p.skills, date_trunc('hour', p.created_at), count(*)
  from public.pins p where p.created_at > now() - interval '30 days'
  group by 1, 2, 3, 4, 5;
$$;
revoke all on function public.pin_stats() from public, anon;
grant execute on function public.pin_stats() to authenticated;

-- ───────────── applications and reservations ─────────────
alter table public.acceptances add column if not exists intro text not null default '' check (char_length(intro) <= 300 and public.no_contact(intro));
alter table public.acceptances add column if not exists available_from date;
alter table public.acceptances add column if not exists promoted_at timestamptz;
alter table public.acceptances add column if not exists decided_at timestamptz;
alter table public.acceptances drop constraint if exists acceptances_status_check;
alter table public.acceptances add constraint acceptances_status_check check (status in ('accepted', 'reserved', 'confirmed', 'rejected', 'forwarded'));

-- the database decides between a place and a reservation, so the insert policy no longer fixes the status
drop policy if exists "seekers accept" on public.acceptances;
create policy "seekers accept" on public.acceptances
  for insert to authenticated with check (
    seeker_id = auth.uid()
    and not exists (select 1 from public.posts p where p.id = post_id and p.employer_id = auth.uid())); -- not your own post
drop policy if exists "seekers withdraw" on public.acceptances;
create policy "seekers withdraw" on public.acceptances
  for delete to authenticated using (seeker_id = auth.uid() and status in ('accepted', 'reserved', 'confirmed'));
-- "admins forward" (0002) stays, so the earlier website version keeps working with this database; this version uses forward_case()

create or replace function public.check_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare cap int; rel timestamptz; held int;
begin
  if tg_op = 'INSERT' then
    -- one application at a time per post, so two people cannot take the last place together
    select coalesce(headcount, 1), released_at into cap, rel from public.posts where id = new.post_id for update;
    if not found then raise exception 'not_open' using errcode = 'P0001'; end if;
    if rel <= now() - interval '182 days' then raise exception 'expired' using errcode = 'P0001'; end if;
    if new.available_from is not null and (new.available_from < current_date - 1 or new.available_from > current_date + 731) then
      raise exception 'bad_date' using errcode = 'P0001';
    end if;
    select count(*) into held from public.acceptances where post_id = new.post_id and status in ('accepted', 'confirmed', 'forwarded');
    new.seeker_name := coalesce((select nullif(full_name, '') from public.profiles where id = new.seeker_id), 'Job seeker');
    new.status := case when held < cap then 'accepted' else 'reserved' end;
    new.created_at := now(); new.forwarded_at := null; new.promoted_at := null; new.decided_at := null;
  else
    new.post_id := old.post_id; new.seeker_id := old.seeker_id; new.seeker_name := old.seeker_name; new.created_at := old.created_at;
    new.intro := old.intro; new.available_from := old.available_from;
    new.forwarded_at := case when new.status = 'forwarded' then coalesce(old.forwarded_at, now()) else null end;
  end if;
  return new;
end;
$$;

-- fill free places from the queue: the earliest reservation first
create or replace function public.promote_reserved(p_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare cap int; held int; nxt uuid;
begin
  select coalesce(headcount, 1) into cap from public.posts where id = p_post for update;
  if not found then return; end if;
  loop
    select count(*) into held from public.acceptances where post_id = p_post and status in ('accepted', 'confirmed', 'forwarded');
    exit when held >= cap;
    select id into nxt from public.acceptances where post_id = p_post and status = 'reserved' order by created_at, id limit 1;
    exit when nxt is null;
    update public.acceptances set status = 'accepted', promoted_at = now() where id = nxt;
  end loop;
end;
$$;
revoke all on function public.promote_reserved(uuid) from public, anon, authenticated;

create or replace function public.after_acceptance_gone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.promote_reserved(old.post_id);
  return null;
end;
$$;
drop trigger if exists acceptances_gone on public.acceptances;
create trigger acceptances_gone after delete on public.acceptances
  for each row execute function public.after_acceptance_gone();

-- more people wanted → places go to the queue
create or replace function public.after_post_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.headcount is distinct from old.headcount then perform public.promote_reserved(new.id); end if;
  return null;
end;
$$;
drop trigger if exists posts_after on public.posts;
create trigger posts_after after update on public.posts
  for each row execute function public.after_post_change();

-- the employer of the post (or an admin) confirms or declines an application that holds a place
create or replace function public.decide_application(p_id uuid, p_confirm boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare st text; pid uuid; emp uuid;
begin
  select a.status, a.post_id, p.employer_id into st, pid, emp
    from public.acceptances a join public.posts p on p.id = a.post_id where a.id = p_id for update of a;
  if not found or (emp is distinct from auth.uid() and not public.is_admin()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if st <> 'accepted' then raise exception 'bad_state' using errcode = 'P0001'; end if;
  update public.acceptances set status = case when p_confirm then 'confirmed' else 'rejected' end, decided_at = now() where id = p_id;
  perform public.promote_reserved(pid);
end;
$$;
revoke all on function public.decide_application(uuid, boolean) from public, anon;
grant execute on function public.decide_application(uuid, boolean) to authenticated;

-- simulated: an admin marks a confirmed case as forwarded to the employment authority (nothing is sent anywhere)
create or replace function public.forward_case(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  update public.acceptances set status = 'forwarded' where id = p_id and status = 'confirmed';
  if not found then raise exception 'bad_state' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.forward_case(uuid) from public, anon;
grant execute on function public.forward_case(uuid) to authenticated;

-- anonymous per post: places held, waiting for the employer, reservations (seekers only see their own applications)
create or replace function public.post_counts()
returns table (post_id uuid, held bigint, pending bigint, reserved bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select a.post_id,
    count(*) filter (where a.status in ('accepted', 'confirmed', 'forwarded')),
    count(*) filter (where a.status = 'accepted'),
    count(*) filter (where a.status = 'reserved')
  from public.acceptances a group by a.post_id;
$$;
revoke all on function public.post_counts() from public, anon;
grant execute on function public.post_counts() to authenticated;

-- ───────────── clean-up: posts after 6 months, pins after a month ─────────────
create or replace function public.purge_expired()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.posts where not is_sample and released_at <= now() - interval '182 days';
  delete from public.pins where created_at <= now() - interval '30 days';
$$;
revoke all on function public.purge_expired() from public, anon;
grant execute on function public.purge_expired() to authenticated;

-- the keep-alive ping (GitHub Action, twice a day) also cleans up; it still reveals nothing
create or replace function public.ping()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.purge_expired();
  return now();
end;
$$;
grant execute on function public.ping() to anon, authenticated;

-- ───────────── a third invented sample post, over a month old (it shows level 5, international) ─────────────
insert into public.posts (is_sample, employer_id, company, position, industry, skills, min_years, details, headcount, employment,
  salary_min, salary_max, salary_currency, start_date, languages, education, benefits, country, province, created_at, released_at)
select true, null, 'Sample Eastern Logistics', 'Warehouse Coordinator', 'logistics', array['project_management'], 1,
  'Sample post for the prototype. Cross-border shipments.', 1, 'permanent', 18000, 25000, 'THB', current_date + 20,
  '[{"lang":"th","level":"conversational"},{"lang":"zh","level":"basic"}]'::jsonb, 'secondary', array['insurance'], 'TH', 'TH-20',
  now() - interval '40 days', now() - interval '40 days'
where not exists (select 1 from public.posts where is_sample and company = 'Sample Eastern Logistics');
