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

// Owner-only (enforced by RLS - "Site owner can create milestones") -
// adding a stage is a planning decision, same reasoning as WBS activity
// inserts. Sequence is computed by the caller from the already-loaded
// milestone list (append to the end) rather than here, since this hook
// has no query of its own to read the current max from.
export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ site_id, name, sequence }: { site_id: string; name: string; sequence: number }) => {
      const { error } = await supabase.from('site_milestone').insert({ site_id, name, sequence });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.site_id] });
    },
  });
}

// Owner-only, and only while the milestone is still 'pending' (enforced by
// RLS - "Site owner can delete pending milestones") - once a milestone
// carries a real sign-off/compliance record it can never be deleted.
export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; site_id: string }) => {
      const { error } = await supabase.from('site_milestone').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.site_id] });
    },
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
