-- 0009 · Counting uses of the real AI (owner, Oct 2026 — "A + B": AI check before posting, AI legal Q&A).
-- The server function (api/ai.ts) calls ai_take() AS THE SIGNED-IN PERSON before every AI call: 20 uses a day per person and kind,
-- 1000 a day for the whole site (cost guard), administrators unlimited. Nobody reads or writes the table directly.
-- Safe to run more than once.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('check', 'ask')),
  n int not null default 0,
  primary key (user_id, day, kind)
);
alter table public.ai_usage enable row level security; -- no policies: only ai_take() (security definer) touches it
revoke all on public.ai_usage from anon, authenticated;

create or replace function public.ai_take(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Asia/Bangkok')::date;
  per_user constant int := 20;
  site_cap constant int := 1000;
  used int;
  site int;
begin
  if me is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if p_kind not in ('check', 'ask') then raise exception 'bad kind'; end if;
  if public.is_admin() then
    insert into public.ai_usage as u (user_id, day, kind, n) values (me, today, p_kind, 1)
      on conflict (user_id, day, kind) do update set n = u.n + 1;
    return jsonb_build_object('ok', true, 'left', null);
  end if;
  select coalesce(sum(n), 0) into site from public.ai_usage where day = today;
  if site >= site_cap then return jsonb_build_object('ok', false, 'reason', 'site'); end if;
  select n into used from public.ai_usage where user_id = me and day = today and kind = p_kind for update;
  if coalesce(used, 0) >= per_user then return jsonb_build_object('ok', false, 'reason', 'limit', 'left', 0); end if;
  insert into public.ai_usage as u (user_id, day, kind, n) values (me, today, p_kind, 1)
    on conflict (user_id, day, kind) do update set n = u.n + 1
    returning n into used;
  return jsonb_build_object('ok', true, 'left', per_user - used);
end;
$$;
revoke all on function public.ai_take(text) from public, anon;
grant execute on function public.ai_take(text) to authenticated;
