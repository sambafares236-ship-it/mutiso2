-- Certification/expiry tracker (Stage 6, Tier 4) - worker certs (e.g. first
-- aid, working-at-height) and equipment certs (e.g. crane inspection,
-- fire extinguisher service) in one table, distinguished by subject_type
-- with a CHECK constraint enforcing exactly one of worker_id/tool_id is
-- set depending on which. "Expiring soon" is computed client-side (same
-- isExpiringSoon() pattern already used for subcontractor insurance in
-- Stage 5) rather than via a notifications-table trigger - there's no
-- time-based event to hang an AFTER INSERT trigger off, and adding
-- pg_cron for a 30-day-lookahead badge would be disproportionate. See
-- CLAUDE.md for the full reasoning.

create table public.certification (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  subject_type text not null, -- 'worker' | 'equipment'
  worker_id uuid references public.workers_master(id) on delete cascade,
  tool_id uuid references public.tool_inventory(id) on delete cascade,
  cert_name text not null,
  cert_number text,
  issued_date date,
  expiry_date date not null,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now(),
  constraint certification_subject_matches_type check (
    (subject_type = 'worker' and worker_id is not null and tool_id is null)
    or (subject_type = 'equipment' and tool_id is not null and worker_id is null)
  )
);

alter table public.certification enable row level security;

create policy "Site owner or assigned foreman can manage certifications"
  on public.certification for all
  to authenticated
  using (
    public.owns_site(certification.site_id, (select auth.uid()))
    or public.is_assigned_foreman(certification.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(certification.site_id, (select auth.uid()))
    or public.is_assigned_foreman(certification.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all certifications"
  on public.certification for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
