-- Real tier-based feature gating, part 3: the 8 SECURITY DEFINER RPCs that
-- bypass RLS and do their own internal owns_site()/is_assigned_foreman()
-- check need the tier requirement added too - the RLS policy changes
-- (20260730091000) don't cover these since they never go through a table
-- policy for their write.
--
-- Deliberately NOT using owns_pro_site()/is_assigned_foreman_of_pro_site()
-- here (unlike the RLS policies) - those collapse "not yours" and "not on
-- Pro" into one boolean, which is fine for a table policy (no user-facing
-- message either way) but would make these RPCs' existing custom error
-- messages misleading for an owner correctly rejected only for tier reasons.
-- Each function keeps its original ownership check message and adds a
-- distinct, separate tier check with its own message.

create or replace function public.generate_payment_certificate(
  p_site_id uuid,
  p_period_start date,
  p_period_end date,
  p_work_completed_value numeric,
  p_retention_percentage numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_retention_pct numeric;
  v_retention_amount numeric;
  v_previous_total numeric;
  v_net_due numeric;
  v_cert_number int;
  v_cert_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.owns_site(p_site_id, v_user_id) then
    raise exception 'Only the site owner can generate a payment certificate';
  end if;

  if not exists (select 1 from public.sites where id = p_site_id and subscription_tier = 'pro') then
    raise exception 'Payment certificates require the Pro plan';
  end if;

  v_retention_pct := coalesce(
    p_retention_percentage,
    (select retention_percentage from public.site_contract where site_id = p_site_id),
    0
  );

  select coalesce(sum(net_amount_due), 0) into v_previous_total
  from public.payment_certificate
  where site_id = p_site_id;

  v_retention_amount := p_work_completed_value * v_retention_pct / 100;
  v_net_due := p_work_completed_value - v_retention_amount - v_previous_total;

  select coalesce(max(certificate_number), 0) + 1 into v_cert_number
  from public.payment_certificate
  where site_id = p_site_id;

  insert into public.payment_certificate (
    site_id, certificate_number, period_start, period_end, work_completed_value,
    retention_percentage, retention_amount, previous_payments_total, net_amount_due,
    created_by
  ) values (
    p_site_id, v_cert_number, p_period_start, p_period_end, p_work_completed_value,
    v_retention_pct, v_retention_amount, v_previous_total, v_net_due,
    v_user_id
  )
  returning id into v_cert_id;

  return v_cert_id;
end;
$$;

create or replace function public.save_schedule_baseline(
  p_site_id uuid,
  p_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_baseline_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.owns_site(p_site_id, v_user_id) then
    raise exception 'Only the site owner can save a schedule baseline';
  end if;

  if not exists (select 1 from public.sites where id = p_site_id and subscription_tier = 'pro') then
    raise exception 'Schedule baselines require the Pro plan';
  end if;

  insert into public.schedule_baseline (site_id, label, created_by)
  values (p_site_id, p_label, v_user_id)
  returning id into v_baseline_id;

  insert into public.schedule_baseline_activity (baseline_id, activity_id, activity_code, name, planned_start, planned_end)
  select v_baseline_id, a.id, a.activity_code, a.name, a.planned_start, a.planned_end
  from public.activity a
  where a.site_id = p_site_id;

  return v_baseline_id;
end;
$$;

create or replace function public.replace_site_activities(
  p_site_id uuid,
  p_activities jsonb
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.owns_site(p_site_id, v_user_id) then
    raise exception 'Only the site owner can replace the schedule of works';
  end if;

  if not exists (select 1 from public.sites where id = p_site_id and subscription_tier = 'pro') then
    raise exception 'Schedule/WBS upload requires the Pro plan';
  end if;

  delete from public.activity where site_id = p_site_id;

  insert into public.activity (site_id, created_by, name, activity_code, planned_start, planned_end, responsible_party)
  select
    p_site_id,
    v_user_id,
    row_data->>'name',
    nullif(row_data->>'activity_code', ''),
    nullif(row_data->>'planned_start', '')::date,
    nullif(row_data->>'planned_end', '')::date,
    nullif(row_data->>'responsible_party', '')
  from jsonb_array_elements(p_activities) as row_data
  where coalesce(row_data->>'name', '') <> '';

  get diagnostics v_count = row_count;

  update public.activity child
  set parent_id = parent.id
  from public.activity parent
  where child.site_id = p_site_id
    and parent.site_id = p_site_id
    and child.activity_code is not null
    and position('.' in child.activity_code) > 0
    and parent.activity_code = left(
      child.activity_code,
      length(child.activity_code) - position('.' in reverse(child.activity_code))
    );

  return v_count;
end;
$$;

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

  if not exists (select 1 from public.sites where id = v_site_id and subscription_tier = 'pro') then
    raise exception 'Defect tracking requires the Pro plan';
  end if;

  if v_fixed_by is not null and v_fixed_by = v_user_id then
    raise exception 'You cannot verify a defect you fixed yourself';
  end if;

  update public.defect_log
  set status = 'resolved', verified_by = v_user_id, verified_at = now()
  where id = p_defect_id;
end;
$$;

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

  if not exists (select 1 from public.sites where id = v_site_id and subscription_tier = 'pro') then
    raise exception 'Payroll requires the Pro plan';
  end if;

  update public.payroll_line
  set paid = true, paid_by = v_user_id, paid_at = now()
  where id = p_line_id;
end;
$$;

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

  if not exists (select 1 from public.sites where id = p_site_id and subscription_tier = 'pro') then
    raise exception 'Payroll requires the Pro plan';
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

create or replace function public.checkout_tool(
  p_tool_id uuid,
  p_worker_id uuid,
  p_meter_reading numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_status text;
  v_worker_site_id uuid;
  v_worker_name text;
  v_present_today boolean;
  v_log_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select site_id, status into v_site_id, v_status
  from public.tool_inventory
  where id = p_tool_id
  for update;

  if v_site_id is null then
    raise exception 'Tool not found';
  end if;

  if not (public.owns_site(v_site_id, v_user_id) or public.is_assigned_foreman(v_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  if not exists (select 1 from public.sites where id = v_site_id and subscription_tier = 'pro') then
    raise exception 'Tools & equipment tracking requires the Pro plan';
  end if;

  if v_status <> 'available' then
    raise exception 'Tool is not available (current status: %)', v_status;
  end if;

  select site_id, full_name into v_worker_site_id, v_worker_name
  from public.workers_master
  where id = p_worker_id;

  if v_worker_site_id is null or v_worker_site_id <> v_site_id then
    raise exception 'Worker not found on this site';
  end if;

  select exists (
    select 1 from public.attendance_log
    where site_id = v_site_id and worker_id = p_worker_id and date = current_date
  ) into v_present_today;

  if not v_present_today then
    raise exception '% must be marked present today before checking out a tool', v_worker_name;
  end if;

  insert into public.tool_checkout_log (tool_id, site_id, worker_id, checked_out_to, checked_out_by, meter_reading_out)
  values (p_tool_id, v_site_id, p_worker_id, v_worker_name, v_user_id, p_meter_reading)
  returning id into v_log_id;

  update public.tool_inventory
  set status = 'checked_out', current_holder_name = v_worker_name
  where id = p_tool_id;

  return v_log_id;
end;
$$;

create or replace function public.return_tool(
  p_tool_id uuid,
  p_condition_on_return text default null,
  p_meter_reading numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_status text;
  v_log_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select site_id, status into v_site_id, v_status
  from public.tool_inventory
  where id = p_tool_id
  for update;

  if v_site_id is null then
    raise exception 'Tool not found';
  end if;

  if not (public.owns_site(v_site_id, v_user_id) or public.is_assigned_foreman(v_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  if not exists (select 1 from public.sites where id = v_site_id and subscription_tier = 'pro') then
    raise exception 'Tools & equipment tracking requires the Pro plan';
  end if;

  if v_status <> 'checked_out' then
    raise exception 'Tool is not currently checked out (current status: %)', v_status;
  end if;

  select id into v_log_id
  from public.tool_checkout_log
  where tool_id = p_tool_id and returned_at is null
  order by checked_out_at desc
  limit 1;

  if v_log_id is null then
    raise exception 'No open checkout record found for this tool';
  end if;

  update public.tool_checkout_log
  set returned_at = now(), condition_on_return = p_condition_on_return, meter_reading_in = p_meter_reading
  where id = v_log_id;

  update public.tool_inventory
  set status = 'available', current_holder_name = null
  where id = p_tool_id;

  return v_log_id;
end;
$$;
