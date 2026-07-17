-- Foreman invite email delivery, moved off the client. Previously
-- useCreateInvite() fired a best-effort, fire-and-forget
-- supabase.functions.invoke('send-invite-email', ...) call straight from
-- the browser (Resend via an edge function) - if the tab closed or the
-- network blipped before that call landed, the invite row existed but no
-- email ever went out, silently. This trigger moves delivery to the same
-- reliable AFTER INSERT + net.http_post + Vault-secret pattern already
-- used for severe incidents / permit requests / variation orders, so it
-- survives the browser closing and gets n8n's execution history for free.
-- The send-invite-email edge function itself is left in place (unused,
-- not deleted) in case Resend is ever preferred back over Gmail.
--
-- Only fires when `email` is set - invites.email is nullable, and an
-- invite created without one has nothing to send to.

create or replace function public.notify_on_invite_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_site_name text;
  v_webhook_secret text;
begin
  if new.email is not null then
    select s.site_name into v_site_name
    from public.sites s
    where s.id = new.site_id;

    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'invite_created_webhook_secret';

    if v_webhook_secret is not null then
      perform net.http_post(
        url := 'https://primary-production-bd339.up.railway.app/webhook/invite-created',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_webhook_secret
        ),
        body := jsonb_build_object(
          'invite_id', new.id,
          'token', new.token,
          'email', new.email,
          'site_name', v_site_name,
          'expires_at', new.expires_at
        )
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger on_invite_insert_notify
  after insert on public.invites
  for each row execute function public.notify_on_invite_created();
