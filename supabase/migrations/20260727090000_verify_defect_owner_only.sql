-- Defect verification becomes the contractor's exclusive action, at the
-- user's explicit request - "report" and "mark fixed" stay foreman+owner
-- field capture (defect_log's existing blanket policy, untouched), but
-- resolving a defect is a quality sign-off, not a field action. Same
-- reasoning and same SECURITY DEFINER RPC pattern as
-- mark_payroll_line_paid(): the blanket table policy can't distinguish
-- "which column/transition" is being updated, so this specific action
-- moves through its own RPC with its own explicit owns_site() check
-- rather than reshaping the whole table's RLS (which also governs
-- inserts and the fixed-photo update).

create or replace function public.verify_defect(p_defect_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_fixed_by uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select site_id, fixed_by into v_site_id, v_fixed_by
  from public.defect_log
  where id = p_defect_id;

  if v_site_id is null then
    raise exception 'Defect not found';
  end if;

  if not public.owns_site(v_site_id, v_user_id) then
    raise exception 'Only the site owner can verify a defect';
  end if;

  -- Still enforced here too (not just the old CHECK constraint) since
  -- this RPC is SECURITY DEFINER and bypasses RLS internally.
  if v_fixed_by is not null and v_fixed_by = v_user_id then
    raise exception 'You cannot verify a defect you fixed yourself';
  end if;

  update public.defect_log
  set status = 'resolved', verified_by = v_user_id, verified_at = now()
  where id = p_defect_id;
end;
$$;

grant execute on function public.verify_defect(uuid) to authenticated;
