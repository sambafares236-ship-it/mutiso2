-- Contract admin (subcontractor registry, variation orders) moves fully
-- off the foreman's plate onto the contractor's dashboard - the foreman
-- was never the one negotiating trade packages or contract variations,
-- just the one who happened to have the only form for it. Subcontractor
-- management becomes owner-only outright (no read access either, unlike
-- certifications - there's no field-operational reason a foreman needs
-- this). Variation orders keep their existing approve/reject split
-- (already owner-only), but raising one is now owner-only too - the
-- contractor uses it as their own record/reminder rather than a
-- foreman-raises/contractor-approves workflow.

drop policy "Site owner or assigned foreman can manage subcontractors" on public.subcontractor;

create policy "Only site owner can manage subcontractors"
  on public.subcontractor for all
  to authenticated
  using (public.owns_site(subcontractor.site_id, (select auth.uid())))
  with check (public.owns_site(subcontractor.site_id, (select auth.uid())));

drop policy "Site owner or assigned foreman can manage work orders" on public.subcontractor_work_order;

create policy "Only site owner can manage work orders"
  on public.subcontractor_work_order for all
  to authenticated
  using (public.owns_site(subcontractor_work_order.site_id, (select auth.uid())))
  with check (public.owns_site(subcontractor_work_order.site_id, (select auth.uid())));

drop policy "Site owner or assigned foreman can raise variation orders" on public.variation_order;

create policy "Only site owner can raise variation orders"
  on public.variation_order for insert
  to authenticated
  with check (
    raised_by = (select auth.uid())
    and status = 'open'
    and public.owns_site(variation_order.site_id, (select auth.uid()))
  );
