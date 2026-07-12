-- Bulk-replaces a site's WBS from an uploaded schedule of works (CSV/
-- spreadsheet import). Delete-then-bulk-insert needs to be one atomic
-- transaction, not two separate client round-trips - a network drop
-- between the delete and the insert would otherwise leave a site with
-- zero activities. Owner-only, same reasoning as every other planning/
-- financial-decision RPC in this schema: replacing the whole schedule is
-- a planning decision, not field capture.

create or replace function public.replace_site_activities(
  p_site_id uuid,
  p_activities jsonb -- array of {name, activity_code, planned_start, planned_end, responsible_party}
)
returns int -- count of activities inserted
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
  return v_count;
end;
$$;

grant execute on function public.replace_site_activities(uuid, jsonb) to authenticated;
