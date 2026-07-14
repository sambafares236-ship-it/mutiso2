import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Site } from './useSite';
import { useAuth } from './useAuth';

export interface PendingSite extends Site {
  owner_name: string | null;
  owner_email: string | null;
}

export function usePendingSites() {
  return useQuery({
    queryKey: ['pendingSites'],
    queryFn: async (): Promise<PendingSite[]> => {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data?.length) return [];

      const ownerIds = [...new Set(data.map((s) => s.owner_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email_address')
        .in('id', ownerIds);

      return data.map((site) => {
        const owner = profiles?.find((p) => p.id === site.owner_id);
        return {
          ...site,
          owner_name: owner?.full_name ?? null,
          owner_email: owner?.email_address ?? null,
        };
      });
    },
  });
}

export function useApproveSite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (siteId: string) => {
      if (!user) throw new Error('Not authenticated');
      const today = new Date();
      const trialEnd = new Date(today);
      trialEnd.setDate(trialEnd.getDate() + 7);
      const { error } = await supabase
        .from('sites')
        .update({
          status: 'active',
          approved_by: user.id,
          approved_at: today.toISOString(),
          subscription_start: today.toISOString().split('T')[0],
          // 7-day free trial starts on approval - subscription_end doubles
          // as "when does access expire" whether that expiry came from the
          // trial or a real payment, so no separate trial_ends_at column.
          subscription_end: trialEnd.toISOString().split('T')[0],
        })
        .eq('id', siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSites'] });
      queryClient.invalidateQueries({ queryKey: ['adminSites'] });
    },
  });
}

export function useRejectSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (siteId: string) => {
      const { error } = await supabase.from('sites').update({ status: 'cancelled' }).eq('id', siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingSites'] });
      queryClient.invalidateQueries({ queryKey: ['adminSites'] });
    },
  });
}
