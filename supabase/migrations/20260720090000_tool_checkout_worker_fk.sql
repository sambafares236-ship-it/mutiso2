-- Tool checkout recipient was free text (checked_out_to) - exactly the
-- name-string matching this app has deliberately avoided everywhere else
-- (attendance_log.worker_id being the canonical example). Adds a real FK
-- and, per the user's decision, enforces "who is in" literally: a worker
-- can only receive a tool checkout if they have an attendance_log row for
-- today. checked_out_to/current_holder_name stay as denormalized display
-- text (a name snapshot at checkout time), but are now always derived
-- from a validated worker_id rather than freely typed.

alter table public.tool_checkout_log
  add column worker_id uuid references public.workers_master(id) on delete set null;

-- Signature changes from (uuid, text) to (uuid, uuid) - different arg
-- types, so the old overload must be dropped explicitly first (CREATE OR
-- REPLACE alone leaves both signatures live).
drop function if exists public.checkout_tool(uuid, text);

create or replace function public.checkout_tool(
  p_tool_id uuid,
  p_worker_id uuid
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

  insert into public.tool_checkout_log (tool_id, site_id, worker_id, checked_out_to, checked_out_by)
  values (p_tool_id, v_site_id, p_worker_id, v_worker_name, v_user_id)
  returning id into v_log_id;

  update public.tool_inventory
  set status = 'checked_out', current_holder_name = v_worker_name
  where id = p_tool_id;

  return v_log_id;
end;
$$;

grant execute on function public.checkout_tool(uuid, uuid) to authenticated;
