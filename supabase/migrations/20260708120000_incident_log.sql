-- Incident & Near-Miss Register (Stage 3, Tier 1 Safety & Compliance).
-- Right now safety exists only as static rotating tips - there is no way
-- to record an actual injury, near-miss, or hazard observation. This is
-- the highest-priority gap: WIBA claims and insurance require a
-- documented incident record with what happened, who was involved,
-- severity, and what corrective action was taken.

create table public.incident_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  date date not null default current_date,
  category text not null default 'near_miss', -- 'injury' | 'near_miss' | 'property_damage' | 'environmental'
  severity text not null default 'low', -- 'low' | 'medium' | 'high'
  description text not null,
  workers_involved text,
  photo_url text,
  corrective_action text,
  closed_by uuid references auth.users(id),
  closed_at timestamptz,
  reported_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.incident_log enable row level security;

create policy "Site owner or assigned foreman can manage incidents"
  on public.incident_log for all
  to authenticated
  using (
    public.owns_site(incident_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(incident_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(incident_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(incident_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all incidents"
  on public.incident_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Medium/high severity incidents notify the site owner immediately -
-- SECURITY DEFINER so the trigger can look up sites.owner_id regardless
-- of who's inserting (a foreman doesn't need direct SELECT rights on the
-- owner's user id to trigger their notification).
create or replace function public.notify_owner_on_severe_incident()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  if new.severity in ('medium', 'high') then
    select owner_id into v_owner_id from public.sites where id = new.site_id;
    if v_owner_id is not null then
      insert into public.notifications (recipient_id, type, related_id)
      values (v_owner_id, 'incident_reported', new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger on_incident_insert_notify_owner
  after insert on public.incident_log
  for each row execute function public.notify_owner_on_severe_incident();
