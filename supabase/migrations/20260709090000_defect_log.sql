-- Defect/Snag List (Stage 4, Tier 2 Quality & Progress). Nothing today
-- records "this isn't done right" and tracks it to resolution.
--
-- verified_by is deliberately distinct from fixed_by - the person who
-- confirms a fix is correct should never be the same person who did the
-- fix, or verification is meaningless. Enforced as a real CHECK
-- constraint, not just a UI convention, so it holds no matter which
-- client or path performs the update.

create table public.defect_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  location text,
  description text not null,
  photo_url text,
  severity text not null default 'medium', -- 'low' | 'medium' | 'high'
  status text not null default 'open', -- 'open' | 'in_progress' | 'resolved'
  reported_by uuid references auth.users(id) not null,
  fixed_by uuid references auth.users(id),
  fixed_at timestamptz,
  verified_by uuid references auth.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint defect_verifier_not_fixer check (verified_by is null or fixed_by is null or verified_by <> fixed_by)
);

alter table public.defect_log enable row level security;

create policy "Site owner or assigned foreman can manage defects"
  on public.defect_log for all
  to authenticated
  using (
    public.owns_site(defect_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(defect_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(defect_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(defect_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all defects"
  on public.defect_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
