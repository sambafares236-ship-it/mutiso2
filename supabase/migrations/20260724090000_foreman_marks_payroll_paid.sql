-- Reverses part of the Stage 5 "financial authority ≠ field capture"
-- design at the user's explicit request: marking a payroll line as paid
-- becomes the assigned foreman's action, not the contractor's. On a real
-- site the foreman is the one physically handing over cash/M-Pesa to
-- workers, so they're the actual witness to a payment happening - this
-- is closer to field capture ("I paid this today") than a financial
-- policy decision like generating the run or editing advances/
-- deductions, both of which stay owner-only via the existing blanket
-- "Only site owner can modify payroll lines" policy (untouched below).
--
-- Rather than reshape that blanket policy (which also governs advances/
-- deductions edits), mark-paid moves through its own SECURITY DEFINER
-- RPC - same pattern as checkout_tool()/return_tool(): the function does
-- its own explicit is_assigned_foreman() check internally (SECURITY
-- DEFINER bypasses RLS, so this check is the only thing standing between
-- a valid-looking line id and an unrelated foreman marking someone
-- else's payroll paid), and only touches the paid/paid_by/paid_at
-- columns - it can't touch gross_amount, advances, or deductions.

create or replace function public.mark_payroll_line_paid(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select pr.site_id into v_site_id
  from public.payroll_line pl
  join public.payroll_run pr on pr.id = pl.payroll_run_id
  where pl.id = p_line_id;

  if v_site_id is null then
    raise exception 'Payroll line not found';
  end if;

  if not public.is_assigned_foreman(v_site_id, v_user_id) then
    raise exception 'Only the assigned foreman can mark a payroll line as paid';
  end if;

  update public.payroll_line
  set paid = true, paid_by = v_user_id, paid_at = now()
  where id = p_line_id;
end;
$$;

grant execute on function public.mark_payroll_line_paid(uuid) to authenticated;
