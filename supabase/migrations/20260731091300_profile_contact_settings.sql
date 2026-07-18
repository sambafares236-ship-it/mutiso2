-- Contractor-editable contact settings.
--
-- profiles.phone_number was doing double duty: it is both the WhatsApp
-- identity the chatbot resolves a contractor by (see the n8n "Resolve
-- Contractor" node, which matches on regexp_replace(phone_number,'\D','','g'))
-- AND the number recorded against an M-Pesa subscription payment. Now that a
-- contractor can edit their own contact details, those two need to be able to
-- differ - the phone that receives WhatsApp alerts is not necessarily the
-- phone that pays the bill.
--
-- phone_number keeps its existing meaning (WhatsApp / notifications) so the
-- bot lookup and every existing alert path are unaffected. The new column is
-- payment-only, and is nullable with a fallback so that every existing
-- profile - none of which have one set - keeps working exactly as before.
alter table public.profiles add column mpesa_phone_number text;

comment on column public.profiles.phone_number is
  'WhatsApp/notification number. The chatbot resolves a contractor by matching this (digits only) against the inbound WhatsApp number, so it must be stored in international format (254...).';
comment on column public.profiles.mpesa_phone_number is
  'Optional M-Pesa number for subscription payments. Falls back to phone_number when null.';

-- Both functions below keep the exact same name and argument types as their
-- previous definitions, so CREATE OR REPLACE genuinely replaces them rather
-- than creating a second overload (the repo has been bitten by that before
-- when a parameter list changed - it has not changed here).

create or replace function public.create_site_with_manual_payment(
  p_site_name text,
  p_location text default null,
  p_subscription_tier text default null,
  p_includes_bot boolean default false,
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

  if p_subscription_tier is null or p_subscription_tier not in ('field_ops', 'pro') then
    raise exception 'Unknown subscription tier: %', p_subscription_tier;
  end if;

  if p_site_name is null or length(trim(p_site_name)) = 0 then
    raise exception 'Site name is required';
  end if;

  -- Payment number, falling back to the WhatsApp number when none is set.
  select coalesce(nullif(trim(coalesce(mpesa_phone_number, '')), ''), phone_number)
    into v_phone
    from public.profiles where id = v_user_id;
  if v_phone is null then
    raise exception 'Add a phone number to your profile before creating a site';
  end if;

  v_amount := case
    when p_subscription_tier = 'field_ops' and p_includes_bot then 4000
    when p_subscription_tier = 'field_ops' then 2500
    when p_subscription_tier = 'pro' and p_includes_bot then 7000
    when p_subscription_tier = 'pro' then 5000
  end;

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

create or replace function public.request_manual_subscription_payment(
  p_site_id uuid,
  p_includes_bot boolean default false,
  p_mpesa_receipt_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier text;
  v_phone text;
  v_amount numeric;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- is_site_owner() deliberately, not owns_site(): an expired site's owner
  -- must still be able to pay their way back in.
  if not (
    public.is_site_owner(p_site_id, v_user_id)
    or public.has_role(v_user_id, 'admin')
    or public.has_role(v_user_id, 'super_admin')
  ) then
    raise exception 'Not authorized for this site';
  end if;

  select subscription_tier into v_tier from public.sites where id = p_site_id;
  if v_tier is null then
    raise exception 'Site not found';
  end if;

  -- Payment number, falling back to the WhatsApp number when none is set.
  select coalesce(nullif(trim(coalesce(mpesa_phone_number, '')), ''), phone_number)
    into v_phone
    from public.profiles where id = v_user_id;
  if v_phone is null then
    raise exception 'Add a phone number to your profile before reporting a payment';
  end if;

  v_amount := case
    when v_tier = 'field_ops' and p_includes_bot then 4000
    when v_tier = 'field_ops' then 2500
    when v_tier = 'pro' and p_includes_bot then 7000
    when v_tier = 'pro' then 5000
  end;
  if v_amount is null then
    raise exception 'Unknown subscription tier: %', v_tier;
  end if;

  insert into public.subscription_payment (
    site_id, amount, includes_bot, phone_number, checkout_request_id,
    payment_method, status, mpesa_receipt_number, initiated_by
  ) values (
    p_site_id, v_amount, p_includes_bot, v_phone, 'MANUAL-' || gen_random_uuid()::text,
    'manual', 'pending', p_mpesa_receipt_number, v_user_id
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

grant execute on function public.request_manual_subscription_payment(uuid, boolean, text) to authenticated;
