-- Waste & environmental log (Stage 7, Tier 5 Environmental) - NEMA-oriented
-- record-keeping of what waste left the site, how much, and via which
-- disposal route/partner. This is the one genuinely new concern for this
-- stage; "dust/noise/environmental incidents" (the other half of the plan
-- bullet) deliberately does NOT get its own table - incident_log
-- (20260708120000_incident_log.sql) already has an 'environmental'
-- category option from Stage 3, and category is a free-text column, so
-- dust/noise/spill reports just insert into incident_log with a new
-- category value. That table's existing medium/high-severity
-- owner-notification trigger applies to these for free. See CLAUDE.md for
-- the full reasoning - this avoids a second near-duplicate incident table.

create table public.waste_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  date date not null default current_date,
  waste_type text not null, -- 'general' | 'construction_debris' | 'hazardous' | 'e_waste' | 'scrap_metal' | 'other'
  disposal_method text not null, -- 'licensed_transporter' | 'recycling' | 'landfill' | 'reuse_onsite' | 'other'
  quantity numeric,
  unit text, -- 'kg' | 'tonnes' | 'm3' | 'truckloads'
  disposal_partner text, -- name of the NEMA-licensed waste handler/transporter, kept as compliance evidence
  photo_url text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.waste_log enable row level security;

create policy "Site owner or assigned foreman can manage waste log"
  on public.waste_log for all
  to authenticated
  using (
    public.owns_site(waste_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(waste_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(waste_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(waste_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all waste logs"
  on public.waste_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
