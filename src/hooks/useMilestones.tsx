import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Milestone = Database['public']['Tables']['site_milestone']['Row'];

export function useSiteMilestones(siteId: string | undefined) {
  return useQuery({
    queryKey: ['milestones', siteId],
    queryFn: async (): Promise<Milestone[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('site_milestone')
        .select('*')
        .eq('site_id', siteId)
        .order('sequence');
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// The sequence gate itself lives in a DB trigger (enforce_milestone_sequence)
// - trying to start/complete a milestone out of order fails with a
// Postgres exception here, it isn't just a disabled button client-side.
export function useUpdateMilestoneStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, status }: { milestoneId: string; status: 'in_progress' | 'completed' }) => {
      const { error } = await supabase.from('site_milestone').update({ status }).eq('id', milestoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
    },
  });
}
