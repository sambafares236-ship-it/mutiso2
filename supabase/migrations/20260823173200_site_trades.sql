-- Trade dropdown for Workers and Subcontractors forms. Previously both
-- `workers_master.trade` and `subcontractors.trade` were plain free-text
-- inputs with no canonical list behind them - this adds one, without
-- touching either of those existing text columns (old free-typed values on
-- existing records are left exactly as they are; the new dropdown only
-- governs how future rows get their trade value).
--
-- Design: scoped per site, not global. A foreman adding a custom trade not
-- in the standard list only adds it for their own site - it never becomes
-- visible to other contractors/sites. This avoids one contractor's messy or
-- duplicate entries ("Mason" / "mason" / "Masonry guy") polluting every
-- other site's dropdown, and keeps the RLS story identical to every other
-- site-scoped table in this schema (tool_inventory, materials, etc.) rather
-- than needing a separate cross-tenant-readable shared table.
--
-- Every site gets the same standard starter list automatically via an
-- AFTER INSERT trigger on sites, rather than hooking every individual site-
-- creation RPC (create_site_with_manual_payment, start_trial_site, and any
-- future ones) - the trigger fires regardless of which path created the
-- row, so nothing can create a site without also getting its trade list.

create table public.site_trades (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  name text not null,
  is_custom boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (site_id, name)
);

alter table public.site_trades enable row level security;

create policy "Site owner or assigned foreman can view trades"
  on public.site_trades for select
  to authenticated
  using (
    public.owns_site(site_trades.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_trades.site_id, (select auth.uid()))
  );

create policy "Site owner or assigned foreman can add custom trades"
  on public.site_trades for insert
  to authenticated
  with check (
    public.owns_site(site_trades.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_trades.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all trades"
  on public.site_trades for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Standard starter list, seeded verbatim for every site. Kept as a plain
-- array constant inside the trigger function rather than a second lookup
-- table, since it's static and only ever read at site-creation time.
create or replace function public.seed_default_site_trades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_trades (site_id, name, is_custom)
  select new.id, t.name, false
  from unnest(array[
    'Mason', 'Electrician', 'Plumber', 'Carpenter', 'Steel Fixer',
    'Painter', 'Welder', 'Tiler', 'Plasterer', 'Scaffolder', 'Roofer',
    'Glazier', 'Machine Operator', 'Site Surveyor', 'Foreman',
    'General Laborer'
  ]) as t(name)
  on conflict (site_id, name) do nothing;
  return new;
end;
$$;

create trigger seed_default_site_trades_trigger
  after insert on public.sites
  for each row
  execute function public.seed_default_site_trades();

-- Backfill: sites created before this migration existed don't have any
-- site_trades rows yet, and won't fire the new trigger since they already
-- exist. One-time seed for those, same list, same on-conflict guard.
insert into public.site_trades (site_id, name, is_custom)
select s.id, t.name, false
from public.sites s
cross join unnest(array[
  'Mason', 'Electrician', 'Plumber', 'Carpenter', 'Steel Fixer',
  'Painter', 'Welder', 'Tiler', 'Plasterer', 'Scaffolder', 'Roofer',
  'Glazier', 'Machine Operator', 'Site Surveyor', 'Foreman',
  'General Laborer'
]) as t(name)
on conflict (site_id, name) do nothing;

-- Adds a custom trade for a site if it doesn't already exist, and returns
-- its id either way - lets the frontend call one RPC that works whether or
-- not another user already added the same trade name to this site first
-- (unique constraint would otherwise make this a two-step
-- check-then-insert with a race window).
create or replace function public.add_site_trade(
  p_site_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_name text := trim(p_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_name is null or length(v_name) = 0 then
    raise exception 'Trade name is required';
  end if;

  if not (public.owns_site(p_site_id, v_user_id) or public.is_assigned_foreman(p_site_id, v_user_id)) then
    raise exception 'Not authorized for this site';
  end if;

  insert into public.site_trades (site_id, name, is_custom, created_by)
  values (p_site_id, v_name, true, v_user_id)
  on conflict (site_id, name) do nothing
  returning id into v_trade_id;

  if v_trade_id is null then
    select id into v_trade_id from public.site_trades
    where site_id = p_site_id and name = v_name;
  end if;

  return v_trade_id;
end;
$$;

grant execute on function public.add_site_trade(uuid, text) to authenticated;
