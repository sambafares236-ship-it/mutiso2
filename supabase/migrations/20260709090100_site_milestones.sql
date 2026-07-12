-- Milestone sign-off: contracts frequently gate progression on inspection
-- ("foundation must be signed off before backfilling"). Right now the
-- diary just records that something happened, with no approval gate.
--
-- Every site gets the same 5-stage default sequence, auto-created by a
-- trigger on sites INSERT (and backfilled here for sites that already
-- exist). The actual gate is enforced in a BEFORE UPDATE trigger, not
-- just in application code: a milestone can't move to 'in_progress' or
-- 'completed' unless the previous sequence's milestone is already
-- 'completed' - this holds no matter what client issues the update.

create table public.site_milestone (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  name text not null,
  sequence int not null,
  status text not null default 'pending', -- 'pending' | 'in_progress' | 'completed'
  inspected_by uuid references auth.users(id),
  signed_off_at timestamptz,
  created_at timestamptz not null default now(),
  unique (site_id, sequence)
);

alter table public.site_milestone enable row level security;

create policy "Site owner or assigned foreman can manage milestones"
  on public.site_milestone for all
  to authenticated
  using (
    public.owns_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_milestone.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman(site_milestone.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all milestones"
  on public.site_milestone for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- The gate itself: reject any UPDATE moving this row to 'in_progress' or
-- 'completed' if the previous-sequence milestone for the same site isn't
-- already 'completed'. Sequence 1 has nothing before it, so it's exempt.
create or replace function public.enforce_milestone_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev_status text;
begin
  if new.status in ('in_progress', 'completed') and new.sequence > 1 then
    select status into v_prev_status
    from public.site_milestone
    where site_id = new.site_id and sequence = new.sequence - 1;

    if v_prev_status is distinct from 'completed' then
      raise exception 'Cannot start "%" until the previous milestone is completed', new.name;
    end if;
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    new.signed_off_at := now();
    new.inspected_by := coalesce(new.inspected_by, auth.uid());
  end if;

  return new;
end;
$$;

create trigger on_milestone_update_enforce_sequence
  before update on public.site_milestone
  for each row execute function public.enforce_milestone_sequence();

-- Auto-seed the default 5-stage sequence for every new site.
create or replace function public.seed_default_milestones()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.site_milestone (site_id, name, sequence) values
    (new.id, 'Foundation', 1),
    (new.id, 'Structure', 2),
    (new.id, 'Roofing', 3),
    (new.id, 'Finishes', 4),
    (new.id, 'Handover', 5);
  return new;
end;
$$;

create trigger on_site_insert_seed_milestones
  after insert on public.sites
  for each row execute function public.seed_default_milestones();

-- Backfill for sites created before this migration existed.
insert into public.site_milestone (site_id, name, sequence)
select s.id, m.name, m.sequence
from public.sites s
cross join (values ('Foundation', 1), ('Structure', 2), ('Roofing', 3), ('Finishes', 4), ('Handover', 5)) as m(name, sequence)
where not exists (
  select 1 from public.site_milestone sm where sm.site_id = s.id
);
