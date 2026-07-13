-- Severe incidents already wrote a row into public.notifications via
-- notify_owner_on_severe_incident(), but nothing ever read that table (no
-- frontend consumer exists) - so the notification was silently dead.
-- This extends the same trigger to also push the incident straight to the
-- n8n automation instance (WhatsApp + email), in addition to keeping the
-- notifications row for any future in-app bell.
--
-- pg_net's http_post is fire-and-forget/async (queues the request and
-- returns immediately), so it doesn't block or risk failing the incident
-- INSERT itself even if the webhook endpoint is briefly unreachable.
create extension if not exists pg_net with schema extensions;

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

      perform net.http_post(
        url := 'https://n8n-production-6eba.up.railway.app/webhook/severe-incident',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', '10367ee670439ebcad0803ce4513290d5e48f50e1e786623'
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
  return new;
end;
$$;
