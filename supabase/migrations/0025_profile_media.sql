-- C.A.L.L. — photos on profiles (owner, 28 Nov 2026: profiles like a Facebook page for job seekers and like a shop on Google Maps
-- for employers, with photos). Run once in Supabase → SQL Editor AFTER 0024_post_extras.sql. Safe to run again.
--
--  • One private storage bucket, profile-media: a profile picture, a cover and up to 6 photos of work or of the workplace per
--    person, at <user id>/avatar.webp, <user id>/cover.webp and <user id>/g/<time>.webp. WebP or JPEG only, 1.5 MB at most
--    (the website shrinks every photo first and removes its location data before uploading).
--  • Writing: only into one's own folder. Nobody else can add, replace or delete a person's photos.
--  • Reading (no public links; the website asks for short-lived links):
--      – one's own photos;
--      – an employer's photos: anyone signed in (it is the business' public face, like the shop's page on a map);
--      – a job seeker's photos: only employers the person applied to, and the C.A.L.L. team (the same rule as applicant_work, 0019);
--      – the team (administrators): everything, to remove photos that break the rules.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 1572864, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1572864, allowed_mime_types = array['image/webp', 'image/jpeg'];

-- may the current visitor see the photos in this person's folder?
create or replace function public.can_see_media(p_owner text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    p_owner = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.profiles pr where pr.id::text = p_owner and pr.user_type = 'employer')
    or exists (select 1 from public.acceptances a join public.posts p on p.id = a.post_id
               where a.seeker_id::text = p_owner and p.employer_id = auth.uid())
  );
$$;
revoke all on function public.can_see_media(text) from public, anon;
grant execute on function public.can_see_media(text) to authenticated;

drop policy if exists "profile media: read if allowed" on storage.objects;
create policy "profile media: read if allowed" on storage.objects for select to authenticated
  using (bucket_id = 'profile-media' and public.can_see_media((storage.foldername(name))[1]));

drop policy if exists "profile media: add to my folder" on storage.objects;
create policy "profile media: add to my folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile media: replace in my folder" on storage.objects;
create policy "profile media: replace in my folder" on storage.objects for update to authenticated
  using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile media: remove from my folder (or the team)" on storage.objects;
create policy "profile media: remove from my folder (or the team)" on storage.objects for delete to authenticated
  using (bucket_id = 'profile-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
