-- public.n8n_chat_histories is not one of this app's own tables - n8n's
-- "Postgres Chat Memory" node (used by the WhatsApp Bot workflow) creates
-- it automatically in whatever Postgres it's pointed at, with RLS disabled
-- by default. Since it lives in the same `public` schema PostgREST exposes
-- to the anon/authenticated roles, that meant anyone holding the app's
-- public anon key could read or write the bot's raw WhatsApp conversation
-- history directly - found via a routine `supabase db query` advisory
-- check, not by design.
--
-- Enabling RLS with zero policies fully blocks anon/authenticated (API)
-- access while leaving n8n's own Postgres node connection unaffected - it
-- authenticates as a direct database role, not through PostgREST, so RLS
-- on a table it owns doesn't restrict it (same reasoning as any other
-- superuser/table-owner connection). This table is never meant to be
-- app-facing, so a full lockout is the correct end state, not a compromise.
--
-- Guarded with `to_regclass` since this table doesn't exist until n8n's
-- chat memory node has actually run at least once against this database -
-- if this migration reaches a project where it doesn't exist yet (e.g. a
-- freshly-replayed prod project before n8n is pointed at it), this is a
-- no-op rather than an error. Whoever repoints the n8n Postgres credential
-- to a new project should re-run this same check afterward, since a fresh
-- table created there will again default to RLS-disabled.

do $$
begin
  if to_regclass('public.n8n_chat_histories') is not null then
    execute 'alter table public.n8n_chat_histories enable row level security';
  end if;
end $$;
