import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type Incident = Database['public']['Tables']['incident_log']['Row'];

export function useSiteIncidents(siteId: string | undefined) {
  return useQuery({
    queryKey: ['incidents', siteId],
    queryFn: async (): Promise<Incident[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('incident_log')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useReportIncident() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    // Required on every offline-queue-backed mutation - see CLAUDE.md's
    // Offline-first architecture section for why.
    networkMode: 'always',
    mutationFn: async (incident: {
      site_id: string;
      date: string;
      category: string;
      severity: string;
      description: string;
      workers_involved?: string;
      photo_url?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'incident_log',
        payload: { ...incident, reported_by: user.id },
        description: `Incident: ${incident.category}`,
      });
    },
  });
}

export function useCloseIncident() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ incidentId, correctiveAction }: { incidentId: string; correctiveAction: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('incident_log')
        .update({ corrective_action: correctiveAction, closed_by: user.id, closed_at: new Date().toISOString() })
        .eq('id', incidentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}
