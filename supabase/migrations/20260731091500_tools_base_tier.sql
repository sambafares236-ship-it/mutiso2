-- Hand tools move to the base (field_ops) tier; heavy plant stays Pro.
--
-- Tool checkout is an everyday field action on any site - the same class of
-- action as attendance or a material delivery, both of which are base-tier.
-- Gating it behind Pro meant a field_ops foreman had no way to record who
-- took which tool, which is exactly the daily-operations gap this app exists
-- to close.
--
-- The split is by tool_inventory.category, which already separates the two:
-- ToolsView filters to category <> 'plant' and HeavyEquipmentView handles
-- plant, so this migration just moves the DB gate to the line the UI was
-- already drawing. equipment_maintenance_log is untouched and stays Pro -
-- service/repair scheduling belongs to plant management, not tool checkout.

-- tool_inventory: base-tier access to non-plant rows, Pro for everything.
drop policy if exists "Site owner or assigned foreman can manage tools" on public.tool_inventory;

create policy "Site owner or assigned foreman can manage tools"
  on public.tool_inventory for all
  to authenticated
  using (
    (
      tool_inventory.category is distinct from 'plant'
      and (
        public.owns_site(tool_inventory.site_id, (select auth.uid()))
        or public.is_assigned_foreman(tool_inventory.site_id, (select auth.uid()))
      )
    )
    or public.owns_pro_site(tool_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(tool_inventory.site_id, (select auth.uid()))
  )
  with check (
    (
      tool_inventory.category is distinct from 'plant'
      and (
        public.owns_site(tool_inventory.site_id, (select auth.uid()))
        or public.is_assigned_foreman(tool_inventory.site_id, (select auth.uid()))
      )
    )
    or public.owns_pro_site(tool_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(tool_inventory.site_id, (select auth.uid()))
  );

-- tool_checkout_log: visible exactly when its tool is visible. The inner
-- select is evaluated under tool_inventory's own RLS for the calling user,
-- so the tier/plant rule above applies here automatically instead of being
-- restated (and drifting). No recursion risk: tool_inventory's policy does
-- not reference tool_checkout_log back - see the RLS recursion lesson in
-- CLAUDE.md for when that matters.
drop policy if exists "Site owner or assigned foreman can view checkout log" on public.tool_checkout_log;

create policy "Site owner or assigned foreman can view checkout log"
  on public.tool_checkout_log for select
  to authenticated
  using (
    exists (
      select 1
      from public.tool_inventory t
      where t.id = tool_checkout_log.tool_id
    )
  );

-- checkout_tool()/return_tool(): the blanket "requires the Pro plan" check
-- becomes a plant-only check. Both are SECURITY DEFINER and therefore do
-- their own authorization inside the body - RLS does not protect them.
-- Signatures are unchanged, so CREATE OR REPLACE is safe here (see the
-- CLAUDE.md gotcha about parameter-list changes needing a DROP first).
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
  v_category text;
  v_worker_site_id uuid;
  v_worker_name text;
  v_present_today boolean;
  v_log_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select site_id, status, category into v_site_id, v_status, v_category
  from public.tool_inventory
  where id = p_tool_id
  for update;

  if v_site_id is null then
    raise exception 'Tool not found';
  end if;

  if not (public.owns_site(v_site_id, v_user_id) or public.is_assigned_foreman(v_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  if v_category = 'plant'
     and not exists (select 1 from public.sites where id = v_site_id and subscription_tier = 'pro') then
    raise exception 'Heavy plant tracking requires the Pro plan';
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
  v_category text;
  v_log_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select site_id, status, category into v_site_id, v_status, v_category
  from public.tool_inventory
  where id = p_tool_id
  for update;

  if v_site_id is null then
    raise exception 'Tool not found';
  end if;

  if not (public.owns_site(v_site_id, v_user_id) or public.is_assigned_foreman(v_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  if v_category = 'plant'
     and not exists (select 1 from public.sites where id = v_site_id and subscription_tier = 'pro') then
    raise exception 'Heavy plant tracking requires the Pro plan';
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
