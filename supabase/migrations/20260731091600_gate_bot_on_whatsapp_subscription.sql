-- The WhatsApp bot was a paid add-on that nothing enforced.
--
-- sites.whatsapp_bot_enabled (20260730090500) is written correctly by every
-- payment path - complete_subscription_payment(), request_manual_subscription
-- _payment(), create_site_with_manual_payment() all set it from the payment's
-- own includes_bot. But no reader ever checked it: the app only *displays* it
-- ("+ WhatsApp Bot" on the site card), n8n's Resolve Contractor node gated
-- solely on sites.status = 'active', and this function documented itself as
-- doing "no further authorization check" because n8n was assumed to have done
-- it. Net effect on prod: 8 active sites, 7 of them without the add-on, and
-- every one of their owners would have been answered in full.
--
-- Expiry was a second, independent hole. The app locks out a lapsed
-- subscription inside owns_site()/is_assigned_foreman() (subscription_end >=
-- current_date, see 20260731090600) - sites.status is never flipped to
-- 'expired'. The bot reaches Postgres directly via the service_role
-- credential and never calls those helpers, so it only ever saw status =
-- 'active', which stays true forever. A lapsed subscriber kept WhatsApp
-- indefinitely.
--
-- This function is the backstop rather than the n8n query, deliberately: it
-- takes a site_id as a parameter and is SECURITY DEFINER, which is exactly
-- the shape CLAUDE.md's own rule covers ("any future SECURITY DEFINER RPC
-- that takes a target row id needs its own ownership check inside the
-- function - being SECURITY DEFINER is why RLS alone won't protect it").
-- n8n gets the same conditions too, but only so an unpaid contractor sees a
-- helpful reply; this is what actually enforces it.

-- Mirrors the shape of owns_site()/owns_pro_site() rather than inlining the
-- three conditions at each call site, so the n8n-facing rule has one
-- definition. `subscription_end >= current_date` is null-safe (a null end
-- date yields false), same as owns_site() relies on.
create or replace function public.site_whatsapp_bot_active(_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = _site_id
      and s.status = 'active'
      and s.whatsapp_bot_enabled
      and s.subscription_end >= current_date
  )
$$;

comment on function public.site_whatsapp_bot_active(uuid) is
  'True when this site currently pays for the WhatsApp add-on and its subscription has not lapsed. The single definition of "may this site use WhatsApp", used by bot_query_site_data() and mirrored by the n8n chatbot/digest queries.';

-- Signature is unchanged, so a plain CREATE OR REPLACE is correct here (the
-- "adding params creates a second overload" gotcha only applies when the
-- argument list itself changes). Body is 20260730090100's verbatim, plus the
-- subscription guard at the top.
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
  -- Returned as data rather than raised: the caller is an LLM tool call, and
  -- a structured reason it can relay ("your plan doesn't include this") is
  -- more useful than an exception it would surface as a generic failure.
  -- Same shape as the existing unknown-query_type branch below.
  if not public.site_whatsapp_bot_active(p_site_id) then
    return jsonb_build_object('data', jsonb_build_object(
      'error', 'whatsapp_bot_not_enabled',
      'message', 'This site''s subscription does not include the WhatsApp assistant, or the subscription has lapsed. No site data can be shared here.'
    ));
  end if;

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
    when 'diary' then
      select jsonb_agg(jsonb_build_object('date', sd.date, 'category', sd.category, 'title', sd.title, 'description', sd.description) order by sd.date desc, sd.created_at desc) into v_result
      from public.site_diary_log sd
      where sd.site_id = p_site_id and sd.date >= current_date - p_date_range_days;
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
      v_result := jsonb_build_object('error', 'unknown query_type: ' || coalesce(p_query_type, ''), 'valid_types', array['attendance','deliveries','usage','inventory','incidents','defects','diary','progress','payroll','visitors','certifications','permits','budget']);
  end case;

  return jsonb_build_object('data', coalesce(v_result, '[]'::jsonb));
end;
$$;

revoke all on function public.bot_query_site_data(text, uuid, int) from public, anon, authenticated;
revoke all on function public.site_whatsapp_bot_active(uuid) from public, anon, authenticated;
