-- Core auth/roles foundation.
-- app_role includes all four values from day one (the old repo's enum only
-- had 'admin'/'foreman' migrated, while the app code and remote DB had
-- drifted to also use 'super_admin'/'contractor' with no migration record).
create type public.app_role as enum ('super_admin', 'contractor', 'admin', 'foreman');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- SECURITY DEFINER function to check roles without recursive RLS issues.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Profiles policies. The (select auth.uid()) wrapping avoids Postgres
-- re-evaluating the function per row (same optimization the old repo
-- applied retroactively in its own hardening migration).
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Admin roles can view all profiles"
  on public.profiles for select
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
    or public.has_role((select auth.uid()), 'contractor')
  );

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- User roles policies.
create policy "Users can view own roles"
  on public.user_roles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Admins can manage all roles"
  on public.user_roles for all
  to authenticated
  using (
    public.has_role((select auth.uid()), 'admin')
    or public.has_role((select auth.uid()), 'super_admin')
  );

-- Shared updated_at trigger helper.
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- New-user trigger: always creates a profile. Role assignment depends on
-- how the signup happened:
--   - Self-service signup (the normal /auth flow): defaults to 'contractor',
--     since a person signing themselves up is setting up their own
--     site-owning account.
--   - Invite-flagged signup (JoinPage, options.data.is_invite = true):
--     skips default role assignment entirely. The invite-consumption step
--     explicitly inserts the 'foreman' role itself, so inserting a default
--     role here would just be redundant (or conflict with the unique
--     constraint if consumeInvite runs first).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email_address)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);

  if not coalesce((new.raw_user_meta_data ->> 'is_invite')::boolean, false) then
    insert into public.user_roles (user_id, role) values (new.id, 'contractor');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
