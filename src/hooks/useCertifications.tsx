import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type Certification = Database['public']['Tables']['certification']['Row'] & {
  worker: { full_name: string } | null;
  tool: { tool_name: string } | null;
};

// Shared with SubcontractorsView's insurance_expiry badge (Stage 5) -
// same 30-day lookahead, computed client-side rather than via a
// notifications-table trigger. See CLAUDE.md for why.
export function isExpiringSoon(dateStr: string | null) {
  if (!dateStr) return false;
  const days = (new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return days < 30;
}

export function useSiteCertifications(siteId: string | undefined) {
  return useQuery({
    queryKey: ['certifications', siteId],
    queryFn: async (): Promise<Certification[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('certification')
        .select('*, worker:workers_master(full_name), tool:tool_inventory(tool_name)')
        .eq('site_id', siteId)
        .order('expiry_date');
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export interface CertificationInput {
  site_id: string;
  subject_type: 'worker' | 'equipment';
  worker_id: string | null;
  tool_id: string | null;
  cert_name: string;
  cert_number?: string;
  issued_date?: string;
  expiry_date: string;
}

// Owner-only now (certification is a contractor-managed compliance
// record, not a foreman field action) - a plain direct insert, not
// submitOrQueue, same as useAddSubcontractor. See CLAUDE.md's
// "Financial authority ≠ field capture" note for why owner-only
// decisions don't go through the offline queue.
export function useAddCertification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cert: CertificationInput) => {
      if (!user) throw new Error('Not authenticated');
      // issued_date is the one optional date field here - coerce empty
      // string to null, same fix as Stage 5's insurance_expiry bug (an
      // untouched date input submits "" via react-hook-form, which
      // Postgres's date parser rejects outright).
      const { error } = await supabase
        .from('certification')
        .insert({ ...cert, issued_date: cert.issued_date || null, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['certifications', variables.site_id] });
    },
  });
}

export function useUpdateCertification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...cert }: CertificationInput & { id: string }) => {
      const { error } = await supabase
        .from('certification')
        .update({ ...cert, issued_date: cert.issued_date || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['certifications', variables.site_id] });
    },
  });
}

export function useDeleteCertification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; site_id: string }) => {
      const { error } = await supabase.from('certification').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['certifications', variables.site_id] });
    },
  });
}
