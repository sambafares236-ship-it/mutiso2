-- Adds real WBS hierarchy to the CSV/spreadsheet schedule import. Sources
-- like MS Project export a dotted "Outline Number" (e.g. "1.2.3") that
-- already encodes parent/child structure - the parent of "1.2.3" is
-- "1.2", the parent of "1.2" is "1". Previously every uploaded row landed
-- flat (parent_id always null), which meant a phase like "PROJECT
-- INCEPTION" imported as its own standalone activity sitting alongside
-- its own children instead of containing them.
--
-- Signature is unchanged (still 2 args, same types) so CREATE OR REPLACE
-- is sufficient here - no DROP FUNCTION needed, unlike a parameter-list
-- change.

create or replace function public.replace_site_activities(
  p_site_id uuid,
  p_activities jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.owns_site(p_site_id, v_user_id) then
    raise exception 'Only the site owner can replace the schedule of works';
  end if;

  delete from public.activity where site_id = p_site_id;

  insert into public.activity (site_id, created_by, name, activity_code, planned_start, planned_end, responsible_party)
  select
    p_site_id,
    v_user_id,
    row_data->>'name',
    nullif(row_data->>'activity_code', ''),
    nullif(row_data->>'planned_start', '')::date,
    nullif(row_data->>'planned_end', '')::date,
    nullif(row_data->>'responsible_party', '')
  from jsonb_array_elements(p_activities) as row_data
  where coalesce(row_data->>'name', '') <> '';

  get diagnostics v_count = row_count;

  -- Link parents by activity_code prefix. Only rows with a dotted code
  -- participate; a code with no dot (or no code at all) stays top-level.
  -- A child code with no matching parent code (e.g. a gap in numbering,
  -- or the parent row was skipped for having no name) also just stays
  -- top-level rather than erroring - a safe degrade, not a hard failure.
  update public.activity child
  set parent_id = parent.id
  from public.activity parent
  where child.site_id = p_site_id
    and parent.site_id = p_site_id
    and child.activity_code is not null
    and position('.' in child.activity_code) > 0
    and parent.activity_code = left(
      child.activity_code,
      length(child.activity_code) - position('.' in reverse(child.activity_code))
    );

  return v_count;
end;
$$;
