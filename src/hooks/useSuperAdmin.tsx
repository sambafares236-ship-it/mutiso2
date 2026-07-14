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
      // No free trial - approval just marks the site as legitimate.
      // subscription_start/subscription_end stay null until the first
      // successful payment sets them (_extend_site_subscription), so the
      // site has no usable period until it's actually paid for.
      const { error } = await supabase
        .from('sites')
        .update({
          status: 'active',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
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
