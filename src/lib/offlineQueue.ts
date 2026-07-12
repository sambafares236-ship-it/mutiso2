import { get, set } from 'idb-keyval';

const QUEUE_KEY = 'mutiso_offline_queue';
const FAILED_KEY = 'mutiso_offline_failed';

// NewInsertOp/NewRpcOp (pre-id/createdAt) are defined directly, rather
// than derived via Omit<QueuedOperation, 'id' | 'createdAt'> - Omit over a
// discriminated union collapses it into a single non-discriminated shape,
// which loses the 'table'-only-on-insert / 'fn'-only-on-rpc distinction
// and made every caller's object literal fail to type-check.
type NewInsertOp = { kind: 'insert'; table: string; payload: Record<string, unknown>; description: string };
type NewRpcOp = { kind: 'rpc'; fn: string; payload: Record<string, unknown>; description: string };
export type NewQueuedOperation = NewInsertOp | NewRpcOp;

export type QueuedOperation =
  | (NewInsertOp & { id: string; createdAt: number })
  | (NewRpcOp & { id: string; createdAt: number });

export type FailedOperation = QueuedOperation & { errorMessage: string; failedAt: number };

export async function getQueue(): Promise<QueuedOperation[]> {
  return (await get(QUEUE_KEY)) ?? [];
}

export async function enqueueOperation(op: NewQueuedOperation): Promise<QueuedOperation> {
  const queue = await getQueue();
  const fullOp = { ...op, id: crypto.randomUUID(), createdAt: Date.now() } as QueuedOperation;
  await set(QUEUE_KEY, [...queue, fullOp]);
  return fullOp;
}

export async function removeOperation(id: string): Promise<void> {
  const queue = await getQueue();
  await set(
    QUEUE_KEY,
    queue.filter((op) => op.id !== id),
  );
}

export async function getFailedOperations(): Promise<FailedOperation[]> {
  return (await get(FAILED_KEY)) ?? [];
}

// Moves a queued operation to the "failed" bucket instead of leaving it
// stuck in the retry queue forever - used when the server rejects an
// operation for a real reason (e.g. insufficient stock) that retrying
// won't fix, as opposed to a transient network failure that should stay
// queued for the next reconnect.
export async function moveToFailed(op: QueuedOperation, errorMessage: string): Promise<void> {
  await removeOperation(op.id);
  const failed = await getFailedOperations();
  await set(FAILED_KEY, [...failed, { ...op, errorMessage, failedAt: Date.now() }]);
}

export async function dismissFailedOperation(id: string): Promise<void> {
  const failed = await getFailedOperations();
  await set(
    FAILED_KEY,
    failed.filter((op) => op.id !== id),
  );
}
