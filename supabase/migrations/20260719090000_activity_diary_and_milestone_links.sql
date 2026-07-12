-- Links foreman field data to the WBS, and the WBS to milestones, closing
-- the gap where progress/milestones were entirely disconnected from the
-- day-to-day diary a foreman actually writes.
--
-- site_diary_log.activity_id: optional - a foreman can tag a diary entry
-- to the activity it's evidence for. This does NOT auto-compute
-- percent_complete; that stays a manual number (per user decision) - the
-- link just gives the activity a visible feed of the diary entries behind
-- it. ON DELETE SET NULL so a diary entry survives if the activity is
-- later deleted/replaced by a schedule re-upload.
--
-- activity.milestone_id: which of the 5 fixed milestone stages this
-- activity belongs to. A structural/planning field, so it joins the same
-- owner-only guard list as name/activity_code/parent_id/planned_start/
-- planned_end/responsible_party in enforce_activity_structural_lock() -
-- assigning an activity to a phase is a planning decision, not field
-- progress, same reasoning as everything else already in that list.

alter table public.site_diary_log
  add column activity_id uuid references public.activity(id) on delete set null;

alter table public.activity
  add column milestone_id uuid references public.site_milestone(id) on delete set null;

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
      or new.milestone_id is distinct from old.milestone_id
    then
      raise exception 'Only the site owner can change activity structure/plan - percent_complete, actual dates, and status can still be updated';
    end if;
  end if;
  return new;
end;
$$;
