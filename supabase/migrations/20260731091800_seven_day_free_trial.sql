-- 7-day free trial.
--
-- This is a deliberate, narrow exception to the invariant established in
-- 20260731090400: that a site can never exist without a subscription_payment
-- row beside it. That rule was introduced to stop the old failure where sites
-- went live having never paid (6 of 7 prod sites, at the time). A trial site
-- is the one legitimate case of an active-but-unpaid site, so rather than
-- weakening create_site_with_manual_payment(), trials get their own RPC and
-- their own flag, and everything else about the invariant stands.
--
-- Trial contents (product decision): Field Ops & Safety tier WITH the WhatsApp
-- assistant enabled, active immediately (no admin approval - waiting for a
-- human to approve a free trial defeats the point), for 7 days.
--
-- Expiry needs no new machinery: subscription_end is already what
-- owns_site()/is_assigned_foreman() gate on, so a lapsed trial locks the site
-- exactly like a lapsed paid subscription, and isSubscriptionExpiringSoon()
-- already warns in the UI.

alter table public.sites add column is_trial boolean not null default false;
alter table public.profiles add column trial_used_at timestamptz;

comment on column public.sites.is_trial is
  'True while this site is on the free trial (active, no payment). Cleared once a real payment completes.';
comment on column public.profiles.trial_used_at is
  'When this contractor started their one free trial. Non-null means no further trials.';

-- One trial per contractor, ever. Without this a contractor could spin up
-- unlimited free sites and never pay. profiles.phone_number is unique as of
-- 20260731091700, which also makes "just make another account" harder.
create or replace function public.start_trial_site(
  p_site_name text,
  p_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trial_used timestamptz;
  v_phone text;
  v_site_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_site_name is null or length(trim(p_site_name)) = 0 then
    raise exception 'Site name is required';
  end if;

  select trial_used_at, phone_number into v_trial_used, v_phone
    from public.profiles where id = v_user_id;

  if v_trial_used is not null then
    raise exception 'You have already used your free trial';
  end if;

  -- The trial includes the WhatsApp assistant, and the assistant identifies a
  -- contractor purely by their phone number. Starting a bot-enabled trial for
  -- a profile with no number would hand them a headline feature that silently
  -- never responds - exactly the failure 20260731091700 was written to fix.
  if v_phone is null or trim(v_phone) = '' then
    raise exception 'Add your WhatsApp phone number in Settings before starting the trial';
  end if;

  insert into public.sites (
    owner_id, site_name, location, subscription_tier, status,
    whatsapp_bot_enabled, subscription_start, subscription_end,
    is_trial, approved_at
  ) values (
    v_user_id,
    trim(p_site_name),
    nullif(trim(coalesce(p_location, '')), ''),
    'field_ops',
    'active',
    true,
    current_date,
    (current_date + interval '7 days')::date,
    true,
    now()
  )
  returning id into v_site_id;

  update public.profiles set trial_used_at = now() where id = v_user_id;

  return v_site_id;
end;
$$;

grant execute on function public.start_trial_site(text, text) to authenticated;

-- A trial site is already 'active', so a later payment flows through the
-- renewal branch here rather than approve_site() (which only accepts a
-- 'pending' site). Clearing is_trial is what marks the conversion - the
-- subscription window itself extends from whichever is later, the trial's
-- remaining days or today, so a contractor who pays on day 2 keeps the rest
-- of their trial rather than being silently penalised for paying early.
--
-- Same signature, so CREATE OR REPLACE genuinely replaces it.
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
        whatsapp_bot_enabled = p_includes_bot,
        is_trial = false
    where id = p_site_id;
  else
    update public.sites
    set whatsapp_bot_enabled = p_includes_bot
    where id = p_site_id;
  end if;
end;
$$;

-- approve_site() covers the other conversion path: a contractor who let their
-- trial lapse into lockout, then paid. That still requires a confirmed
-- payment, so it stays the gate it always was - this only makes sure the site
-- stops being labelled a trial once it is genuinely paid for.
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
      is_trial = false
  where id = p_site_id;
end;
$$;
