import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type Subcontractor = Database['public']['Tables']['subcontractor']['Row'];
export type WorkOrder = Database['public']['Tables']['subcontractor_work_order']['Row'];
export type SubcontractorPayment = Database['public']['Tables']['subcontractor_payment']['Row'];

export function useSubcontractorCompliance(subcontractorId: string | undefined) {
  return useQuery({
    queryKey: ['subcontractorCompliance', subcontractorId],
    queryFn: async (): Promise<boolean> => {
      if (!subcontractorId) return false;
      const { data, error } = await supabase.rpc('subcontractor_is_compliant', {
        p_subcontractor_id: subcontractorId,
      });
      if (error) throw error;
      return !!data;
    },
    enabled: !!subcontractorId,
  });
}

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

export function useUpdateSubcontractor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sub: {
      id: string;
      site_id: string;
      company_name?: string;
      trade?: string;
      contact_name?: string;
      contact_phone?: string;
      nca_number?: string;
      nca_class?: string;
      nca_expiry?: string;
      insurance_expiry?: string;
    }) => {
      const { id, site_id, ...updates } = sub;
      void site_id; // kept on the input type only so onSuccess can invalidate the right query key
      const { error } = await supabase.from('subcontractor').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractors', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['subcontractorCompliance', variables.id] });
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
    mutationFn: async (order: { site_id: string; subcontractor_id: string; description: string; value?: number }) => {
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

// Owner-only - enforced both by RLS (foreman's UPDATE policy exists, but
// enforce_work_order_approval_lock rejects a non-owner setting anything
// other than open -> completed) and by the trigger raising a clear error
// if a foreman's client somehow calls this directly.
export function useApproveWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workOrderId: string) => {
      const { error } = await supabase.from('subcontractor_work_order').update({ status: 'approved' }).eq('id', workOrderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });
}

export function useSubcontractorPayments(subcontractorId: string | undefined) {
  return useQuery({
    queryKey: ['subcontractorPayments', subcontractorId],
    queryFn: async (): Promise<SubcontractorPayment[]> => {
      if (!subcontractorId) return [];
      const { data, error } = await supabase
        .from('subcontractor_payment')
        .select('*')
        .eq('subcontractor_id', subcontractorId)
        .order('payment_number', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!subcontractorId,
  });
}

// Owner-only - see generate_subcontractor_payment migration. Blocks
// server-side if the subcontractor isn't compliant (NCA number missing or
// insurance expired), computes retention, and writes a matching
// actual_cost row automatically.
export function useGenerateSubcontractorPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payment: {
      site_id: string;
      subcontractor_id: string;
      work_completed_value: number;
      retention_percentage?: number;
      work_order_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('generate_subcontractor_payment', {
        p_site_id: payment.site_id,
        p_subcontractor_id: payment.subcontractor_id,
        p_work_completed_value: payment.work_completed_value,
        p_retention_percentage: payment.retention_percentage,
        p_work_order_id: payment.work_order_id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractorPayments', variables.subcontractor_id] });
      queryClient.invalidateQueries({ queryKey: ['actualCosts', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.site_id] });
    },
  });
}