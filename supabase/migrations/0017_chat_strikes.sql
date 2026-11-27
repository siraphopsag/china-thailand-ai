-- C.A.L.L. — contact details in the chat end the match on the third time (owner's blueprint, 27 Nov 2026). Run once in Supabase →
-- SQL Editor AFTER 0016_verify_first.sql. Safe to run again.
--
--  • Every message with contact details is already hidden (0015) and counts as a violation of its side. The 1st and 2nd are only
--    warnings (shown by the website). On the 3rd, the match ends: the application is declined with ended_for = 'contact' and the
--    side that caused it, the reservation queue moves up, and a case nobody has started is removed. A case already under way is
--    not ended (only the chat locks). Nothing is deleted from the chat: the messages stay as a record.
--  • A chat where either side has 3 violations takes no more messages (insert policy below).
--  • When one employer's violations have ended 3 matches on the same post, the post is held for the team (held, as in 0012).
--  • Nobody can set ended_for / ended_by by hand: only this file's trigger does.
--  • Known limit: interview times (chat_offer_interview / chat_pick_interview) are not locked by this file.

alter table public.acceptances add column if not exists ended_for text check (ended_for in ('contact'));
alter table public.acceptances add column if not exists ended_by text check (ended_by in ('seeker', 'employer'));

-- the number of violations of each side in one application
create or replace function public.chat_locked(p_acc uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.chat_messages m where m.acceptance_id = p_acc and m.masked group by m.side having count(*) >= 3);
$$;
revoke all on function public.chat_locked(uuid) from public, anon;
grant execute on function public.chat_locked(uuid) to authenticated;

drop policy if exists "the two sides write in an open chat" on public.chat_messages;
create policy "the two sides write in an open chat" on public.chat_messages
  for insert to authenticated with check (
    sender = auth.uid() and public.chat_side(acceptance_id) is not null and not public.chat_locked(acceptance_id)
    and exists (select 1 from public.acceptances a where a.id = acceptance_id and a.status in ('accepted', 'confirmed', 'forwarded')));

-- the 3rd violation of one side ends the match
create or replace function public.after_chat_strike()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare a public.acceptances%rowtype; n int;
begin
  if not new.masked then return null; end if;
  select count(*) into n from public.chat_messages where acceptance_id = new.acceptance_id and side = new.side and masked;
  if n <> 3 then return null; end if;
  select * into a from public.acceptances where id = new.acceptance_id for update;
  if not found or a.ended_for is not null or a.status not in ('accepted', 'confirmed') then return null; end if;
  if exists (select 1 from public.cases c where c.acceptance_id = a.id and (c.steps ? 'submitted' or c.steps ? 'accepted')) then return null; end if;
  delete from public.cases where acceptance_id = a.id; -- opened, but nobody has started it
  perform set_config('call.ending', 'on', true);
  update public.acceptances set status = 'rejected', decided_at = now(), ended_for = 'contact', ended_by = new.side where id = a.id;
  perform set_config('call.ending', 'off', true);
  perform public.promote_reserved(a.post_id);
  if new.side = 'employer' and (select count(*) from public.acceptances where post_id = a.post_id and ended_for = 'contact' and ended_by = 'employer') >= 3 then
    perform set_config('call.moderating', 'on', true);
    update public.posts set held = true, hidden = true where id = a.post_id;
    perform set_config('call.moderating', 'off', true);
  end if;
  return null;
end;
$$;
drop trigger if exists chat_messages_strike on public.chat_messages;
create trigger chat_messages_strike after insert on public.chat_messages for each row execute function public.after_chat_strike();

-- ended_for / ended_by: only the trigger above
create or replace function public.keep_ended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('call.ending', true), '') <> 'on' then
    new.ended_for := old.ended_for; new.ended_by := old.ended_by;
  end if;
  return new;
end;
$$;
drop trigger if exists acceptances_keep_ended on public.acceptances;
create trigger acceptances_keep_ended before update on public.acceptances for each row execute function public.keep_ended();
