-- "Original schedule of works" baseline: a locked snapshot of the WBS's
-- planned dates, distinct from the live activity table so later edits to
-- planned_start/planned_end (e.g. after a variation order shifts the
-- timeline) can never silently rewrite history. Multiple baselines are
-- allowed per site (re-saveable, history kept, per user decision) - "the
-- current baseline" is just the most recently locked one.
--
-- schedule_baseline_activity copies the relevant fields at save time rather
-- than joining live to public.activity - activity_id is kept for reference
-- but is ON DELETE SET NULL, so the snapshot survives even if the live
-- activity row is later deleted.

create table public.schedule_baseline (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  label text,
  locked_at timestamptz not null default now(),
  created_by uuid references auth.users(id) not null
);

create table public.schedule_baseline_activity (
  id uuid primary key default gen_random_uuid(),
  baseline_id uuid references public.schedule_baseline(id) on delete cascade not null,
  activity_id uuid references public.activity(id) on delete set null,
  activity_code text,
  name text not null,
  planned_start date,
  planned_end date
);

alter table public.schedule_baseline enable row level security;
alter table public.schedule_baseline_activity enable row level security;

create policy "Site owner or assigned foreman can view schedule baselines"
  on public.schedule_baseline for select
  to authenticated
  using (
    public.owns_site(schedule_baseline.site_id, (select auth.uid()))
    or public.is_assigned_foreman(schedule_baseline.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage schedule baselines"
  on public.schedule_baseline for all
  to authenticated
  using (public.owns_site(schedule_baseline.site_id, (select auth.uid())))
  with check (public.owns_site(schedule_baseline.site_id, (select auth.uid())));

create policy "Admin roles can manage all schedule baselines"
  on public.schedule_baseline for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- schedule_baseline_activity has no site_id of its own - same one-hop
-- join-helper pattern as can_access_toolbox_talk()/can_access_activity().
create or replace function public.can_access_baseline(_baseline_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schedule_baseline b
    where b.id = _baseline_id
      and (public.owns_site(b.site_id, _user_id) or public.is_assigned_foreman(b.site_id, _user_id))
  )
$$;

create or replace function public.owns_baseline_site(_baseline_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.schedule_baseline b
    where b.id = _baseline_id
      and public.owns_site(b.site_id, _user_id)
  )
$$;

create policy "Site owner or assigned foreman can view baseline activities"
  on public.schedule_baseline_activity for select
  to authenticated
  using (public.can_access_baseline(schedule_baseline_activity.baseline_id, (select auth.uid())));

create policy "Only site owner can manage baseline activities"
  on public.schedule_baseline_activity for all
  to authenticated
  using (public.owns_baseline_site(schedule_baseline_activity.baseline_id, (select auth.uid())))
  with check (public.owns_baseline_site(schedule_baseline_activity.baseline_id, (select auth.uid())));

create policy "Admin roles can manage all baseline activities"
  on public.schedule_baseline_activity for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Snapshots every current activity for a site into a new baseline, in one
-- transaction. Owner-only - locking in "the" schedule of works is a
-- planning/contractual decision, same reasoning as generate_payroll_run.
create or replace function public.save_schedule_baseline(
  p_site_id uuid,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_baseline_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.owns_site(p_site_id, v_user_id) then
    raise exception 'Only the site owner can save a schedule baseline';
  end if;

  insert into public.schedule_baseline (site_id, label, created_by)
  values (p_site_id, p_label, v_user_id)
  returning id into v_baseline_id;

  insert into public.schedule_baseline_activity (baseline_id, activity_id, activity_code, name, planned_start, planned_end)
  select v_baseline_id, a.id, a.activity_code, a.name, a.planned_start, a.planned_end
  from public.activity a
  where a.site_id = p_site_id;

  return v_baseline_id;
end;
$$;

grant execute on function public.save_schedule_baseline(uuid, text) to authenticated;
