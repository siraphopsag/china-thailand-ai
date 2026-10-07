-- C.A.L.L. — simulated data and the administrator's tools (owner, Oct 2026). Run once in Supabase → SQL Editor after
-- 0007_person_verify.sql (guide step 17). Safe to run again.
--  • Everything that does not come from a real user is "simulated data" (ข้อมูลจำลอง) and the website labels it in yellow:
--    the sample posts, everything an administrator posts or pins, and what the administrator's generator makes.
--    posts.is_sample already exists; pins get is_sample too.
--  • The generator (admin_add_samples) adds simulated posts (owned by the administrator, so they can play the employer and test
--    the whole flow) and simulated pins (owned by nobody, like a crowd of job seekers). Times may lie in the past, so the
--    rings, the 30-day pins and the market view look lived-in. admin_clear_samples removes them again.
--  • An administrator posts and pins without limits.
--  • pin_stats also says which counts are simulated (the market view shows how many).

-- ───────────── pins can be simulated, and simulated pins need no owner ─────────────
alter table public.pins add column if not exists is_sample boolean not null default false;
alter table public.pins alter column seeker_id drop not null;
alter table public.pins drop constraint if exists pins_owner_or_sample;
alter table public.pins add constraint pins_owner_or_sample check (seeker_id is not null or is_sample);

-- an administrator: no weekly limit, no "one pin per place and field"; everything they pin is simulated.
-- simulated pins without an owner (the generator) keep the time they were given.
create or replace function public.check_pin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.seeker_id is null then
    if not new.is_sample then raise exception 'not_allowed' using errcode = 'P0001'; end if;
    new.created_at := least(coalesce(new.created_at, now()), now());
    return new;
  end if;
  if public.is_admin() and new.seeker_id = auth.uid() then
    new.is_sample := true;
  else
    new.is_sample := false;
    if public.cycle_used(new.seeker_id, array['pin']) >= (case when public.member_now(new.seeker_id) then 10 else 5 end) then raise exception 'pin_limit' using errcode = 'P0001'; end if;
    if exists (select 1 from public.pins where seeker_id = new.seeker_id and country = new.country and province = new.province
               and industry = new.industry and created_at > now() - interval '30 days') then
      raise exception 'pin_duplicate' using errcode = 'P0001';
    end if;
  end if;
  insert into public.quota_events (user_id, kind) values (new.seeker_id, 'pin');
  new.created_at := now();
  return new;
end;
$$;

-- ───────────── posts: an administrator posts without limits, and their posts are simulated ─────────────
create or replace function public.post_limit(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (select 1 from public.profiles where id = p_user and role = 'admin') then 100000
              when public.member_now(p_user) then 10 else 3 end;
$$;
revoke all on function public.post_limit(uuid) from public, anon, authenticated;

-- the website may add or edit an administrator's simulated post (before: never a simulated one)
drop policy if exists "employers add own posts" on public.posts;
create policy "employers add own posts" on public.posts
  for insert to authenticated with check (employer_id = auth.uid() and (not is_sample or public.is_admin()));
drop policy if exists "employers edit own posts" on public.posts;
create policy "employers edit own posts" on public.posts
  for update to authenticated using (employer_id = auth.uid()) with check (employer_id = auth.uid() and (not is_sample or public.is_admin()));

-- as in 0007, plus: an administrator's own post is marked simulated
create or replace function public.check_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_sample then
      if coalesce((select suspended from public.profiles where id = new.employer_id), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
      if public.cycle_used(new.employer_id, array['post', 'renew']) >= public.post_limit(new.employer_id) then raise exception 'quota' using errcode = 'P0001'; end if;
      insert into public.quota_events (user_id, kind) values (new.employer_id, 'post');
      new.created_at := now(); new.released_at := now();
      new.verified := coalesce((select verify_status = 'verified' from public.profiles where id = new.employer_id), false);
      new.verify_kind := case when new.verified then (select coalesce(verify_kind, 'company') from public.profiles where id = new.employer_id) end;
      -- everything an administrator posts is simulated data (owner, Oct 2026)
      if exists (select 1 from public.profiles where id = new.employer_id and role = 'admin') then new.is_sample := true; end if;
    end if;
    new.released_at := coalesce(new.released_at, new.created_at);
    new.hidden := false;
  else
    new.created_at := old.created_at; new.employer_id := old.employer_id;
    if coalesce(current_setting('call.labeling', true), '') <> 'on' then new.is_sample := old.is_sample; end if;
    if new.headcount is distinct from old.headcount and coalesce(new.headcount, 1) <
       (select count(*) from public.acceptances where post_id = old.id and status in ('accepted', 'confirmed', 'forwarded')) then
      raise exception 'below_held' using errcode = 'P0001';
    end if;
    if coalesce(current_setting('call.renewing', true), '') = 'on' then
      if coalesce((select suspended from public.profiles where id = old.employer_id), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
    else
      new.released_at := old.released_at;
    end if;
    if coalesce(current_setting('call.syncing', true), '') <> 'on' then new.verified := old.verified; new.verify_kind := old.verify_kind; end if;
    if coalesce(current_setting('call.moderating', true), '') <> 'on' then new.hidden := old.hidden; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- clearing simulated posts is allowed even while a (simulated) case runs
create or replace function public.check_post_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('call.clearing', true), '') = 'on' and old.is_sample then return old; end if;
  if auth.uid() = old.employer_id
     and exists (select 1 from auth.users where id = old.employer_id)
     and exists (select 1 from public.cases where post_id = old.id and steps ? 'accepted' and not (steps ? 'arrived')) then
    raise exception 'case_started' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

-- ───────────── the administrator's generator ─────────────
-- p_posts: [{company, position, industry, skills[], min_years, details, headcount, employment, salary_min, salary_max,
--            salary_currency, start_date, languages, education, benefits[], country, province, created_at, verified, verify_kind}]
-- p_pins:  [{country, province, industry, skills[], created_at}]
-- the website builds them (src/domain/match/simulate.ts); the table checks still apply to every row. At most 200 of each a call.
create or replace function public.admin_add_samples(p_posts jsonb default '[]'::jsonb, p_pins jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r jsonb; np int := 0; nn int := 0; t timestamptz;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_posts, '[]')) > 200 or jsonb_array_length(coalesce(p_pins, '[]')) > 200 then raise exception 'too_many' using errcode = 'P0001'; end if;
  for r in select * from jsonb_array_elements(coalesce(p_posts, '[]')) loop
    -- no later than now, no earlier than 5 months ago (posts last 6)
    t := greatest(least(coalesce((r->>'created_at')::timestamptz, now()), now()), now() - interval '150 days');
    insert into public.posts (is_sample, employer_id, company, position, industry, skills, min_years, details, headcount, employment,
      salary_min, salary_max, salary_currency, start_date, languages, education, benefits, country, province, created_at, released_at, verified, verify_kind)
    values (true, auth.uid(), r->>'company', r->>'position', r->>'industry', array(select jsonb_array_elements_text(r->'skills')),
      coalesce((r->>'min_years')::int, 0), coalesce(r->>'details', ''), (r->>'headcount')::int, r->>'employment',
      (r->>'salary_min')::int, (r->>'salary_max')::int, r->>'salary_currency', (r->>'start_date')::date,
      coalesce(r->'languages', '[]'::jsonb), coalesce(r->>'education', 'none'), array(select jsonb_array_elements_text(coalesce(r->'benefits', '[]'::jsonb))),
      r->>'country', r->>'province', t, t, coalesce((r->>'verified')::boolean, false),
      case when coalesce((r->>'verified')::boolean, false) then coalesce(r->>'verify_kind', 'company') end);
    np := np + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_pins, '[]')) loop
    -- pins last 30 days
    t := greatest(least(coalesce((r->>'created_at')::timestamptz, now()), now()), now() - interval '29 days');
    insert into public.pins (seeker_id, is_sample, country, province, industry, skills, created_at)
    values (null, true, r->>'country', r->>'province', r->>'industry', array(select jsonb_array_elements_text(r->'skills')), t);
    nn := nn + 1;
  end loop;
  return jsonb_build_object('posts', np, 'pins', nn);
end;
$$;
revoke all on function public.admin_add_samples(jsonb, jsonb) from public, anon;
grant execute on function public.admin_add_samples(jsonb, jsonb) to authenticated;

-- remove simulated posts and/or simulated pins (with their applications and cases)
create or replace function public.admin_clear_samples(p_posts boolean, p_pins boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare np int := 0; nn int := 0;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  perform set_config('call.clearing', 'on', true);
  if p_posts then delete from public.posts where is_sample; get diagnostics np = row_count; end if;
  if p_pins then delete from public.pins where is_sample; get diagnostics nn = row_count; end if;
  perform set_config('call.clearing', 'off', true);
  return jsonb_build_object('posts', np, 'pins', nn);
end;
$$;
revoke all on function public.admin_clear_samples(boolean, boolean) from public, anon;
grant execute on function public.admin_clear_samples(boolean, boolean) to authenticated;

-- ───────────── pin counts: which are simulated ─────────────
drop function if exists public.pin_stats();
create function public.pin_stats()
returns table (country text, province text, industry text, skills text[], hour timestamptz, n bigint, sample bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.country, p.province, p.industry, p.skills, date_trunc('hour', p.created_at), count(*), count(*) filter (where p.is_sample)
  from public.pins p where p.created_at > now() - interval '30 days'
  group by 1, 2, 3, 4, 5;
$$;
revoke all on function public.pin_stats() from public, anon;
grant execute on function public.pin_stats() to authenticated;

-- the administrator's own earlier posts and pins become simulated too
do $$
begin
  perform set_config('call.labeling', 'on', true);
  update public.posts set is_sample = true where not is_sample and employer_id in (select id from public.profiles where role = 'admin');
  perform set_config('call.labeling', 'off', true);
  update public.pins set is_sample = true where not is_sample and seeker_id in (select id from public.profiles where role = 'admin');
end;
$$;
