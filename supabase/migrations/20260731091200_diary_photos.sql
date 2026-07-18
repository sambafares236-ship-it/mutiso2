-- Lets a foreman attach one or more photos directly to a site diary entry
-- at creation time, so a photo and the description explaining it travel
-- together instead of living in two disconnected features (site_diary_log
-- vs. site_photos). Mirrors exactly how activity_id was added to
-- site_diary_log in 20260719090000_activity_diary_and_milestone_links.sql:
-- a nullable FK on the child table, no new bucket/RLS policy needed since
-- site_photos already has its own owns_site()/is_assigned_foreman()
-- policies covering any row regardless of what it's linked to.
--
-- on delete cascade (not set null, unlike activity_id): these photos exist
-- specifically as evidence for this one diary entry, not a standalone
-- record that should survive independently of it.
alter table public.site_photos
  add column diary_id uuid references public.site_diary_log(id) on delete cascade;

create index site_photos_diary_id_idx on public.site_photos (diary_id) where diary_id is not null;
