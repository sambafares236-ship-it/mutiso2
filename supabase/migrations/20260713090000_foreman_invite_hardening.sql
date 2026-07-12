-- Hardens the foreman invite flow:
--   1. A site can have at most one active foreman assignment at a time,
--      symmetric to the existing one-active-site-per-foreman index. Without
--      this, nothing stopped a contractor from generating and having
--      multiple invite links claimed for the same site.
--   2. consume_invite() now verifies the claiming user's auth email matches
--      the email the invite was issued to (when one was set) -- previously
--      only the token was checked, so anyone holding the link could retype
--      a different email at signup and still claim it.
--   3. Claiming one invite for a site auto-voids any other still-pending
--      invites for that same site, so no dangling working links remain for
--      an already-staffed site.

-- Pre-existing test data has sites with more than one active assignment
-- (nothing enforced this until now) - keep only the most recent active
-- assignment per site before the new unique index can be created.
with ranked as (
  select id, site_id, row_number() over (partition by site_id order by assigned_at desc) as rn
  from public.site_assignments
  where is_active
)
update public.site_assignments sa
set is_active = false
from ranked r
where sa.id = r.id and r.rn > 1;

create unique index site_assignments_one_active_per_site
  on public.site_assignments (site_id)
  where is_active;

create or replace function public.consume_invite(p_token uuid)
returns uuid -- returns the site_id the caller was assigned to
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text;
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

  if v_invite.email is not null then
    select email into v_user_email from auth.users where id = v_user_id;
    if v_user_email is null or lower(v_user_email) <> lower(v_invite.email) then
      raise exception 'This invite was issued to a different email address';
    end if;
  end if;

  update public.invites
  set used = true, used_by = v_user_id
  where token = p_token;

  update public.invites
  set used = true
  where site_id = v_invite.site_id
    and token <> p_token
    and not used;

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'foreman')
  on conflict (user_id, role) do nothing;

  update public.site_assignments
  set is_active = false
  where foreman_id = v_user_id and is_active;

  begin
    insert into public.site_assignments (site_id, foreman_id, assigned_by, is_active)
    values (v_invite.site_id, v_user_id, v_user_id, true);
  exception
    when unique_violation then
      raise exception 'This site already has an assigned foreman';
  end;

  return v_invite.site_id;
end;
$$;

grant execute on function public.consume_invite(uuid) to authenticated;
