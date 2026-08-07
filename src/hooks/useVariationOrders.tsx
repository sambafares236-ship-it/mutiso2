import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type VariationOrder = Database['public']['Tables']['variation_order']['Row'];
export type VariationOrderResponse = Database['public']['Tables']['variation_order_response']['Row'];

export function useSiteVariationOrders(siteId: string | undefined) {
  return useQuery({
    queryKey: ['variationOrders', siteId],
    queryFn: async (): Promise<VariationOrder[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('variation_order')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useRaiseVariationOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vo: { site_id: string; title: string; description: string; cost_impact?: number; time_impact_days?: number }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('variation_order').insert({ ...vo, raised_by: user.id, status: 'open' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['variationOrders', variables.site_id] });
    },
  });
}

// Contractor-only review action: lets the site owner correct/refine the
// title, description, and add cost/time impact (fields the foreman who
// raised it doesn't set) as part of approving or rejecting - one save
// instead of a separate "edit" step before deciding. Same RLS as before
// ("Only site owner can decide..." covers the
// whole row via UPDATE, not just status), so a non-owner caller gets
// zero rows updated, not an error.
export function useReviewVariationOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      voId,
      approve,
      title,
      description,
      cost_impact,
      time_impact_days,
    }: {
      voId: string;
      approve: boolean;
      title: string;
      description: string;
      cost_impact?: number;
      time_impact_days?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('variation_order')
        .update({
          title,
          description,
          cost_impact: cost_impact ?? null,
          time_impact_days: time_impact_days ?? null,
          status: approve ? 'approved' : 'rejected',
          decided_by: user.id,
        })
        .eq('id', voId)
        .select();
      if (error) throw error;
      if (!data?.length) throw new Error('Not authorized to decide this variation order');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variationOrders'] });
    },
  });
}

export function useVariationOrderResponses(voId: string | undefined) {
  return useQuery({
    queryKey: ['voResponses', voId],
    queryFn: async (): Promise<VariationOrderResponse[]> => {
      if (!voId) return [];
      const { data, error } = await supabase
        .from('variation_order_response')
        .select('*')
        .eq('variation_order_id', voId)
        .order('created_at');
      if (error) throw error;
      return data || [];
    },
    enabled: !!voId,
  });
}

export function useAddVariationOrderResponse() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ voId, message }: { voId: string; message: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('variation_order_response')
        .insert({ variation_order_id: voId, responder_id: user.id, message });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['voResponses', variables.voId] });
    },
  });
}