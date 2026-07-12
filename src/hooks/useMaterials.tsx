import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOfflineQueue } from './useOfflineQueue';

export type InventoryItem = Database['public']['Tables']['material_inventory']['Row'];

export function useInventory(siteId: string | undefined) {
  return useQuery({
    queryKey: ['inventory', siteId],
    queryFn: async (): Promise<InventoryItem[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('material_inventory')
        .select('*')
        .eq('site_id', siteId)
        .order('material_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// Deliveries and usage both go through SECURITY DEFINER RPCs
// (log_material_delivery / log_material_usage) rather than raw table
// writes, because both need an atomic read-then-write against
// material_inventory (usage checks stock before deducting; delivery
// increments-or-creates the inventory row) - see the migration comments
// for the race-condition reasoning, same pattern as consume_invite().
export function useLogDelivery() {
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    // See useMarkPresent (useAttendance.tsx) for why networkMode: 'always'
    // is required on every offline-queue-backed mutation.
    networkMode: 'always',
    mutationFn: async (delivery: {
      site_id: string;
      material_name: string;
      supplier?: string;
      quantity: number;
      unit?: string;
      date: string;
      // Receipt photo is uploaded to Storage separately, BEFORE this
      // mutation runs (see DeliveryForm) - it can't be queued offline
      // like the rest of this payload (a File object doesn't survive
      // IndexedDB the way a small JSON payload does), so only the
      // resulting path is passed through here.
      receipt_photo_url?: string;
    }) => {
      return submitOrQueue({
        kind: 'rpc',
        fn: 'log_material_delivery',
        payload: {
          p_site_id: delivery.site_id,
          p_material_name: delivery.material_name,
          p_supplier: delivery.supplier ?? null,
          p_quantity: delivery.quantity,
          p_unit: delivery.unit ?? null,
          p_date: delivery.date,
          p_receipt_photo_url: delivery.receipt_photo_url ?? null,
        },
        description: `Delivery: ${delivery.material_name}`,
      });
    },
  });
}

export function useLogUsage() {
  const queryClient = useQueryClient();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (usage: {
      site_id: string;
      material_name: string;
      quantity: number;
      unit?: string;
      description?: string;
      date: string;
    }) => {
      return submitOrQueue({
        kind: 'rpc',
        fn: 'log_material_usage',
        payload: {
          p_site_id: usage.site_id,
          p_material_name: usage.material_name,
          p_quantity: usage.quantity,
          p_unit: usage.unit ?? null,
          p_description: usage.description ?? null,
          p_date: usage.date,
        },
        description: `Usage: ${usage.material_name}`,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', variables.site_id] });
    },
  });
}
