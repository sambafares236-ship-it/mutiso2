-- The invite-consumption flow (JoinPage -> useConsumeInvite) runs as the
-- newly-signed-up foreman, not the contractor who created the invite, and
-- needs to insert two rows about themselves:
--   1. their own 'foreman' user_roles row
--   2. their own site_assignments row
-- No policy allowed either INSERT for a plain authenticated user - only
-- admins could manage user_roles, and only the site owner could manage
-- site_assignments. Both new policies are deliberately narrow:
--   - user_roles: can only self-insert the 'foreman' role specifically,
--     never 'admin'/'super_admin'/'contractor' - self-promotion to a
--     privileged role stays impossible.
--   - site_assignments: can only self-insert for a site where an invite
--     has already been marked used by this exact user - can't self-assign
--     to an arbitrary site without a real consumed invite.

create policy "Users can self-assign foreman role via invite"
  on public.user_roles for insert
  to authenticated
  with check ((select auth.uid()) = user_id and role = 'foreman');

create policy "Users can self-assign to a site via a consumed invite"
  on public.site_assignments for insert
  to authenticated
  with check (
    foreman_id = (select auth.uid())
    and exists (
      select 1 from public.invites i
      where i.site_id = site_assignments.site_id
        and i.used_by = (select auth.uid())
    )
  );
