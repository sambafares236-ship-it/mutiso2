import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type SiteTrade = Database['public']['Tables']['site_trades']['Row'];

// Every site is auto-seeded with the standard trade list on creation (see
// seed_default_site_trades_trigger), so this is just a plain per-site read -
// no client-side fallback list needed even for older sites, since the
// migration backfilled those too.
export function useSiteTrades(siteId: string | undefined) {
  return useQuery({
    queryKey: ['site_trades', siteId],
    queryFn: async (): Promise<SiteTrade[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('site_trades')
        .select('*')
        .eq('site_id', siteId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// add_site_trade is idempotent server-side (on conflict do nothing, then
// look up the existing row) so calling this with a name that already
// exists on the site just returns that row's id rather than erroring.
export function useAddSiteTrade(siteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!siteId) throw new Error('No site selected');
      const { data, error } = await supabase.rpc('add_site_trade', {
        p_site_id: siteId,
        p_name: name,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site_trades', siteId] });
    },
  });
}
