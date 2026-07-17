-- Payment-gated onboarding, part 3: hard lockout when subscription_end
-- passes with no renewal. owns_site()/is_assigned_foreman() are the two
-- SECURITY DEFINER helpers nearly every owner/foreman-gated table in this
-- schema is built on (same reasoning as 20260730090800's status='active'
-- gate and 20260730090900's owns_pro_site() tier gate) - tightening these
-- two propagates the lockout across virtually the whole schema in one
-- change, without touching dozens of individual table policies.

-- Backfill BEFORE tightening the functions below: every currently-'active'
-- site approved under the old no-payment-required flow has a null
-- subscription_end. Without this, deploying the lockout would instantly and
-- silently cut off every existing active site with no payment history, dev
-- and prod alike. Gives them one retroactive month from approval (or
-- creation, if never formally approved) - the same "one month from the
-- moment the site became usable" semantics approve_site() now applies going
-- forward.
update public.sites
set subscription_start = coalesce(subscription_start, coalesce(approved_at::date, created_at::date)),
    subscription_end = coalesce(subscription_end, (coalesce(approved_at::date, created_at::date) + interval '1 month')::date)
where status = 'active' and subscription_end is null;

create or replace function public.owns_site(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = _site_id
      and s.owner_id = _user_id
      and s.status = 'active'
      and s.subscription_end >= current_date
  )
$$;

create or replace function public.is_assigned_foreman(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_assignments sa
    join public.sites s on s.id = sa.site_id
    where sa.site_id = _site_id
      and sa.foreman_id = _user_id
      and sa.is_active
      and s.status = 'active'
      and s.subscription_end >= current_date
  )
$$;

-- Self-lock fix, found while auditing every owns_site() caller before
-- tightening it above: request_manual_subscription_payment() (the RPC a
-- contractor calls to pay/renew) and subscription_payment's own "view your
-- payments" RLS policy both gated on owns_site(). Once owns_site() requires
-- a non-expired subscription, an expired site's owner would fail both checks
-- - meaning they could never submit a renewal payment, nor even see their
-- own payment history, once locked out. Expiry would become permanent and
-- unrecoverable. Both need ownership only, not full entitlement - same
-- reasoning the `sites` table's own policies already use (direct
-- `owner_id = auth.uid()`, never routed through owns_site(), precisely so a
-- contractor can always see/manage their own pending/cancelled/expired site
-- rows per 20260730090800's comments).
create or replace function public.is_site_owner(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sites where id = _site_id and owner_id = _user_id
  )
$$;

drop policy if exists "Site owner can view their subscription payments" on public.subscription_payment;

create policy "Site owner can view their subscription payments"
  on public.subscription_payment for select
  to authenticated
  using (public.is_site_owner(subscription_payment.site_id, (select auth.uid())));

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
