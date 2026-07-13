import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type Defect = Database['public']['Tables']['defect_log']['Row'];

export function useSiteDefects(siteId: string | undefined) {
  return useQuery({
    queryKey: ['defects', siteId],
    queryFn: async (): Promise<Defect[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('defect_log')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useReportDefect() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (defect: {
      site_id: string;
      location?: string;
      description: string;
      severity: string;
      photo_url?: string;
      activity_id?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'defect_log',
        payload: { ...defect, reported_by: user.id },
        description: 'Defect report',
      });
    },
  });
}

// Marking fixed and verifying are administrative review actions (done
// when looking at an existing list), not field-capture moments, so
// unlike useReportDefect these are plain online mutations - same
// distinction as useCloseIncident/useDecidePermit vs. their offline-
// queued "report/request" counterparts.
export function useMarkDefectFixed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ defectId, photoUrl }: { defectId: string; photoUrl?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('defect_log')
        .update({ status: 'in_progress', fixed_by: user.id, fixed_at: new Date().toISOString(), fixed_photo_url: photoUrl })
        .eq('id', defectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
    },
  });
}

// Owner-only now, at the user's request - see the verify_defect()
// migration comment. Goes through the RPC rather than a raw table update
// since the blanket defect_log policy is still owner+foreman (it also
// governs report/mark-fixed) - the RPC does its own explicit
// owns_site() check plus the verifier-not-fixer check (SECURITY DEFINER
// bypasses RLS and the old CHECK constraint doesn't apply inside it).
export function useVerifyDefect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (defectId: string) => {
      const { error } = await supabase.rpc('verify_defect', { p_defect_id: defectId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defects'] });
    },
  });
}
