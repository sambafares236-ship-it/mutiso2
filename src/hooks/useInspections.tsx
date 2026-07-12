import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type InspectionTemplate = Database['public']['Tables']['inspection_template']['Row'];
export type InspectionLog = Database['public']['Tables']['inspection_log']['Row'];
export type ChecklistItem = { label: string };
export type ChecklistResult = { label: string; pass: boolean; note?: string };

export function useInspectionTemplates() {
  return useQuery({
    queryKey: ['inspectionTemplates'],
    queryFn: async (): Promise<InspectionTemplate[]> => {
      const { data, error } = await supabase.from('inspection_template').select('*').order('name');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSiteInspections(siteId: string | undefined) {
  return useQuery({
    queryKey: ['inspections', siteId],
    queryFn: async (): Promise<InspectionLog[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('inspection_log')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useSubmitInspection() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (inspection: {
      site_id: string;
      template_id: string;
      date: string;
      results: ChecklistResult[];
    }) => {
      if (!user) throw new Error('Not authenticated');
      const flaggedCount = inspection.results.filter((r) => !r.pass).length;
      return submitOrQueue({
        kind: 'insert',
        table: 'inspection_log',
        payload: {
          site_id: inspection.site_id,
          template_id: inspection.template_id,
          date: inspection.date,
          results: inspection.results,
          flagged_count: flaggedCount,
          inspected_by: user.id,
        },
        description: 'Site inspection',
      });
    },
  });
}
