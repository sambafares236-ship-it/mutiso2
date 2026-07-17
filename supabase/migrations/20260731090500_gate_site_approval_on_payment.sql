-- Payment-gated onboarding, part 2: approval is now the sole trigger for the
-- 1-month subscription clock, and is itself blocked until a payment has been
-- confirmed. Previously _extend_site_subscription() (called from both the
-- STK callback and the manual-confirmation RPC) unilaterally flipped
-- status to 'active' and set subscription_start/end the moment ANY payment
-- completed - completely bypassing admin approval. That's no longer correct
-- now that payment happens at creation time, before a site has ever been
-- reviewed.
--
-- Same signature as before (CREATE OR REPLACE is safe - no params changed).
-- Branches on the site's current status: a site that's already 'active' is
-- being renewed, so the existing extend-from-later-of-today-or-current-end
-- behavior is preserved exactly. A still-'pending' site is receiving its
-- FIRST payment - only the bot addon preference is recorded here; status
-- and subscription dates are left alone entirely, to be set by approve_site()
-- below once an admin actually reviews the site.
create or replace function public._extend_site_subscription(p_site_id uuid, p_includes_bot boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.sites where id = p_site_id;

  if v_status = 'active' then
    update public.sites
    set subscription_end = (greatest(coalesce(subscription_end, current_date), current_date) + interval '1 month')::date,
        whatsapp_bot_enabled = p_includes_bot
    where id = p_site_id;
  else
    update public.sites
    set whatsapp_bot_enabled = p_includes_bot
    where id = p_site_id;
  end if;
end;
$$;

-- Replaces the plain client-side `.update()` useApproveSite() used to do
-- directly (permitted only by the "Admin roles can manage all sites" RLS
-- policy, which still exists and still allows a raw update as an admin
-- bypass - same pattern as every other RPC-gated action in this schema, e.g.
-- payroll/checkout_tool/generate_payment_certificate). This RPC is what the
-- app actually calls now, and it's the one place that enforces "no approval
-- without a confirmed payment."
create or replace function public.approve_site(p_site_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_status text;
begin
  if v_user_id is null or not (
    public.has_role(v_user_id, 'admin') or public.has_role(v_user_id, 'super_admin')
  ) then
    raise exception 'Only an admin can approve a site';
  end if;

  select status into v_status from public.sites where id = p_site_id;
  if v_status is null then
    raise exception 'Site not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'Site is not pending approval';
  end if;

  if not exists (
    select 1 from public.subscription_payment
    where site_id = p_site_id and status = 'completed'
  ) then
    raise exception 'Cannot approve: no confirmed payment on file for this site';
  end if;

  update public.sites
  set status = 'active',
      approved_by = v_user_id,
      approved_at = now(),
      subscription_start = current_date,
      subscription_end = (current_date + interval '1 month')::date
  where id = p_site_id;
end;
$$;

grant execute on function public.approve_site(uuid) to authenticated;
