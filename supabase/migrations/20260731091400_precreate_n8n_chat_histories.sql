-- Pre-creates public.n8n_chat_histories with RLS already enabled, ahead of
-- ever pointing n8n's Postgres Chat Memory node at a new project.
--
-- 20260730090300 locks this table down, but it is guarded by to_regclass and
-- the table only exists once n8n's chat memory node has actually run against
-- that database - so on a project n8n has never touched (prod, as of
-- 2026-07-18: `to_regclass(...) is not null` returned false) that migration
-- is a silent no-op. Repointing the WhatsApp bot at such a project would
-- have n8n auto-CREATE the table itself, with RLS disabled by default,
-- leaving every contractor's raw WhatsApp conversation readable AND
-- writable through the app's public anon key until somebody noticed. The
-- lockdown migration's own closing note calls out this exact scenario.
--
-- Creating it ourselves first closes that window entirely: n8n's chat memory
-- node issues CREATE TABLE IF NOT EXISTS, so it adopts this table as-is
-- instead of creating its own unprotected one. The column definitions mirror
-- what n8n creates, verified against the dev project's live table
-- (id serial primary key, session_id varchar, message jsonb - note there is
-- deliberately no created_at; n8n does not create one). If n8n's own schema
-- ever changes, this has to be updated to match or the memory node will
-- fail against the adopted table.
--
-- RLS with zero policies blocks anon/authenticated (PostgREST) access
-- entirely while leaving n8n's own direct Postgres connection unaffected -
-- it authenticates as a database role rather than through PostgREST, so RLS
-- doesn't restrict it. Same reasoning as 20260730090300.
--
-- Fully idempotent: on dev the table already exists with RLS on, so both
-- statements are no-ops.

create table if not exists public.n8n_chat_histories (
  id serial primary key,
  session_id varchar(255) not null,
  message jsonb not null
);

alter table public.n8n_chat_histories enable row level security;

-- Belt and braces on top of RLS. Supabase's default privileges hand anon and
-- authenticated full table grants on anything created in `public`, and RLS
-- with zero policies already blocks all *row* access for them - but TRUNCATE
-- is a table-level privilege that RLS does not govern at all, so it survives
-- the lockdown. PostgREST never exposes TRUNCATE, which is why dev has been
-- fine carrying these grants, but there is no reason for either role to hold
-- any privilege on a table the app never touches. n8n connects as the table
-- owner over a direct Postgres connection, so revoking here doesn't affect it.
revoke all on public.n8n_chat_histories from anon, authenticated;
