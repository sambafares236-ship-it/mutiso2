import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getQueue,
  enqueueOperation,
  removeOperation,
  getFailedOperations,
  moveToFailed,
  dismissFailedOperation,
  type QueuedOperation,
  type NewQueuedOperation,
  type FailedOperation,
} from '@/lib/offlineQueue';

async function runOperation(op: NewQueuedOperation): Promise<Record<string, unknown> | null> {
  if (op.kind === 'insert') {
    const { data, error } = await supabase.from(op.table as never).insert(op.payload as never).select().single();
    if (error) throw error;
    return data as Record<string, unknown>;
  } else {
    const { data, error } = await supabase.rpc(op.fn as never, op.payload as never);
    if (error) throw error;
    return data as Record<string, unknown> | null;
  }
}

export function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError || !navigator.onLine;
}

interface OfflineQueueContextType {
  isOnline: boolean;
  pendingCount: number;
  pending: QueuedOperation[];
  failed: FailedOperation[];
  isFlushing: boolean;
  flush: () => Promise<void>;
  // `data` is only ever populated on the online-success path - a queued
  // (offline) insert has no real row yet, so callers that need the new
  // row's id (e.g. attaching a photo to a freshly-created diary entry)
  // must check `!queued` first. See the "referential availability" rule
  // in CLAUDE.md - don't attach something to an id that might itself still
  // be sitting unsynced in this same queue.
  submitOrQueue: (op: NewQueuedOperation) => Promise<{ queued: boolean; data?: Record<string, unknown> | null }>;
  dismissFailed: (id: string) => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueContextType | null>(null);

// Offline-first foundation for field data-entry forms (attendance,
// deliveries, usage, diary). Forms that opt in call submitOrQueue()
// instead of writing to Supabase directly:
//   - online + write succeeds -> behaves exactly like a normal mutation
//   - online + write fails on what looks like a network error, or
//     offline to begin with -> the operation is queued in IndexedDB and
//     replayed in order once connectivity returns
//   - a queued operation that fails on replay for a REAL reason (server
//     rejected it - e.g. insufficient stock) is moved to a separate
//     "failed" list rather than left stuck retrying forever and blocking
//     every later queued item behind it. Only genuine network failures
//     stay in the retry queue.
//
// This state lives in ONE Provider instance, not per-hook-call - every
// caller of useOfflineQueue() used to get its OWN independent queue
// processor (own 'online' listener, own flush loop), and two of them
// racing on reconnect double-inserted the same queued row (confirmed via
// a 409 conflict during testing). A single shared instance means exactly
// one flush runs per reconnect, no matter how many components use the
// hook.
export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState<QueuedOperation[]>([]);
  const [failed, setFailed] = useState<FailedOperation[]>([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    setPending(await getQueue());
    setFailed(await getFailedOperations());
  }, []);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsFlushing(true);
    try {
      const queue = await getQueue();
      for (const op of queue) {
        try {
          await runOperation(op);
          await removeOperation(op.id);
        } catch (err) {
          if (isNetworkFailure(err)) {
            // Stop here - keep this and later items queued, retry on the
            // next flush trigger rather than reordering or dropping data.
            break;
          }
          // A real server rejection: move it out of the retry path so it
          // doesn't block everything queued after it, and surface it.
          await moveToFailed(op, err instanceof Error ? err.message : 'Sync failed');
        }
      }
      await refresh();
      queryClient.invalidateQueries();
    } finally {
      setIsFlushing(false);
    }
  }, [queryClient, refresh]);

  useEffect(() => {
    refresh();

    const goOnline = () => {
      setIsOnline(true);
      flush();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    if (navigator.onLine) flush();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitOrQueue = useCallback(
    async (op: NewQueuedOperation): Promise<{ queued: boolean; data?: Record<string, unknown> | null }> => {
      if (navigator.onLine) {
        try {
          const data = await runOperation(op);
          queryClient.invalidateQueries();
          return { queued: false, data };
        } catch (err) {
          if (!isNetworkFailure(err)) throw err;
        }
      }
      await enqueueOperation(op);
      await refresh();
      return { queued: true };
    },
    [queryClient, refresh],
  );

  const dismissFailed = useCallback(
    async (id: string) => {
      await dismissFailedOperation(id);
      await refresh();
    },
    [refresh],
  );

  return (
    <OfflineQueueContext.Provider
      value={{
        isOnline,
        pendingCount: pending.length,
        pending,
        failed,
        isFlushing,
        flush,
        submitOrQueue,
        dismissFailed,
      }}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be used within an OfflineQueueProvider');
  return ctx;
}
