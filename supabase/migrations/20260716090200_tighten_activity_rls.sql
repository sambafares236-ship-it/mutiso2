-- Tightens activity RLS per the "contractor-only WBS structure" decision:
-- the previous blanket owner-or-foreman "for all" policy (from the
-- Planning module migration) let either role create/restructure the WBS.
-- Now:
--   - INSERT/DELETE on activity: owner-only (creating/removing WBS
--     structure is a planning decision).
--   - UPDATE stays open to owner-or-foreman, but a BEFORE UPDATE trigger
--     (same pattern as enforce_milestone_sequence) rejects a non-owner
--     update that touches structural fields (name/activity_code/parent_id/
--     planned_start/planned_end/responsible_party) - a foreman can only
--     move percent_complete/actual_start/actual_end/status. This is a real
--     DB-level guarantee, not just "the foreman's form doesn't expose
--     those fields."
-- activity_dependency gets the same INSERT/DELETE-owner-only split, since
-- dependency structure is part of the WBS.

drop policy if exists "Site owner or assigned foreman can manage activities" on public.activity;

create policy "Site owner or assigned foreman can view activities"
  on public.activity for select
  to authenticated
  using (
    public.owns_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman(activity.site_id, (select auth.uid()))
  );

create policy "Site owner can create activities"
  on public.activity for insert
  to authenticated
  with check (public.owns_site(activity.site_id, (select auth.uid())));

create policy "Site owner can delete activities"
  on public.activity for delete
  to authenticated
  using (public.owns_site(activity.site_id, (select auth.uid())));

create policy "Site owner or assigned foreman can update activities"
  on public.activity for update
  to authenticated
  using (
    public.owns_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman(activity.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman(activity.site_id, (select auth.uid()))
  );

-- The actual field-level lock: a non-owner (i.e. a foreman) may only ever
-- change the "field truth" columns. Anything else in the same UPDATE is
-- rejected outright, even if percent_complete is also being changed in the
-- same statement.
create or replace function public.enforce_activity_structural_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_site(new.site_id, auth.uid()) then
    if new.name is distinct from old.name
      or new.activity_code is distinct from old.activity_code
      or new.parent_id is distinct from old.parent_id
      or new.planned_start is distinct from old.planned_start
      or new.planned_end is distinct from old.planned_end
      or new.responsible_party is distinct from old.responsible_party
    then
      raise exception 'Only the site owner can change activity structure/plan - percent_complete, actual dates, and status can still be updated';
    end if;
  end if;
  return new;
end;
$$;

create trigger on_activity_update_enforce_structural_lock
  before update on public.activity
  for each row execute function public.enforce_activity_structural_lock();

-- activity_dependency: same INSERT/DELETE-owner-only split.
drop policy if exists "Site owner or assigned foreman can manage activity dependencies" on public.activity_dependency;

create policy "Site owner or assigned foreman can view activity dependencies"
  on public.activity_dependency for select
  to authenticated
  using (public.can_access_activity(activity_dependency.activity_id, (select auth.uid())));

create policy "Site owner can manage activity dependencies"
  on public.activity_dependency for all
  to authenticated
  using (
    exists (
      select 1 from public.activity a
      where a.id = activity_dependency.activity_id
        and public.owns_site(a.site_id, (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.activity a
      where a.id = activity_dependency.activity_id
        and public.owns_site(a.site_id, (select auth.uid()))
    )
  );
