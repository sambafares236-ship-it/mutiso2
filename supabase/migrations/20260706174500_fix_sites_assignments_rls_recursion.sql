-- Fixes "infinite recursion detected in policy for relation sites".
--
-- Root cause: the "Assigned foremen can view their site" policy on `sites`
-- queries `site_assignments`, and the "Site owners can manage assignments"
-- policy on `site_assignments` queries `sites` right back. Postgres applies
-- RLS to the subqueries a policy issues too, so evaluating either policy
-- triggers the other, which triggers the first again, forever.
--
-- Fix: same pattern already used for has_role() — wrap each cross-table
-- check in a SECURITY DEFINER function, which bypasses RLS on the table it
-- queries internally and breaks the cycle.

create or replace function public.is_assigned_foreman(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.site_assignments sa
    where sa.site_id = _site_id
      and sa.foreman_id = _user_id
      and sa.is_active
  )
$$;

create or replace function public.owns_site(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = _site_id
      and s.owner_id = _user_id
  )
$$;

drop policy if exists "Assigned foremen can view their site" on public.sites;
create policy "Assigned foremen can view their site"
  on public.sites for select
  to authenticated
  using (public.is_assigned_foreman(sites.id, (select auth.uid())));

drop policy if exists "Site owners can manage assignments for their sites" on public.site_assignments;
create policy "Site owners can manage assignments for their sites"
  on public.site_assignments for all
  to authenticated
  using (public.owns_site(site_assignments.site_id, (select auth.uid())))
  with check (public.owns_site(site_assignments.site_id, (select auth.uid())));
