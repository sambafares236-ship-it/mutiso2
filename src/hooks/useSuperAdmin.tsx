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

export interface ClientSite extends Site {
  foreman_count: number;
}

export interface ClientRosterEntry {
  owner_id: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  sites: ClientSite[];
}

// One row per contractor (owner_id), not per site - a contractor can own
// several sites and the super admin needs to see them as one client. Sites
// and foreman-assignment counts are fetched in bulk (2 extra queries total,
// not one per client) then grouped/joined client-side, same shape as
// usePendingSites' owner lookup above.
export function useClientRoster() {
  return useQuery({
    queryKey: ['clientRoster'],
    queryFn: async (): Promise<ClientRosterEntry[]> => {
      const { data: sites, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!sites?.length) return [];

      const ownerIds = [...new Set(sites.map((s) => s.owner_id))];
      const siteIds = sites.map((s) => s.id);

      const [{ data: profiles }, { data: assignments }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email_address, phone_number').in('id', ownerIds),
        supabase.from('site_assignments').select('site_id').eq('is_active', true).in('site_id', siteIds),
      ]);

      const foremanCounts = new Map<string, number>();
      for (const a of assignments ?? []) {
        foremanCounts.set(a.site_id, (foremanCounts.get(a.site_id) ?? 0) + 1);
      }

      const byOwner = new Map<string, ClientRosterEntry>();
      for (const site of sites) {
        if (!byOwner.has(site.owner_id)) {
          const owner = profiles?.find((p) => p.id === site.owner_id);
          byOwner.set(site.owner_id, {
            owner_id: site.owner_id,
            owner_name: owner?.full_name ?? null,
            owner_email: owner?.email_address ?? null,
            owner_phone: owner?.phone_number ?? null,
            sites: [],
          });
        }
        byOwner.get(site.owner_id)!.sites.push({ ...site, foreman_count: foremanCounts.get(site.id) ?? 0 });
      }

      return [...byOwner.values()];
    },
  });
}
