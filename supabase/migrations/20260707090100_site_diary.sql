-- Site diary is its own dedicated table, not folded into a generic
-- catch-all events table like the old repo's site_events_log (which is
-- exactly why the old ActivityForm could silently omit site_id in the
-- first place - a generic table has no per-purpose NOT NULL guarantee).
-- site_id is NOT NULL here, full stop.

create table public.site_diary_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  date date not null default current_date,
  category text not null default 'Activity',
  title text not null,
  description text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.site_diary_log enable row level security;

create policy "Site owner or assigned foreman can manage diary entries"
  on public.site_diary_log for all
  to authenticated
  using (
    public.owns_site(site_diary_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_diary_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(site_diary_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_diary_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all diary entries"
  on public.site_diary_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
