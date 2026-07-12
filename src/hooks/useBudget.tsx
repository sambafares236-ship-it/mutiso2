import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type BudgetLine = Database['public']['Tables']['budget_line']['Row'];

export function useSiteBudget(siteId: string | undefined) {
  return useQuery({
    queryKey: ['budget', siteId],
    queryFn: async (): Promise<BudgetLine[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('budget_line')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useCreateBudgetLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (line: {
      site_id: string;
      created_by: string;
      category: string;
      budgeted_amount: number;
      cost_code?: string;
      activity_id?: string;
    }) => {
      const { error } = await supabase.from('budget_line').insert(line);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budget', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.site_id] });
    },
  });
}
