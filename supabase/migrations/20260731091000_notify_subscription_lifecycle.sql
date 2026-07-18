-- Client welcome + renewal thank-you notifications via n8n, same
-- AFTER-trigger + net.http_post + Vault-secret pattern as
-- notify_owner_on_severe_incident / permit / variation / invite.
--
-- Both events are keyed off public.sites (NOT subscription_payment) on
-- purpose: confirm_manual_subscription_payment() flips the payment row to
-- 'completed' BEFORE _extend_site_subscription() moves subscription_end, so
-- a trigger on the payment row would send the renewal message with a stale
-- (pre-extension) end date. Triggering on sites gives the fresh date and
-- covers the manual and STK renewal paths in one place.
--
--   welcome  = pending -> active            (approve_site())
--   renewal  = active  -> active AND subscription_end pushed forward
--              (_extend_site_subscription on an already-active site)
--
-- The first-ever payment never fires 'renewal': at confirm time the site is
-- still 'pending', so _extend leaves subscription_end untouched; the site
-- only reaches 'active' later via approve_site(), which is the welcome path.
--
-- One webhook, branched by a `type` field (welcome | renewal), mirroring the
-- agreed "same endpoint, branched by type" design. The shared secret lives
-- in Vault (populated out-of-band, per the severe-incident migration's
-- reasoning) - if it's absent the post is skipped, so this is safe to deploy
-- before the n8n side / secret exist. net.http_post is fire-and-forget, so a
-- briefly-unreachable webhook never blocks or fails the sites UPDATE itself.

create extension if not exists pg_net with schema extensions;

create or replace function public.notify_owner_on_subscription_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_owner_email text;
  v_owner_phone text;
  v_owner_name text;
  v_webhook_secret text;
begin
  if old.status = 'pending' and new.status = 'active' then
    v_type := 'welcome';
  elsif old.status = 'active' and new.status = 'active'
        and new.subscription_end is not null
        and (old.subscription_end is null or new.subscription_end > old.subscription_end) then
    v_type := 'renewal';
  else
    -- Some other sites UPDATE (location, name, cancellation, etc.) - not a
    -- subscription lifecycle event we notify on.
    return new;
  end if;

  select p.email_address, p.phone_number, p.full_name
    into v_owner_email, v_owner_phone, v_owner_name
  from public.profiles p
  where p.id = new.owner_id;

  -- Keep the in-app notifications row too (consistent with the other
  -- notify_* triggers), for any future in-app bell consumer.
  insert into public.notifications (recipient_id, type, related_id)
  values (new.owner_id, 'subscription_' || v_type, new.id);

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'subscription_lifecycle_webhook_secret';

  if v_webhook_secret is not null then
    perform net.http_post(
      url := 'https://primary-production-bd339.up.railway.app/webhook/subscription-lifecycle',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'type', v_type,
        'site_id', new.id,
        'site_name', new.site_name,
        'owner_email', v_owner_email,
        'owner_phone', v_owner_phone,
        'owner_name', v_owner_name,
        'subscription_tier', new.subscription_tier,
        'subscription_end', new.subscription_end,
        'whatsapp_bot_enabled', new.whatsapp_bot_enabled
      )
    );
  end if;

  return new;
end;
$$;

-- WHEN clause is just an optimization so the function body doesn't run on
-- every unrelated sites UPDATE - the function itself still makes the final
-- welcome/renewal/neither decision.
drop trigger if exists on_site_subscription_lifecycle on public.sites;
create trigger on_site_subscription_lifecycle
  after update on public.sites
  for each row
  when (
    old.status is distinct from new.status
    or old.subscription_end is distinct from new.subscription_end
  )
  execute function public.notify_owner_on_subscription_lifecycle();
