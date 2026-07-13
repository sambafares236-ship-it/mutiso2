-- Customizable milestones: the fixed 5-stage list was previously read-only
-- (auto-seeded, never restructured). Contractor can now add/remove stages
-- per site. New sites still auto-seed the same 5-stage default via the
-- existing seed_default_milestones trigger (unchanged) - customization is
-- purely additive/subtractive from there, not a replacement of the
-- starting point.
--
-- RLS moves from the old blanket "owner or foreman, for all" policy to a
-- split shape, same pattern as activity's tightened RLS
-- (20260716090200_tighten_activity_rls.sql): INSERT/DELETE are owner-only
-- (restructuring the stage list is a planning decision), SELECT/UPDATE stay
-- open to owner-or-foreman so a foreman can still Start/Sign Off. A new
-- BEFORE UPDATE trigger blocks a foreman from renaming/resequencing an
-- existing milestone in the same way enforce_activity_structural_lock
-- blocks a foreman from editing WBS structure - only status may move for a
-- non-owner. DELETE additionally requires status = 'pending' so a
-- milestone that already carries a real sign-off/compliance record
-- (signed_off_at/inspected_by) can never be deleted out from under it.

drop policy if exists "Site owner or assigned foreman can manage milestones" on public.site_milestone;

create policy "Site owner or assigned foreman can view milestones"
  on public.site_milestone for select
  to authenticated
  using (
    public.owns_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_milestone.site_id, (select auth.uid()))
  );

create policy "Site owner can create milestones"
  on public.site_milestone for insert
  to authenticated
  with check (public.owns_site(site_milestone.site_id, (select auth.uid())));

create policy "Site owner can delete pending milestones"
  on public.site_milestone for delete
  to authenticated
  using (
    public.owns_site(site_milestone.site_id, (select auth.uid()))
    and site_milestone.status = 'pending'
  );

create policy "Site owner or assigned foreman can update milestones"
  on public.site_milestone for update
  to authenticated
  using (
    public.owns_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_milestone.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_milestone.site_id, (select auth.uid()))
  );

-- Field-level lock: a non-owner (a foreman) may only ever change `status`.
-- Only name/sequence are inspected here - signed_off_at/inspected_by are
-- set separately by the existing enforce_milestone_sequence trigger, not
-- checked or touched by this one.
create or replace function public.enforce_milestone_structural_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_site(new.site_id, auth.uid()) then
    if new.name is distinct from old.name
      or new.sequence is distinct from old.sequence
    then
      raise exception 'Only the site owner can rename or resequence a milestone - status can still be updated';
    end if;
  end if;
  return new;
end;
$$;

create trigger on_milestone_update_enforce_structural_lock
  before update on public.site_milestone
  for each row execute function public.enforce_milestone_structural_lock();

-- Readiness signals: link a work permit to the milestone it's covering
-- work for, and a defect to the WBS activity it affects (milestone
-- linkage for a defect is then one hop further via activity.milestone_id -
-- mirrors site_diary_log.activity_id, the existing "evidence link"
-- pattern, rather than adding a second direct milestone_id column).
-- Both nullable/on delete set null - purely advisory data for the
-- MilestonesView readiness nudge, no new write-path or trigger reads
-- these; nothing here ever auto-completes a milestone.

alter table public.work_permit
  add column milestone_id uuid references public.site_milestone(id) on delete set null;

alter table public.defect_log
  add column activity_id uuid references public.activity(id) on delete set null;
