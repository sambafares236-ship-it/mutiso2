-- No policy allowed the invited foreman themselves to mark an invite as
-- used - only the inviter (contractor) or an admin could update invites.
-- Since the whole point of JoinPage/useConsumeInvite is the *new user*
-- claiming the invite right after signing up, this update needs its own
-- narrow policy: can only flip a still-live invite to used, and only by
-- setting used_by to themselves - can't un-use it, can't claim it on
-- someone else's behalf.
create policy "Authenticated users can consume a live invite"
  on public.invites for update
  to authenticated
  using (not used and expires_at > now())
  with check (used = true and used_by = (select auth.uid()));
