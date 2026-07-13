-- M-Pesa Daraja subscription billing. Reuses the existing `sites.monthly_rate`
-- as the charge amount - no new tier/plan system yet, that's a separate,
-- bigger task. `subscription_end` already existed on `sites` but was never
-- written to except once (subscription_start, on Super Admin approval) -
-- this is the first thing that actually extends it.
--
-- All writes to this table go through the Edge Functions using the
-- service-role key, not direct client policies - same "don't add narrow
-- client-side write policies, use server-side logic instead" lesson this
-- codebase already learned once with consume_invite/checkout_tool. There is
-- deliberately no INSERT/UPDATE policy for authenticated below.
create table public.subscription_payment (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  amount numeric not null,
  phone_number text not null,
  checkout_request_id text not null unique,
  merchant_request_id text,
  mpesa_receipt_number text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  initiated_by uuid references auth.users(id),
  initiated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.subscription_payment enable row level security;

create policy "Site owner can view their subscription payments"
  on public.subscription_payment for select
  to authenticated
  using (public.owns_site(subscription_payment.site_id, (select auth.uid())));

create policy "Admin roles can view all subscription payments"
  on public.subscription_payment for select
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Called by the mpesa-stk-callback Edge Function (service role) once
-- Safaricom confirms or rejects an STK push. Idempotent by design -
-- Safaricom can and does retry callbacks, so re-processing an
-- already-completed/failed payment is a no-op rather than double-extending
-- the subscription. On success, extends subscription_end by one month from
-- whichever is later - today, or the current subscription_end - so renewing
-- before expiry never loses already-paid-for days (same cumulative logic
-- generate_payment_certificate already uses for previous_payments_total).
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
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'p_status must be completed or failed, got %', p_status;
  end if;

  select site_id, status into v_site_id, v_current_status
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
    update public.sites
    set subscription_start = coalesce(subscription_start, current_date),
        subscription_end = (greatest(coalesce(subscription_end, current_date), current_date) + interval '1 month')::date,
        status = 'active'
    where id = v_site_id;
  end if;
end;
$$;

-- No grants to anon/authenticated - only ever called via the service_role
-- key from the mpesa-stk-callback Edge Function, same reasoning as
-- bot_query_site_data.
revoke all on function public.complete_subscription_payment(text, text, text) from public, anon, authenticated;
