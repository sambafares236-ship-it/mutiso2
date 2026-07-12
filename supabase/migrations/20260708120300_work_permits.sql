-- Permit-to-Work: certain work (hot work, excavation, working at height,
-- confined space) needs a time-bound authorization signed off BEFORE it
-- starts - a gate, not just a diary entry. Unlike every other Stage 3
-- table, this one deliberately does NOT use the blanket "owner or
-- assigned foreman can manage everything" policy: a foreman can request
-- a permit but must never be able to approve their own request, or the
-- gate means nothing. INSERT and UPDATE are split into separate,
-- differently-scoped policies specifically to enforce that.

create table public.work_permit (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  permit_type text not null, -- 'hot_work' | 'excavation' | 'height' | 'confined_space'
  description text,
  requested_by uuid references auth.users(id) not null,
  approved_by uuid references auth.users(id),
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

alter table public.work_permit enable row level security;

create policy "Site owner or assigned foreman can view permits"
  on public.work_permit for select
  to authenticated
  using (
    public.owns_site(work_permit.site_id, (select auth.uid()))
    or public.is_assigned_foreman(work_permit.site_id, (select auth.uid()))
  );

create policy "Site owner or assigned foreman can request permits"
  on public.work_permit for insert
  to authenticated
  with check (
    requested_by = (select auth.uid())
    and status = 'pending'
    and (
      public.owns_site(work_permit.site_id, (select auth.uid()))
      or public.is_assigned_foreman(work_permit.site_id, (select auth.uid()))
    )
  );

-- Only the site owner (contractor) can approve/reject - a foreman
-- requesting their own permit is deliberately excluded here, unlike
-- every other Stage 3 policy.
create policy "Only site owner can approve or reject permits"
  on public.work_permit for update
  to authenticated
  using (public.owns_site(work_permit.site_id, (select auth.uid())))
  with check (public.owns_site(work_permit.site_id, (select auth.uid())));

create policy "Admin roles can manage all permits"
  on public.work_permit for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Notify the requesting foreman when their permit is approved/rejected.
create or replace function public.notify_requester_on_permit_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('approved', 'rejected') and new.status is distinct from old.status then
    insert into public.notifications (recipient_id, type, related_id)
    values (new.requested_by, 'permit_' || new.status, new.id);
  end if;
  return new;
end;
$$;

create trigger on_permit_update_notify_requester
  after update on public.work_permit
  for each row execute function public.notify_requester_on_permit_decision();
