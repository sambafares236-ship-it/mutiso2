import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type ActualCost = Database['public']['Tables']['actual_cost']['Row'];

// Non-labor costs only - labor's actual cost is payroll_line.gross_amount,
// see the migration comment for why that isn't duplicated here.
export function useSiteActualCosts(siteId: string | undefined) {
  return useQuery({
    queryKey: ['actualCosts', siteId],
    queryFn: async (): Promise<ActualCost[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('actual_cost')
        .select('*')
        .eq('site_id', siteId)
        .order('date_incurred', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useCreateActualCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cost: {
      site_id: string;
      created_by: string;
      cost_type: string;
      amount: number;
      date_incurred?: string;
      invoice_reference?: string;
      activity_id?: string;
      subcontractor_id?: string;
      material_delivery_id?: string;
    }) => {
      const { error } = await supabase.from('actual_cost').insert(cost);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['actualCosts', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.site_id] });
    },
  });
}
