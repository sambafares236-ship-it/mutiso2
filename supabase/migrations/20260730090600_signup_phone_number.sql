-- Collects phone_number at signup (Auth.tsx) instead of leaving it
-- permanently null until a contractor happens to hit the "add a phone
-- number before paying" wall in mpesa-stk-push. Same options.data pattern
-- full_name already uses - the client normalizes to the 2547XXXXXXXX shape
-- (src/lib/phone.ts) before it ever reaches this trigger.
--
-- Same shape as before (no parameter change) so CREATE OR REPLACE is safe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email_address, phone_number)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email, new.raw_user_meta_data ->> 'phone_number');

  if not coalesce((new.raw_user_meta_data ->> 'is_invite')::boolean, false) then
    insert into public.user_roles (user_id, role) values (new.id, 'contractor');
  end if;

  return new;
end;
$$;
