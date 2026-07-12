-- Logging usage needs to (1) check there's enough stock, (2) deduct it,
-- and (3) record the usage - as one atomic operation, not three separate
-- client round-trips that could race (two foremen logging usage of the
-- same material at the same moment could both read the same
-- current_quantity before either deduction lands, over-drawing stock).
-- Same reasoning as consume_invite() in Stage 1: SECURITY DEFINER RPC,
-- not multi-step client-side writes, for anything that must be atomic.

create or replace function public.log_material_usage(
  p_site_id uuid,
  p_material_name text,
  p_quantity numeric,
  p_unit text,
  p_description text,
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_current numeric;
  v_authorized boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_authorized := public.owns_site(p_site_id, v_user_id) or public.is_assigned_foreman(p_site_id, v_user_id);
  if not v_authorized then
    raise exception 'Not authorized for this site';
  end if;

  select current_quantity into v_current
  from public.material_inventory
  where site_id = p_site_id and material_name = p_material_name
  for update;

  if not found then
    raise exception '% has no recorded stock at this site. Log a delivery first.', p_material_name;
  end if;

  if p_quantity > v_current then
    raise exception 'Only % % of % available. Cannot log %.', v_current, coalesce(p_unit, 'units'), p_material_name, p_quantity;
  end if;

  update public.material_inventory
  set current_quantity = v_current - p_quantity, last_updated = now()
  where site_id = p_site_id and material_name = p_material_name;

  insert into public.material_usage_log (site_id, date, material_name, quantity, unit, description, created_by)
  values (p_site_id, p_date, p_material_name, p_quantity, p_unit, p_description, v_user_id);
end;
$$;

grant execute on function public.log_material_usage(uuid, text, numeric, text, text, date) to authenticated;

-- Deliveries increment (or create) the matching inventory row, same
-- atomicity reasoning.
create or replace function public.log_material_delivery(
  p_site_id uuid,
  p_material_name text,
  p_supplier text,
  p_quantity numeric,
  p_unit text,
  p_date date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_authorized boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_authorized := public.owns_site(p_site_id, v_user_id) or public.is_assigned_foreman(p_site_id, v_user_id);
  if not v_authorized then
    raise exception 'Not authorized for this site';
  end if;

  insert into public.materials_delivered (site_id, date, material_name, supplier, quantity, unit, created_by)
  values (p_site_id, p_date, p_material_name, p_supplier, p_quantity, p_unit, v_user_id);

  insert into public.material_inventory (site_id, material_name, current_quantity, unit, last_updated)
  values (p_site_id, p_material_name, p_quantity, p_unit, now())
  on conflict (site_id, material_name)
  do update set
    current_quantity = public.material_inventory.current_quantity + excluded.current_quantity,
    unit = excluded.unit,
    last_updated = now();
end;
$$;

grant execute on function public.log_material_delivery(uuid, text, text, numeric, text, date) to authenticated;
