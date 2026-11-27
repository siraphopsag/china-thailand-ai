-- C.A.L.L. — verify before posting or pinning (owner's blueprint, 27 Nov 2026: "not verified = cannot post or pin"). Run once in
-- Supabase → SQL Editor AFTER 0015_contact_rules.sql. Safe to run again: it only replaces one function and two triggers.
--
--  • An employer with nothing sent yet (no registration number, no confirmed mobile) cannot add a post. A request waiting for the
--    team ("partly verified") is enough to post; as before, the team's approval decides how far a post reaches.
--  • A job seeker without a confirmed mobile number cannot add a pin. The passport makes them fully verified, but is not needed to pin.
--  • Administrators are not checked (everything they post is sample data), nor is anything done outside a signed-in session.
--  • Existing posts and pins stay as they are; only new ones are checked.

create or replace function public.need_verify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare p public.profiles%rowtype;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  select * into p from public.profiles where id = auth.uid();
  if tg_table_name = 'posts' then
    if coalesce(new.is_sample, false) then return new; end if;
    if p.verify_status is null or p.verify_status = 'rejected' then raise exception 'need_verify' using errcode = 'P0001'; end if;
  elsif p.seeker_phone4 is null then
    raise exception 'need_verify' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_need_verify on public.posts;
create trigger posts_need_verify before insert on public.posts for each row execute function public.need_verify();
drop trigger if exists pins_need_verify on public.pins;
create trigger pins_need_verify before insert on public.pins for each row execute function public.need_verify();
