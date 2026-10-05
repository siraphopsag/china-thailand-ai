-- C.A.L.L. — reporting suspicious posts (owner, Oct 2026). Run once in Supabase → SQL Editor after 0004_cases.sql (guide step 14).
-- Anyone signed in may report a post once (never their own), 10 reports a day at most. When three different people have open
-- reports on a post it is hidden from everyone except its employer, administrators and people in its case, and nobody can apply,
-- until an administrator decides: not a problem (shown again), remove the post, or suspend the employer (all their posts hidden;
-- no new posts or renewals). Employers never see who reported them. Safe to run again.

alter table public.profiles add column if not exists suspended boolean not null default false; -- not in the update grants: only moderate_post() sets it
alter table public.posts add column if not exists hidden boolean not null default false;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('fee', 'false', 'illegal', 'contact', 'other')),
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'open' check (status in ('open', 'dismissed', 'upheld')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);
create index if not exists reports_open on public.reports (post_id) where status = 'open';
create index if not exists reports_reporter on public.reports (reporter_id, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists "report a post" on public.reports;
create policy "report a post" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());
revoke update, delete on public.reports from anon, authenticated; -- decisions only through moderate_post()

create or replace function public.check_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare emp uuid;
begin
  select employer_id into emp from public.posts where id = new.post_id;
  if not found or emp is not distinct from new.reporter_id then raise exception 'not_allowed' using errcode = '42501'; end if;
  if (select count(*) from public.reports where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'report_limit' using errcode = 'P0001';
  end if;
  new.status := 'open'; new.created_at := now(); new.note := btrim(coalesce(new.note, ''));
  return new;
end;
$$;
drop trigger if exists reports_check on public.reports;
create trigger reports_check before insert on public.reports
  for each row execute function public.check_report();

-- three different people → hidden until an administrator decides
create or replace function public.after_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(distinct reporter_id) from public.reports where post_id = new.post_id and status = 'open') >= 3 then
    perform set_config('call.moderating', 'on', true);
    update public.posts set hidden = true where id = new.post_id and not hidden;
    perform set_config('call.moderating', 'off', true);
  end if;
  return null;
end;
$$;
drop trigger if exists reports_after on public.reports;
create trigger reports_after after insert on public.reports
  for each row execute function public.after_report();

-- posts: as in 0004, plus — a suspended employer cannot post or renew; only moderation hides or shows a post
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
    end if;
    new.released_at := coalesce(new.released_at, new.created_at);
    new.hidden := false;
  else
    new.created_at := old.created_at; new.employer_id := old.employer_id; new.is_sample := old.is_sample;
    -- fewer people than already hold a place cannot be asked for
    if new.headcount is distinct from old.headcount and coalesce(new.headcount, 1) <
       (select count(*) from public.acceptances where post_id = old.id and status in ('accepted', 'confirmed', 'forwarded')) then
      raise exception 'below_held' using errcode = 'P0001';
    end if;
    -- only renew_post() moves the release time (not for a suspended employer); only a verification change moves "verified"
    if coalesce(current_setting('call.renewing', true), '') = 'on' then
      if coalesce((select suspended from public.profiles where id = old.employer_id), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
    else
      new.released_at := old.released_at;
    end if;
    if coalesce(current_setting('call.syncing', true), '') <> 'on' then new.verified := old.verified; end if;
    if coalesce(current_setting('call.moderating', true), '') <> 'on' then new.hidden := old.hidden; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- renewing: as in 0003, but a suspended employer hears so before the weekly allowance is checked
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
  if coalesce((select suspended from public.profiles where id = emp), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
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

-- a hidden post takes no applications
create or replace function public.check_acceptance_hidden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.posts where id = new.post_id and hidden) then raise exception 'not_open' using errcode = 'P0001'; end if;
  return new;
end;
$$;
drop trigger if exists acceptances_hidden on public.acceptances;
create trigger acceptances_hidden before insert on public.acceptances
  for each row execute function public.check_acceptance_hidden();

-- hidden posts: only their employer, administrators and people in their case still see them
drop policy if exists "signed-in people read posts" on public.posts;
create policy "signed-in people read posts" on public.posts
  for select to authenticated using (
    ((released_at > now() - interval '182 days' or is_sample) and not hidden)
    or employer_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.cases c where c.post_id = posts.id and c.seeker_id = auth.uid()));

-- the administrator's decision on a reported post
create or replace function public.moderate_post(p_post uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare emp uuid;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select employer_id into emp from public.posts where id = p_post for update;
  if not found then raise exception 'bad_state' using errcode = 'P0001'; end if;
  if p_action = 'dismiss' then
    update public.reports set status = 'dismissed' where post_id = p_post and status = 'open';
    perform set_config('call.moderating', 'on', true);
    update public.posts set hidden = false where id = p_post;
    perform set_config('call.moderating', 'off', true);
  elsif p_action = 'remove' then
    -- a case the agency is running keeps its post (suspend the employer instead)
    if exists (select 1 from public.cases where post_id = p_post and steps ? 'accepted' and not (steps ? 'arrived')) then
      raise exception 'case_started' using errcode = 'P0001';
    end if;
    delete from public.posts where id = p_post; -- its reports go with it
  elsif p_action = 'suspend' then
    if emp is null then raise exception 'bad_state' using errcode = 'P0001'; end if; -- sample posts have no employer
    update public.reports set status = 'upheld' where status = 'open' and post_id in (select id from public.posts where employer_id = emp);
    update public.profiles set suspended = true where id = emp;
    perform set_config('call.moderating', 'on', true);
    update public.posts set hidden = true where employer_id = emp;
    perform set_config('call.moderating', 'off', true);
  else
    raise exception 'bad_state' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.moderate_post(uuid, text) from public, anon;
grant execute on function public.moderate_post(uuid, text) to authenticated;
