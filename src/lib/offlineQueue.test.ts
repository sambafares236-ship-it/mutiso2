import { describe, it, expect, vi, beforeEach } from 'vitest';

// jsdom has no real IndexedDB, and idb-keyval's actual implementation would
// need one - mock it with a plain in-memory Map so these tests exercise
// offlineQueue.ts's own logic (read-modify-write, filtering) rather than a
// browser API this environment doesn't provide.
const store = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string) => Promise.resolve(store.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    store.set(key, value);
    return Promise.resolve();
  }),
}));

import {
  getQueue,
  enqueueOperation,
  removeOperation,
  getFailedOperations,
  moveToFailed,
  dismissFailedOperation,
} from './offlineQueue';

describe('offlineQueue', () => {
  beforeEach(() => {
    store.clear();
  });

  it('starts empty', async () => {
    expect(await getQueue()).toEqual([]);
    expect(await getFailedOperations()).toEqual([]);
  });

  it('enqueues an operation and assigns it an id and timestamp', async () => {
    const queued = await enqueueOperation({
      kind: 'insert',
      table: 'attendance_log',
      payload: { site_id: 's1', worker_id: 'w1' },
      description: 'Mark attendance',
    });

    expect(queued.id).toBeTruthy();
    expect(queued.createdAt).toBeTypeOf('number');
    expect(await getQueue()).toEqual([queued]);
  });

  it('preserves queue order across multiple enqueues (replay must not reorder)', async () => {
    const first = await enqueueOperation({ kind: 'insert', table: 't', payload: { n: 1 }, description: 'first' });
    const second = await enqueueOperation({ kind: 'insert', table: 't', payload: { n: 2 }, description: 'second' });

    const queue = await getQueue();
    expect(queue.map((op) => op.id)).toEqual([first.id, second.id]);
  });

  it('removes only the targeted operation, leaving the rest queued', async () => {
    const first = await enqueueOperation({ kind: 'insert', table: 't', payload: { n: 1 }, description: 'first' });
    const second = await enqueueOperation({ kind: 'insert', table: 't', payload: { n: 2 }, description: 'second' });

    await removeOperation(first.id);

    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(second.id);
  });

  it('moves a real server rejection out of the retry queue and into failed, not silently dropped', async () => {
    const op = await enqueueOperation({
      kind: 'rpc',
      fn: 'log_material_usage',
      payload: { material: 'cement' },
      description: 'Use material',
    });

    await moveToFailed(op, 'insufficient stock');

    expect(await getQueue()).toEqual([]);
    const failed = await getFailedOperations();
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ id: op.id, errorMessage: 'insufficient stock' });
  });

  it('dismissing a failed operation removes it without touching the retry queue', async () => {
    const stillQueued = await enqueueOperation({ kind: 'insert', table: 't', payload: {}, description: 'still queued' });
    const willFail = await enqueueOperation({ kind: 'insert', table: 't', payload: {}, description: 'will fail' });
    await moveToFailed(willFail, 'rejected');

    await dismissFailedOperation(willFail.id);

    expect(await getFailedOperations()).toEqual([]);
    expect((await getQueue()).map((op) => op.id)).toEqual([stillQueued.id]);
  });
});
