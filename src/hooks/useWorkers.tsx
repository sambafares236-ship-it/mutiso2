import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type Worker = Database['public']['Tables']['workers_master']['Row'];

export function useWorkers(siteId: string | undefined) {
  return useQuery({
    queryKey: ['workers', siteId],
    queryFn: async (): Promise<Worker[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('workers_master')
        .select('*')
        .eq('site_id', siteId)
        .order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useAddWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (worker: {
      site_id: string;
      worker_id_number: string;
      full_name: string;
      trade?: string;
      daily_rate?: number;
      phone_number?: string;
    }) => {
      const { data, error } = await supabase.from('workers_master').insert(worker).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workers', variables.site_id] });
    },
  });
}
