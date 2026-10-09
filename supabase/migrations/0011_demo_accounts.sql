-- C.A.L.L. — demo accounts (owner, Oct 2026). Run once AFTER 0010 (safe to run again).
-- "Try it without signing up": the website signs a visitor in with a Supabase anonymous account (Authentication → Sign In / Providers →
-- turn on "Allow anonymous sign-ins"). Each one gets its own running number — บัญชีทดลอง 001, 002, … — so people trying at the same
-- time can tell their accounts apart (the website shows it as 体验账号 001 / Demo account 001 in Chinese and English). A demo account can
-- do everything a normal account can. Its posts carry a "demo account" label, and demo accounts with everything they made are removed
-- 7 days after they were created (the twice-daily keep-alive ping runs the clean-up).

create sequence if not exists public.demo_account_seq;

-- profiles: as in 0001, plus the running number for anonymous accounts (kept on later sign-ins)
create or replace function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare nm text;
begin
  if coalesce(new.is_anonymous, false) then
    select full_name into nm from public.profiles where id = new.id;
    if nm is null or nm = '' then nm := 'บัญชีทดลอง ' || lpad(nextval('public.demo_account_seq')::text, 3, '0'); end if;
    insert into public.profiles (id, email, full_name, last_sign_in_at) values (new.id, '', nm, new.last_sign_in_at)
    on conflict (id) do update set full_name = nm, last_sign_in_at = excluded.last_sign_in_at;
    return new;
  end if;
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

-- posts made by a demo account say so (set by the database, never by the website)
alter table public.posts add column if not exists is_demo boolean not null default false;
create or replace function public.mark_demo_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.is_demo := coalesce((select is_anonymous from auth.users where id = new.employer_id), false);
  else
    new.is_demo := old.is_demo;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_mark_demo on public.posts;
create trigger posts_mark_demo before insert or update on public.posts for each row execute function public.mark_demo_post();

-- clean-up (also run by the keep-alive ping): as in 0003, plus demo accounts older than 7 days with everything they made
create or replace function public.purge_expired()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.posts where not is_sample and released_at <= now() - interval '182 days';
  delete from public.pins where created_at <= now() - interval '30 days';
  delete from auth.users where is_anonymous and created_at <= now() - interval '7 days';
$$;
revoke all on function public.purge_expired() from public, anon;
grant execute on function public.purge_expired() to authenticated;
