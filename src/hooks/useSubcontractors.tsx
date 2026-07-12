import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type Subcontractor = Database['public']['Tables']['subcontractor']['Row'];
export type WorkOrder = Database['public']['Tables']['subcontractor_work_order']['Row'];

export function useSiteSubcontractors(siteId: string | undefined) {
  return useQuery({
    queryKey: ['subcontractors', siteId],
    queryFn: async (): Promise<Subcontractor[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase.from('subcontractor').select('*').eq('site_id', siteId).order('company_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useAddSubcontractor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sub: {
      site_id: string;
      company_name: string;
      trade?: string;
      contact_name?: string;
      contact_phone?: string;
      nca_number?: string;
      insurance_expiry?: string;
    }) => {
      const { data, error } = await supabase
        .from('subcontractor')
        .insert({ ...sub, insurance_expiry: sub.insurance_expiry || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', variables.site_id] });
    },
  });
}

export function useSubcontractorWorkOrders(subcontractorId: string | undefined) {
  return useQuery({
    queryKey: ['workOrders', subcontractorId],
    queryFn: async (): Promise<WorkOrder[]> => {
      if (!subcontractorId) return [];
      const { data, error } = await supabase
        .from('subcontractor_work_order')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!subcontractorId,
  });
}

export function useAddWorkOrder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (order: { site_id: string; subcontractor_id: string; description: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('subcontractor_work_order').insert({ ...order, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workOrders', variables.subcontractor_id] });
    },
  });
}

export function useCompleteWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workOrderId: string) => {
      const { error } = await supabase.from('subcontractor_work_order').update({ status: 'completed' }).eq('id', workOrderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });
}
