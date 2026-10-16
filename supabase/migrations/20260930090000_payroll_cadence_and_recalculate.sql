-- Fixes two related issues logged in ISSUES.md (2026-09-30):
--
-- 1. generate_payroll_run() snapshots attendance once, at the moment it's
--    called, and payroll_run's unique(site_id, week_start) makes that
--    snapshot permanent - generating mid-week locks the week to a partial
--    total with no way to regenerate.
--
-- 2. Project cost tracking (useFinanceSummary.laborActualTotal) only ever
--    reads payroll_line.gross_amount. Any period nobody generated payroll
--    for contributes nothing to Actual Cost - silently, with no warning -
--    which can make a site look under budget when it isn't.
--
-- Fix, per the discussion: let a contractor choose daily or weekly payroll
-- generation per site; allow regenerating/recalculating an existing run in
-- place instead of being blocked by the unique constraint; and add a query
-- the UI can use to list periods with attendance but no payroll_run, so a
-- gap is always visible with a direct "Generate" action rather than
-- discovered later as a missing cost.

-- 1. Per-site cadence setting. Weekly stays the default - no behavior
-- change for existing sites until a contractor opts into daily.
alter table public.sites
  add column if not exists payroll_cadence text not null default 'weekly'
    check (payroll_cadence in ('daily', 'weekly'));

-- 2. payroll_run currently can only ever represent a Mon-Sun week
-- (week_start/week_end, unique on site_id+week_start). Generalize to any
-- period so a daily cadence can insert one row per day without a schema
-- fork. week_start/week_end are kept as-is (not renamed) so existing
-- queries/components keep working untouched; they now just mean "period
-- start/end" for a daily run too (a single day has week_start = week_end).
alter table public.payroll_run
  drop constraint if exists payroll_run_site_id_week_start_key;

alter table public.payroll_run
  add constraint payroll_run_site_id_period_key unique (site_id, week_start, week_end);

-- 3. generate_payroll_run: allow recalculating an existing run instead of
-- only ever inserting a brand-new one. Creates the run if needed, then
-- upserts its lines so a regenerate reflects the full, current attendance
-- for that period without losing advances/deductions already entered. Paid lines block
-- the recalculate - paying someone is a real-world event that shouldn't be
-- silently undone by a recalculation; the caller has to resolve that first
-- (see mark_payroll_line_paid / the manual-unblock note in ISSUES.md).
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
  v_paid_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.owns_site(p_site_id, v_user_id) then
    raise exception 'Only the site owner can generate a payroll run';
  end if;

  select id into v_run_id
  from public.payroll_run
  where site_id = p_site_id and week_start = p_week_start and week_end = p_week_end;

  if v_run_id is not null then
    select count(*) into v_paid_count
    from public.payroll_line
    where payroll_run_id = v_run_id and paid = true;

    if v_paid_count > 0 then
      raise exception 'Cannot recalculate: % line(s) in this period are already marked paid', v_paid_count;
    end if;

  else
    insert into public.payroll_run (site_id, week_start, week_end, created_by)
    values (p_site_id, p_week_start, p_week_end, v_user_id)
    returning id into v_run_id;
  end if;

  -- Upsert rather than delete + reinsert: on a recalculate, lines already
  -- exist and may carry advances/deductions the owner entered. Only
  -- days_present and the amounts derived from it are refreshed; the
  -- line's own daily_rate, advances and deductions are kept, and
  -- net_amount is recomputed as gross - advances - deductions.
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
  group by w.id, w.daily_rate
  on conflict (payroll_run_id, worker_id) do update
    set days_present = excluded.days_present,
        gross_amount = excluded.days_present * payroll_line.daily_rate,
        net_amount = excluded.days_present * payroll_line.daily_rate
                     - payroll_line.advances - payroll_line.deductions;

  return v_run_id;
end;
$$;

grant execute on function public.generate_payroll_run(uuid, date, date) to authenticated;

-- 4. List periods with attendance logged but no payroll_run yet, so the UI
-- can show a "Generate" reminder instead of a silent cost gap. Buckets by
-- the site's own cadence: one row per day, or one row per Mon-Sun week.
create or replace function public.get_ungenerated_payroll_periods(p_site_id uuid)
returns table (period_start date, period_end date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cadence text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not (public.owns_site(p_site_id, v_user_id) or public.is_assigned_foreman(p_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  select payroll_cadence into v_cadence from public.sites where id = p_site_id;

  if v_cadence = 'daily' then
    return query
    select distinct a.date, a.date
    from public.attendance_log a
    join public.workers_master w on w.id = a.worker_id
    where w.site_id = p_site_id
      and not exists (
        select 1 from public.payroll_run pr
        where pr.site_id = p_site_id and pr.week_start = a.date and pr.week_end = a.date
      )
    order by a.date;
  else
    return query
    select distinct
      date_trunc('week', a.date)::date as wk_start,
      (date_trunc('week', a.date) + interval '6 days')::date as wk_end
    from public.attendance_log a
    join public.workers_master w on w.id = a.worker_id
    where w.site_id = p_site_id
      and not exists (
        select 1 from public.payroll_run pr
        where pr.site_id = p_site_id
          and pr.week_start = date_trunc('week', a.date)::date
          and pr.week_end = (date_trunc('week', a.date) + interval '6 days')::date
      )
    order by wk_start;
  end if;
end;
$$;

grant execute on function public.get_ungenerated_payroll_periods(uuid) to authenticated;

comment on function public.generate_payroll_run is
  'Creates or recalculates a payroll run for a period. Recalculating refreshes days/gross/net from current attendance, keeping advances and deductions; blocks if any line in the run is already paid.';
comment on function public.get_ungenerated_payroll_periods is
  'Periods (days or weeks, per sites.payroll_cadence) with attendance logged but no payroll_run yet - drives the Budget/Payroll "Generate" reminder.';
