-- "Buy any package, get the WhatsApp assistant free for your first month."
--
-- Replaces the (withdrawn) 7-day free trial as the onboarding sweetener. The
-- WhatsApp bot was a paid add-on gated by sites.whatsapp_bot_enabled (see
-- 20260731091600). Rather than overload that flag - which would conflate "paid
-- for the add-on" with "got it free", and could be flipped off by an early
-- renewal through _extend_site_subscription() - the promo gets its own column.
--
-- Bot access becomes "paid add-on OR still inside the free window". The free
-- window is a fixed date, so it survives a renewal that doesn't buy the add-on
-- (whatsapp_bot_enabled would flip to false, but the free date still stands
-- until it naturally lapses). Once past, the OR clause simply stops matching -
-- no cleanup needed, which is why _extend_site_subscription() is untouched.
--
-- Granted per site, once, at first approval: approve_site() only ever runs for
-- a 'pending' site, so renewals never re-grant it. The window lines up with
-- the first subscription month by construction (both are current_date + 1mo).

alter table public.sites
  add column whatsapp_bot_free_until date;

comment on column public.sites.whatsapp_bot_free_until is
  'Promo: the WhatsApp assistant is free until this date regardless of whatsapp_bot_enabled (the paid add-on). Set once at first approval (approve_site) to current_date + 1 month. A lapsed date is inert. Read by site_whatsapp_bot_active() and mirrored by the n8n chatbot Resolve Contractor query.';

-- Backstop that actually enforces bot access inside bot_query_site_data().
-- Signature unchanged, so a plain CREATE OR REPLACE is correct. Only the bot
-- clause changes: the paid flag OR an unlapsed free window. status='active'
-- and subscription_end guards are kept verbatim (subscription_end >=
-- current_date is null-safe - a null end yields false).
create or replace function public.site_whatsapp_bot_active(_site_id uuid)
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
      and s.status = 'active'
      and s.subscription_end >= current_date
      and (
        s.whatsapp_bot_enabled
        or (s.whatsapp_bot_free_until is not null and s.whatsapp_bot_free_until >= current_date)
      )
  )
$$;

comment on function public.site_whatsapp_bot_active(uuid) is
  'True when this site may use the WhatsApp add-on: subscription is active and unlapsed, and it either pays for the add-on (whatsapp_bot_enabled) or is inside its free first-month window (whatsapp_bot_free_until). Single definition of "may this site use WhatsApp", used by bot_query_site_data() and mirrored by the n8n chatbot/Resolve Contractor query.';

-- Approval is the sole trigger for the 1-month subscription clock (see
-- 20260731090500). It now also opens the free WhatsApp window for the same
-- month. Same signature/body as 20260731090500 apart from the added
-- whatsapp_bot_free_until assignment in the final update.
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
      subscription_end = (current_date + interval '1 month')::date,
      whatsapp_bot_free_until = (current_date + interval '1 month')::date
  where id = p_site_id;
end;
$$;

grant execute on function public.approve_site(uuid) to authenticated;

-- Extend the offer to sites approved before this shipped: every currently
-- active site that isn't already paying for the add-on gets the assistant free
-- for the remainder of its current subscription period. Bounded (never past
-- subscription_end) and generous. Sites that already pay (whatsapp_bot_enabled)
-- are left alone - they have the bot regardless.
update public.sites
set whatsapp_bot_free_until = subscription_end
where status = 'active'
  and not whatsapp_bot_enabled
  and subscription_end is not null
  and subscription_end >= current_date
  and whatsapp_bot_free_until is null;
