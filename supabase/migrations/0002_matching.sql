-- C.A.L.L. — job posts, pins and acceptances in the database (Oct 2026). Run once AFTER 0001_profiles.sql:
-- Supabase → SQL Editor → paste this file → Run. Safe to run again (it only adds what is missing, replaces functions/policies).
--
-- Who may do what is enforced here (row level security), not in the website:
--   • posts      — every signed-in person can read; an employer adds, edits and deletes only their own; admins delete any
--   • pins       — a job seeker sees and manages only their own (max 5)
--   • acceptances— the seeker who accepted, the employer of the post and admins can read; only admins forward a case
-- Limits are checked here too: 3 posts per rolling 7 days (10 for members), 5 pins per seeker, no contact details in text.

-- ───────────── profile settings a person may change themselves ─────────────
alter table public.profiles add column if not exists user_type text check (user_type in ('seeker', 'employer'));
alter table public.profiles add column if not exists company text not null default '' check (char_length(company) <= 80);
alter table public.profiles add column if not exists origin_country text check (origin_country in ('TH', 'CN'));
alter table public.profiles add column if not exists origin_province text check (origin_province ~ '^(TH-[0-9]{2}|CN-[A-Z]{2})$');
alter table public.profiles add column if not exists member boolean not null default false; -- simulated package (no payment)

-- only these columns can be changed from the website — never role, e-mail or dates
revoke update on public.profiles from anon, authenticated;
grant update (user_type, company, origin_country, origin_province, member) on public.profiles to authenticated;
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- text that looks like contact details (e-mail, link, phone/ID-like digit runs) is refused, like in the website
create or replace function public.no_contact(t text)
returns boolean
language sql
immutable
as $$
  select t is null or not (t ~* '[^\s@]+@[^\s@]+' or t ~* '(https?://|www\.)' or t ~ '\d[\d\s-]{6,}\d');
$$;

-- ───────────── job posts ─────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references auth.users (id) on delete cascade default auth.uid(), -- null only for the sample posts below
  is_sample boolean not null default false,
  company text not null check (char_length(company) between 2 and 80 and public.no_contact(company)),
  position text not null check (char_length(position) between 2 and 80 and public.no_contact(position)),
  industry text not null check (industry in ('manufacturing', 'technology', 'hospitality', 'food_service', 'education', 'logistics', 'finance')),
  skills text[] not null check (cardinality(skills) between 1 and 12),
  min_years int not null default 0 check (min_years between 0 and 50),
  details text not null default '' check (char_length(details) <= 1000 and public.no_contact(details)),
  headcount int check (headcount between 1 and 99),
  employment text check (employment in ('permanent', 'contract', 'temporary', 'internship')),
  salary_min int check (salary_min > 0),
  salary_max int check (salary_max > 0),
  salary_currency text check (salary_currency in ('THB', 'CNY')),
  start_date date,
  languages jsonb not null default '[]'::jsonb check (jsonb_typeof(languages) = 'array' and jsonb_array_length(languages) <= 3),
  education text not null default 'none' check (education in ('none', 'lower_secondary', 'secondary', 'vocational', 'high_vocational', 'bachelor', 'master', 'doctorate')),
  benefits text[] not null default '{}' check (cardinality(benefits) <= 4 and benefits <@ array['housing', 'meals', 'insurance', 'workDocs']),
  country text not null check (country in ('TH', 'CN')),
  province text not null check (province ~ '^(TH-[0-9]{2}|CN-[A-Z]{2})$' and left(province, 2) = country),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((salary_min is null and salary_max is null and salary_currency is null) or (salary_min is not null and salary_max is not null and salary_currency is not null and salary_min <= salary_max)),
  check (is_sample or employer_id is not null)
);
create index if not exists posts_employer_created on public.posts (employer_id, created_at desc);
create index if not exists posts_place on public.posts (country, province);
alter table public.posts enable row level security;

drop policy if exists "signed-in people read posts" on public.posts;
create policy "signed-in people read posts" on public.posts
  for select to authenticated using (true);
drop policy if exists "employers add own posts" on public.posts;
create policy "employers add own posts" on public.posts
  for insert to authenticated with check (employer_id = auth.uid() and not is_sample);
drop policy if exists "employers edit own posts" on public.posts;
create policy "employers edit own posts" on public.posts
  for update to authenticated using (employer_id = auth.uid()) with check (employer_id = auth.uid() and not is_sample);
drop policy if exists "employers or admins delete posts" on public.posts;
create policy "employers or admins delete posts" on public.posts
  for delete to authenticated using (employer_id = auth.uid() or public.is_admin());

-- weekly allowance (3, or 10 with the simulated membership) and edit timestamps
create or replace function public.check_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare used int; lim int;
begin
  if tg_op = 'INSERT' and not new.is_sample then
    select count(*) into used from public.posts where employer_id = new.employer_id and created_at > now() - interval '7 days';
    select case when coalesce(member, false) then 10 else 3 end into lim from public.profiles where id = new.employer_id;
    if used >= coalesce(lim, 3) then raise exception 'quota' using errcode = 'P0001'; end if;
    new.created_at := now();
  end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; new.employer_id := old.employer_id; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists posts_check on public.posts;
create trigger posts_check before insert or update on public.posts
  for each row execute function public.check_post();

-- ───────────── pins (job seekers) ─────────────
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  seeker_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  country text not null check (country in ('TH', 'CN')),
  province text not null check (province ~ '^(TH-[0-9]{2}|CN-[A-Z]{2})$' and left(province, 2) = country),
  industry text not null check (industry in ('manufacturing', 'technology', 'hospitality', 'food_service', 'education', 'logistics', 'finance')),
  skills text[] not null check (cardinality(skills) between 1 and 12),
  created_at timestamptz not null default now()
);
create index if not exists pins_seeker on public.pins (seeker_id);
alter table public.pins enable row level security;

drop policy if exists "seekers read own pins" on public.pins;
create policy "seekers read own pins" on public.pins
  for select to authenticated using (seeker_id = auth.uid() or public.is_admin());
drop policy if exists "seekers add own pins" on public.pins;
create policy "seekers add own pins" on public.pins
  for insert to authenticated with check (seeker_id = auth.uid());
drop policy if exists "seekers delete own pins" on public.pins;
create policy "seekers delete own pins" on public.pins
  for delete to authenticated using (seeker_id = auth.uid());

create or replace function public.check_pin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.pins where seeker_id = new.seeker_id) >= 5 then raise exception 'pin_limit' using errcode = 'P0001'; end if;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists pins_check on public.pins;
create trigger pins_check before insert on public.pins
  for each row execute function public.check_pin();

-- ───────────── acceptances ─────────────
create table if not exists public.acceptances (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  seeker_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  seeker_name text not null default '', -- copied from the seeker's profile by the database (the employer sees only this)
  status text not null default 'accepted' check (status in ('accepted', 'forwarded')),
  created_at timestamptz not null default now(),
  forwarded_at timestamptz,
  unique (post_id, seeker_id)
);
create index if not exists acceptances_post on public.acceptances (post_id);
alter table public.acceptances enable row level security;

drop policy if exists "people involved read acceptances" on public.acceptances;
create policy "people involved read acceptances" on public.acceptances
  for select to authenticated using (
    seeker_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = post_id and p.employer_id = auth.uid())
    or public.is_admin());
drop policy if exists "seekers accept" on public.acceptances;
create policy "seekers accept" on public.acceptances
  for insert to authenticated with check (
    seeker_id = auth.uid() and status = 'accepted'
    and not exists (select 1 from public.posts p where p.id = post_id and p.employer_id = auth.uid())); -- not your own post
drop policy if exists "admins forward" on public.acceptances;
create policy "admins forward" on public.acceptances
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.check_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.seeker_name := coalesce((select nullif(full_name, '') from public.profiles where id = new.seeker_id), 'Job seeker');
    new.created_at := now(); new.status := 'accepted'; new.forwarded_at := null;
  else
    new.post_id := old.post_id; new.seeker_id := old.seeker_id; new.seeker_name := old.seeker_name; new.created_at := old.created_at;
    new.forwarded_at := case when new.status = 'forwarded' then coalesce(old.forwarded_at, now()) else null end;
  end if;
  return new;
end;
$$;
drop trigger if exists acceptances_check on public.acceptances;
create trigger acceptances_check before insert or update on public.acceptances
  for each row execute function public.check_acceptance();

-- ───────────── numbers for the future admin page (administrators only) ─────────────
create or replace function public.admin_stats()
returns table (users bigint, employers bigint, seekers bigint, posts bigint, posts_7d bigint, acceptances bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where user_type = 'employer'),
    (select count(*) from public.profiles where user_type = 'seeker'),
    (select count(*) from public.posts where not is_sample),
    (select count(*) from public.posts where not is_sample and created_at > now() - interval '7 days'),
    (select count(*) from public.acceptances);
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ───────────── two invented sample posts so the site is not empty (added once) ─────────────
insert into public.posts (is_sample, employer_id, company, position, industry, skills, min_years, details, headcount, employment,
  salary_min, salary_max, salary_currency, start_date, languages, education, benefits, country, province)
select true, null, 'Sample Riverside Hotels', 'Front Office Manager', 'hospitality', array['hospitality_management'], 3,
  'Sample post for the prototype. Thai and Chinese guests; shift work.', 2, 'permanent', 9000, 12000, 'CNY', current_date + 30,
  '[{"lang":"zh","level":"professional"},{"lang":"th","level":"native"}]'::jsonb, 'bachelor', array['housing', 'meals', 'insurance'], 'CN', 'CN-SH'
where not exists (select 1 from public.posts where is_sample and company = 'Sample Riverside Hotels');
insert into public.posts (is_sample, employer_id, company, position, industry, skills, min_years, details, headcount, employment,
  salary_min, salary_max, salary_currency, start_date, languages, education, benefits, country, province)
select true, null, 'Example Precision Parts', 'Quality Control Engineer', 'manufacturing', array['quality_control'], 2,
  'Sample post for the prototype. Automotive parts line.', 3, 'contract', null, null, null, current_date + 45,
  '[{"lang":"zh","level":"conversational"}]'::jsonb, 'vocational', array['housing', 'workDocs'], 'CN', 'CN-JS'
where not exists (select 1 from public.posts where is_sample and company = 'Example Precision Parts');
