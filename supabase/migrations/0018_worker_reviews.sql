-- C.A.L.L. — closing the job: the employer reviews the worker too (owner's blueprint, 27 Nov 2026: "both sides review"). Run once
-- in Supabase → SQL Editor AFTER 0017_chat_strikes.sql. Safe to run again.
--
--  • worker_reviews: stars 1–5 and fixed points only (no free text), one per case, written only by the employer of the case through
--    worker_review_save(), and only once 30 days have passed since the arrival (the earlier of the two confirmations).
--  • Read: the worker and the employer of that case, and the team. Other employers get only the anonymous list of stars and
--    points through worker_reviews_of(), and only for job seekers who applied to their posts (like seeker_badges, 0014).

create table if not exists public.worker_reviews (
  case_id uuid primary key references public.cases (id) on delete cascade,
  seeker_id uuid not null references auth.users (id) on delete cascade,
  employer_id uuid not null references auth.users (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  good text[] not null default '{}' check (good <@ array['onTime', 'skilled', 'communicates', 'followsRules', 'teamwork']),
  bad text[] not null default '{}' check (bad <@ array['late', 'absent', 'poorWork', 'breaksRules', 'leftEarly']),
  at timestamptz not null default now()
);
create index if not exists worker_reviews_seeker on public.worker_reviews (seeker_id);
alter table public.worker_reviews enable row level security;
drop policy if exists "the two people of the case read the review" on public.worker_reviews;
create policy "the two people of the case read the review" on public.worker_reviews
  for select to authenticated using (seeker_id = auth.uid() or employer_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.worker_reviews from anon, authenticated; -- only through worker_review_save

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
  if arrived is null or now() < arrived + interval '29 days' then raise exception 'bad_state' using errcode = 'P0001'; end if;
  insert into public.worker_reviews (case_id, seeker_id, employer_id, stars, good, bad, at)
  values (c.id, c.seeker_id, c.employer_id, p_stars, coalesce(p_good, '{}'), coalesce(p_bad, '{}'), now())
  on conflict (case_id) do update set stars = excluded.stars, good = excluded.good, bad = excluded.bad, at = now();
end;
$$;
revoke all on function public.worker_review_save(uuid, int, text[], text[]) from public, anon;
grant execute on function public.worker_review_save(uuid, int, text[], text[]) to authenticated;

-- the anonymous reviews of one worker: for the worker, the team, and employers the worker applied to
create or replace function public.worker_reviews_of(p_seeker uuid)
returns table (stars int, good text[], bad text[], at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.stars, r.good, r.bad, r.at from public.worker_reviews r
  where r.seeker_id = p_seeker
    and (p_seeker = auth.uid() or public.is_admin()
         or exists (select 1 from public.acceptances a join public.posts p on p.id = a.post_id where a.seeker_id = p_seeker and p.employer_id = auth.uid()))
  order by r.at desc limit 200;
$$;
revoke all on function public.worker_reviews_of(uuid) from public, anon;
grant execute on function public.worker_reviews_of(uuid) to authenticated;
