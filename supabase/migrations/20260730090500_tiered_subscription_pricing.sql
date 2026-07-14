-- Real tier/trial/bot-addon billing, replacing the flat monthly_rate this
-- was deliberately scoped out of when subscription_payment was first built
-- (see that migration's own comment). Confirmed monthly_rate has no other
-- reader anywhere in the app besides the M-Pesa flow being replaced here.
--
-- Tier is a fixed, small set (2 values) - text + check constraint, matching
-- this codebase's existing convention (sites.status, incident_log.category)
-- rather than a Postgres enum or a separate price_table reference table.
-- "In trial" is deliberately NOT a stored flag - it's derived client-side
-- from subscription_end being set with no completed subscription_payment
-- yet, same "compute, don't store" bias as useScheduleProgress/AtAGlanceStats.

alter table public.sites
  add column subscription_tier text not null default 'field_ops'
    check (subscription_tier in ('field_ops', 'pro')),
  add column whatsapp_bot_enabled boolean not null default false;

alter table public.sites drop column monthly_rate;

-- Records what was actually purchased, not just the amount - so
-- complete_subscription_payment can flip whatsapp_bot_enabled correctly
-- without inferring intent from a numeric amount (which would silently
-- break if prices ever change).
alter table public.subscription_payment
  add column includes_bot boolean not null default false;

-- Same shape as before (no parameter change, so a plain CREATE OR REPLACE
-- is safe here - see the "adding params creates an overload" gotcha this
-- only applies when the signature itself changes). Now also flips
-- whatsapp_bot_enabled based on what this specific payment purchased.
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
    update public.sites
    set subscription_start = coalesce(subscription_start, current_date),
        subscription_end = (greatest(coalesce(subscription_end, current_date), current_date) + interval '1 month')::date,
        status = 'active',
        whatsapp_bot_enabled = v_includes_bot
    where id = v_site_id;
  end if;
end;
$$;
