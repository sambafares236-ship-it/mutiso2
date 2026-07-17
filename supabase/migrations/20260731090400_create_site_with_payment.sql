-- Payment-gated onboarding, part 1: a site can no longer be created without
-- a payment record alongside it. Previously useCreateSite() was a plain
-- client-side insert with no payment involved at all - a contractor could
-- create any number of 'pending' sites with nothing ever paid. This RPC
-- inserts the sites row and its first subscription_payment row in one
-- transaction, same "atomic multi-step operation" reasoning this codebase
-- already applies to consume_invite()/log_material_delivery()/etc.
--
-- Manual-payment-only for now (PAYMENT_MODE = 'manual' in src/lib/payment.ts
-- - the STK path is dormant pending production Daraja credentials). Amount
-- is computed server-side from the same 4 fixed tier numbers already
-- duplicated across src/lib/pricing.ts, mpesa-stk-push/index.ts, and
-- request_manual_subscription_payment() below - same "small fixed set,
-- duplication is cheaper than shared infra" reasoning as those three.
create or replace function public.create_site_with_manual_payment(
  p_site_name text,
  p_location text,
  p_subscription_tier text,
  p_includes_bot boolean,
  p_mpesa_receipt_number text default null
)
returns table(site_id uuid, payment_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_phone text;
  v_amount numeric;
  v_site_id uuid;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_subscription_tier not in ('field_ops', 'pro') then
    raise exception 'Unknown subscription tier: %', p_subscription_tier;
  end if;

  if p_site_name is null or length(trim(p_site_name)) = 0 then
    raise exception 'Site name is required';
  end if;

  select phone_number into v_phone from public.profiles where id = v_user_id;
  if v_phone is null then
    raise exception 'Add a phone number to your profile before creating a site';
  end if;

  v_amount := case
    when p_subscription_tier = 'field_ops' and p_includes_bot then 4000
    when p_subscription_tier = 'field_ops' then 2500
    when p_subscription_tier = 'pro' and p_includes_bot then 7000
    when p_subscription_tier = 'pro' then 5000
  end;

  -- No owns_site() check needed here - this is inserting fresh rows the
  -- caller will own, not acting on an existing row id.
  insert into public.sites (owner_id, site_name, location, subscription_tier, status)
  values (v_user_id, trim(p_site_name), nullif(trim(coalesce(p_location, '')), ''), p_subscription_tier, 'pending')
  returning id into v_site_id;

  insert into public.subscription_payment (
    site_id, amount, includes_bot, phone_number, checkout_request_id,
    payment_method, status, mpesa_receipt_number, initiated_by
  ) values (
    v_site_id, v_amount, p_includes_bot, v_phone, 'MANUAL-' || gen_random_uuid()::text,
    'manual', 'pending', p_mpesa_receipt_number, v_user_id
  )
  returning id into v_payment_id;

  return query select v_site_id, v_payment_id;
end;
$$;

grant execute on function public.create_site_with_manual_payment(text, text, text, boolean, text) to authenticated;
