-- Financial Tracking module (gap analysis Module 5, full scope per user
-- decision): contract terms, budget by cost code, a non-labor actual-costs
-- ledger, and payment certificates with retention.
--
-- actual_cost deliberately excludes labor - payroll_line.gross_amount is
-- already the real labor actual-cost record (computed from attendance),
-- duplicating it here would just create two sources of truth that can
-- drift. Same "don't duplicate a table that already covers this" reasoning
-- already used for incident_log/waste_log (see CLAUDE.md).
--
-- All four tables use the same split-policy shape as payroll_run/
-- work_permit/variation_order: SELECT open to owner+foreman (a foreman
-- should be able to see budget/contract context), INSERT/UPDATE/DELETE
-- owner-only - these are financial decisions, not field capture.

create table public.site_contract (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null unique,
  contract_type text, -- 'lump_sum' | 'cost_plus' | 'unit_price'
  contract_value numeric,
  currency text not null default 'KES',
  retention_percentage numeric,
  payment_terms text,
  signed_date date,
  contract_document_url text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_line (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  activity_id uuid references public.activity(id) on delete set null,
  cost_code text,
  category text not null, -- 'labor' | 'material' | 'equipment' | 'subcontractor' | 'overhead'
  budgeted_amount numeric not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

create table public.actual_cost (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  activity_id uuid references public.activity(id) on delete set null,
  subcontractor_id uuid references public.subcontractor(id) on delete set null,
  cost_type text not null, -- 'material' | 'equipment' | 'subcontractor' | 'overhead'
  amount numeric not null,
  date_incurred date not null default current_date,
  invoice_reference text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

create table public.payment_certificate (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  certificate_number int not null,
  period_start date not null,
  period_end date not null,
  work_completed_value numeric not null,
  retention_percentage numeric not null default 0,
  retention_amount numeric not null,
  previous_payments_total numeric not null default 0,
  net_amount_due numeric not null,
  status text not null default 'draft', -- 'draft' | 'certified' | 'paid'
  certified_by uuid references auth.users(id),
  certified_at timestamptz,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now(),
  unique (site_id, certificate_number)
);

alter table public.site_contract enable row level security;
alter table public.budget_line enable row level security;
alter table public.actual_cost enable row level security;
alter table public.payment_certificate enable row level security;

create trigger update_site_contract_updated_at
  before update on public.site_contract
  for each row execute function public.update_updated_at_column();

-- site_contract
create policy "Site owner or assigned foreman can view contract"
  on public.site_contract for select
  to authenticated
  using (
    public.owns_site(site_contract.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_contract.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage contract"
  on public.site_contract for all
  to authenticated
  using (public.owns_site(site_contract.site_id, (select auth.uid())))
  with check (public.owns_site(site_contract.site_id, (select auth.uid())));

create policy "Admin roles can manage all contracts"
  on public.site_contract for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- budget_line
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

create policy "Admin roles can manage all budget lines"
  on public.budget_line for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- actual_cost
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

create policy "Admin roles can manage all actual costs"
  on public.actual_cost for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- payment_certificate
create policy "Site owner or assigned foreman can view payment certificates"
  on public.payment_certificate for select
  to authenticated
  using (
    public.owns_site(payment_certificate.site_id, (select auth.uid()))
    or public.is_assigned_foreman(payment_certificate.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage payment certificates"
  on public.payment_certificate for all
  to authenticated
  using (public.owns_site(payment_certificate.site_id, (select auth.uid())))
  with check (public.owns_site(payment_certificate.site_id, (select auth.uid())));

create policy "Admin roles can manage all payment certificates"
  on public.payment_certificate for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Generates the next sequential certificate for a site in one atomic
-- transaction: pulls the default retention % from site_contract if not
-- explicitly overridden, sums every prior certificate's net_amount_due for
-- previous_payments_total, computes retention_amount/net_amount_due, and
-- auto-numbers the certificate. Owner-only, same reasoning as
-- generate_payroll_run - this is a financial decision, not field capture.
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

grant execute on function public.generate_payment_certificate(uuid, date, date, numeric, numeric) to authenticated;
