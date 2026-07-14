-- Real tier-based feature gating, part 1: tier-aware helper functions.
-- owns_site()/is_assigned_foreman() already require sites.status='active'
-- (20260730090800). These two new functions wrap them and additionally
-- require subscription_tier='pro', reusing the same centralized-helper
-- pattern this schema already relies on for every cross-table RLS check.
create or replace function public.owns_pro_site(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.owns_site(_site_id, _user_id)
    and exists (select 1 from public.sites where id = _site_id and subscription_tier = 'pro')
$$;

create or replace function public.is_assigned_foreman_of_pro_site(_site_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_assigned_foreman(_site_id, _user_id)
    and exists (select 1 from public.sites where id = _site_id and subscription_tier = 'pro')
$$;

-- Six existing join-helper functions already centralize access for
-- activity_dependency, variation_order_response, schedule_baseline_activity,
-- and payroll_line - rewriting just these 6 (same signature, no policy
-- changes needed) makes all four of those tables tier-aware for free.

create or replace function public.can_access_activity(_activity_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.activity a
    where a.id = _activity_id
      and (public.owns_pro_site(a.site_id, _user_id) or public.is_assigned_foreman_of_pro_site(a.site_id, _user_id))
  )
$$;

create or replace function public.can_access_variation_order(_variation_order_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.variation_order vo
    where vo.id = _variation_order_id
      and (public.owns_pro_site(vo.site_id, _user_id) or public.is_assigned_foreman_of_pro_site(vo.site_id, _user_id))
  )
$$;

create or replace function public.can_access_baseline(_baseline_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.schedule_baseline b
    where b.id = _baseline_id
      and (public.owns_pro_site(b.site_id, _user_id) or public.is_assigned_foreman_of_pro_site(b.site_id, _user_id))
  )
$$;

create or replace function public.owns_baseline_site(_baseline_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.schedule_baseline b
    where b.id = _baseline_id and public.owns_pro_site(b.site_id, _user_id)
  )
$$;

create or replace function public.can_access_payroll_run(_payroll_run_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.payroll_run pr
    where pr.id = _payroll_run_id
      and (public.owns_pro_site(pr.site_id, _user_id) or public.is_assigned_foreman_of_pro_site(pr.site_id, _user_id))
  )
$$;

create or replace function public.owns_payroll_run_site(_payroll_run_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.payroll_run pr
    where pr.id = _payroll_run_id and public.owns_pro_site(pr.site_id, _user_id)
  )
$$;
