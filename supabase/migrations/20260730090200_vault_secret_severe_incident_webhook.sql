-- notify_owner_on_severe_incident() (20260728090200) hardcoded the n8n
-- webhook's shared secret directly in the function body - readable by
-- anything with sufficient privilege to inspect pg_proc, and it was about
-- to be committed to git in plaintext. Moves it into Supabase Vault
-- (pgsodium-encrypted secret storage) instead, read by name at call time.
--
-- Deliberately does NOT insert the secret value here - a migration file is
-- git-tracked, and a secret belongs in Vault the same way an Edge Function
-- secret belongs in `supabase secrets set`, never in a committed file. The
-- actual secret is inserted directly against each project (dev and prod)
-- via `select vault.create_secret(...)` run once, out of band, and the
-- n8n webhook's "Verify Secret" node is updated to match the same rotated
-- value - both must change together or the webhook starts rejecting every
-- request.

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
          url := 'https://n8n-production-6eba.up.railway.app/webhook/severe-incident',
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
