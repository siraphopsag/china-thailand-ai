-- C.A.L.L. — posts the AI rates high risk are held for review (owner, Oct 2026). Run once in Supabase → SQL Editor after
-- 0011_demo_accounts.sql. Safe to run again.
--  • When the AI check before posting rates a post "high_risk" (clear signs of a scam or trafficking), the website saves it with
--    held = true. A held post is hidden (0005): only its employer, administrators and people in its case see it, and nobody can
--    apply. It waits in the administrator's queue with the reported posts.
--  • Only the employer's own new post can arrive held; an edit the AI rates high risk holds the post again. Only an administrator
--    releases it: "No problem" (moderate_post 'dismiss') clears held and shows the post. Remove and suspend work as before.
--  • Websites that never send held (before this file) keep working: the column defaults to false and posts go live as before.
--  • Administrators already read hidden posts (policy "signed-in people read posts", 0005), so the queue needs no new policy.

alter table public.posts add column if not exists held boolean not null default false; -- held for review because the AI rated it high risk

-- as in 0008, plus: a post can arrive held (and is then hidden); only moderation releases a hold
create or replace function public.check_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- 0012: only the employer's own new post can arrive held (simulated posts never)
    new.held := coalesce(new.held, false) and not new.is_sample;
    if not new.is_sample then
      if coalesce((select suspended from public.profiles where id = new.employer_id), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
      if public.cycle_used(new.employer_id, array['post', 'renew']) >= public.post_limit(new.employer_id) then raise exception 'quota' using errcode = 'P0001'; end if;
      insert into public.quota_events (user_id, kind) values (new.employer_id, 'post');
      new.created_at := now(); new.released_at := now();
      new.verified := coalesce((select verify_status = 'verified' from public.profiles where id = new.employer_id), false);
      new.verify_kind := case when new.verified then (select coalesce(verify_kind, 'company') from public.profiles where id = new.employer_id) end;
      -- everything an administrator posts is simulated data (owner, Oct 2026)
      if exists (select 1 from public.profiles where id = new.employer_id and role = 'admin') then new.is_sample := true; end if;
    end if;
    new.released_at := coalesce(new.released_at, new.created_at);
    new.hidden := new.held; -- held → hidden from the start; nothing else arrives hidden
  else
    new.created_at := old.created_at; new.employer_id := old.employer_id;
    if coalesce(current_setting('call.labeling', true), '') <> 'on' then new.is_sample := old.is_sample; end if;
    if new.headcount is distinct from old.headcount and coalesce(new.headcount, 1) <
       (select count(*) from public.acceptances where post_id = old.id and status in ('accepted', 'confirmed', 'forwarded')) then
      raise exception 'below_held' using errcode = 'P0001';
    end if;
    if coalesce(current_setting('call.renewing', true), '') = 'on' then
      if coalesce((select suspended from public.profiles where id = old.employer_id), false) then raise exception 'suspended' using errcode = 'P0001'; end if;
    else
      new.released_at := old.released_at;
    end if;
    if coalesce(current_setting('call.syncing', true), '') <> 'on' then new.verified := old.verified; new.verify_kind := old.verify_kind; end if;
    if coalesce(current_setting('call.moderating', true), '') <> 'on' then
      -- 0012: an employer never releases a hold; an edit the AI rates high risk holds the post again (hidden at once)
      new.held := old.held or coalesce(new.held, false);
      new.hidden := old.hidden or (new.held and not old.held);
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- the administrator's decision on a reported or held post: as in 0005, plus "No problem" also releases a hold
create or replace function public.moderate_post(p_post uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare emp uuid;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select employer_id into emp from public.posts where id = p_post for update;
  if not found then raise exception 'bad_state' using errcode = 'P0001'; end if;
  if p_action = 'dismiss' then
    update public.reports set status = 'dismissed' where post_id = p_post and status = 'open';
    perform set_config('call.moderating', 'on', true);
    update public.posts set hidden = false, held = false where id = p_post;
    perform set_config('call.moderating', 'off', true);
  elsif p_action = 'remove' then
    -- a case the agency is running keeps its post (suspend the employer instead)
    if exists (select 1 from public.cases where post_id = p_post and steps ? 'accepted' and not (steps ? 'arrived')) then
      raise exception 'case_started' using errcode = 'P0001';
    end if;
    delete from public.posts where id = p_post; -- its reports go with it
  elsif p_action = 'suspend' then
    if emp is null then raise exception 'bad_state' using errcode = 'P0001'; end if; -- sample posts have no employer
    update public.reports set status = 'upheld' where status = 'open' and post_id in (select id from public.posts where employer_id = emp);
    update public.profiles set suspended = true where id = emp;
    perform set_config('call.moderating', 'on', true);
    update public.posts set hidden = true where employer_id = emp;
    perform set_config('call.moderating', 'off', true);
  else
    raise exception 'bad_state' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.moderate_post(uuid, text) from public, anon;
grant execute on function public.moderate_post(uuid, text) to authenticated;
