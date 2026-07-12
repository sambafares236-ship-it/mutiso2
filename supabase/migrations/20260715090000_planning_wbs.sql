-- Planning & Scheduling module (gap analysis Module 2, P1 item): a real WBS
-- with hierarchy/dates/dependencies, a BOQ, and a resource plan. Previously
-- the only "schedule" concept was site_milestone's fixed 5-stage sequence -
-- fine as a coarse sign-off gate, not a substitute for a real activity list.
--
-- Tenancy/roles follow the decision made in the gap-analysis review: reuse
-- the existing site_id + owns_site()/is_assigned_foreman() pattern and the
-- existing 4-role model, same as every other table in this schema. No
-- organizations table, no new app_role values.

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  parent_id uuid references public.activity(id) on delete cascade,
  activity_code text,
  name text not null,
  description text,
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  percent_complete numeric not null default 0,
  responsible_party text,
  status text not null default 'not_started', -- 'not_started' | 'in_progress' | 'completed' | 'delayed'
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_percent_complete_range check (percent_complete >= 0 and percent_complete <= 100)
);

-- Dependencies as a real join table rather than a uuid[] column - a raw
-- array can't be FK-constrained per element, so a dropped/renamed activity
-- would silently leave dangling ids in every dependent row's array.
create table public.activity_dependency (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activity(id) on delete cascade not null,
  depends_on_id uuid references public.activity(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (activity_id, depends_on_id),
  constraint activity_dependency_not_self check (activity_id <> depends_on_id)
);

create table public.boq_item (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  activity_id uuid references public.activity(id) on delete set null,
  item_code text not null,
  description text not null,
  unit text,
  quantity numeric not null,
  unit_rate numeric not null,
  -- Generated, not stored-and-hand-maintained, so total_amount can never
  -- drift from quantity * unit_rate the way a plain column could if only
  -- one of the three fields got updated.
  total_amount numeric generated always as (quantity * unit_rate) stored,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

create table public.resource_plan (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  activity_id uuid references public.activity(id) on delete set null,
  resource_type text not null, -- 'labor' | 'equipment' | 'material'
  category text not null,
  planned_quantity numeric,
  planned_cost numeric,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

alter table public.activity enable row level security;
alter table public.activity_dependency enable row level security;
alter table public.boq_item enable row level security;
alter table public.resource_plan enable row level security;

create trigger update_activity_updated_at
  before update on public.activity
  for each row execute function public.update_updated_at_column();

create policy "Site owner or assigned foreman can manage activities"
  on public.activity for all
  to authenticated
  using (
    public.owns_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman(activity.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman(activity.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all activities"
  on public.activity for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- activity_dependency has no site_id of its own - same one-hop join-helper
-- pattern as can_access_toolbox_talk()/can_access_variation_order().
create or replace function public.can_access_activity(_activity_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.activity a
    where a.id = _activity_id
      and (public.owns_site(a.site_id, _user_id) or public.is_assigned_foreman(a.site_id, _user_id))
  )
$$;

create policy "Site owner or assigned foreman can manage activity dependencies"
  on public.activity_dependency for all
  to authenticated
  using (public.can_access_activity(activity_dependency.activity_id, (select auth.uid())))
  with check (public.can_access_activity(activity_dependency.activity_id, (select auth.uid())));

create policy "Admin roles can manage all activity dependencies"
  on public.activity_dependency for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage BOQ items"
  on public.boq_item for all
  to authenticated
  using (
    public.owns_site(boq_item.site_id, (select auth.uid()))
    or public.is_assigned_foreman(boq_item.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(boq_item.site_id, (select auth.uid()))
    or public.is_assigned_foreman(boq_item.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all BOQ items"
  on public.boq_item for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create policy "Site owner or assigned foreman can manage resource plan"
  on public.resource_plan for all
  to authenticated
  using (
    public.owns_site(resource_plan.site_id, (select auth.uid()))
    or public.is_assigned_foreman(resource_plan.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(resource_plan.site_id, (select auth.uid()))
    or public.is_assigned_foreman(resource_plan.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all resource plan rows"
  on public.resource_plan for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
