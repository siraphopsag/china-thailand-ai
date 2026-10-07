-- C.A.L.L. — verifying an employer who is a private person (owner, Oct 2026: option ก). Run once in Supabase → SQL Editor after
-- 0006_calendar_analytics.sql (guide step 16). Safe to run again.
--  • A company still gives its registration number (0004). An employer without one (a private person) confirms a mobile number
--    with a one-time code in the website instead; only the LAST 4 DIGITS of that number reach the database (verify_phone4) —
--    no identity-card number and no full phone number is ever stored. An administrator (the agency in the prototype) approves
--    it with verify_employer(), as for a company.
--  • Posts carry how their employer was verified (posts.verify_kind): the website lets a verified company reach all five levels,
--    a verified private person levels 1–3 and an employer not yet verified levels 1–2.
--  • In the prototype the code is shown on the screen (sending a real SMS needs a paid service); a real deployment would send it
--    by SMS, or use the state digital ID (ThaID / NDID) instead.

alter table public.profiles add column if not exists verify_kind text check (verify_kind in ('company', 'person'));
alter table public.profiles add column if not exists verify_phone4 text check (verify_phone4 ~ '^[0-9]{4}$');
grant update (verify_kind, verify_phone4) on public.profiles to authenticated; -- the status only through verify_employer()
alter table public.posts add column if not exists verify_kind text check (verify_kind in ('company', 'person'));

-- a new or changed request waits for approval; only verify_employer() changes the status
--  registration number given → a company · otherwise 'person' with the last 4 digits of a phone → a private person · neither → cleared
create or replace function public.check_profile_verify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verify_reg is distinct from old.verify_reg or new.verify_country is distinct from old.verify_country
     or new.verify_kind is distinct from old.verify_kind or new.verify_phone4 is distinct from old.verify_phone4 then
    if new.verify_reg is not null then
      if not (case new.verify_country when 'TH' then public.th_juristic_ok(new.verify_reg) when 'CN' then public.uscc_ok(new.verify_reg) else false end) then
        raise exception 'bad_reg_no' using errcode = 'P0001';
      end if;
      new.verify_kind := 'company'; new.verify_phone4 := null;
      new.verify_status := 'pending'; new.verify_at := now(); new.verify_decided_at := null;
    elsif new.verify_kind = 'person' then
      if new.verify_country is null or new.verify_country not in ('TH', 'CN') or new.verify_phone4 is null or new.verify_phone4 !~ '^[0-9]{4}$' then
        raise exception 'bad_phone' using errcode = 'P0001';
      end if;
      new.verify_status := 'pending'; new.verify_at := now(); new.verify_decided_at := null;
    else
      new.verify_country := null; new.verify_kind := null; new.verify_phone4 := null;
      new.verify_status := null; new.verify_at := null; new.verify_decided_at := null;
    end if;
  elsif coalesce(current_setting('call.verifying', true), '') <> 'on' then
    new.verify_status := old.verify_status; new.verify_at := old.verify_at; new.verify_decided_at := old.verify_decided_at;
  end if;
  return new;
end;
$$;

-- posts: as in 0005, plus how the employer was verified (kept in step with the profile, never set from the website)
create or replace function public.check_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not new.is_sample then
      if coalesce((select suspended from public.profiles where id = new.employer_id), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
      if public.cycle_used(new.employer_id, array['post', 'renew']) >= public.post_limit(new.employer_id) then raise exception 'quota' using errcode = 'P0001'; end if;
      insert into public.quota_events (user_id, kind) values (new.employer_id, 'post');
      new.created_at := now(); new.released_at := now();
      new.verified := coalesce((select verify_status = 'verified' from public.profiles where id = new.employer_id), false);
      new.verify_kind := case when new.verified then (select coalesce(verify_kind, 'company') from public.profiles where id = new.employer_id) end;
    end if;
    new.released_at := coalesce(new.released_at, new.created_at);
    new.hidden := false;
  else
    new.created_at := old.created_at; new.employer_id := old.employer_id; new.is_sample := old.is_sample;
    -- fewer people than already hold a place cannot be asked for
    if new.headcount is distinct from old.headcount and coalesce(new.headcount, 1) <
       (select count(*) from public.acceptances where post_id = old.id and status in ('accepted', 'confirmed', 'forwarded')) then
      raise exception 'below_held' using errcode = 'P0001';
    end if;
    -- only renew_post() moves the release time (not for a suspended employer); only a verification change moves "verified"
    if coalesce(current_setting('call.renewing', true), '') = 'on' then
      if coalesce((select suspended from public.profiles where id = old.employer_id), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
    else
      new.released_at := old.released_at;
    end if;
    if coalesce(current_setting('call.syncing', true), '') <> 'on' then new.verified := old.verified; new.verify_kind := old.verify_kind; end if;
    if coalesce(current_setting('call.moderating', true), '') <> 'on' then new.hidden := old.hidden; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- a verification decided by the agency: posts follow it (and how); a verified employer's waiting cases go to the agency
create or replace function public.after_profile_verify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verify_status is distinct from old.verify_status or new.verify_kind is distinct from old.verify_kind then
    perform set_config('call.syncing', 'on', true);
    -- (coalesce: a cleared request has no status — 0004 failed on that with a null "verified")
    update public.posts set verified = coalesce(new.verify_status = 'verified', false),
      verify_kind = case when new.verify_status = 'verified' then coalesce(new.verify_kind, 'company') end
      where employer_id = new.id;
    perform set_config('call.syncing', 'off', true);
    if new.verify_status = 'verified' and new.verify_status is distinct from old.verify_status then perform public.submit_waiting_cases(new.id); end if;
  end if;
  return null;
end;
$$;

-- the agency decides a company or a private person alike
create or replace function public.verify_employer(p_user uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  perform set_config('call.verifying', 'on', true);
  update public.profiles set verify_status = case when p_ok then 'verified' else 'rejected' end, verify_decided_at = now()
    where id = p_user and (verify_reg is not null or (verify_kind = 'person' and verify_phone4 is not null));
  if not found then raise exception 'bad_state' using errcode = 'P0001'; end if;
  perform set_config('call.verifying', 'off', true);
end;
$$;
revoke all on function public.verify_employer(uuid, boolean) from public, anon;
grant execute on function public.verify_employer(uuid, boolean) to authenticated;

-- companies verified before this file: say so on their posts (the samples too)
do $$
begin
  perform set_config('call.syncing', 'on', true);
  update public.posts set verify_kind = 'company' where verified and verify_kind is null;
  perform set_config('call.syncing', 'off', true);
end;
$$;
