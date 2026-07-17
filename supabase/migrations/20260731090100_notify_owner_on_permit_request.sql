-- Permit-to-work request notification: a foreman (or the owner themselves)
-- requesting a permit currently only reaches the owner via the in-app
-- notifications feed, which they have to think to check. Adds a WhatsApp
-- nudge via n8n, same AFTER INSERT + net.http_post + Vault-secret pattern
-- as notify_owner_on_severe_incident() (20260730090200) - see that
-- migration's reasoning for why the webhook secret isn't inserted here
-- (Vault, populated out-of-band via `select vault.create_secret(...)`).
--
-- Guards against notifying an owner about their own permit request - the
-- work_permit INSERT policy allows either the owner or the assigned
-- foreman to request a permit, unlike most tables where only the foreman
-- would plausibly be the one filing something for the owner to review.

create or replace function public.notify_owner_on_permit_request()
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
  v_requester_name text;
  v_webhook_secret text;
begin
  select s.owner_id, s.site_name into v_owner_id, v_site_name
  from public.sites s
  where s.id = new.site_id;

  if v_owner_id is not null and v_owner_id <> new.requested_by then
    select p.email_address, p.phone_number into v_owner_email, v_owner_phone
    from public.profiles p
    where p.id = v_owner_id;

    select p.full_name into v_requester_name
    from public.profiles p
    where p.id = new.requested_by;

    insert into public.notifications (recipient_id, type, related_id)
    values (v_owner_id, 'permit_requested', new.id);

    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'permit_requested_webhook_secret';

    if v_webhook_secret is not null then
      perform net.http_post(
        url := 'https://primary-production-bd339.up.railway.app/webhook/permit-requested',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_webhook_secret
        ),
        body := jsonb_build_object(
          'permit_id', new.id,
          'site_name', v_site_name,
          'owner_email', v_owner_email,
          'owner_phone', v_owner_phone,
          'permit_type', new.permit_type,
          'description', new.description,
          'requested_by_name', v_requester_name,
          'valid_from', new.valid_from,
          'valid_to', new.valid_to
        )
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger on_permit_insert_notify_owner
  after insert on public.work_permit
  for each row execute function public.notify_owner_on_permit_request();
