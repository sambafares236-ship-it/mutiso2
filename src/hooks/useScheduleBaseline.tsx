import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ScheduleBaseline = Database['public']['Tables']['schedule_baseline']['Row'];
export type ScheduleBaselineActivity = Database['public']['Tables']['schedule_baseline_activity']['Row'];

// History of every baseline ever locked for a site, newest first - "the
// current baseline" is simply the first row here.
export function useSiteBaselines(siteId: string | undefined) {
  return useQuery({
    queryKey: ['scheduleBaselines', siteId],
    queryFn: async (): Promise<ScheduleBaseline[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('schedule_baseline')
        .select('*')
        .eq('site_id', siteId)
        .order('locked_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// Snapshots every current activity's planned dates into a new baseline -
// see save_schedule_baseline() in the schedule_baseline migration. Owner-
// only; a foreman calling this gets the RPC's own "Only the site owner..."
// exception, not a silent no-op.
export function useSaveScheduleBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ site_id, label }: { site_id: string; label?: string }) => {
      const { data, error } = await supabase.rpc('save_schedule_baseline', {
        p_site_id: site_id,
        p_label: label,
      });
      if (error) throw error;
      return data; // new schedule_baseline id
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduleBaselines', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['scheduleProgress', variables.site_id] });
    },
  });
}
