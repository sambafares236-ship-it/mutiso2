-- Toolbox Talks: safety briefings with worker sign-off, reusing the same
-- present/absent tap pattern as attendance. A talk plus its attendee list
-- is submitted as ONE atomic RPC (not two separate table writes) for the
-- same reason consume_invite() and the material RPCs are RPCs: it needs
-- to be a single unit for the offline queue (submitOrQueue queues one
-- operation at a time - a multi-table write needs to collapse into one
-- RPC call to queue cleanly) and to avoid a half-written talk (topic
-- logged but no attendees, or vice versa) if a client dies mid-submit.

create table public.toolbox_talk_log (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  topic text not null,
  date date not null default current_date,
  conducted_by uuid references auth.users(id) not null,
  created_at timestamptz not null default now()
);

create table public.toolbox_talk_attendance (
  id uuid primary key default gen_random_uuid(),
  toolbox_talk_id uuid references public.toolbox_talk_log(id) on delete cascade not null,
  worker_id uuid references public.workers_master(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (toolbox_talk_id, worker_id)
);

alter table public.toolbox_talk_log enable row level security;
alter table public.toolbox_talk_attendance enable row level security;

create policy "Site owner or assigned foreman can manage toolbox talks"
  on public.toolbox_talk_log for all
  to authenticated
  using (
    public.owns_site(toolbox_talk_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(toolbox_talk_log.site_id, (select auth.uid()))
  )
  with check (
    public.owns_site(toolbox_talk_log.site_id, (select auth.uid()))
    or public.is_assigned_foreman(toolbox_talk_log.site_id, (select auth.uid()))
  );

create policy "Admin roles can manage all toolbox talks"
  on public.toolbox_talk_log for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- SECURITY DEFINER helper (same reasoning as owns_site/is_assigned_foreman):
-- lets the toolbox_talk_attendance policy check "does this talk belong to
-- a site I can access" without an inlined subquery that could recurse.
create or replace function public.can_access_toolbox_talk(_toolbox_talk_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.toolbox_talk_log t
    where t.id = _toolbox_talk_id
      and (public.owns_site(t.site_id, _user_id) or public.is_assigned_foreman(t.site_id, _user_id))
  )
$$;

create policy "Site owner or assigned foreman can manage talk attendance"
  on public.toolbox_talk_attendance for all
  to authenticated
  using (public.can_access_toolbox_talk(toolbox_talk_attendance.toolbox_talk_id, (select auth.uid())))
  with check (public.can_access_toolbox_talk(toolbox_talk_attendance.toolbox_talk_id, (select auth.uid())));

create policy "Admin roles can manage all talk attendance"
  on public.toolbox_talk_attendance for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

create or replace function public.create_toolbox_talk(
  p_site_id uuid,
  p_topic text,
  p_date date,
  p_worker_ids uuid[]
)
returns uuid -- returns the new toolbox_talk_log id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_authorized boolean;
  v_talk_id uuid;
  v_worker_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_authorized := public.owns_site(p_site_id, v_user_id) or public.is_assigned_foreman(p_site_id, v_user_id);
  if not v_authorized then
    raise exception 'Not authorized for this site';
  end if;

  insert into public.toolbox_talk_log (site_id, topic, date, conducted_by)
  values (p_site_id, p_topic, p_date, v_user_id)
  returning id into v_talk_id;

  foreach v_worker_id in array p_worker_ids loop
    insert into public.toolbox_talk_attendance (toolbox_talk_id, worker_id)
    values (v_talk_id, v_worker_id)
    on conflict (toolbox_talk_id, worker_id) do nothing;
  end loop;

  return v_talk_id;
end;
$$;

grant execute on function public.create_toolbox_talk(uuid, text, date, uuid[]) to authenticated;
