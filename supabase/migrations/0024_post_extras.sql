-- C.A.L.L. — more about the job (owner, 28 Nov 2026: "add more job details without making the form harder"). Run once in
-- Supabase → SQL Editor AFTER 0023_demo_review.sql. Safe to run again.
--
--  • posts.extras: working hours and days a week, overtime, housing (free / deducted, people per room), meals a day, contract
--    and probation in months, how often the pay comes, the district or industrial estate, a shuttle, near a station.
--  • One small json object, at most 1 000 characters, never contact details (no_contact, 0002/0015) — the website cleans every
--    value before saving (src/domain/match/postExtras.ts), and the database refuses anything that is not an object or too long.
--  • Posts saved before this have {} and show nothing new.

alter table public.posts add column if not exists extras jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_extras_ok') then
    alter table public.posts add constraint posts_extras_ok
      check (jsonb_typeof(extras) = 'object' and char_length(extras::text) <= 1000 and public.no_contact(extras::text));
  end if;
end $$;
