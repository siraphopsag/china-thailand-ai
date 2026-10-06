-- C.A.L.L. — calendar appointments and admin analytics (owner, Oct 2026). Run once in Supabase → SQL Editor after
-- 0005_reports.sql (guide step 15). Safe to run again.
--  • cases.dates: appointment days the agency sets (documents, the two tests, the first working day); courses carry their own
--    "date" inside trainings. case_action() gains 'date' and 'train_date'.
--  • daily_visits: one number per day. track_visit() adds 1; the website calls it once per browser per day and sends nothing
--    that identifies the visitor (no id, no IP stored, no cookie).
--  • admin_daily(days): totals per day for the administrator's charts (visits, sign-ups, posts, applications, cases, reports).
-- Days follow Thai time (Asia/Bangkok).

alter table public.cases add column if not exists dates jsonb not null default '{}'::jsonb;

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
  -- appointments (calendar): once the case is with the agency and until the worker arrives; a day from today on, or null = clear
  elsif p_action in ('date', 'train_date') then
    if not (c.steps ? 'submitted') or c.steps ? 'arrived' then raise exception 'bad_state' using errcode = 'P0001'; end if;
    if p_value is not null and (p_value !~ '^\d{4}-\d{2}-\d{2}$' or p_value::date < (now() at time zone 'Asia/Bangkok')::date - 1) then
      raise exception 'bad_state' using errcode = 'P0001';
    end if;
    if p_action = 'date' then
      if p_key not in ('documents', 'language', 'skill', 'start') then raise exception 'bad_state' using errcode = 'P0001'; end if;
      c.dates := case when p_value is null then c.dates - p_key else c.dates || jsonb_build_object(p_key, p_value) end;
    else
      if not exists (select 1 from jsonb_array_elements(c.trainings) e where e ->> 'id' = p_key) then raise exception 'bad_state' using errcode = 'P0001'; end if;
      select jsonb_agg(case when x.e ->> 'id' = p_key then (case when p_value is null then x.e - 'date' else x.e || jsonb_build_object('date', p_value) end) else x.e end order by x.ord)
        into t from jsonb_array_elements(c.trainings) with ordinality as x(e, ord);
      c.trainings := t;
    end if;
  else
    raise exception 'bad_state' using errcode = 'P0001';
  end if;
  update public.cases set steps = c.steps, docs = c.docs, tests = c.tests, permit = c.permit, trainings = c.trainings,
    departure_date = c.departure_date, note = c.note, dates = c.dates, updated_at = now() where id = p_id;
end;
$$;
revoke all on function public.case_action(uuid, text, text, text) from public, anon;
grant execute on function public.case_action(uuid, text, text, text) to authenticated;

create table if not exists public.daily_visits (
  day date primary key,
  visits int not null default 0 check (visits >= 0)
);
alter table public.daily_visits enable row level security;
drop policy if exists "admins read visits" on public.daily_visits;
create policy "admins read visits" on public.daily_visits for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.daily_visits from anon, authenticated; -- only track_visit() writes

create or replace function public.track_visit()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.daily_visits (day, visits) values ((now() at time zone 'Asia/Bangkok')::date, 1)
  on conflict (day) do update set visits = public.daily_visits.visits + 1;
$$;
revoke all on function public.track_visit() from public;
grant execute on function public.track_visit() to anon, authenticated;

create or replace function public.admin_daily(p_days int)
returns table (day date, visits int, signups int, posts int, applications int, cases int, reports int)
language plpgsql
security definer
set search_path = ''
as $$
declare today date := (now() at time zone 'Asia/Bangkok')::date; n int := least(greatest(coalesce(p_days, 30), 1), 400);
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query
  with d as (select (today - g)::date as day from generate_series(0, n - 1) g),
  pr as (select (created_at at time zone 'Asia/Bangkok')::date as day, count(*)::int as k from public.profiles group by 1),
  po as (select (created_at at time zone 'Asia/Bangkok')::date as day, count(*)::int as k from public.posts where not is_sample group by 1),
  ac as (select (created_at at time zone 'Asia/Bangkok')::date as day, count(*)::int as k from public.acceptances group by 1),
  ca as (select (created_at at time zone 'Asia/Bangkok')::date as day, count(*)::int as k from public.cases group by 1),
  re as (select (created_at at time zone 'Asia/Bangkok')::date as day, count(*)::int as k from public.reports group by 1)
  select d.day, coalesce(v.visits, 0), coalesce(pr.k, 0), coalesce(po.k, 0), coalesce(ac.k, 0), coalesce(ca.k, 0), coalesce(re.k, 0)
  from d
  left join public.daily_visits v on v.day = d.day
  left join pr on pr.day = d.day left join po on po.day = d.day left join ac on ac.day = d.day left join ca on ca.day = d.day left join re on re.day = d.day
  order by d.day;
end;
$$;
revoke all on function public.admin_daily(int) from public, anon;
grant execute on function public.admin_daily(int) to authenticated;
