-- Sites, foreman assignment, invites, and notifications.
-- Every table here has RLS enabled in the same migration that creates it —
-- the old repo lost that discipline for exactly these tables (they existed
-- on the remote DB with zero migration record and unverified RLS).

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  site_name text not null,
  location text,
  description text,
  is_active boolean not null default true,
  status text not null default 'pending',
  monthly_rate numeric not null default 2500,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  subscription_start date,
  subscription_end date,
  latitude double precision,
  longitude double precision,
  location_recapture_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_assignments (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  foreman_id uuid references auth.users(id) on delete cascade not null,
  assigned_by uuid references auth.users(id),
  assigned_at timestamptz not null default now(),
  is_active boolean not null default true
);

-- Enforced at the DB level: a foreman can have at most one active
-- assignment. The old app relied purely on application code
-- (deactivate-then-insert as two separate calls) with no DB-level
-- guarantee — this index is the safety net that code was missing.
create unique index site_assignments_one_active_per_foreman
  on public.site_assignments (foreman_id)
  where is_active;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid() unique,
  site_id uuid references public.sites(id) on delete cascade not null,
  invited_by uuid references auth.users(id) not null,
  email text,
  used boolean not null default false,
  used_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

-- recipient_id: notify one specific user (e.g. a contractor about their
-- own site). recipient_role: broadcast to everyone holding that role
-- (e.g. all super_admins about a newly pending site). Exactly one of the
-- two must be set.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_role public.app_role,
  type text not null,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_recipient_check check (
    (recipient_id is not null and recipient_role is null)
    or (recipient_id is null and recipient_role is not null)
  )
);

alter table public.sites enable row level security;
alter table public.site_assignments enable row level security;
alter table public.invites enable row level security;
alter table public.notifications enable row level security;

create trigger update_sites_updated_at
  before update on public.sites
  for each row execute function public.update_updated_at_column();

-- Sites policies.
create policy "Owners can manage own sites"
  on public.sites for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Assigned foremen can view their site"
  on public.sites for select
  to authenticated
  using (
    exists (
      select 1 from public.site_assignments sa
      where sa.site_id = sites.id
        and sa.foreman_id = (select auth.uid())
        and sa.is_active
    )
  );

create policy "Admin roles can manage all sites"
  on public.sites for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Anonymous read access, scoped tightly to "there is a live invite for this
-- site" — needed because JoinPage looks up the invite (and its joined site
-- name/location) before the foreman has an account to authenticate with.
create policy "Anon can view sites with a live invite"
  on public.sites for select
  to anon
  using (
    exists (
      select 1 from public.invites i
      where i.site_id = sites.id
        and not i.used
        and i.expires_at > now()
    )
  );

-- Site assignments policies.
create policy "Foremen can view own assignments"
  on public.site_assignments for select
  to authenticated
  using ((select auth.uid()) = foreman_id);

create policy "Site owners can manage assignments for their sites"
  on public.site_assignments for all
  to authenticated
  using (
    exists (
      select 1 from public.sites s
      where s.id = site_assignments.site_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sites s
      where s.id = site_assignments.site_id
        and s.owner_id = (select auth.uid())
    )
  );

create policy "Admin roles can manage all assignments"
  on public.site_assignments for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Invites policies.
create policy "Inviters can manage own invites"
  on public.invites for all
  to authenticated
  using ((select auth.uid()) = invited_by)
  with check ((select auth.uid()) = invited_by);

create policy "Admin roles can manage all invites"
  on public.invites for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Anonymous read (not write) access to live invites by token — the
-- lookup itself never needs to expose used/expired invites.
create policy "Anon can view live invites"
  on public.invites for select
  to anon
  using (not used and expires_at > now());

-- Anonymous UPDATE is intentionally NOT granted here. Consuming an invite
-- (marking it used) happens via useConsumeInvite AFTER signUp() completes,
-- by which point the new user is authenticated — so that update runs
-- under the "authenticated" role, not "anon". If a future change needs
-- anon to consume invites pre-auth, that's a deliberate RLS decision to
-- make explicitly, not a default to fall into.

-- Notifications policies.
create policy "Users can view own direct notifications"
  on public.notifications for select
  to authenticated
  using ((select auth.uid()) = recipient_id);

create policy "Users can view notifications broadcast to their role"
  on public.notifications for select
  to authenticated
  using (
    recipient_role is not null
    and public.has_role((select auth.uid()), recipient_role)
  );

create policy "Users can mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (
    (select auth.uid()) = recipient_id
    or (recipient_role is not null and public.has_role((select auth.uid()), recipient_role))
  )
  with check (true);

create policy "Admin roles can manage all notifications"
  on public.notifications for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
