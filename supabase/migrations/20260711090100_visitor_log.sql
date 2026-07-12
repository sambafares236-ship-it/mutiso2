-- Visitor/access log (Stage 6, Tier 4). Simple sign-in/sign-out record -
-- no RPC needed since it's single-table (unlike tool checkout, there's no
-- second table to keep in sync), just an insert for sign-in and an update
-- for sign-out against a row the client already has the id for.

create table public.visitor_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  visitor_name text not null,
  company text,
  purpose text,
  host_name text,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.visitor_log enable row level security;

create policy "Site owner or assigned foreman can manage visitor log"
  on public.visitor_log for all
  to authenticated
  using (
    public.owns_site(visitor_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(visitor_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(visitor_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(visitor_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all visitor logs"
  on public.visitor_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
