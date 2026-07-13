import { describe, it, expect, vi, afterEach } from 'vitest';

// This test only exercises the pure isNetworkFailure() branching logic, not
// the OfflineQueueProvider itself - mock the Supabase client so importing
// the module doesn't depend on real env vars or hit the network.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { isNetworkFailure } from './useOfflineQueue';

// This is the exact branch CLAUDE.md documents as the single most
// bug-prone piece of this codebase: a queued operation that fails for a
// REAL server reason (e.g. insufficient stock) must move to the "failed"
// list, while a transient network failure must stay queued for retry.
// Getting this backwards either silently drops real data-entry rejections
// into an endless retry loop, or (worse) treats a real rejection as
// "network flaked, try again forever."
describe('isNetworkFailure', () => {
  const originalOnLine = navigator.onLine;

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });

  it('treats a TypeError (fetch failed to reach the server at all) as a network failure', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('treats being offline as a network failure regardless of error shape', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    expect(isNetworkFailure(new Error('anything'))).toBe(true);
  });

  it('does NOT treat a real server rejection as a network failure when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const postgrestError = { message: 'insufficient stock', code: '23514' };
    expect(isNetworkFailure(postgrestError)).toBe(false);
  });

  it('does NOT treat a plain Error (e.g. a thrown validation/business error) as a network failure when online', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    expect(isNetworkFailure(new Error('duplicate key value violates unique constraint'))).toBe(false);
  });
});
