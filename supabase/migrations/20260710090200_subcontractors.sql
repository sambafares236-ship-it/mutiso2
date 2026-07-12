-- Subcontractor registry: larger sites run subcontracted trades who need
-- their own compliance record - insurance, NCA registration - tracked
-- separately from the general workforce, plus simple work orders tying
-- specific work to a subcontractor.

create table public.subcontractor (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  company_name text not null,
  trade text,
  contact_name text,
  contact_phone text,
  nca_number text,
  insurance_expiry date,
  created_at timestamptz not null default now()
);

create table public.subcontractor_work_order (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid references public.subcontractor(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete cascade not null,
  description text not null,
  status text not null default 'open', -- 'open' | 'completed'
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.subcontractor enable row level security;
alter table public.subcontractor_work_order enable row level security;

create policy "Site owner or assigned foreman can manage subcontractors"
  on public.subcontractor for all
  to authenticated
  using (
    public.owns_site(subcontractor.site_id, (select auth.uid()))
    or public.is_assigned_foreman(subcontractor.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(subcontractor.site_id, (select auth.uid()))
    or public.is_assigned_foreman(subcontractor.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all subcontractors"
  on public.subcontractor for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage work orders"
  on public.subcontractor_work_order for all
  to authenticated
  using (
    public.owns_site(subcontractor_work_order.site_id, (select auth.uid()))
    or public.is_assigned_foreman(subcontractor_work_order.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(subcontractor_work_order.site_id, (select auth.uid()))
    or public.is_assigned_foreman(subcontractor_work_order.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all work orders"
  on public.subcontractor_work_order for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
