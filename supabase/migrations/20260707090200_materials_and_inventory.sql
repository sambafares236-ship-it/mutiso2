-- Materials in (deliveries), materials out (usage), and running stock
-- levels. site_id is NOT NULL on every one.

create table public.materials_delivered (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  date date not null default current_date,
  material_name text not null,
  supplier text,
  quantity numeric not null,
  unit text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

create table public.material_inventory (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  material_name text not null,
  current_quantity numeric not null default 0,
  unit text,
  last_updated timestamptz not null default now(),
  unique (site_id, material_name)
);

create table public.material_usage_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  date date not null default current_date,
  material_name text not null,
  quantity numeric not null,
  unit text,
  description text,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.materials_delivered enable row level security;
alter table public.material_inventory enable row level security;
alter table public.material_usage_log enable row level security;

create policy "Site owner or assigned foreman can manage deliveries"
  on public.materials_delivered for all
  to authenticated
  using (
    public.owns_site(materials_delivered.site_id, (select auth.uid()))
    or public.is_assigned_foreman(materials_delivered.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(materials_delivered.site_id, (select auth.uid()))
    or public.is_assigned_foreman(materials_delivered.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all deliveries"
  on public.materials_delivered for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage inventory"
  on public.material_inventory for all
  to authenticated
  using (
    public.owns_site(material_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman(material_inventory.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(material_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman(material_inventory.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all inventory"
  on public.material_inventory for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage usage log"
  on public.material_usage_log for all
  to authenticated
  using (
    public.owns_site(material_usage_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(material_usage_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(material_usage_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(material_usage_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all usage logs"
  on public.material_usage_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
