-- Tool/equipment lifecycle (Stage 6, Tier 4 Asset/Equipment/Access).
-- tool_inventory covers both hand tools and heavy plant (distinguished by
-- `category`); checkout/return goes through SECURITY DEFINER RPCs for the
-- same reason material delivery/usage does - it's an atomic read-then-write
-- (check current status, then flip it + log the transition) that would
-- otherwise need two round trips with a race window between them.

create table public.tool_inventory (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  tool_name text not null,
  tool_id_number text,
  category text not null default 'tool', -- 'tool' | 'plant'
  status text not null default 'available', -- 'available' | 'checked_out' | 'maintenance' | 'lost'
  current_holder_name text,
  condition_notes text,
  created_at timestamptz not null default now()
);

create table public.tool_checkout_log (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid references public.tool_inventory(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete cascade not null,
  checked_out_to text not null,
  checked_out_by uuid references auth.users(id) not null,
  checked_out_at timestamptz not null default now(),
  returned_at timestamptz,
  condition_on_return text,
  notes text
);

create table public.equipment_maintenance_log (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid references public.tool_inventory(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete cascade not null,
  maintenance_type text not null, -- 'service' | 'repair' | 'inspection'
  description text,
  performed_by text,
  performed_at date not null default current_date,
  next_due_date date,
  cost numeric,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.tool_inventory enable row level security;
alter table public.tool_checkout_log enable row level security;
alter table public.equipment_maintenance_log enable row level security;

create policy "Site owner or assigned foreman can manage tools"
  on public.tool_inventory for all
  to authenticated
  using (
    public.owns_site(tool_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman(tool_inventory.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(tool_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman(tool_inventory.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all tools"
  on public.tool_inventory for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can view checkout log"
  on public.tool_checkout_log for select
  to authenticated
  using (
    public.owns_site(tool_checkout_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(tool_checkout_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all checkout logs"
  on public.tool_checkout_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage maintenance log"
  on public.equipment_maintenance_log for all
  to authenticated
  using (
    public.owns_site(equipment_maintenance_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(equipment_maintenance_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(equipment_maintenance_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(equipment_maintenance_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all maintenance logs"
  on public.equipment_maintenance_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Checks out a tool: rejects if it's not currently 'available' (already
-- checked out / in maintenance / lost), otherwise flips status and logs
-- the transition in one transaction.
create or replace function public.checkout_tool(
  p_tool_id uuid,
  p_checked_out_to text
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

  if v_status <> 'available' then
    raise exception 'Tool is not available (current status: %)', v_status;
  end if;

  insert into public.tool_checkout_log (tool_id, site_id, checked_out_to, checked_out_by)
  values (p_tool_id, v_site_id, p_checked_out_to, v_user_id)
  returning id into v_log_id;

  update public.tool_inventory
  set status = 'checked_out', current_holder_name = p_checked_out_to
  where id = p_tool_id;

  return v_log_id;
end;
$$;

-- Returns a checked-out tool: finds the open checkout row (returned_at
-- still null) for this tool and closes it, flipping status back.
create or replace function public.return_tool(
  p_tool_id uuid,
  p_condition_on_return text default null
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
  set returned_at = now(), condition_on_return = p_condition_on_return
  where id = v_log_id;

  update public.tool_inventory
  set status = 'available', current_holder_name = null
  where id = p_tool_id;

  return v_log_id;
end;
$$;

grant execute on function public.checkout_tool(uuid, text) to authenticated;
grant execute on function public.return_tool(uuid, text) to authenticated;
