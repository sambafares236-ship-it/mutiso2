-- Closes the gap flagged after removing the free trial: hiding buttons in
-- ContractorView for a non-active site was UI-only - a contractor could
-- still hit the API directly (invite a foreman, request a permit, log
-- attendance, etc.) for a site no admin has approved yet. Real enforcement
-- has to live in RLS, not the client.
--
-- owns_site()/is_assigned_foreman() are the two SECURITY DEFINER helpers
-- nearly every owner/foreman-gated table in this schema is built on
-- (payroll, materials, diary, permits, milestones, tools, ...) - per this
-- project's own established pattern of centralizing cross-table RLS checks
-- in one function to avoid recursion and duplication. Tightening these two
-- functions to also require the site to be 'active' therefore propagates
-- the enforcement across virtually the whole schema in one change, without
-- touching dozens of individual table policies.
--
-- Safe to do: `sites` itself does NOT route through owns_site() for its own
-- policies (it checks `auth.uid() = owner_id` directly - confirmed in
-- 20260706173701_sites_and_multi_tenant.sql) so a contractor can still see
-- and manage their own pending/cancelled site rows (submit for approval,
-- check status, pay once approved) - only OTHER tables gated by these
-- helpers lose access until the site is active. Admin/super_admin bypass
-- policies are always separate `has_role(...)` branches on each table, not
-- routed through these helpers, so admin access is unaffected.
--
-- is_assigned_foreman() is tightened too, not just owns_site() - if a
-- previously-active site is later cancelled, an already-assigned foreman
-- should lose access immediately as well, not just future invites be
-- blocked.
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
      and s.status = 'active'
  )
$$;

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
    join public.sites s on s.id = sa.site_id
    where sa.site_id = _site_id
      and sa.foreman_id = _user_id
      and sa.is_active
      and s.status = 'active'
  )
$$;

-- invites is the one table that does NOT route through owns_site() at all -
-- it only ever checked `invited_by = auth.uid()`, a pure self-attribution
-- check with no real site-ownership or status check. That meant, prior to
-- this migration, the policy's own name ("Inviters can manage own invites")
-- was aspirational rather than enforced: nothing stopped a request for a
-- site_id the caller didn't actually own, active or not. Fixed here by
-- routing through owns_site() like every other owner-gated table already
-- does - this closes both gaps (ownership + active status) in one change.
drop policy if exists "Inviters can manage own invites" on public.invites;

create policy "Inviters can manage own invites"
  on public.invites for all
  to authenticated
  using ((select auth.uid()) = invited_by and public.owns_site(invites.site_id, (select auth.uid())))
  with check ((select auth.uid()) = invited_by and public.owns_site(invites.site_id, (select auth.uid())));
