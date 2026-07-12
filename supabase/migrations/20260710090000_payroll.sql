-- Payroll (Stage 5, Tier 3 Financial). workers_master.daily_rate and
-- attendance_log already exist - this just does the multiplication and
-- turns it into a real wage record with a paid confirmation step.
--
-- Financial authority split, same reasoning as the permit approval gate:
-- a foreman can VIEW payroll for their site, but generating a run and
-- marking it paid is owner-only. Unlike attendance/materials/diary,
-- payroll isn't "field capture" - it's a financial decision, and the
-- foreman is exactly the person whose own hours are being computed, so
-- letting them also generate/approve their own crew's pay would be the
-- same self-dealing problem the permit and defect-verification gates
-- already exist to prevent.

create table public.payroll_run (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  week_start date not null,
  week_end date not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now(),
  unique (site_id, week_start)
);

create table public.payroll_line (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid references public.payroll_run(id) on delete cascade not null,
  worker_id uuid references public.workers_master(id) on delete cascade not null,
  days_present int not null default 0,
  daily_rate numeric not null,
  gross_amount numeric not null,
  advances numeric not null default 0,
  deductions numeric not null default 0,
  net_amount numeric not null,
  paid boolean not null default false,
  paid_by uuid references auth.users(id),
  paid_at timestamptz,
  unique (payroll_run_id, worker_id)
);

alter table public.payroll_run enable row level security;
alter table public.payroll_line enable row level security;

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

create policy "Admin roles can manage all payroll runs"
  on public.payroll_run for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- payroll_line's site is one hop away via payroll_run - same
-- SECURITY DEFINER join-helper pattern as can_access_toolbox_talk().
create or replace function public.can_access_payroll_run(_payroll_run_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payroll_run pr
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
    select 1
    from public.payroll_run pr
    where pr.id = _payroll_run_id
      and public.owns_site(pr.site_id, _user_id)
  )
$$;

create policy "Site owner or assigned foreman can view payroll lines"
  on public.payroll_line for select
  to authenticated
  using (public.can_access_payroll_run(payroll_line.payroll_run_id, (select auth.uid())));

create policy "Only site owner can modify payroll lines"
  on public.payroll_line for all
  to authenticated
  using (public.owns_payroll_run_site(payroll_line.payroll_run_id, (select auth.uid())))
  with check (public.owns_payroll_run_site(payroll_line.payroll_run_id, (select auth.uid())));

create policy "Admin roles can manage all payroll lines"
  on public.payroll_line for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Generates a payroll_run + one payroll_line per worker who has at least
-- one attendance_log row in the week, computing days_present and
-- gross_amount from real data in one atomic transaction. Owner-only,
-- enforced inside the function itself (not just by RLS) since this does
-- multiple inserts that individually would each need the same check.
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

grant execute on function public.generate_payroll_run(uuid, date, date) to authenticated;
