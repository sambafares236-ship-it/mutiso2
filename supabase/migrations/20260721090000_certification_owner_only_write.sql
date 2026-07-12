-- Certifications become a contractor-owned compliance record (managed
-- from ProjectOverviewView) rather than a foreman field-capture form -
-- only the site owner may add/edit/delete now. Foreman keeps SELECT so
-- the Certifications tile in ForemanDashboard can still show what's
-- expiring. Same split-policy shape as payroll_run.

drop policy "Site owner or assigned foreman can manage certifications" on public.certification;

create policy "Site owner or assigned foreman can view certifications"
  on public.certification for select
  to authenticated
  using (
    public.owns_site(certification.site_id, (select auth.uid()))
    or public.is_assigned_foreman(certification.site_id, (select auth.uid()))
  );

create policy "Only site owner can create or modify certifications"
  on public.certification for all
  to authenticated
  using (public.owns_site(certification.site_id, (select auth.uid())))
  with check (public.owns_site(certification.site_id, (select auth.uid())));
