-- Automatic milestone status transitions, at the user's explicit request -
-- this reverses the "nudge only, human confirms" design from the prior
-- migration (20260729090000). That design existed to protect
-- signed_off_at/inspected_by as a deliberate compliance record; the user
-- was told this tradeoff directly (an automatic transition means
-- inspected_by ends up recording whoever's field action happened to
-- trigger it, not a considered inspection) and chose automation anyway.
-- The manual Start/Sign Off buttons in MilestonesView still work
-- unchanged for any milestone with no linked activities/permits to key
-- off, or if a contractor wants to override early.
--
-- Rules, mirroring the exact readiness computation already built
-- client-side in MilestonesView (kept in sync deliberately - same
-- three signals: linked-activity progress, approved permits, open
-- linked defects):
--   pending -> in_progress: any activity linked to this milestone has
--     started (percent_complete > 0, status in progress/completed, or
--     actual_start set), OR any permit tagged to this milestone is
--     approved.
--   in_progress -> completed: every activity linked to this milestone is
--     at 100% AND zero unresolved defects linked (via activity) to this
--     milestone.
-- A milestone with zero linked activities and zero linked permits never
-- auto-transitions - nothing to key off, manual buttons are the only way.
-- The existing enforce_milestone_sequence gate still applies: if the
-- previous milestone isn't completed yet, this function skips silently
-- rather than attempting (and erroring on) an out-of-order transition -
-- that would otherwise abort the unrelated activity/defect/permit update
-- that triggered the recompute.

create or replace function public.recompute_milestone_auto_status(p_milestone_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id uuid;
  v_sequence int;
  v_status text;
  v_prev_status text;
  v_total int;
  v_done int;
  v_any_started boolean;
  v_open_defects int;
  v_approved_permits int;
  v_target text;
begin
  select site_id, sequence, status into v_site_id, v_sequence, v_status
  from public.site_milestone where id = p_milestone_id;

  if v_site_id is null or v_status = 'completed' then
    return;
  end if;

  select
    count(*),
    count(*) filter (where percent_complete >= 100),
    bool_or(percent_complete > 0 or status in ('in_progress', 'completed') or actual_start is not null)
  into v_total, v_done, v_any_started
  from public.activity
  where milestone_id = p_milestone_id;

  select count(*) into v_open_defects
  from public.defect_log d
  join public.activity a on a.id = d.activity_id
  where a.milestone_id = p_milestone_id and d.status <> 'resolved';

  select count(*) into v_approved_permits
  from public.work_permit
  where milestone_id = p_milestone_id and status = 'approved';

  if v_total > 0 and v_done = v_total and v_open_defects = 0 then
    v_target := 'completed';
  elsif coalesce(v_any_started, false) or v_approved_permits > 0 then
    v_target := 'in_progress';
  else
    v_target := v_status;
  end if;

  if v_target = v_status then
    return;
  end if;

  if v_sequence > 1 then
    select status into v_prev_status
    from public.site_milestone
    where site_id = v_site_id and sequence = v_sequence - 1;

    if v_prev_status is distinct from 'completed' then
      return;
    end if;
  end if;

  update public.site_milestone set status = v_target where id = p_milestone_id;
end;
$$;

create or replace function public.trg_activity_milestone_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.milestone_id is not null then
    perform public.recompute_milestone_auto_status(new.milestone_id);
  end if;
  if old.milestone_id is not null and old.milestone_id is distinct from new.milestone_id then
    perform public.recompute_milestone_auto_status(old.milestone_id);
  end if;
  return new;
end;
$$;

create trigger on_activity_update_recompute_milestone
  after update on public.activity
  for each row execute function public.trg_activity_milestone_recompute();

create or replace function public.trg_defect_milestone_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone_id uuid;
begin
  if new.activity_id is not null then
    select milestone_id into v_milestone_id from public.activity where id = new.activity_id;
    if v_milestone_id is not null then
      perform public.recompute_milestone_auto_status(v_milestone_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger on_defect_update_recompute_milestone
  after update on public.defect_log
  for each row execute function public.trg_defect_milestone_recompute();

create or replace function public.trg_permit_milestone_recompute()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.milestone_id is not null and new.status = 'approved' then
    perform public.recompute_milestone_auto_status(new.milestone_id);
  end if;
  return new;
end;
$$;

create trigger on_permit_update_recompute_milestone
  after update on public.work_permit
  for each row execute function public.trg_permit_milestone_recompute();
