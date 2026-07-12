-- Real photo upload, replacing the old repo's non-functional PhotoForm
-- stub ("Photo upload coming soon" with no Storage wiring at all).
-- Storage object paths are {site_id}/{filename} - storage policies parse
-- the site_id out of the path via storage.foldername() and check it
-- against the same owns_site/is_assigned_foreman helpers used everywhere
-- else, so a single consistent authorization rule covers both the table
-- row and the underlying file.

create table public.site_photos (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  photo_url text not null,
  category text not null default 'progress',
  caption text,
  uploaded_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.site_photos enable row level security;

create policy "Site owner or assigned foreman can manage photos"
  on public.site_photos for all
  to authenticated
  using (
    public.owns_site(site_photos.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_photos.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(site_photos.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_photos.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all photos"
  on public.site_photos for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

insert into storage.buckets (id, name, public)
values ('site-photos', 'site-photos', false)
on conflict (id) do nothing;

create policy "Site owner or assigned foreman can upload site photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-photos'
    and (
      public.owns_site(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      or public.is_assigned_foreman(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    )
  );

create policy "Site owner or assigned foreman can view site photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'site-photos'
    and (
      public.owns_site(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      or public.is_assigned_foreman(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    )
  );

create policy "Site owner or assigned foreman can delete site photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'site-photos'
    and (
      public.owns_site(((storage.foldername(name))[1])::uuid, (select auth.uid()))
      or public.is_assigned_foreman(((storage.foldername(name))[1])::uuid, (select auth.uid()))
    )
  );

create policy "Admin roles can manage all site photo objects"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'site-photos'
    and (
      public.has_role((select auth.uid()), 'admin')
      or public.has_role((select auth.uid()), 'super_admin')
    )
  );
