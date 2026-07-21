-- Lets the signup form tell someone their number is already registered,
-- instead of silently creating a second account for the same person.
--
-- Three profiles on prod ended up sharing one phone number because nothing in
-- the signup flow ever said "you already have an account" - each signup used a
-- different email, which is all Supabase Auth checks. Since the WhatsApp
-- assistant identifies a contractor by phone number, that produced an account
-- that had paid for the assistant and two that had not, with the bot resolving
-- to an arbitrary one of them.
--
-- 20260731091700 made a duplicate number impossible to store; this makes it
-- explainable at the moment it happens. handle_new_user() still degrades
-- gracefully (account created, phone dropped) to cover the race between this
-- check and the insert, so this is a UX affordance rather than the enforcement
-- mechanism - the unique index remains the thing that actually guarantees it.
--
-- Note this necessarily reveals whether a given number has an account, the
-- same way an "email already in use" message does. That is accepted: the
-- alternative is silently creating duplicate identities, which is precisely
-- the failure this exists to prevent.
create or replace function public.is_phone_number_available(p_phone text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  -- normalize_ke_phone() returns null for an unparseable number, and `= null`
  -- is never true, so a malformed input reports "available" and is left to the
  -- client's own format validation to reject.
  select not exists (
    select 1
    from public.profiles
    where public.normalize_ke_phone(phone_number) = public.normalize_ke_phone(p_phone)
  );
$$;

-- anon as well as authenticated: this is called from the signup form, before
-- the user has a session.
grant execute on function public.is_phone_number_available(text) to anon, authenticated;
