import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type SiteContract = Database['public']['Tables']['site_contract']['Row'];

export function useSiteContract(siteId: string | undefined) {
  return useQuery({
    queryKey: ['contract', siteId],
    queryFn: async (): Promise<SiteContract | null> => {
      if (!siteId) return null;
      const { data, error } = await supabase.from('site_contract').select('*').eq('site_id', siteId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });
}

// site_id is unique on site_contract, so this is a genuine upsert - create
// on first save, edit in place afterward. Owner-only per RLS.
export function useUpsertContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contract: {
      site_id: string;
      created_by: string;
      contract_type?: string;
      contract_value?: number;
      currency?: string;
      retention_percentage?: number;
      payment_terms?: string;
      signed_date?: string | null;
      contract_document_url?: string;
    }) => {
      const { error } = await supabase.from('site_contract').upsert(contract, { onConflict: 'site_id' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contract', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.site_id] });
    },
  });
}
