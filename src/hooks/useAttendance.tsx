import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

function today() {
  return new Date().toISOString().split('T')[0];
}

export function useTodayAttendance(siteId: string | undefined) {
  return useQuery({
    queryKey: ['attendance', siteId, today()],
    queryFn: async (): Promise<Set<string>> => {
      if (!siteId) return new Set();
      const { data, error } = await supabase
        .from('attendance_log')
        .select('worker_id')
        .eq('site_id', siteId)
        .eq('date', today());
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.worker_id));
    },
    enabled: !!siteId,
  });
}

// Attendance is a simple single-table insert (no cross-table atomicity
// concern like materials has), so it queues directly rather than via an
// RPC - the unique(site_id, worker_id, date) constraint is what prevents
// double-marking, both online and once a queued mark eventually replays.
export function useMarkPresent() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    // networkMode: 'always' is required for every offline-queue-backed
    // mutation - TanStack Query's default ('online') pauses the mutation
    // and never even calls mutationFn while navigator.onLine is false,
    // which pre-empts submitOrQueue's own offline handling before it ever
    // runs (confirmed: without this, an offline click just silently sits
    // until reconnect, then fires - it never reaches the local queue).
    networkMode: 'always',
    mutationFn: async ({ siteId, workerId }: { siteId: string; workerId: string }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'attendance_log',
        payload: { site_id: siteId, worker_id: workerId, date: today(), marked_by: user.id },
        description: 'Mark attendance',
      });
    },
  });
}

export function useUnmarkPresent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ siteId, workerId }: { siteId: string; workerId: string }) => {
      const { error } = await supabase
        .from('attendance_log')
        .delete()
        .eq('site_id', siteId)
        .eq('worker_id', workerId)
        .eq('date', today());
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', variables.siteId] });
      queryClient.invalidateQueries({ queryKey: ['atAGlance', variables.siteId] });
      queryClient.invalidateQueries({ queryKey: ['payrollSummary', variables.siteId] });
    },
  });
}
