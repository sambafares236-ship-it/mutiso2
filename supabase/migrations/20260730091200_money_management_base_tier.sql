-- Revises the Pro-tier boundary at the user's explicit request: core
-- "money management" (Material Payments, Payroll, Petty Cash, Budget/total
-- project cost, Variation Orders) moves back to the base Field Ops &
-- Safety tier - it should look like Pro for money, not be a Pro upsell.
-- Contract details and Payment Certificates stay Pro-only (explicitly
-- confirmed separately), as does Subcontractors (a relationship/work-order
-- feature, not core money in/out tracking).
--
-- Reverts budget_line, actual_cost, payroll_run, payroll_line (via its two
-- join-helpers), variation_order, and variation_order_response (via its
-- join-helper) back to the plain owns_site()/is_assigned_foreman() checks
-- from before 20260730090900/091000/091100 - same policies, same shape,
-- just no tier condition anymore. site_contract, payment_certificate,
-- subcontractor, subcontractor_work_order, and everything else gated in
-- those three migrations are untouched.

-- Join-helpers: revert to their pre-tier-gating bodies.
create or replace function public.can_access_payroll_run(_payroll_run_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.payroll_run pr
    where pr.id = _payroll_run_id
      and (public.owns_site(pr.site_id, _user_id) or public.is_assigned_foreman(pr.site_id, _user_id))
  )
$$;

create or replace function public.owns_payroll_run_site(_payroll_run_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.payroll_run pr
    where pr.id = _payroll_run_id and public.owns_site(pr.site_id, _user_id)
  )
$$;

create or replace function public.can_access_variation_order(_variation_order_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.variation_order vo
    where vo.id = _variation_order_id
      and (public.owns_site(vo.site_id, _user_id) or public.is_assigned_foreman(vo.site_id, _user_id))
  )
$$;

-- budget_line
drop policy if exists "Site owner or assigned foreman can view budget" on public.budget_line;
drop policy if exists "Only site owner can manage budget" on public.budget_line;

create policy "Site owner or assigned foreman can view budget"
  on public.budget_line for select
  to authenticated
  using (
    public.owns_site(budget_line.site_id, (select auth.uid()))
    or public.is_assigned_foreman(budget_line.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage budget"
  on public.budget_line for all
  to authenticated
  using (public.owns_site(budget_line.site_id, (select auth.uid())))
  with check (public.owns_site(budget_line.site_id, (select auth.uid())));

-- actual_cost
drop policy if exists "Site owner or assigned foreman can view actual costs" on public.actual_cost;
drop policy if exists "Only site owner can manage actual costs" on public.actual_cost;

create policy "Site owner or assigned foreman can view actual costs"
  on public.actual_cost for select
  to authenticated
  using (
    public.owns_site(actual_cost.site_id, (select auth.uid()))
    or public.is_assigned_foreman(actual_cost.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage actual costs"
  on public.actual_cost for all
  to authenticated
  using (public.owns_site(actual_cost.site_id, (select auth.uid())))
  with check (public.owns_site(actual_cost.site_id, (select auth.uid())));

-- payroll_run
drop policy if exists "Site owner or assigned foreman can view payroll runs" on public.payroll_run;
drop policy if exists "Only site owner can create or modify payroll runs" on public.payroll_run;

create policy "Site owner or assigned foreman can view payroll runs"
  on public.payroll_run for select
  to authenticated
  using (
    public.owns_site(payroll_run.site_id, (select auth.uid()))
    or public.is_assigned_foreman(payroll_run.site_id, (select auth.uid()))
  );

create policy "Only site owner can create or modify payroll runs"
  on public.payroll_run for all
  to authenticated
  using (public.owns_site(payroll_run.site_id, (select auth.uid())))
  with check (public.owns_site(payroll_run.site_id, (select auth.uid())));

-- variation_order (3 policies, no delete policy exists)
drop policy if exists "Site owner or assigned foreman can view variation orders" on public.variation_order;
drop policy if exists "Only site owner can raise variation orders" on public.variation_order;
drop policy if exists "Only site owner can decide variation orders" on public.variation_order;

create policy "Site owner or assigned foreman can view variation orders"
  on public.variation_order for select
  to authenticated
  using (
    public.owns_site(variation_order.site_id, (select auth.uid()))
    or public.is_assigned_foreman(variation_order.site_id, (select auth.uid()))
  );

create policy "Only site owner can raise variation orders"
  on public.variation_order for insert
  to authenticated
  with check (
    raised_by = (select auth.uid())
    and status = 'open'
    and public.owns_site(variation_order.site_id, (select auth.uid()))
  );

create policy "Only site owner can decide variation orders"
  on public.variation_order for update
  to authenticated
  using (public.owns_site(variation_order.site_id, (select auth.uid())))
  with check (public.owns_site(variation_order.site_id, (select auth.uid())));

-- generate_payroll_run: remove the tier check, keep everything else.
create or replace function public.generate_payroll_run(
  p_site_id uuid,
  p_week_start date,
  p_week_end date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_run_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.owns_site(p_site_id, v_user_id) then
    raise exception 'Only the site owner can generate a payroll run';
  end if;

  insert into public.payroll_run (site_id, week_start, week_end, created_by)
  values (p_site_id, p_week_start, p_week_end, v_user_id)
  returning id into v_run_id;

  insert into public.payroll_line (payroll_run_id, worker_id, days_present, daily_rate, gross_amount, net_amount)
  select
    v_run_id,
    w.id,
    count(a.id),
    coalesce(w.daily_rate, 0),
    count(a.id) * coalesce(w.daily_rate, 0),
    count(a.id) * coalesce(w.daily_rate, 0)
  from public.workers_master w
  join public.attendance_log a on a.worker_id = w.id and a.date between p_week_start and p_week_end
  where w.site_id = p_site_id
  group by w.id, w.daily_rate;

  return v_run_id;
end;
$$;

-- mark_payroll_line_paid: remove the tier check, keep everything else.
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
