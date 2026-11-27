-- C.A.L.L. — the demo account can try everything on its own (owner, 27 Nov 2026: the judges test the live site with the
-- "try without signing up" account, so it must be able to do everything a signed-in account does, alone). Run once in
-- Supabase → SQL Editor AFTER 0020_review_fixes.sql. Safe to run again.
--
--  • Instant verification for a demo account (demo_verify_employer): the request is approved at once, as the team would.
--    Job seekers verify on the page itself (phone code shown on screen + the sample passport), so they need nothing here.
--  • Six simulated job seekers (ผู้หางานจำลอง 1–6): accounts nobody can sign in to. demo_sample_apply lets one of them apply
--    to a demo account's own post, so the employer side can be tried alone (confirm, chat, case).
--  • A simulated employer (demo_sample_post): posts a job that fits the demo account's pin. Such a post is seen only by that
--    demo account (posts.demo_for) and goes when the demo account goes (7 days, 0011). demo_sample_answer lets the simulated
--    employer confirm or decline the demo account's application.
--  • Nothing here works for an ordinary account: every function checks that the caller is a demo (anonymous) account.
--  • The website marks every simulated person and post as simulated data (yellow), as in 0008.

-- ───────────── who is a demo account ─────────────
create or replace function public.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_anonymous from auth.users where id = auth.uid()), false);
$$;
revoke all on function public.is_demo_user() from public, anon;
grant execute on function public.is_demo_user() to authenticated;

-- ───────────── a post made for one demo account only ─────────────
alter table public.posts add column if not exists demo_for uuid references auth.users (id) on delete cascade;
create index if not exists posts_demo_for on public.posts (demo_for) where demo_for is not null;

-- as in 0005, plus: a post made for one demo account is seen by that account only (and the administrators)
drop policy if exists "signed-in people read posts" on public.posts;
create policy "signed-in people read posts" on public.posts
  for select to authenticated using (
    (demo_for is null or demo_for = auth.uid() or public.is_admin()) and (
      ((released_at > now() - interval '182 days' or is_sample) and not hidden)
      or employer_id = auth.uid() or public.is_admin()
      or exists (select 1 from public.cases c where c.post_id = posts.id and c.seeker_id = auth.uid())));

-- ───────────── instant verification (employer) ─────────────
-- approves what the demo account sent; with nothing sent yet, a demo company (a made-up registration number that passes
-- the check) is filled in first. A company may post to all five levels.
create or replace function public.demo_verify_employer()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare p public.profiles%rowtype;
begin
  if not public.is_demo_user() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into p from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p.verify_status is null or p.verify_status = 'rejected' then
    update public.profiles set verify_country = 'TH', verify_reg = '0105599000001' where id = auth.uid(); -- check_profile_verify: company, pending
  end if;
  perform set_config('call.verifying', 'on', true);
  update public.profiles set verify_status = 'verified', verify_decided_at = now() where id = auth.uid(); -- after_profile_verify updates the posts
  perform set_config('call.verifying', 'off', true);
end;
$$;
revoke all on function public.demo_verify_employer() from public, anon;
grant execute on function public.demo_verify_employer() to authenticated;

-- ───────────── six simulated job seekers ─────────────
-- real rows (an application needs an account) that cannot sign in: no password, an address that cannot receive mail
do $$
declare i int; uid uuid; o text[] := array['CN-YN', 'CN-GX', 'TH-50', 'CN-GD', 'TH-10', 'CN-SC'];
begin
  for i in 1..6 loop
    uid := ('00000000-0000-4000-a000-00000000d0c' || i)::uuid;
    if not exists (select 1 from auth.users where id = uid) then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, is_anonymous)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'sample-seeker-' || i || '@call.invalid', '',
        '{"provider":"sample","providers":["sample"]}'::jsonb, jsonb_build_object('full_name', 'ผู้หางานจำลอง ' || i),
        now(), now(), '', '', '', '', false);
    end if;
    insert into public.profiles (id, email, full_name) values (uid, 'sample-seeker-' || i || '@call.invalid', 'ผู้หางานจำลอง ' || i)
      on conflict (id) do update set full_name = excluded.full_name;
    -- four of the six are verified (phone and passport: only the last 4 digits, as for everyone)
    update public.profiles set user_type = 'seeker', origin_country = left(o[i], 2), origin_province = o[i],
      seeker_phone_country = left(o[i], 2), seeker_phone4 = lpad((1000 + i * 1111 % 9000)::text, 4, '0'), seeker_phone_at = now(),
      seeker_pp_last4 = case when i <= 4 then lpad((2000 + i * 37)::text, 4, '0') end,
      seeker_pp_nat = case when i <= 4 then (case left(o[i], 2) when 'CN' then 'CHN' else 'THA' end) end,
      seeker_pp_expiry = case when i <= 4 then current_date + 1500 end,
      seeker_pp_at = case when i <= 4 then now() end
      where id = uid;
  end loop;
end $$;

-- one of them applies to the demo account's own post; null = all six have applied already
create or replace function public.demo_sample_apply(p_post uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare sid uuid; nm text; i int;
begin
  if not public.is_demo_user() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not exists (select 1 from public.posts where id = p_post and employer_id = auth.uid() and not hidden and not coalesce(held, false)) then
    raise exception 'not_open' using errcode = 'P0001';
  end if;
  for i in 1..6 loop
    sid := ('00000000-0000-4000-a000-00000000d0c' || i)::uuid;
    if not exists (select 1 from public.acceptances where post_id = p_post and seeker_id = sid) then
      insert into public.acceptances (post_id, seeker_id, intro, available_from)
        values (p_post, sid, 'สนใจตำแหน่งนี้และพร้อมเริ่มงานตามวันที่ระบุ (ผู้สมัครจำลอง)', current_date + 14);
      select full_name into nm from public.profiles where id = sid;
      return nm;
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function public.demo_sample_apply(uuid) from public, anon;
grant execute on function public.demo_sample_apply(uuid) to authenticated;

-- ───────────── a simulated employer posts a job that fits a pin ─────────────
create or replace function public.demo_sample_post(p_country text, p_province text, p_industry text, p_skills text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare nid uuid; pos text;
begin
  if not public.is_demo_user() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if (select count(*) from public.posts where demo_for = auth.uid()) >= 20 then raise exception 'quota' using errcode = 'P0001'; end if;
  pos := case p_industry when 'manufacturing' then 'พนักงานฝ่ายผลิต' when 'technology' then 'นักพัฒนาซอฟต์แวร์' when 'hospitality' then 'พนักงานต้อนรับโรงแรม'
    when 'food_service' then 'พนักงานครัว' when 'education' then 'ครูสอนภาษา' when 'logistics' then 'พนักงานคลังสินค้า' when 'finance' then 'เจ้าหน้าที่บัญชี' else 'พนักงานทั่วไป' end;
  insert into public.posts (is_sample, employer_id, demo_for, company, position, industry, skills, min_years, details, headcount, employment,
    salary_min, salary_max, salary_currency, start_date, languages, education, benefits, country, province, verified, verify_kind)
  values (true, null, auth.uid(), 'บริษัทตัวอย่าง (นายจ้างจำลอง)', pos, p_industry,
    case when cardinality(coalesce(p_skills, '{}')) between 1 and 12 then p_skills else array['customer_service'] end, 0,
    'ประกาศจำลองสำหรับบัญชีทดลอง สร้างให้ตรงกับหมุดของคุณ เพื่อลองสมัครและติดตามขั้นตอนต่อไปได้ด้วยตัวเอง', 3, 'permanent',
    case p_country when 'CN' then 4500 else 15000 end, case p_country when 'CN' then 7000 else 22000 end, case p_country when 'CN' then 'CNY' else 'THB' end,
    current_date + 30, jsonb_build_array(jsonb_build_object('lang', case p_country when 'CN' then 'zh' else 'th' end, 'level', 'basic')), 'none', array['housing', 'insurance'], p_country, p_province, true, 'company')
  returning id into nid;
  return nid;
end;
$$;
revoke all on function public.demo_sample_post(text, text, text, text[]) from public, anon;
grant execute on function public.demo_sample_post(text, text, text, text[]) to authenticated;

-- the simulated employer answers the demo account's application to a post made for it (as decide_application)
create or replace function public.demo_sample_answer(p_acc uuid, p_confirm boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare st text; pid uuid;
begin
  if not public.is_demo_user() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select a.status, a.post_id into st, pid from public.acceptances a join public.posts p on p.id = a.post_id
    where a.id = p_acc and a.seeker_id = auth.uid() and p.demo_for = auth.uid() for update of a;
  if not found then raise exception 'not_allowed' using errcode = '42501'; end if;
  if st <> 'accepted' then raise exception 'bad_state' using errcode = 'P0001'; end if;
  update public.acceptances set status = case when p_confirm then 'confirmed' else 'rejected' end, decided_at = now() where id = p_acc;
  perform public.promote_reserved(pid);
end;
$$;
revoke all on function public.demo_sample_answer(uuid, boolean) from public, anon;
grant execute on function public.demo_sample_answer(uuid, boolean) to authenticated;
