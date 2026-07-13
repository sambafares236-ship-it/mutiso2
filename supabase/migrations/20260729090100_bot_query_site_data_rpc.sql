-- WhatsApp bot data-query RPC. Called by n8n via the PostgREST /rpc endpoint
-- using the service_role key (bypasses RLS by design, same as any other
-- service_role call) - the site_id passed in is always resolved and
-- verified server-side in n8n before this is ever called (checked against
-- the requesting contractor's own sites), never taken from the WhatsApp
-- message text directly. This function itself does no further authorization
-- check because nothing client-facing can call it directly (no anon/
-- authenticated grant - see below).
create or replace function public.bot_query_site_data(
  p_query_type text,
  p_site_id uuid,
  p_date_range_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  case p_query_type
    when 'attendance' then
      select jsonb_agg(jsonb_build_object('date', a.date, 'worker', w.full_name)) into v_result
      from public.attendance_log a join public.workers_master w on w.id = a.worker_id
      where a.site_id = p_site_id and a.date >= current_date - p_date_range_days;
    when 'deliveries' then
      select jsonb_agg(jsonb_build_object('date', d.date, 'material', d.material_name, 'quantity', d.quantity, 'unit', d.unit, 'supplier', d.supplier)) into v_result
      from public.materials_delivered d
      where d.site_id = p_site_id and d.date >= current_date - p_date_range_days;
    when 'usage' then
      select jsonb_agg(jsonb_build_object('date', u.date, 'material', u.material_name, 'quantity', u.quantity, 'unit', u.unit)) into v_result
      from public.material_usage_log u
      where u.site_id = p_site_id and u.date >= current_date - p_date_range_days;
    when 'inventory' then
      select jsonb_agg(jsonb_build_object('material', mi.material_name, 'current_quantity', mi.current_quantity, 'unit', mi.unit)) into v_result
      from public.material_inventory mi
      where mi.site_id = p_site_id;
    when 'incidents' then
      select jsonb_agg(jsonb_build_object('date', i.date, 'category', i.category, 'severity', i.severity, 'description', i.description, 'closed', i.closed_at is not null)) into v_result
      from public.incident_log i
      where i.site_id = p_site_id and i.date >= current_date - p_date_range_days;
    when 'defects' then
      select jsonb_agg(jsonb_build_object('location', df.location, 'description', df.description, 'severity', df.severity, 'status', df.status)) into v_result
      from public.defect_log df
      where df.site_id = p_site_id and df.status <> 'resolved';
    when 'progress' then
      select jsonb_build_object(
        'percent_complete', (select coalesce(round(avg(act.percent_complete)),0) from public.activity act where act.site_id = p_site_id),
        'milestones', (select jsonb_agg(jsonb_build_object('name', sm.name, 'status', sm.status, 'sequence', sm.sequence) order by sm.sequence) from public.site_milestone sm where sm.site_id = p_site_id),
        'overdue_activities', (select jsonb_agg(jsonb_build_object('name', act.name, 'planned_end', act.planned_end)) from public.activity act where act.site_id = p_site_id and act.planned_end < current_date and act.status <> 'completed')
      ) into v_result;
    when 'payroll' then
      select jsonb_agg(jsonb_build_object('week_start', pr.week_start, 'week_end', pr.week_end, 'total_gross', (select sum(pl.gross_amount) from public.payroll_line pl where pl.payroll_run_id = pr.id), 'total_net', (select sum(pl.net_amount) from public.payroll_line pl where pl.payroll_run_id = pr.id))) into v_result
      from (select * from public.payroll_run where site_id = p_site_id order by week_start desc limit 5) pr;
    when 'visitors' then
      select jsonb_agg(jsonb_build_object('visitor_name', v.visitor_name, 'company', v.company, 'purpose', v.purpose, 'time_in', v.time_in, 'time_out', v.time_out)) into v_result
      from public.visitor_log v
      where v.site_id = p_site_id and v.time_in >= current_date - p_date_range_days;
    when 'certifications' then
      select jsonb_agg(jsonb_build_object('subject_type', c.subject_type, 'cert_name', c.cert_name, 'expiry_date', c.expiry_date)) into v_result
      from public.certification c
      where c.site_id = p_site_id and c.expiry_date <= current_date + 60;
    when 'permits' then
      select jsonb_agg(jsonb_build_object('permit_type', wp.permit_type, 'status', wp.status, 'requested_at', wp.created_at)) into v_result
      from (select * from public.work_permit where site_id = p_site_id order by created_at desc limit 10) wp;
    when 'budget' then
      select jsonb_build_object('contract_value', sc.contract_value, 'retention_percentage', sc.retention_percentage, 'total_budget', (select sum(bl.budgeted_amount) from public.budget_line bl where bl.site_id = p_site_id), 'total_actual_cost', (select sum(ac.amount) from public.actual_cost ac where ac.site_id = p_site_id)) into v_result
      from public.site_contract sc
      where sc.site_id = p_site_id;
    else
      v_result := jsonb_build_object('error', 'unknown query_type: ' || coalesce(p_query_type, ''), 'valid_types', array['attendance','deliveries','usage','inventory','incidents','defects','progress','payroll','visitors','certifications','permits','budget']);
  end case;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- No grants to anon/authenticated - this is only ever called via the
-- service_role key from the n8n bot, never directly from the app.
revoke all on function public.bot_query_site_data(text, uuid, int) from public, anon, authenticated;
