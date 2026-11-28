-- C.A.L.L. — exchanging contact details, unlocked by the case (owner, 28 Nov 2026: C.A.L.L. now looks after the worker to the
-- end, so the safety reason for keeping talk on the platform stays — but once working together, people need to call each other).
-- Run once in Supabase → SQL Editor AFTER 0025_profile_media.sql. Safe to run again.
--
--  • Before the documents step of the case is done (the C.A.L.L. team has checked the contract and the documents), nobody can
--    exchange contact details, and the chat keeps hiding them (the 3-strike rule, 0017, is unchanged).
--  • After it, each side may give a phone number, LINE or WeChat and agree that the other side sees it. Each sees the other's only
--    when BOTH have agreed (consent both ways). Either side can take theirs back at any time.
--  • The table cannot be read or written directly: only through the functions below, which check who is asking. The team
--    (administrators) can read it, to help in an emergency.
--  • A demo account whose other side is simulated (a simulated employer's post, or a simulated job seeker, 0021) can have that
--    side agree with sample details, so the whole flow can be tried alone.

create table if not exists public.contact_shares (
  acceptance_id uuid primary key references public.acceptances (id) on delete cascade,
  seeker_contact text check (seeker_contact is null or char_length(seeker_contact) between 3 and 80),
  employer_contact text check (employer_contact is null or char_length(employer_contact) between 3 and 80),
  seeker_at timestamptz,
  employer_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.contact_shares enable row level security;
revoke all on public.contact_shares from anon, authenticated;
grant select on public.contact_shares to authenticated;
drop policy if exists "the team reads contact shares" on public.contact_shares;
create policy "the team reads contact shares" on public.contact_shares for select to authenticated using (public.is_admin());

-- what the caller may see about the exchange of this match (raises not_allowed for anyone but its two sides)
create or replace function public.contact_share_state(p_acc uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare a record; st jsonb; side text; r public.contact_shares%rowtype; both_ok boolean;
begin
  select ac.id, ac.seeker_id, p.employer_id into a from public.acceptances ac join public.posts p on p.id = ac.post_id where ac.id = p_acc;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  side := case when a.seeker_id = auth.uid() then 'seeker' when a.employer_id = auth.uid() then 'employer' end;
  if side is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  select steps into st from public.cases where acceptance_id = p_acc;
  select * into r from public.contact_shares where acceptance_id = p_acc;
  both_ok := r.seeker_at is not null and r.employer_at is not null;
  return jsonb_build_object(
    'side', side,
    'unlocked', coalesce(st ? 'documents', false),
    'mine', case side when 'seeker' then r.seeker_contact else r.employer_contact end,
    'meAt', case side when 'seeker' then r.seeker_at else r.employer_at end,
    'themAt', case side when 'seeker' then r.employer_at else r.seeker_at end,
    'theirs', case when both_ok then (case side when 'seeker' then r.employer_contact else r.seeker_contact end) end,
    'sim', public.is_demo_user() and (a.employer_id is null or a.seeker_id::text like '00000000-0000-4000-a000-00000000d0c%'));
end;
$$;

-- give my contact and agree that the other side sees it (only once the case's documents step is done)
create or replace function public.contact_share_set(p_acc uuid, p_contact text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare s jsonb; v text := btrim(coalesce(p_contact, ''));
begin
  s := public.contact_share_state(p_acc);
  if not (s ->> 'unlocked')::boolean then raise exception 'locked' using errcode = 'P0001'; end if;
  if char_length(v) not between 3 and 80 then raise exception 'bad_contact' using errcode = 'P0001'; end if;
  insert into public.contact_shares (acceptance_id) values (p_acc) on conflict (acceptance_id) do nothing;
  if s ->> 'side' = 'seeker' then
    update public.contact_shares set seeker_contact = v, seeker_at = now(), updated_at = now() where acceptance_id = p_acc;
  else
    update public.contact_shares set employer_contact = v, employer_at = now(), updated_at = now() where acceptance_id = p_acc;
  end if;
  return public.contact_share_state(p_acc);
end;
$$;

-- take my contact back (the other side no longer sees it)
create or replace function public.contact_share_withdraw(p_acc uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare s jsonb;
begin
  s := public.contact_share_state(p_acc);
  if s ->> 'side' = 'seeker' then
    update public.contact_shares set seeker_contact = null, seeker_at = null, updated_at = now() where acceptance_id = p_acc;
  else
    update public.contact_shares set employer_contact = null, employer_at = null, updated_at = now() where acceptance_id = p_acc;
  end if;
  return public.contact_share_state(p_acc);
end;
$$;

-- demo: the simulated other side agrees with sample details
create or replace function public.contact_share_demo(p_acc uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare s jsonb;
begin
  s := public.contact_share_state(p_acc);
  if not (s ->> 'sim')::boolean then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not (s ->> 'unlocked')::boolean then raise exception 'locked' using errcode = 'P0001'; end if;
  insert into public.contact_shares (acceptance_id) values (p_acc) on conflict (acceptance_id) do nothing;
  if s ->> 'side' = 'seeker' then
    update public.contact_shares set employer_contact = 'LINE: sample-employer (ตัวอย่าง)', employer_at = now(), updated_at = now() where acceptance_id = p_acc;
  else
    update public.contact_shares set seeker_contact = 'WeChat: sample-worker (ตัวอย่าง)', seeker_at = now(), updated_at = now() where acceptance_id = p_acc;
  end if;
  return public.contact_share_state(p_acc);
end;
$$;

revoke all on function public.contact_share_state(uuid) from public, anon;
revoke all on function public.contact_share_set(uuid, text) from public, anon;
revoke all on function public.contact_share_withdraw(uuid) from public, anon;
revoke all on function public.contact_share_demo(uuid) from public, anon;
grant execute on function public.contact_share_state(uuid) to authenticated;
grant execute on function public.contact_share_set(uuid, text) to authenticated;
grant execute on function public.contact_share_withdraw(uuid) to authenticated;
grant execute on function public.contact_share_demo(uuid) to authenticated;
