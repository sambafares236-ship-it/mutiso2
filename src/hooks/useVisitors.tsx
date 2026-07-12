import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type Visitor = Database['public']['Tables']['visitor_log']['Row'];

export function useSiteVisitors(siteId: string | undefined) {
  return useQuery({
    queryKey: ['visitors', siteId],
    queryFn: async (): Promise<Visitor[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('visitor_log')
        .select('*')
        .eq('site_id', siteId)
        .order('time_in', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// Sign-in is a single-table insert and a plausible field action at the
// site gate, so it goes through the offline queue like attendance.
export function useSignInVisitor() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (visitor: { site_id: string; visitor_name: string; company?: string; purpose?: string; host_name?: string }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'visitor_log',
        payload: { ...visitor, created_by: user.id },
        description: `Visitor sign-in: ${visitor.visitor_name}`,
      });
    },
  });
}

// Sign-out is deliberately NOT offline-queued, unlike sign-in: it updates
// a specific existing row by id, and a visitor signed in while offline
// won't have a server row (or a real id) to update until their sign-in
// has synced - queuing an update against a not-yet-existent row would
// just fail on replay. Since useSiteVisitors only lists rows that already
// made it to the server, the UI can only ever offer to sign out a row
// that's safe to update directly.
export function useSignOutVisitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (visitorId: string) => {
      const { error } = await supabase.from('visitor_log').update({ time_out: new Date().toISOString() }).eq('id', visitorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
    },
  });
}
