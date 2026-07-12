import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type PaymentCertificate = Database['public']['Tables']['payment_certificate']['Row'];

export function useSitePaymentCertificates(siteId: string | undefined) {
  return useQuery({
    queryKey: ['paymentCertificates', siteId],
    queryFn: async (): Promise<PaymentCertificate[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('payment_certificate')
        .select('*')
        .eq('site_id', siteId)
        .order('certificate_number', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// See generate_payment_certificate() in the contract_and_financials
// migration - auto-numbers the certificate and computes retention_amount/
// net_amount_due (accounting for every prior certificate) in one atomic
// transaction. Owner-only.
export function useGeneratePaymentCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      site_id: string;
      period_start: string;
      period_end: string;
      work_completed_value: number;
      retention_percentage?: number;
    }) => {
      const { data, error } = await supabase.rpc('generate_payment_certificate', {
        p_site_id: input.site_id,
        p_period_start: input.period_start,
        p_period_end: input.period_end,
        p_work_completed_value: input.work_completed_value,
        p_retention_percentage: input.retention_percentage,
      });
      if (error) throw error;
      return data; // new payment_certificate id
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['paymentCertificates', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.site_id] });
    },
  });
}

export function useUpdateCertificateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; site_id: string; status: 'certified' | 'paid'; certified_by?: string }) => {
      const { id, status, certified_by } = params;
      const updates: Partial<PaymentCertificate> =
        status === 'certified'
          ? { status, certified_by: certified_by ?? null, certified_at: new Date().toISOString() }
          : { status };
      const { error } = await supabase.from('payment_certificate').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['paymentCertificates', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['financeSummary', variables.site_id] });
    },
  });
}
