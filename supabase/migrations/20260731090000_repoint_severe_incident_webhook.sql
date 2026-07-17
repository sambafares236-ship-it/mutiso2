-- The n8n Railway service that previously hosted the severe-incident webhook
-- (n8n-production-6eba.up.railway.app) is gone - confirmed dead via a direct
-- request returning Railway's own edge 404 ("Application not found", not an
-- n8n 404), meaning every medium/high-severity incident has been silently
-- failing to notify anyone by WhatsApp/email since that service disappeared
-- (pg_net's http_post is fire-and-forget, so nothing ever surfaced this).
-- The current n8n instance lives at primary-production-bd339.up.railway.app;
-- this repoints the trigger at that host, same /webhook/severe-incident path.
--
-- The webhook secret itself was also rotated out-of-band via
-- vault.update_secret() against this project directly (not committed here,
-- same reasoning as 20260730090200) since the old value had been briefly
-- committed to git in plaintext before that migration moved it into Vault.
create or replace function public.notify_owner_on_severe_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_owner_email text;
  v_owner_phone text;
  v_site_name text;
  v_webhook_secret text;
begin
  if new.severity in ('medium', 'high') then
    select s.owner_id, s.site_name, p.email_address, p.phone_number
      into v_owner_id, v_site_name, v_owner_email, v_owner_phone
    from public.sites s
    join public.profiles p on p.id = s.owner_id
    where s.id = new.site_id;

    if v_owner_id is not null then
      insert into public.notifications (recipient_id, type, related_id)
      values (v_owner_id, 'severe_incident', new.id);

      select decrypted_secret into v_webhook_secret
      from vault.decrypted_secrets
      where name = 'severe_incident_webhook_secret';

      if v_webhook_secret is not null then
        perform net.http_post(
          url := 'https://primary-production-bd339.up.railway.app/webhook/severe-incident',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', v_webhook_secret
          ),
          body := jsonb_build_object(
            'incident_id', new.id,
            'site_name', v_site_name,
            'owner_email', v_owner_email,
            'owner_phone', v_owner_phone,
            'severity', new.severity,
            'category', new.category,
            'description', new.description,
            'workers_involved', new.workers_involved,
            'date', new.date
          )
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;
