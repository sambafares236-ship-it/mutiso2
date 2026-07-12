-- Delivery note upgrade: materials_delivered currently just logs a
-- free-text supplier name and quantity - no reference to the actual
-- paper delivery note, no record of discrepancies between what was
-- ordered and what arrived. Adding waybill reference + a mismatch flag
-- computed from ordered vs. received quantity.

alter table public.materials_delivered
  add column waybill_number text,
  add column waybill_photo_url text,
  add column ordered_quantity numeric;

-- Replaces the Stage 2 version of this RPC to also accept the new
-- fields. Postgres identifies functions by name + argument TYPES, not
-- just name - adding new parameters (even with defaults) makes this a
-- different signature, so CREATE OR REPLACE alone would create an
-- overload sitting alongside the old 6-arg version rather than actually
-- replacing it. Drop the old signature explicitly first.
drop function if exists public.log_material_delivery(uuid, text, text, numeric, text, date);

create function public.log_material_delivery(
  p_site_id uuid,
  p_material_name text,
  p_supplier text,
  p_quantity numeric,
  p_unit text,
  p_date date default current_date,
  p_waybill_number text default null,
  p_waybill_photo_url text default null,
  p_ordered_quantity numeric default null
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

  insert into public.materials_delivered
    (site_id, date, material_name, supplier, quantity, unit, created_by, waybill_number, waybill_photo_url, ordered_quantity)
  values
    (p_site_id, p_date, p_material_name, p_supplier, p_quantity, p_unit, v_user_id, p_waybill_number, p_waybill_photo_url, p_ordered_quantity);

  insert into public.material_inventory (site_id, material_name, current_quantity, unit, last_updated)
  values (p_site_id, p_material_name, p_quantity, p_unit, now())
  on conflict (site_id, material_name)
  do update set
    current_quantity = public.material_inventory.current_quantity + excluded.current_quantity,
    unit = excluded.unit,
    last_updated = now();
end;
$$;

grant execute on function public.log_material_delivery(uuid, text, text, numeric, text, date, text, text, numeric) to authenticated;
