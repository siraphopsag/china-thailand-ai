-- C.A.L.L. — a demo account walks its own case all the way (owner, 27 Nov 2026: a friend testing with the demo account could not
-- reach the documents and training, because only the C.A.L.L. team moves a case on). Run once in Supabase → SQL Editor AFTER
-- 0021_demo_full.sql. Safe to run again.
--
--  • case_action: as in 0006, plus a demo account may take the team's steps (accept the case, documents, tests, training, permit,
--    departure, arrival) on a case it is part of — never on anyone else's. Ordinary accounts are unchanged.
--  • demo_sample_answer: as in 0021, plus a case the simulated employer accepts goes to the team at once (a simulated employer
--    has no account, so its case would otherwise wait for an employer verification that can never come).

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
  own boolean; -- 0022: a demo account acts as the team on its own case
begin
  select * into c from public.cases where id = p_id for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  own := public.is_demo_user() and (c.seeker_id = auth.uid() or c.employer_id = auth.uid());
  if p_action = 'arrived' then
    if c.employer_id is distinct from auth.uid() and not public.is_admin() and not own then raise exception 'not_allowed' using errcode = '42501'; end if;
  elsif not public.is_admin() and not own then
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
grant execute on function public.case_action(uuid, text, text, text) to authenticated;

create or replace function public.demo_sample_answer(p_acc uuid, p_confirm boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare st text; pid uuid;
begin
  if not public.is_demo_user() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select a.status, a.post_id into st, pid from public.acceptances a join public.posts p on p.id = a.post_id
    where a.id = p_acc and a.seeker_id = auth.uid() and p.demo_for = auth.uid() for update of a;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  if st <> 'accepted' then raise exception 'bad_state' using errcode = 'P0001'; end if;
  update public.acceptances set status = case when p_confirm then 'confirmed' else 'rejected' end, decided_at = now() where id = p_acc;
  if p_confirm then -- the case opened by after_acceptance_confirmed goes to the team at once
    update public.acceptances set status = 'forwarded' where id = p_acc;
    update public.cases set steps = steps || jsonb_build_object('submitted', now()), updated_at = now() where acceptance_id = p_acc and not (steps ? 'submitted');
  end if;
  perform public.promote_reserved(pid);
end;
$$;
revoke all on function public.demo_sample_answer(uuid, boolean) from public, anon;
grant execute on function public.demo_sample_answer(uuid, boolean) to authenticated;
