-- C.A.L.L. — post options and translations (owner, Oct 2026). Run once AFTER 0009 (safe to run again).
--  • domestic_only: the employer keeps the post inside its own country — the release stops at level 4 (the whole country) and never
--    reaches job seekers abroad (level 5). The website also sets it for occupations closed to foreigners (e.g. tour guiding).
--  • work_right: "only people who already have the right to work in this country" — the employer will not apply for a work permit or
--    visa. Shown as a label on the post (not a nationality filter: limiting by nationality would be discrimination).
--  • translations: the job title and details translated by the AI when the post was checked, so job seekers who use another language
--    can read them: {"src":"th","th":{"position":"…","details":"…"},"zh":{…},"en":{…}}. Contact details stay forbidden here too.
--  • more fields of work (owner, Oct 2026): legal and advisory services, healthcare, construction, retail and e-commerce, agriculture,
--    automotive and EV, energy, import and export, media and marketing, real estate, beauty and wellness (posts and pins).
--    Skills are not listed in the database (only how many); the website knows the new ones.
-- The release levels are worked out in the website (src/domain/match/release.ts), as before.

alter table public.posts drop constraint if exists posts_industry_check;
alter table public.posts add constraint posts_industry_check check (industry in ('manufacturing', 'technology', 'hospitality', 'food_service', 'education', 'logistics', 'finance', 'legal_services', 'healthcare', 'construction', 'retail_ecommerce', 'agriculture', 'automotive_ev', 'energy', 'trade', 'media_marketing', 'real_estate', 'beauty_wellness'));
alter table public.pins drop constraint if exists pins_industry_check;
alter table public.pins add constraint pins_industry_check check (industry in ('manufacturing', 'technology', 'hospitality', 'food_service', 'education', 'logistics', 'finance', 'legal_services', 'healthcare', 'construction', 'retail_ecommerce', 'agriculture', 'automotive_ev', 'energy', 'trade', 'media_marketing', 'real_estate', 'beauty_wellness'));

alter table public.posts add column if not exists domestic_only boolean not null default false;
alter table public.posts add column if not exists work_right boolean not null default false;
alter table public.posts add column if not exists translations jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.posts add constraint posts_translations_ok
    check (jsonb_typeof(translations) = 'object' and char_length(translations::text) <= 8000 and public.no_contact(translations::text));
exception when duplicate_object then null; end $$;
