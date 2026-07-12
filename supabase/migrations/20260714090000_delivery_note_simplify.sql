-- Reverses part of the Stage 5 delivery-note upgrade at the user's
-- request: the ordered-vs-received mismatch flagging and waybill number
-- added no real value in practice, and "waybill photo" is being replaced
-- with a plainer "receipt photo" concept. Only the received quantity is
-- tracked going forward.

alter table public.materials_delivered
  drop column waybill_number,
  drop column ordered_quantity;

alter table public.materials_delivered
  rename column waybill_photo_url to receipt_photo_url;

-- Signature is shrinking from 9 args to 7 - CREATE OR REPLACE won't drop
-- the old 9-arg overload (Postgres identifies functions by name + arg
-- types), so the old signature must be dropped explicitly first.
drop function if exists public.log_material_delivery(uuid, text, text, numeric, text, date, text, text, numeric);

create function public.log_material_delivery(
  p_site_id uuid,
  p_material_name text,
  p_supplier text,
  p_quantity numeric,
  p_unit text,
  p_date date default current_date,
  p_receipt_photo_url text default null
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
    (site_id, date, material_name, supplier, quantity, unit, created_by, receipt_photo_url)
  values
    (p_site_id, p_date, p_material_name, p_supplier, p_quantity, p_unit, v_user_id, p_receipt_photo_url);

  insert into public.material_inventory (site_id, material_name, current_quantity, unit, last_updated)
  values (p_site_id, p_material_name, p_quantity, p_unit, now())
  on conflict (site_id, material_name)
  do update set
    current_quantity = public.material_inventory.current_quantity + excluded.current_quantity,
    unit = excluded.unit,
    last_updated = now();
end;
$$;

grant execute on function public.log_material_delivery(uuid, text, text, numeric, text, date, text) to authenticated;
