-- Variation order raised notification. Unlike the permit-request trigger,
-- this does NOT notify the site owner - 20260722090000_contract_admin_owner_only.sql
-- made raising a variation order owner-only ("the contractor uses it as
-- their own record/reminder", not a foreman-raises/owner-approves flow),
-- so the owner is always the one raising it and notifying them of their
-- own action would be the same no-op the permit trigger already guards
-- against. The party who actually benefits from knowing is the site's
-- assigned foreman: they can still respond via variation_order_response,
-- and a variation frequently changes what they're building day to day.
--
-- Same AFTER INSERT + net.http_post + Vault-secret pattern as the other
-- two event triggers - secret populated out-of-band via
-- `select vault.create_secret(...)`, never committed here.

create or replace function public.notify_foreman_on_variation_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_foreman_id uuid;
  v_foreman_phone text;
  v_site_name text;
  v_webhook_secret text;
begin
  select s.site_name into v_site_name
  from public.sites s
  where s.id = new.site_id;

  select sa.foreman_id into v_foreman_id
  from public.site_assignments sa
  where sa.site_id = new.site_id
    and sa.is_active = true
  limit 1;

  if v_foreman_id is not null then
    select p.phone_number into v_foreman_phone
    from public.profiles p
    where p.id = v_foreman_id;

    insert into public.notifications (recipient_id, type, related_id)
    values (v_foreman_id, 'variation_order_raised', new.id);

    select decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets
    where name = 'variation_order_raised_webhook_secret';

    if v_webhook_secret is not null then
      perform net.http_post(
        url := 'https://primary-production-bd339.up.railway.app/webhook/variation-order-raised',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', v_webhook_secret
        ),
        body := jsonb_build_object(
          'variation_order_id', new.id,
          'site_name', v_site_name,
          'foreman_phone', v_foreman_phone,
          'title', new.title,
          'description', new.description,
          'cost_impact', new.cost_impact,
          'time_impact_days', new.time_impact_days
        )
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger on_variation_order_insert_notify_foreman
  after insert on public.variation_order
  for each row execute function public.notify_foreman_on_variation_order();
