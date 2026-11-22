-- C.A.L.L. — arrival confirmed by both sides (v2 model, owner Nov 2026). Run once in Supabase → SQL Editor after
-- 0012_ai_hold.sql. Safe to run again.
--  • Until now only the employer confirmed that the worker had arrived (case_action 'arrived', the last of the 9 steps). The worker
--    now confirms too: the website shows "arrival confirmed by both sides" only when both have, and raises an alert when the
--    departure day is more than 2 days past and either confirmation is missing (the alert is worked out on the website).
--  • The employer's confirmation stays the 9th step (unchanged); the worker's is a separate time, seeker_arrived_at, set once by
--    the case's own worker through case_seeker_arrived(), and only after the departure step is done.
--  • Websites from before this file keep working: they never read the new column. Without this file the worker's button reports
--    "the database is older than the website" and nothing else changes.

alter table public.cases add column if not exists seeker_arrived_at timestamptz; -- when the worker confirmed the arrival (null = not yet)

create or replace function public.case_seeker_arrived(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare c public.cases%rowtype;
begin
  select * into c from public.cases where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if c.seeker_id is distinct from auth.uid() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if c.steps ->> 'departure' is null or c.seeker_arrived_at is not null then raise exception 'bad_state' using errcode = 'P0001'; end if;
  update public.cases set seeker_arrived_at = now() where id = p_id;
end;
$$;
revoke all on function public.case_seeker_arrived(uuid) from public, anon;
grant execute on function public.case_seeker_arrived(uuid) to authenticated;
