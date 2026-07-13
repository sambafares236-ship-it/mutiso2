import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type WorkPermit = Database['public']['Tables']['work_permit']['Row'];

export const PERMIT_TYPE_LABELS: Record<string, string> = {
  hot_work: 'Hot Work',
  excavation: 'Excavation',
  height: 'Working at Height',
  confined_space: 'Confined Space',
};

export function useSitePermits(siteId: string | undefined) {
  return useQuery({
    queryKey: ['permits', siteId],
    queryFn: async (): Promise<WorkPermit[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('work_permit')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// Foreman-side request. Offline-capable like the other Stage 3 forms -
// requesting a permit doesn't require connectivity, only approving one
// does (the contractor side, assumed to have better connectivity).
export function useRequestPermit() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (permit: {
      site_id: string;
      permit_type: string;
      description?: string;
      valid_from?: string;
      valid_to?: string;
      milestone_id?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'work_permit',
        payload: { ...permit, requested_by: user.id, status: 'pending' },
        description: `Permit: ${permit.permit_type}`,
      });
    },
  });
}

// Approval/rejection is only possible for the site owner - enforced at
// the RLS layer (see the work_permit migration), not just in the UI.
export function useDecidePermit() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ permitId, approve }: { permitId: string; approve: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('work_permit')
        .update({ status: approve ? 'approved' : 'rejected', approved_by: user.id })
        .eq('id', permitId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits'] });
    },
  });
}
