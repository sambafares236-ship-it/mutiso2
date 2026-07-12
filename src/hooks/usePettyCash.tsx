import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type PettyCashEntry = Database['public']['Tables']['petty_cash_log']['Row'];

export function useSitePettyCash(siteId: string | undefined) {
  return useQuery({
    queryKey: ['pettyCash', siteId],
    queryFn: async (): Promise<PettyCashEntry[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('petty_cash_log')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useSitePettyCashTotal(siteId: string | undefined) {
  return useQuery({
    queryKey: ['pettyCashTotal', siteId],
    queryFn: async (): Promise<number> => {
      if (!siteId) return 0;
      const { data, error } = await supabase.from('petty_cash_log').select('amount').eq('site_id', siteId);
      if (error) throw error;
      return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    },
    enabled: !!siteId,
  });
}

// Field capture, not a financial-authority decision (unlike budget/
// actual_cost) - the foreman is the one holding the cash and spending it,
// so this is offline-queued like diary/materials rather than routed
// through the owner-only path used for Material Payments.
export function useLogPettyCash() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (entry: { site_id: string; date: string; amount: number; description: string; receipt_photo_url?: string }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'petty_cash_log',
        payload: { ...entry, created_by: user.id },
        description: `Petty cash: ${entry.description}`,
      });
    },
  });
}
