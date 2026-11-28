-- C.A.L.L. — a demo account can review its worker without waiting 30 real days (owner, 28 Nov 2026: the demo account must be
-- able to try everything alone; its clock is moved on the page, but the database checked the real date). Run once in
-- Supabase → SQL Editor AFTER 0022_demo_case.sql. Safe to run again.
--
--  • worker_review_save: as in 0020, plus a demo account skips the 30-day wait on its own case (the worker must still have
--    arrived). Ordinary accounts are unchanged.

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
  if arrived is null or (not public.is_demo_user() and (now() at time zone 'Asia/Bangkok')::date < (arrived at time zone 'Asia/Bangkok')::date + 29) then
    raise exception 'bad_state' using errcode = 'P0001';
  end if;
  insert into public.worker_reviews (case_id, seeker_id, employer_id, stars, good, bad, at)
  values (c.id, c.seeker_id, c.employer_id, p_stars, coalesce(p_good, '{}'), coalesce(p_bad, '{}'), now())
  on conflict (case_id) do update set stars = excluded.stars, good = excluded.good, bad = excluded.bad, at = now();
end;
$$;
