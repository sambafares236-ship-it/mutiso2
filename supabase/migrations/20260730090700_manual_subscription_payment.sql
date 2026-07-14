-- Manual M-Pesa payment path - interim until Safaricom production Daraja
-- credentials exist (mpesa-stk-push stays sandbox-only for now). Contractor
-- sends money directly to the operator's personal number via M-Pesa "Send
-- Money" (0700 920 985 / 254700920985), then self-reports it here. A
-- client-submitted "I paid" claim is NOT itself trusted - only the Super
-- Admin's explicit confirmation actually extends the subscription, mirroring
-- how only Safaricom's own STK callback (never the client) is trusted for
-- the automated path. Both paths coexist so this can switch back to
-- STK-only later without removing anything.

alter table public.subscription_payment
  add column payment_method text not null default 'mpesa_stk'
    check (payment_method in ('mpesa_stk', 'manual'));

-- Shared extension logic factored out of complete_subscription_payment so
-- the manual confirmation path grants exactly the same outcome via its own
-- separate trust check, without duplicating the update. Not exposed to any
-- role - only called from within the two SECURITY DEFINER functions below.
create or replace function public._extend_site_subscription(p_site_id uuid, p_includes_bot boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sites
  set subscription_start = coalesce(subscription_start, current_date),
      subscription_end = (greatest(coalesce(subscription_end, current_date), current_date) + interval '1 month')::date,
      status = 'active',
      whatsapp_bot_enabled = p_includes_bot
  where id = p_site_id;
end;
$$;

revoke all on function public._extend_site_subscription(uuid, boolean) from public, anon, authenticated;

-- Same signature as before (no parameter change) - just calls the shared
-- helper instead of inlining the same update.
create or replace function public.complete_subscription_payment(
  p_checkout_request_id text,
  p_status text,
  p_mpesa_receipt_number text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_id uuid;
  v_current_status text;
  v_includes_bot boolean;
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'p_status must be completed or failed, got %', p_status;
  end if;

  select site_id, status, includes_bot into v_site_id, v_current_status, v_includes_bot
  from public.subscription_payment
  where checkout_request_id = p_checkout_request_id
  for update;

  if v_site_id is null then
    raise exception 'No subscription_payment found for checkout_request_id %', p_checkout_request_id;
  end if;

  if v_current_status <> 'pending' then
    return;
  end if;

  update public.subscription_payment
  set status = p_status,
      mpesa_receipt_number = p_mpesa_receipt_number,
      completed_at = now()
  where checkout_request_id = p_checkout_request_id;

  if p_status = 'completed' then
    perform public._extend_site_subscription(v_site_id, v_includes_bot);
  end if;
end;
$$;

-- Contractor (or admin) self-reports a manual payment as pending. Amount is
-- computed server-side from the site's tier + bot choice (same 4 numbers as
-- TIER_PRICING in src/lib/pricing.ts and mpesa-stk-push/index.ts - kept in
-- sync manually across all three, a small fixed set) rather than trusting a
-- client-supplied amount. Requires a phone_number on the caller's profile,
-- same precondition mpesa-stk-push already enforces, so the Super Admin has
-- something to cross-reference against the M-Pesa SMS when confirming.
create or replace function public.request_manual_subscription_payment(
  p_site_id uuid,
  p_includes_bot boolean,
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

  if not (
    public.owns_site(p_site_id, v_user_id)
    or public.has_role(v_user_id, 'admin')
    or public.has_role(v_user_id, 'super_admin')
  ) then
    raise exception 'Not authorized for this site';
  end if;

  select subscription_tier into v_tier from public.sites where id = p_site_id;
  if v_tier is null then
    raise exception 'Site not found';
  end if;

  select phone_number into v_phone from public.profiles where id = v_user_id;
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

-- Super-admin-only confirmation - this is the actual trust boundary for the
-- manual path. Idempotent, same reasoning as complete_subscription_payment
-- (re-confirming an already-completed payment is a no-op, not a double
-- extension).
create or replace function public.confirm_manual_subscription_payment(
  p_payment_id uuid,
  p_mpesa_receipt_number text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_includes_bot boolean;
  v_status text;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'super_admin') then
    raise exception 'Only a super admin can confirm a manual payment';
  end if;

  select site_id, includes_bot, status into v_site_id, v_includes_bot, v_status
  from public.subscription_payment
  where id = p_payment_id and payment_method = 'manual'
  for update;

  if v_site_id is null then
    raise exception 'Manual payment not found';
  end if;

  if v_status <> 'pending' then
    return;
  end if;

  update public.subscription_payment
  set status = 'completed',
      mpesa_receipt_number = coalesce(p_mpesa_receipt_number, mpesa_receipt_number),
      completed_at = now()
  where id = p_payment_id;

  perform public._extend_site_subscription(v_site_id, v_includes_bot);
end;
$$;

grant execute on function public.confirm_manual_subscription_payment(uuid, text) to authenticated;
