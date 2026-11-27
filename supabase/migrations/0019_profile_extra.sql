-- C.A.L.L. — the shop or company, and the job seeker's work history (owner's blueprint, 27 Nov 2026). Run once in Supabase →
-- SQL Editor AFTER 0018_worker_reviews.sql. Safe to run again.
--
--  • profiles.business (employer): about (≤ 400 characters), industry, size, the year it started.
--  • profiles.work (job seeker): up to 5 past jobs (role, country, years) and a short "what I can show" (≤ 300 characters).
--  • Both: no contact details (no_contact, 0015) and a size limit; only the person writes their own (column grant).
--  • Reading: profiles stay private (0001). Others read only through the two functions below: employer_about for anyone signed in
--    (it is the business' public description), applicant_work for an employer about people who applied to their posts, the
--    person themselves and the team.

alter table public.profiles add column if not exists business jsonb not null default '{}'::jsonb
  check (jsonb_typeof(business) = 'object' and char_length(business::text) <= 1200 and public.no_contact(business::text));
alter table public.profiles add column if not exists work jsonb not null default '{}'::jsonb
  check (jsonb_typeof(work) = 'object' and char_length(work::text) <= 2000 and public.no_contact(work::text)
         and coalesce(jsonb_array_length(case when jsonb_typeof(work -> 'jobs') = 'array' then work -> 'jobs' else '[]'::jsonb end), 0) <= 5);
grant update (business, work) on public.profiles to authenticated;

create or replace function public.employer_about(p_employer uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then '{}'::jsonb else coalesce((select business from public.profiles where id = p_employer), '{}'::jsonb) end;
$$;
revoke all on function public.employer_about(uuid) from public, anon;
grant execute on function public.employer_about(uuid) to authenticated;

create or replace function public.applicant_work(p_seeker uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_seeker = auth.uid() or public.is_admin()
              or exists (select 1 from public.acceptances a join public.posts p on p.id = a.post_id where a.seeker_id = p_seeker and p.employer_id = auth.uid())
         then coalesce((select work from public.profiles where id = p_seeker), '{}'::jsonb) else '{}'::jsonb end;
$$;
revoke all on function public.applicant_work(uuid) from public, anon;
grant execute on function public.applicant_work(uuid) to authenticated;
