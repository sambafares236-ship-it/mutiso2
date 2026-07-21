-- One phone number, one contractor.
--
-- The WhatsApp chatbot identifies who is messaging it purely by phone number
-- (the "Resolve Contractor" query in the n8n WhatsApp Contractor Chatbot
-- workflow), and that query ends in `limit 1` with no ORDER BY. Nothing ever
-- stopped two profiles sharing a number, so when three accounts on prod all
-- registered 254700920985, the bot resolved to an arbitrary one of them --
-- in practice the account with no WhatsApp add-on -- and told a paying
-- customer their "plan doesn't include the WhatsApp assistant" while the
-- account that had actually paid was never consulted. The pick is not stable
-- either: with no ORDER BY the winner can change after any update or replan,
-- which is why the same number appeared to work intermittently.
--
-- Uniqueness is enforced on the *normalized* number rather than the raw text,
-- because 0712345678 and +254 712 345 678 are the same phone to every human
-- and to WhatsApp, but three different strings to a plain unique index.

-- Mirrors normalizeKenyanPhone() in src/lib/phone.ts (and the copy in
-- supabase/functions/mpesa-stk-push/index.ts) -- keep all three in sync.
-- Returns null for anything that isn't a valid Kenyan mobile number, so
-- garbage never collides with a real number in the unique index below.
--
-- IMMUTABLE is required to use this in an index expression. Deliberately no
-- `set search_path`: a function with a SET clause cannot be inlined, and this
-- only calls regexp_replace/substring from pg_catalog, which user schemas
-- cannot shadow.
create or replace function public.normalize_ke_phone(p_phone text)
returns text
language sql
immutable
strict
as $$
  select case
    when digits ~ '^254[17][0-9]{8}$' then digits              -- already 2547XXXXXXXX
    when digits ~ '^0[17][0-9]{8}$'   then '254' || substring(digits from 2)  -- 07XXXXXXXX
    when digits ~ '^[17][0-9]{8}$'    then '254' || digits     -- 7XXXXXXXX
    else null
  end
  from (select regexp_replace(p_phone, '\D', '', 'g') as digits) s;
$$;

comment on function public.normalize_ke_phone(text) is
  'Normalizes a Kenyan mobile number to 2547XXXXXXXX/2541XXXXXXXX, or null if invalid. Mirrors normalizeKenyanPhone() in src/lib/phone.ts.';

-- 1. Rewrite existing values into the normalized shape.
--
-- This matters beyond tidiness: the bot's lookup compares digits-only, so a
-- number stored as 0700920985 would never match an inbound 254700920985 and
-- that contractor would be silently unrecognised. Rows that don't parse as a
-- valid Kenyan mobile are left exactly as they are rather than destroyed --
-- they simply won't participate in the unique index.
update public.profiles
   set phone_number = public.normalize_ke_phone(phone_number)
 where phone_number is not null
   and public.normalize_ke_phone(phone_number) is not null
   and public.normalize_ke_phone(phone_number) <> phone_number;

-- 2. Resolve numbers now claimed by more than one profile.
--
-- Exactly one profile keeps each number; the rest have it cleared to null.
-- The keeper is chosen by which account most looks like the real owner, in
-- this order:
--   1. most WhatsApp-bot-enabled sites  (the account the bot exists to serve)
--   2. most completed subscription payments (a genuinely paying customer)
--   3. most sites, then oldest, then id (pure tie-breakers, for determinism)
-- On prod this deterministically keeps mutiso ai <mutisoconstruction@gmail.com>
-- (2 bot-enabled sites, 3 completed payments) over ian and Fares Samba, which
-- is the intended outcome -- the number belongs to the account that paid for
-- the assistant.
--
-- Clearing a phone number is deliberately non-destructive: those profiles keep
-- every site, payment and role they had. The one real consequence is that
-- create_site_with_manual_payment() and request_manual_subscription_payment()
-- both raise when the caller's profile has no phone, so those accounts must
-- set a new number (Settings) before creating a site or reporting a payment.
with ranked as (
  select
    p.id,
    public.normalize_ke_phone(p.phone_number) as norm,
    row_number() over (
      partition by public.normalize_ke_phone(p.phone_number)
      order by
        (select count(*) from public.sites s
          where s.owner_id = p.id and s.whatsapp_bot_enabled) desc,
        (select count(*) from public.subscription_payment sp
           join public.sites s on s.id = sp.site_id
          where s.owner_id = p.id and sp.status = 'completed') desc,
        (select count(*) from public.sites s where s.owner_id = p.id) desc,
        p.created_at asc,
        p.id asc
    ) as rn
  from public.profiles p
  where public.normalize_ke_phone(p.phone_number) is not null
)
update public.profiles p
   set phone_number = null
  from ranked r
 where p.id = r.id
   and r.rn > 1;

-- 3. Enforce it from here on.
--
-- Partial index: profiles with no phone (or an unparseable one, which
-- normalizes to null) are unconstrained, and multiple nulls never conflict.
create unique index profiles_normalized_phone_unique
  on public.profiles (public.normalize_ke_phone(phone_number))
  where public.normalize_ke_phone(phone_number) is not null;

-- 4. Keep signup working.
--
-- handle_new_user() runs inside the auth.users insert, so an unhandled unique
-- violation here would abort the whole signup and surface to the client as an
-- opaque "Database error saving new user" -- breaking registration for anyone
-- who happens to type a number another account already uses. Signup therefore
-- degrades instead of failing: the account is created with no phone number,
-- and the user can set one in Settings, where a duplicate gets a clear,
-- actionable error instead of a 500.
--
-- Same signature, so CREATE OR REPLACE genuinely replaces it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := public.normalize_ke_phone(new.raw_user_meta_data ->> 'phone_number');
begin
  -- Drop the phone if another profile already owns it, rather than letting the
  -- unique index abort signup.
  if v_phone is not null and exists (
    select 1 from public.profiles
     where public.normalize_ke_phone(phone_number) = v_phone
  ) then
    v_phone := null;
  end if;

  insert into public.profiles (id, full_name, email_address, phone_number)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email, v_phone);

  if not coalesce((new.raw_user_meta_data ->> 'is_invite')::boolean, false) then
    insert into public.user_roles (user_id, role) values (new.id, 'contractor');
  end if;

  return new;
end;
$$;
