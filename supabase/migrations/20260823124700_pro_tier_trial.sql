-- Upgrade the 7-day free trial from Field Ops to Pro tier.
--
-- Product decision: a one-week trial is too short to make the case for Pro
-- (schedule of works, equipment tracking, subcontractor compliance) if the
-- prospect only ever sees Field Ops during it. Trial now grants full Pro
-- tier access for the duration, still capped to the one site the RPC
-- creates and still one trial per contractor (trial_used_at, unique
-- phone_number - unchanged from 20260731091800).
--
-- Also drops the WhatsApp-bot-in-trial logic: the bot has since been
-- removed from client-facing UI entirely (see the JengaOps -> JengaOps
-- rebrand commits), so a trial that still silently enabled it would be
-- offering a feature no longer exposed anywhere in the app.
--
-- Lockout on expiry needs no new machinery here either: subscription_end is
-- already what owns_site()/is_assigned_foreman() gate on as of
-- 20260731090600, so a lapsed trial (Pro or Field Ops) locks the site the
-- same way a lapsed paid subscription does. No downgrade path - full
-- lockout until the contractor picks a paid plan, per product decision.

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

  -- Phone is still required at signup regardless of the trial (see Auth.tsx
  -- / is_phone_number_available), so this remains a defensive check rather
  -- than a live gate on a bot feature.
  if v_phone is null or trim(v_phone) = '' then
    raise exception 'Add your phone number in Settings before starting the trial';
  end if;

  insert into public.sites (
    owner_id, site_name, location, subscription_tier, status,
    whatsapp_bot_enabled, subscription_start, subscription_end,
    is_trial, approved_at
  ) values (
    v_user_id,
    trim(p_site_name),
    nullif(trim(coalesce(p_location, '')), ''),
    'pro',
    'active',
    false,
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
