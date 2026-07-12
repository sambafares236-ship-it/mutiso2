-- The "Anon can view live invites" policy only grants role=anon. The
-- instant a foreman signs up mid-JoinPage-flow, they become "authenticated"
-- and lost visibility of the very invite row they're trying to consume -
-- which in turn silently no-ops the UPDATE that marks it used (Postgres/
-- PostgREST returns no error, just zero affected rows, for an UPDATE RLS
-- filters out). Mirroring the anon policy for authenticated users closes
-- that gap.
create policy "Authenticated users can view live invites"
  on public.invites for select
  to authenticated
  using (not used and expires_at > now());
