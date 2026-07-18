-- Time-based renewal reminders have no natural DB event to trigger on (a
-- date silently getting closer isn't an INSERT/UPDATE), so unlike the
-- welcome/renewal webhooks this is PULLED, not pushed: an n8n Schedule node
-- runs daily, selects from this view, and sends WhatsApp/email per row.
-- Keeping the "which sites, which reminder" logic here (version-controlled)
-- rather than buried in an n8n Postgres-node query string.
--
-- Threshold-exact by design: a row appears only when days_left is exactly 5
-- or 1, or on the first day past expiry (-1). A daily job therefore sends
-- each reminder once without needing a sent-log table - the same
-- "compute, don't store" choice as the client-side isSubscriptionExpiringSoon()
-- badge. Tradeoff: if a daily run is skipped (n8n downtime) that day's cohort
-- misses that reminder; acceptable for v1, revisit with a reminder_log if
-- delivery ever has to be guaranteed.
--
--   expiring_5d : subscription_end is 5 days out  ("renew soon")
--   expiring_1d : subscription_end is tomorrow     ("renews tomorrow")
--   expired     : subscription_end was yesterday   (access now paused)
--
-- Only active sites with a real subscription_end are considered.

create or replace view public.subscription_reminder_queue
with (security_invoker = on) as
select
  s.id            as site_id,
  s.site_name,
  s.subscription_tier,
  s.subscription_end,
  s.whatsapp_bot_enabled,
  (s.subscription_end - current_date) as days_left,
  case (s.subscription_end - current_date)
    when 5  then 'expiring_5d'
    when 1  then 'expiring_1d'
    when -1 then 'expired'
  end as reminder_kind,
  p.email_address as owner_email,
  p.phone_number  as owner_phone,
  p.full_name     as owner_name
from public.sites s
join public.profiles p on p.id = s.owner_id
where s.status = 'active'
  and s.subscription_end is not null
  and (s.subscription_end - current_date) in (5, 1, -1);

-- This view carries every owner's email/phone. A plain view in `public` is
-- auto-exposed through PostgREST, so without this an authenticated (or anon)
-- user could read the whole table of owner contacts via the API - the same
-- exposure class as the n8n_chat_histories lockdown. n8n reads it over its
-- own direct `postgres` connection, which these revokes don't touch.
revoke all on public.subscription_reminder_queue from anon, authenticated;
