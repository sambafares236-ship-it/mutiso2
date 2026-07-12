-- Stage 2: workers roster + attendance, tied together by a real foreign
-- key. The old app matched "who's present today" by comparing worker
-- full_name strings - two same-named workers would have collided. Here,
-- attendance_log.worker_id references workers_master.id directly, and a
-- unique(site_id, worker_id, date) constraint makes double-marking the
-- same worker on the same day a DB-level impossibility, not just an
-- application-level convention.

create table public.workers_master (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  worker_id_number text not null,
  full_name text not null,
  trade text,
  daily_rate numeric,
  phone_number text,
  created_at timestamptz not null default now(),
  unique (site_id, worker_id_number)
);

create table public.attendance_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  worker_id uuid references public.workers_master(id) on delete cascade not null,
  date date not null default current_date,
  marked_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now(),
  unique (site_id, worker_id, date)
);

alter table public.workers_master enable row level security;
alter table public.attendance_log enable row level security;

-- Reuses the SECURITY DEFINER helpers (owns_site / is_assigned_foreman)
-- introduced in the Stage 1 RLS-recursion fix - this is now the standard
-- pattern for "site owner or the foreman assigned to that site" access.
create policy "Site owner or assigned foreman can manage workers"
  on public.workers_master for all
  to authenticated
  using (
    public.owns_site(workers_master.site_id, (select auth.uid()))
    or public.is_assigned_foreman(workers_master.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(workers_master.site_id, (select auth.uid()))
    or public.is_assigned_foreman(workers_master.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all workers"
  on public.workers_master for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage attendance"
  on public.attendance_log for all
  to authenticated
  using (
    public.owns_site(attendance_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(attendance_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(attendance_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(attendance_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all attendance"
  on public.attendance_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
