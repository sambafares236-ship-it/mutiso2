-- Second self-lock fix found while verifying the expiry lockout end-to-end:
-- "Assigned foremen can view their site" (on `sites`) was already routed
-- through is_assigned_foreman() by 20260706174500 (fixing an earlier RLS
-- recursion bug) - NOT a direct site_assignments check as assumed. That
-- means tightening is_assigned_foreman() to require a non-expired
-- subscription (20260731090600) also strips an expired site's assigned
-- foreman of visibility into the site row itself - they'd see nothing at
-- all rather than ForemanDashboard's "Site access paused" screen, which
-- depends on reading site.status/subscription_end from that very row.
--
-- Same fix shape as is_site_owner(): a plain assignment check, no
-- status/expiry gate, used only for this one SELECT policy so a foreman can
-- always at least see which site they're assigned to and why it's paused.
create or replace function public.is_site_assignee(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.site_assignments sa
    where sa.site_id = _site_id and sa.foreman_id = _user_id and sa.is_active
  )
$$;

drop policy if exists "Assigned foremen can view their site" on public.sites;
create policy "Assigned foremen can view their site"
  on public.sites for select
  to authenticated
  using (public.is_site_assignee(sites.id, (select auth.uid())));
