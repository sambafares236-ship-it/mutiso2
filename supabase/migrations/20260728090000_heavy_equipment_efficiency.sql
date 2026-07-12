-- Heavy equipment ("plant") gets its own tracking depth beyond the shared
-- tool_inventory/tool_checkout_log base - optional meter readings (engine
-- hours or km/mileage, whichever a given item uses) at checkout and
-- return. Deliberately optional at the column level, not required by the
-- RPCs - not every site has metered equipment, and the headline
-- efficiency metrics (utilization %, cost/hour) are computed from
-- checkout/return TIMESTAMPS, which always exist, not from meter deltas.
-- meter_unit is a per-item display label only ('hours' | 'km' | null),
-- doesn't affect any calculation.

alter table public.tool_inventory
  add column meter_unit text;

alter table public.tool_checkout_log
  add column meter_reading_out numeric,
  add column meter_reading_in numeric;

-- Adding a parameter changes the signature even with a default value -
-- CREATE OR REPLACE alone would leave the old 2-arg overload live
-- alongside this one (the same gotcha every prior RPC signature change
-- in this schema has had to work around).
drop function if exists public.checkout_tool(uuid, uuid);

create or replace function public.checkout_tool(
  p_tool_id uuid,
  p_worker_id uuid,
  p_meter_reading numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_status text;
  v_worker_site_id uuid;
  v_worker_name text;
  v_present_today boolean;
  v_log_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select site_id, status into v_site_id, v_status
  from public.tool_inventory
  where id = p_tool_id
  for update;

  if v_site_id is null then
    raise exception 'Tool not found';
  end if;

  if not (public.owns_site(v_site_id, v_user_id) or public.is_assigned_foreman(v_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  if v_status <> 'available' then
    raise exception 'Tool is not available (current status: %)', v_status;
  end if;

  select site_id, full_name into v_worker_site_id, v_worker_name
  from public.workers_master
  where id = p_worker_id;

  if v_worker_site_id is null or v_worker_site_id <> v_site_id then
    raise exception 'Worker not found on this site';
  end if;

  select exists (
    select 1 from public.attendance_log
    where site_id = v_site_id and worker_id = p_worker_id and date = current_date
  ) into v_present_today;

  if not v_present_today then
    raise exception '% must be marked present today before checking out a tool', v_worker_name;
  end if;

  insert into public.tool_checkout_log (tool_id, site_id, worker_id, checked_out_to, checked_out_by, meter_reading_out)
  values (p_tool_id, v_site_id, p_worker_id, v_worker_name, v_user_id, p_meter_reading)
  returning id into v_log_id;

  update public.tool_inventory
  set status = 'checked_out', current_holder_name = v_worker_name
  where id = p_tool_id;

  return v_log_id;
end;
$$;

grant execute on function public.checkout_tool(uuid, uuid, numeric) to authenticated;

drop function if exists public.return_tool(uuid, text);

create or replace function public.return_tool(
  p_tool_id uuid,
  p_condition_on_return text default null,
  p_meter_reading numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_status text;
  v_log_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select site_id, status into v_site_id, v_status
  from public.tool_inventory
  where id = p_tool_id
  for update;

  if v_site_id is null then
    raise exception 'Tool not found';
  end if;

  if not (public.owns_site(v_site_id, v_user_id) or public.is_assigned_foreman(v_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  if v_status <> 'checked_out' then
    raise exception 'Tool is not currently checked out (current status: %)', v_status;
  end if;

  select id into v_log_id
  from public.tool_checkout_log
  where tool_id = p_tool_id and returned_at is null
  order by checked_out_at desc
  limit 1;

  if v_log_id is null then
    raise exception 'No open checkout record found for this tool';
  end if;

  update public.tool_checkout_log
  set returned_at = now(), condition_on_return = p_condition_on_return, meter_reading_in = p_meter_reading
  where id = v_log_id;

  update public.tool_inventory
  set status = 'available', current_holder_name = null
  where id = p_tool_id;

  return v_log_id;
end;
$$;

grant execute on function public.return_tool(uuid, text, numeric) to authenticated;
