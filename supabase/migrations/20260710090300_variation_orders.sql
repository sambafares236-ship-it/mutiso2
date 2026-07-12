-- Variation orders / RFIs: contract changes and client queries need a
-- paper trail distinct from the day-to-day diary. Anyone on the site can
-- raise one or add a response, but the approve/reject decision is
-- owner-only - same reasoning as payroll and permits: a foreman
-- shouldn't be able to approve a cost/time change to the contract they're
-- executing on someone else's behalf.

create table public.variation_order (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  title text not null,
  description text not null,
  cost_impact numeric,
  time_impact_days int,
  status text not null default 'open', -- 'open' | 'approved' | 'rejected'
  raised_by uuid references auth.users(id) not null,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.variation_order_response (
  id uuid primary key default gen_random_uuid(),
  variation_order_id uuid references public.variation_order(id) on delete cascade not null,
  responder_id uuid references auth.users(id) not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.variation_order enable row level security;
alter table public.variation_order_response enable row level security;

create policy "Site owner or assigned foreman can view variation orders"
  on public.variation_order for select
  to authenticated
  using (
    public.owns_site(variation_order.site_id, (select auth.uid()))
    or public.is_assigned_foreman(variation_order.site_id, (select auth.uid()))
  );

create policy "Site owner or assigned foreman can raise variation orders"
  on public.variation_order for insert
  to authenticated
  with check (
    raised_by = (select auth.uid())
    and status = 'open'
    and (
      public.owns_site(variation_order.site_id, (select auth.uid()))
      or public.is_assigned_foreman(variation_order.site_id, (select auth.uid()))
    )
  );

-- Only the site owner can move a variation order out of 'open' - the
-- raiser (which could be the foreman) is not sufficient.
create policy "Only site owner can decide variation orders"
  on public.variation_order for update
  to authenticated
  using (public.owns_site(variation_order.site_id, (select auth.uid())))
  with check (public.owns_site(variation_order.site_id, (select auth.uid())));

create policy "Admin roles can manage all variation orders"
  on public.variation_order for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create or replace function public.can_access_variation_order(_variation_order_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.variation_order vo
    where vo.id = _variation_order_id
      and (public.owns_site(vo.site_id, _user_id) or public.is_assigned_foreman(vo.site_id, _user_id))
  )
$$;

create policy "Site owner or assigned foreman can manage VO responses"
  on public.variation_order_response for all
  to authenticated
  using (public.can_access_variation_order(variation_order_response.variation_order_id, (select auth.uid())))
  with check (
    responder_id = (select auth.uid())
    and public.can_access_variation_order(variation_order_response.variation_order_id, (select auth.uid()))
  );

create policy "Admin roles can manage all VO responses"
  on public.variation_order_response for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );
