-- C.A.L.L. — employer verification and the case after a match (Oct 2026). Run once AFTER 0001, 0002 and 0003:
-- Supabase → SQL Editor → paste this file → Run. Safe to run again (it only adds what is missing, replaces functions/policies).
--
-- What it adds (owner, Oct 2026):
--   • employer verification: a company registration number (Thai juristic person number, 13 digits, or Chinese unified social
--     credit code, 18 characters) checked for its form and check digit here; an administrator approves it (verify_employer).
--     Each post carries "verified"; the website lets unverified posts reach levels 1–2 only and shows a warning.
--   • cases: when an employer confirms a job seeker, a case opens and goes to the employment agency at once (if the employer is
--     verified, otherwise as soon as they are). It is followed in 9 steps: opened → submitted → accepted by the agency →
--     documents → language/skill tests → courses before departure → work permit/visa → departure day → arrived.
--     In the prototype an administrator plays the agency (case_action); the employer confirms the arrival.
--     Documents are a checklist only: no files and no identity numbers of people are stored.
--   • a seeker cannot withdraw once the case has gone to the agency; an employer cannot delete a post whose case the agency has
--     taken; posts with a running case do not expire.

-- ───────────── employer verification ─────────────
alter table public.profiles add column if not exists verify_country text check (verify_country in ('TH', 'CN'));
alter table public.profiles add column if not exists verify_reg text check (char_length(verify_reg) <= 18);
alter table public.profiles add column if not exists verify_status text check (verify_status in ('pending', 'verified', 'rejected'));
alter table public.profiles add column if not exists verify_at timestamptz;
alter table public.profiles add column if not exists verify_decided_at timestamptz;
grant update (verify_country, verify_reg) on public.profiles to authenticated; -- the status only through verify_employer()

-- Thai juristic person number: 13 digits, the last a check digit
create or replace function public.th_juristic_ok(v text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare s int := 0; i int;
begin
  if v is null or v !~ '^[0-9]{13}$' then return false; end if;
  for i in 1..12 loop s := s + substr(v, i, 1)::int * (14 - i); end loop;
  return (11 - s % 11) % 10 = substr(v, 13, 1)::int;
end;
$$;
-- Chinese unified social credit code: 18 characters from 31 symbols, the last a check character
create or replace function public.uscc_ok(v text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare chars text := '0123456789ABCDEFGHJKLMNPQRTUWXY'; w int[] := array[1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]; s int := 0; i int; c int;
begin
  if v is null or v !~ '^[0-9A-HJ-NPQRTUWXY]{18}$' then return false; end if;
  for i in 1..17 loop s := s + (strpos(chars, substr(v, i, 1)) - 1) * w[i]; end loop;
  c := 31 - s % 31; if c = 31 then c := 0; end if;
  return substr(chars, c + 1, 1) = substr(v, 18, 1);
end;
$$;

-- a new or changed number is checked and waits for approval; only verify_employer() changes the status
create or replace function public.check_profile_verify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verify_reg is distinct from old.verify_reg or new.verify_country is distinct from old.verify_country then
    if new.verify_reg is null then
      new.verify_country := null; new.verify_status := null; new.verify_at := null; new.verify_decided_at := null;
    else
      if not (case new.verify_country when 'TH' then public.th_juristic_ok(new.verify_reg) when 'CN' then public.uscc_ok(new.verify_reg) else false end) then
        raise exception 'bad_reg_no' using errcode = 'P0001';
      end if;
      new.verify_status := 'pending'; new.verify_at := now(); new.verify_decided_at := null;
    end if;
  elsif coalesce(current_setting('call.verifying', true), '') <> 'on' then
    new.verify_status := old.verify_status; new.verify_at := old.verify_at; new.verify_decided_at := old.verify_decided_at;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_verify on public.profiles;
create trigger profiles_verify before update on public.profiles
  for each row execute function public.check_profile_verify();

-- posts carry the employer's verification (kept in step by the triggers below, never set from the website)
alter table public.posts add column if not exists verified boolean not null default false;
update public.posts set verified = true where is_sample and company <> 'Example Precision Parts' and not verified; -- the samples (one stays unverified, as in the demo)

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
      new.verified := coalesce((select verify_status = 'verified' from public.profiles where id = new.employer_id), false);
    end if;
    new.released_at := coalesce(new.released_at, new.created_at);
  else
    new.created_at := old.created_at; new.employer_id := old.employer_id; new.is_sample := old.is_sample;
    -- fewer people than already hold a place cannot be asked for
    if new.headcount is distinct from old.headcount and coalesce(new.headcount, 1) <
       (select count(*) from public.acceptances where post_id = old.id and status in ('accepted', 'confirmed', 'forwarded')) then
      raise exception 'below_held' using errcode = 'P0001';
    end if;
    -- only renew_post() moves the release time; only a verification change moves "verified"
    if coalesce(current_setting('call.renewing', true), '') <> 'on' then new.released_at := old.released_at; end if;
    if coalesce(current_setting('call.syncing', true), '') <> 'on' then new.verified := old.verified; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ───────────── cases ─────────────
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  acceptance_id uuid not null unique references public.acceptances (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  seeker_id uuid not null references auth.users (id) on delete cascade,
  employer_id uuid references auth.users (id) on delete cascade,
  steps jsonb not null default '{}'::jsonb,
  docs jsonb not null default '{}'::jsonb,
  tests jsonb not null default '{}'::jsonb,
  permit jsonb not null default '{}'::jsonb,
  trainings jsonb not null default '[{"id":"orient","name":"@orient","done":false},{"id":"lang","name":"@lang","done":false},{"id":"law","name":"@law","done":false},{"id":"safety","name":"@safety","done":false}]'::jsonb,
  departure_date date,
  note text not null default '' check (char_length(note) <= 300 and public.no_contact(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cases_employer on public.cases (employer_id);
create index if not exists cases_seeker on public.cases (seeker_id);
alter table public.cases enable row level security;
drop policy if exists "people involved read cases" on public.cases;
create policy "people involved read cases" on public.cases
  for select to authenticated using (seeker_id = auth.uid() or employer_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.cases from anon, authenticated; -- written only by the functions below

-- hand waiting cases of an employer to the agency (when the employer is verified)
create or replace function public.submit_waiting_cases(p_employer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.acceptances set status = 'forwarded'
    where status = 'confirmed' and id in (select acceptance_id from public.cases where employer_id = p_employer and not (steps ? 'submitted'));
  update public.cases set steps = steps || jsonb_build_object('submitted', now()), updated_at = now()
    where employer_id = p_employer and not (steps ? 'submitted');
end;
$$;
revoke all on function public.submit_waiting_cases(uuid) from public, anon, authenticated;

-- the employer confirms → a case opens (and goes to the agency at once if the employer is verified)
create or replace function public.after_acceptance_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare emp uuid; ver boolean;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    select employer_id, verified into emp, ver from public.posts where id = new.post_id;
    insert into public.cases (acceptance_id, post_id, seeker_id, employer_id, steps)
      values (new.id, new.post_id, new.seeker_id, emp, jsonb_build_object('opened', now()))
      on conflict (acceptance_id) do nothing;
    if coalesce(ver, false) and emp is not null then perform public.submit_waiting_cases(emp); end if;
  end if;
  return null;
end;
$$;
drop trigger if exists acceptances_case on public.acceptances;
create trigger acceptances_case after update on public.acceptances
  for each row execute function public.after_acceptance_confirmed();

-- a verification decided by the agency: posts follow it; a verified employer's waiting cases go to the agency
create or replace function public.after_profile_verify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verify_status is distinct from old.verify_status then
    perform set_config('call.syncing', 'on', true);
    update public.posts set verified = (new.verify_status = 'verified') where employer_id = new.id;
    perform set_config('call.syncing', 'off', true);
    if new.verify_status = 'verified' then perform public.submit_waiting_cases(new.id); end if;
  end if;
  return null;
end;
$$;
drop trigger if exists profiles_verify_after on public.profiles;
create trigger profiles_verify_after after update on public.profiles
  for each row execute function public.after_profile_verify();

create or replace function public.verify_employer(p_user uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  perform set_config('call.verifying', 'on', true);
  update public.profiles set verify_status = case when p_ok then 'verified' else 'rejected' end, verify_decided_at = now()
    where id = p_user and verify_reg is not null;
  if not found then raise exception 'bad_state' using errcode = 'P0001'; end if;
  perform set_config('call.verifying', 'off', true);
end;
$$;
revoke all on function public.verify_employer(uuid, boolean) from public, anon;
grant execute on function public.verify_employer(uuid, boolean) to authenticated;

-- one step of a case: the agency (an administrator in the prototype) does everything except the arrival, which the employer
-- confirms. Steps go in order; a checklist step completes by itself when every item is ticked.
create or replace function public.case_action(p_id uuid, p_action text, p_key text default null, p_value text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cases%rowtype;
  order_ text[] := array['opened', 'submitted', 'accepted', 'documents', 'tests', 'training', 'permit', 'departure', 'arrived'];
  cur text := null; i int; t jsonb;
  flag boolean;
begin
  select * into c from public.cases where id = p_id for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_action = 'arrived' then
    if c.employer_id is distinct from auth.uid() and not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  elsif not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  for i in 1..9 loop if not (c.steps ? order_[i]) then cur := order_[i]; exit; end if; end loop;

  if p_action = 'accept' then
    if cur is distinct from 'accepted' then raise exception 'bad_state' using errcode = 'P0001'; end if;
    c.steps := c.steps || jsonb_build_object('accepted', now());
  elsif p_action = 'doc' then
    if cur is distinct from 'documents' or p_key not in ('passport', 'health', 'contract') then raise exception 'bad_state' using errcode = 'P0001'; end if;
    flag := coalesce((c.docs ->> p_key)::boolean, false);
    c.docs := c.docs || jsonb_build_object(p_key, not flag);
    if coalesce((c.docs ->> 'passport')::boolean, false) and coalesce((c.docs ->> 'health')::boolean, false) and coalesce((c.docs ->> 'contract')::boolean, false) then
      c.steps := c.steps || jsonb_build_object('documents', now());
    end if;
  elsif p_action = 'test' then
    if cur is distinct from 'tests' or p_key not in ('language', 'skill') then raise exception 'bad_state' using errcode = 'P0001'; end if;
    flag := coalesce((c.tests ->> p_key)::boolean, false);
    c.tests := c.tests || jsonb_build_object(p_key, not flag);
    if coalesce((c.tests ->> 'language')::boolean, false) and coalesce((c.tests ->> 'skill')::boolean, false) then
      c.steps := c.steps || jsonb_build_object('tests', now());
    end if;
  elsif p_action = 'train' then
    if cur is distinct from 'training' or not exists (select 1 from jsonb_array_elements(c.trainings) e where e ->> 'id' = p_key) then
      raise exception 'bad_state' using errcode = 'P0001';
    end if;
    select jsonb_agg(case when x.e ->> 'id' = p_key then jsonb_set(x.e, '{done}', to_jsonb(not coalesce((x.e ->> 'done')::boolean, false))) else x.e end order by x.ord)
      into t from jsonb_array_elements(c.trainings) with ordinality as x(e, ord);
    c.trainings := t;
    if not exists (select 1 from jsonb_array_elements(t) e where not coalesce((e ->> 'done')::boolean, false)) then
      c.steps := c.steps || jsonb_build_object('training', now());
    end if;
  elsif p_action = 'train_add' then
    if c.steps ? 'training' or not (c.steps ? 'submitted') or jsonb_array_length(c.trainings) >= 12
       or p_value is null or char_length(btrim(p_value)) not between 2 and 60 or btrim(p_value) <> p_value or not public.no_contact(p_value) then
      raise exception 'bad_state' using errcode = 'P0001';
    end if;
    c.trainings := c.trainings || jsonb_build_array(jsonb_build_object('id', 't' || substr(md5(random()::text), 1, 8), 'name', p_value, 'done', false));
  elsif p_action = 'train_remove' then
    if c.steps ? 'training' or not exists (select 1 from jsonb_array_elements(c.trainings) e where e ->> 'id' = p_key) or jsonb_array_length(c.trainings) <= 1 then
      raise exception 'bad_state' using errcode = 'P0001';
    end if;
    select jsonb_agg(x.e order by x.ord) into t from jsonb_array_elements(c.trainings) with ordinality as x(e, ord) where x.e ->> 'id' <> p_key;
    c.trainings := t;
    if cur = 'training' and not exists (select 1 from jsonb_array_elements(t) e where not coalesce((e ->> 'done')::boolean, false)) then
      c.steps := c.steps || jsonb_build_object('training', now());
    end if;
  elsif p_action = 'permit' then
    if cur is distinct from 'permit' or p_key not in ('workPermit', 'visa') then raise exception 'bad_state' using errcode = 'P0001'; end if;
    flag := coalesce((c.permit ->> p_key)::boolean, false);
    c.permit := c.permit || jsonb_build_object(p_key, not flag);
    if coalesce((c.permit ->> 'workPermit')::boolean, false) and coalesce((c.permit ->> 'visa')::boolean, false) then
      c.steps := c.steps || jsonb_build_object('permit', now());
    end if;
  elsif p_action = 'departure' then
    if cur is distinct from 'departure' or p_value !~ '^\d{4}-\d{2}-\d{2}$' or p_value::date < current_date then raise exception 'bad_state' using errcode = 'P0001'; end if;
    c.departure_date := p_value::date;
  elsif p_action = 'depart_ok' then
    if cur is distinct from 'departure' or c.departure_date is null then raise exception 'bad_state' using errcode = 'P0001'; end if;
    c.steps := c.steps || jsonb_build_object('departure', now());
  elsif p_action = 'note' then
    if p_value is null or char_length(p_value) > 300 or not public.no_contact(p_value) then raise exception 'bad_state' using errcode = 'P0001'; end if;
    c.note := p_value;
  elsif p_action = 'arrived' then
    if cur is distinct from 'arrived' then raise exception 'bad_state' using errcode = 'P0001'; end if;
    c.steps := c.steps || jsonb_build_object('arrived', now());
  else
    raise exception 'bad_state' using errcode = 'P0001';
  end if;
  update public.cases set steps = c.steps, docs = c.docs, tests = c.tests, permit = c.permit, trainings = c.trainings,
    departure_date = c.departure_date, note = c.note, updated_at = now() where id = p_id;
end;
$$;
revoke all on function public.case_action(uuid, text, text, text) from public, anon;
grant execute on function public.case_action(uuid, text, text, text) to authenticated;

-- a seeker cannot withdraw once the case has gone to the agency (deleting an account, or a post being removed, still works)
create or replace function public.check_withdraw()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.seeker_id
     and exists (select 1 from public.posts where id = old.post_id)
     and exists (select 1 from auth.users where id = old.seeker_id)
     and exists (select 1 from public.cases where acceptance_id = old.id and steps ? 'submitted') then
    raise exception 'case_started' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
drop trigger if exists acceptances_withdraw on public.acceptances;
create trigger acceptances_withdraw before delete on public.acceptances
  for each row execute function public.check_withdraw();

-- an employer cannot delete a post whose case the agency has taken and that has not finished (deleting the account still works)
create or replace function public.check_post_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() = old.employer_id
     and exists (select 1 from auth.users where id = old.employer_id)
     and exists (select 1 from public.cases where post_id = old.id and steps ? 'accepted' and not (steps ? 'arrived')) then
    raise exception 'case_started' using errcode = 'P0001';
  end if;
  return old;
end;
$$;
drop trigger if exists posts_delete on public.posts;
create trigger posts_delete before delete on public.posts
  for each row execute function public.check_post_delete();

-- people in a case still see its post after the 6 months; such posts are not cleaned up while the case runs
drop policy if exists "signed-in people read posts" on public.posts;
create policy "signed-in people read posts" on public.posts
  for select to authenticated using (
    released_at > now() - interval '182 days' or is_sample or employer_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.cases c where c.post_id = posts.id and c.seeker_id = auth.uid()));
create or replace function public.purge_expired()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.posts p where not p.is_sample and p.released_at <= now() - interval '182 days'
    and not exists (select 1 from public.cases c where c.post_id = p.id and not (c.steps ? 'arrived'));
  delete from public.pins where created_at <= now() - interval '30 days';
$$;
revoke all on function public.purge_expired() from public, anon;
grant execute on function public.purge_expired() to authenticated;
