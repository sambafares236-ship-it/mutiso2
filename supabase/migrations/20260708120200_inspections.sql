-- Site Inspection Checklists: recurring compliance checks (PPE,
-- scaffolding, electrical, housekeeping) that currently exist only as a
-- bullet point in a static safety tip, not something anyone can be shown
-- to have actually checked.
--
-- inspection_template is a shared reference table (not site-scoped) -
-- readable by everyone authenticated, only admin roles manage the
-- template list itself. inspection_log is the site-scoped completed
-- checklist, storing results as jsonb rather than a normalized per-item
-- table since checklist items are template-defined and don't need to be
-- individually queried/joined elsewhere.

create table public.inspection_template (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  items jsonb not null, -- [{ "label": "Hard hats worn" }, ...]
  created_at timestamptz not null default now()
);

create table public.inspection_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  template_id uuid references public.inspection_template(id) not null,
  date date not null default current_date,
  results jsonb not null, -- [{ "label": "Hard hats worn", "pass": true, "note": "" }, ...]
  flagged_count int not null default 0,
  inspected_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.inspection_template enable row level security;
alter table public.inspection_log enable row level security;

create policy "Authenticated users can view inspection templates"
  on public.inspection_template for select
  to authenticated
  using (true);

create policy "Admin roles can manage inspection templates"
  on public.inspection_template for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage inspections"
  on public.inspection_log for all
  to authenticated
  using (
    public.owns_site(inspection_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(inspection_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(inspection_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(inspection_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all inspections"
  on public.inspection_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

insert into public.inspection_template (name, category, items) values
  ('PPE Compliance', 'ppe', '[
    {"label": "Hard hats worn on site"},
    {"label": "Safety boots worn"},
    {"label": "Reflective vests worn"},
    {"label": "Dust masks available where cutting/grinding"}
  ]'::jsonb),
  ('Scaffolding Safety', 'scaffolding', '[
    {"label": "Guardrails installed on all open sides"},
    {"label": "Base plates and sole boards in place"},
    {"label": "Scaffold tagged and inspection date current"},
    {"label": "Access ladders secured"}
  ]'::jsonb),
  ('Electrical Safety', 'electrical', '[
    {"label": "Clearance from overhead power lines confirmed"},
    {"label": "Cables and cords free of damage"},
    {"label": "Panels and boards properly enclosed"},
    {"label": "Equipment disconnected before maintenance"}
  ]'::jsonb),
  ('Housekeeping', 'housekeeping', '[
    {"label": "Walkways clear of loose materials/offcuts"},
    {"label": "Excavations and trenches barricaded"},
    {"label": "First aid kit stocked and accessible"},
    {"label": "Waste disposed of properly"}
  ]'::jsonb);
