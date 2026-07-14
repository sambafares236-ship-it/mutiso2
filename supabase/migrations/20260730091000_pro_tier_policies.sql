-- Real tier-based feature gating, part 2: swap owns_site()/is_assigned_foreman()
-- for owns_pro_site()/is_assigned_foreman_of_pro_site() (20260730090900) on
-- every Pro-exclusive table's own policies. Every asymmetry (owner-only vs
-- shared, split select/insert/update/delete shapes) is preserved exactly as
-- it was - only the tier condition is added on top. Admin policies
-- (has_role-based) are untouched everywhere, matching this schema's
-- existing convention that admin bypass is never tier/status-gated.

-- site_contract
drop policy if exists "Site owner or assigned foreman can view contract" on public.site_contract;
drop policy if exists "Only site owner can manage contract" on public.site_contract;

create policy "Site owner or assigned foreman can view contract"
  on public.site_contract for select
  to authenticated
  using (
    public.owns_pro_site(site_contract.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(site_contract.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage contract"
  on public.site_contract for all
  to authenticated
  using (public.owns_pro_site(site_contract.site_id, (select auth.uid())))
  with check (public.owns_pro_site(site_contract.site_id, (select auth.uid())));

-- budget_line
drop policy if exists "Site owner or assigned foreman can view budget" on public.budget_line;
drop policy if exists "Only site owner can manage budget" on public.budget_line;

create policy "Site owner or assigned foreman can view budget"
  on public.budget_line for select
  to authenticated
  using (
    public.owns_pro_site(budget_line.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(budget_line.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage budget"
  on public.budget_line for all
  to authenticated
  using (public.owns_pro_site(budget_line.site_id, (select auth.uid())))
  with check (public.owns_pro_site(budget_line.site_id, (select auth.uid())));

-- actual_cost
drop policy if exists "Site owner or assigned foreman can view actual costs" on public.actual_cost;
drop policy if exists "Only site owner can manage actual costs" on public.actual_cost;

create policy "Site owner or assigned foreman can view actual costs"
  on public.actual_cost for select
  to authenticated
  using (
    public.owns_pro_site(actual_cost.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(actual_cost.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage actual costs"
  on public.actual_cost for all
  to authenticated
  using (public.owns_pro_site(actual_cost.site_id, (select auth.uid())))
  with check (public.owns_pro_site(actual_cost.site_id, (select auth.uid())));

-- payment_certificate
drop policy if exists "Site owner or assigned foreman can view payment certificates" on public.payment_certificate;
drop policy if exists "Only site owner can manage payment certificates" on public.payment_certificate;

create policy "Site owner or assigned foreman can view payment certificates"
  on public.payment_certificate for select
  to authenticated
  using (
    public.owns_pro_site(payment_certificate.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(payment_certificate.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage payment certificates"
  on public.payment_certificate for all
  to authenticated
  using (public.owns_pro_site(payment_certificate.site_id, (select auth.uid())))
  with check (public.owns_pro_site(payment_certificate.site_id, (select auth.uid())));

-- payroll_run
drop policy if exists "Site owner or assigned foreman can view payroll runs" on public.payroll_run;
drop policy if exists "Only site owner can create or modify payroll runs" on public.payroll_run;

create policy "Site owner or assigned foreman can view payroll runs"
  on public.payroll_run for select
  to authenticated
  using (
    public.owns_pro_site(payroll_run.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(payroll_run.site_id, (select auth.uid()))
  );

create policy "Only site owner can create or modify payroll runs"
  on public.payroll_run for all
  to authenticated
  using (public.owns_pro_site(payroll_run.site_id, (select auth.uid())))
  with check (public.owns_pro_site(payroll_run.site_id, (select auth.uid())));

-- activity (4 policies: view/create/delete/update)
drop policy if exists "Site owner or assigned foreman can view activities" on public.activity;
drop policy if exists "Site owner can create activities" on public.activity;
drop policy if exists "Site owner can delete activities" on public.activity;
drop policy if exists "Site owner or assigned foreman can update activities" on public.activity;

create policy "Site owner or assigned foreman can view activities"
  on public.activity for select
  to authenticated
  using (
    public.owns_pro_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(activity.site_id, (select auth.uid()))
  );

create policy "Site owner can create activities"
  on public.activity for insert
  to authenticated
  with check (public.owns_pro_site(activity.site_id, (select auth.uid())));

create policy "Site owner can delete activities"
  on public.activity for delete
  to authenticated
  using (public.owns_pro_site(activity.site_id, (select auth.uid())));

create policy "Site owner or assigned foreman can update activities"
  on public.activity for update
  to authenticated
  using (
    public.owns_pro_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(activity.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(activity.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(activity.site_id, (select auth.uid()))
  );

-- activity_dependency: SELECT policy already covered by can_access_activity()
-- rewrite (20260730090900) - only the owner-only "manage" policy uses an
-- inline exists+owns_site, not a helper, so it needs a direct swap.
drop policy if exists "Site owner can manage activity dependencies" on public.activity_dependency;

create policy "Site owner can manage activity dependencies"
  on public.activity_dependency for all
  to authenticated
  using (
    exists (
      select 1 from public.activity a
      where a.id = activity_dependency.activity_id
        and public.owns_pro_site(a.site_id, (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.activity a
      where a.id = activity_dependency.activity_id
        and public.owns_pro_site(a.site_id, (select auth.uid()))
    )
  );

-- schedule_baseline
drop policy if exists "Site owner or assigned foreman can view schedule baselines" on public.schedule_baseline;
drop policy if exists "Only site owner can manage schedule baselines" on public.schedule_baseline;

create policy "Site owner or assigned foreman can view schedule baselines"
  on public.schedule_baseline for select
  to authenticated
  using (
    public.owns_pro_site(schedule_baseline.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(schedule_baseline.site_id, (select auth.uid()))
  );

create policy "Only site owner can manage schedule baselines"
  on public.schedule_baseline for all
  to authenticated
  using (public.owns_pro_site(schedule_baseline.site_id, (select auth.uid())))
  with check (public.owns_pro_site(schedule_baseline.site_id, (select auth.uid())));

-- resource_plan: the one table with zero owner/foreman split - preserve
-- that symmetry, both roles get the same shared tier gate.
drop policy if exists "Site owner or assigned foreman can manage resource plan" on public.resource_plan;

create policy "Site owner or assigned foreman can manage resource plan"
  on public.resource_plan for all
  to authenticated
  using (
    public.owns_pro_site(resource_plan.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(resource_plan.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(resource_plan.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(resource_plan.site_id, (select auth.uid()))
  );

-- defect_log
drop policy if exists "Site owner or assigned foreman can manage defects" on public.defect_log;

create policy "Site owner or assigned foreman can manage defects"
  on public.defect_log for all
  to authenticated
  using (
    public.owns_pro_site(defect_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(defect_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(defect_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(defect_log.site_id, (select auth.uid()))
  );

-- site_milestone (4 policies: view/create/delete/update)
drop policy if exists "Site owner or assigned foreman can view milestones" on public.site_milestone;
drop policy if exists "Site owner can create milestones" on public.site_milestone;
drop policy if exists "Site owner can delete pending milestones" on public.site_milestone;
drop policy if exists "Site owner or assigned foreman can update milestones" on public.site_milestone;

create policy "Site owner or assigned foreman can view milestones"
  on public.site_milestone for select
  to authenticated
  using (
    public.owns_pro_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(site_milestone.site_id, (select auth.uid()))
  );

create policy "Site owner can create milestones"
  on public.site_milestone for insert
  to authenticated
  with check (public.owns_pro_site(site_milestone.site_id, (select auth.uid())));

create policy "Site owner can delete pending milestones"
  on public.site_milestone for delete
  to authenticated
  using (
    public.owns_pro_site(site_milestone.site_id, (select auth.uid()))
    and site_milestone.status = 'pending'
  );

create policy "Site owner or assigned foreman can update milestones"
  on public.site_milestone for update
  to authenticated
  using (
    public.owns_pro_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(site_milestone.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(site_milestone.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(site_milestone.site_id, (select auth.uid()))
  );

-- variation_order (3 policies: view/insert/update - no delete policy exists)
drop policy if exists "Site owner or assigned foreman can view variation orders" on public.variation_order;
drop policy if exists "Only site owner can raise variation orders" on public.variation_order;
drop policy if exists "Only site owner can decide variation orders" on public.variation_order;

create policy "Site owner or assigned foreman can view variation orders"
  on public.variation_order for select
  to authenticated
  using (
    public.owns_pro_site(variation_order.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(variation_order.site_id, (select auth.uid()))
  );

create policy "Only site owner can raise variation orders"
  on public.variation_order for insert
  to authenticated
  with check (
    raised_by = (select auth.uid())
    and status = 'open'
    and public.owns_pro_site(variation_order.site_id, (select auth.uid()))
  );

create policy "Only site owner can decide variation orders"
  on public.variation_order for update
  to authenticated
  using (public.owns_pro_site(variation_order.site_id, (select auth.uid())))
  with check (public.owns_pro_site(variation_order.site_id, (select auth.uid())));

-- subcontractor: already zero foreman access (owner-only) - just swap owns_site.
drop policy if exists "Only site owner can manage subcontractors" on public.subcontractor;

create policy "Only site owner can manage subcontractors"
  on public.subcontractor for all
  to authenticated
  using (public.owns_pro_site(subcontractor.site_id, (select auth.uid())))
  with check (public.owns_pro_site(subcontractor.site_id, (select auth.uid())));

-- subcontractor_work_order: same shape as subcontractor.
drop policy if exists "Only site owner can manage work orders" on public.subcontractor_work_order;

create policy "Only site owner can manage work orders"
  on public.subcontractor_work_order for all
  to authenticated
  using (public.owns_pro_site(subcontractor_work_order.site_id, (select auth.uid())))
  with check (public.owns_pro_site(subcontractor_work_order.site_id, (select auth.uid())));

-- tool_inventory
drop policy if exists "Site owner or assigned foreman can manage tools" on public.tool_inventory;

create policy "Site owner or assigned foreman can manage tools"
  on public.tool_inventory for all
  to authenticated
  using (
    public.owns_pro_site(tool_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(tool_inventory.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(tool_inventory.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(tool_inventory.site_id, (select auth.uid()))
  );

-- tool_checkout_log: SELECT-only policy (writes go through checkout_tool()/
-- return_tool() RPCs, updated separately in the RPC migration).
drop policy if exists "Site owner or assigned foreman can view checkout log" on public.tool_checkout_log;

create policy "Site owner or assigned foreman can view checkout log"
  on public.tool_checkout_log for select
  to authenticated
  using (
    public.owns_pro_site(tool_checkout_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(tool_checkout_log.site_id, (select auth.uid()))
  );

-- equipment_maintenance_log
drop policy if exists "Site owner or assigned foreman can manage maintenance log" on public.equipment_maintenance_log;

create policy "Site owner or assigned foreman can manage maintenance log"
  on public.equipment_maintenance_log for all
  to authenticated
  using (
    public.owns_pro_site(equipment_maintenance_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(equipment_maintenance_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(equipment_maintenance_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(equipment_maintenance_log.site_id, (select auth.uid()))
  );

-- visitor_log
drop policy if exists "Site owner or assigned foreman can manage visitor log" on public.visitor_log;

create policy "Site owner or assigned foreman can manage visitor log"
  on public.visitor_log for all
  to authenticated
  using (
    public.owns_pro_site(visitor_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(visitor_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(visitor_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(visitor_log.site_id, (select auth.uid()))
  );

-- certification (2 policies: view/manage)
drop policy if exists "Site owner or assigned foreman can view certifications" on public.certification;
drop policy if exists "Only site owner can create or modify certifications" on public.certification;

create policy "Site owner or assigned foreman can view certifications"
  on public.certification for select
  to authenticated
  using (
    public.owns_pro_site(certification.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(certification.site_id, (select auth.uid()))
  );

create policy "Only site owner can create or modify certifications"
  on public.certification for all
  to authenticated
  using (public.owns_pro_site(certification.site_id, (select auth.uid())))
  with check (public.owns_pro_site(certification.site_id, (select auth.uid())));

-- waste_log
drop policy if exists "Site owner or assigned foreman can manage waste log" on public.waste_log;

create policy "Site owner or assigned foreman can manage waste log"
  on public.waste_log for all
  to authenticated
  using (
    public.owns_pro_site(waste_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(waste_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_pro_site(waste_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman_of_pro_site(waste_log.site_id, (select auth.uid()))
  );
