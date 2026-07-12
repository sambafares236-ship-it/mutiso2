-- Petty cash log: small day-to-day cash spend on site (fuel, transport,
-- welfare, minor consumables) - genuinely foreman field capture, not a
-- financial-authority decision like budget/actual_cost, so this gets the
-- same blanket owner+foreman RLS as diary/materials rather than the
-- split owner-only shape used for actual_cost. Deliberately its own
-- table rather than routed through actual_cost, for the same reason
-- Material Payments needed its own FK bridge instead of reusing
-- actual_cost directly: the write-authorization shape differs (foreman
-- needs INSERT here, actual_cost is owner-only-write).

create table public.petty_cash_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  date date not null default current_date,
  amount numeric not null,
  description text not null,
  receipt_photo_url text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.petty_cash_log enable row level security;

create policy "Site owner or assigned foreman can manage petty cash"
  on public.petty_cash_log for all
  to authenticated
  using (
    public.owns_site(petty_cash_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(petty_cash_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(petty_cash_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(petty_cash_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all petty cash"
  on public.petty_cash_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
