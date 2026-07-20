import { describe, it, expect, beforeEach, vi } from 'vitest';

// Same reasoning as useOfflineQueue.test.ts: mock the Supabase client so
// importing this module doesn't depend on real env vars or hit the
// network. useAuth.tsx also imports isNetworkFailure from
// useOfflineQueue.tsx, which imports the same client module - one mock
// covers both.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));

import { readPersistedSession, cacheRoles, readCachedRoles } from './useAuth';

// This covers the fallback path added so an offline reload doesn't look
// like a sign-out: when getSession() can't be reached (timeout or a real
// network failure), useAuth falls back to whatever's still sitting,
// unexpired, in localStorage instead of wiping it. These tests exercise
// that fallback logic directly, the same way useOfflineQueue.test.ts
// isolates isNetworkFailure() rather than rendering the whole provider.
describe('readPersistedSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no sb-*-auth-token key exists', () => {
    expect(readPersistedSession()).toBeNull();
  });

  it('returns the parsed session when an unexpired token is present', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const session = { access_token: 'abc', expires_at: future, user: { id: 'user-1' } };
    localStorage.setItem('sb-project-auth-token', JSON.stringify(session));
    expect(readPersistedSession()).toEqual(session);
  });

  it('returns null when the stored token has already expired', () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    localStorage.setItem(
      'sb-project-auth-token',
      JSON.stringify({ access_token: 'abc', expires_at: past, user: { id: 'user-1' } }),
    );
    expect(readPersistedSession()).toBeNull();
  });

  it('returns null (never throws) when the stored value is malformed JSON', () => {
    localStorage.setItem('sb-project-auth-token', '{not valid json');
    expect(readPersistedSession()).toBeNull();
  });

  it('returns null when the stored value has no user field', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('sb-project-auth-token', JSON.stringify({ access_token: 'abc', expires_at: future }));
    expect(readPersistedSession()).toBeNull();
  });
});

describe('cacheRoles / readCachedRoles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips a role list for a given user id', () => {
    cacheRoles('user-1', ['foreman']);
    expect(readCachedRoles('user-1')).toEqual(['foreman']);
  });

  it('returns an empty array when nothing has been cached for that user', () => {
    expect(readCachedRoles('never-cached-user')).toEqual([]);
  });

  it('returns an empty array (never throws) for malformed cached JSON', () => {
    localStorage.setItem('mutiso_cached_roles_user-1', '{not valid json');
    expect(readCachedRoles('user-1')).toEqual([]);
  });

  it('keeps different users\' cached roles independent', () => {
    cacheRoles('user-1', ['contractor']);
    cacheRoles('user-2', ['foreman']);
    expect(readCachedRoles('user-1')).toEqual(['contractor']);
    expect(readCachedRoles('user-2')).toEqual(['foreman']);
  });
});
