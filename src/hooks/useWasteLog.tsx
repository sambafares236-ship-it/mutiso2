import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type WasteEntry = Database['public']['Tables']['waste_log']['Row'];

export function useSiteWasteLog(siteId: string | undefined) {
  return useQuery({
    queryKey: ['wasteLog', siteId],
    queryFn: async (): Promise<WasteEntry[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('waste_log')
        .select('*')
        .eq('site_id', siteId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// Single-table insert, same shape as diary/attendance - no cross-table
// atomicity concern, so it queues directly rather than via an RPC. Photo
// (if any) is uploaded to Storage before this runs, same pattern as
// DeliveryForm's waybill photo - see that component's comment for why a
// File can't itself go through the offline queue.
export function useAddWasteEntry() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (entry: {
      site_id: string;
      date: string;
      waste_type: string;
      disposal_method: string;
      quantity?: number;
      unit?: string;
      disposal_partner?: string;
      photo_url?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'waste_log',
        payload: { ...entry, created_by: user.id },
        description: `Waste disposal: ${entry.waste_type}`,
      });
    },
  });
}
