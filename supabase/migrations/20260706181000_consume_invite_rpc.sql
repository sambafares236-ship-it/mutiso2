-- Invite consumption was implemented as three separate client-side table
-- operations (UPDATE invites, INSERT user_roles, INSERT site_assignments),
-- each needing its own narrow RLS policy for "the invited user, and only
-- for this exact row." That shape of policy turned out to be impossible to
-- write correctly with table-level RLS alone: any policy permissive enough
-- to let the invited user see/update "their" invite by token was also
-- permissive enough to let ANY authenticated user browse or claim ANY live
-- invite platform-wide (confirmed - it let a second contractor see a
-- different contractor's invites, a real cross-tenant leak).
--
-- Replacing all three narrow policies with one atomic SECURITY DEFINER
-- function. The client can no longer write to invites/user_roles/
-- site_assignments for this flow at all - it only calls this RPC, which
-- validates the token itself (bypassing RLS internally) and performs the
-- whole claim as one transaction.

drop policy if exists "Authenticated users can view live invites" on public.invites;
drop policy if exists "Authenticated users can consume a live invite" on public.invites;
drop policy if exists "Users can self-assign foreman role via invite" on public.user_roles;
drop policy if exists "Users can self-assign to a site via a consumed invite" on public.site_assignments;

create or replace function public.consume_invite(p_token uuid)
returns uuid -- returns the site_id the caller was assigned to
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invites
  where token = p_token
    and not used
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite';
  end if;

  update public.invites
  set used = true, used_by = v_user_id
  where token = p_token;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'foreman')
  on conflict (user_id, role) do nothing;

  update public.site_assignments
  set is_active = false
  where foreman_id = v_user_id and is_active;

  insert into public.site_assignments (site_id, foreman_id, assigned_by, is_active)
  values (v_invite.site_id, v_user_id, v_user_id, true);

  return v_invite.site_id;
end;
$$;

grant execute on function public.consume_invite(uuid) to authenticated;
