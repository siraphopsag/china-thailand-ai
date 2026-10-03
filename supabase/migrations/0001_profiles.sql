-- C.A.L.L. — accounts (Oct 2026). Run once in Supabase: Dashboard → SQL Editor → paste this file → Run.
-- Safe to run again (it only creates what is missing and replaces the functions/policies).
--
-- One row per signed-in person, created automatically on first Google sign-in. Only what the app needs is kept:
-- name, e-mail, picture link, role and dates. Row level security: a person reads only their own row; administrators read all.
-- Nobody can change a role from the website — the owner sets administrators here, in the SQL Editor (see the end of the file).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

alter table public.profiles enable row level security;

-- is the current visitor an administrator? (security definer: reads profiles without going through its own policies)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select to authenticated
  using (public.is_admin());
-- no insert / update / delete policies: rows are written only by the trigger below and by the owner in the SQL Editor

-- create or refresh the profile when someone signs in (first time and every later sign-in)
create or replace function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, last_sign_in_at)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.last_sign_in_at
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    last_sign_in_at = excluded.last_sign_in_at;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_user_sign_in();

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_sign_in();

-- "Delete my account" (PDPA right to erasure): removes the signed-in person; their profile goes with it (on delete cascade)
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- keep-alive for the free plan (it pauses after 7 quiet days): the daily GitHub Action calls this; it reveals nothing
create or replace function public.ping()
returns timestamptz
language sql
stable
as $$
  select now();
$$;
grant execute on function public.ping() to anon, authenticated;

-- ── Make yourself an administrator (after your first sign-in on the website) ──
-- update public.profiles set role = 'admin' where email = 'your.address@gmail.com';
-- Check: select email, role, created_at from public.profiles order by created_at;
