import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type Site = Database['public']['Tables']['sites']['Row'];
export type SiteAssignment = Database['public']['Tables']['site_assignments']['Row'];

export interface SiteForeman {
  foreman_id: string;
  full_name: string | null;
  email_address: string | null;
  assigned_at: string;
}

// Hook for contractor/admin - gets ALL sites they own
export function useAdminSites() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['adminSites', user?.id],
    queryFn: async (): Promise<Site[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });
}

// Hook for foreman - gets their assigned site
export function useForemanSite() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['foremanSite', user?.id],
    queryFn: async (): Promise<Site | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('site_assignments')
        .select('*, site:sites(*)')
        .eq('foreman_id', user.id)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.site as Site) || null;
    },
    enabled: !!user,
  });
}

// Queries site_assignments directly for ONE specific site, independent of
// role-table state. Two separate queries since there's no FK relationship
// PostgREST can auto-join between site_assignments and profiles.
export function useSiteForeman(siteId: string | undefined) {
  return useQuery({
    queryKey: ['siteForeman', siteId],
    queryFn: async (): Promise<SiteForeman | null> => {
      if (!siteId) return null;

      const { data: assignment, error: assignError } = await supabase
        .from('site_assignments')
        .select('foreman_id, assigned_at')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assignError) throw assignError;
      if (!assignment) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email_address')
        .eq('id', assignment.foreman_id)
        .maybeSingle();

      return {
        foreman_id: assignment.foreman_id,
        full_name: profile?.full_name || null,
        email_address: profile?.email_address || null,
        assigned_at: assignment.assigned_at,
      };
    },
    enabled: !!siteId,
  });
}

// Hook to assign a foreman to a site (admin/contractor only). Deactivates
// the foreman's previous assignment first; the DB-level partial unique
// index (site_assignments_one_active_per_foreman) is the safety net if
// this ever races.
export function useAssignForeman() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ site_id, foreman_id }: { site_id: string; foreman_id: string }) => {
      if (!user) throw new Error('Not authenticated');

      await supabase.from('site_assignments').update({ is_active: false }).eq('foreman_id', foreman_id);

      const { error } = await supabase
        .from('site_assignments')
        .insert({ site_id, foreman_id, assigned_by: user.id, is_active: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSites'] });
      queryClient.invalidateQueries({ queryKey: ['allForemen'] });
      queryClient.invalidateQueries({ queryKey: ['foremanSite'] });
      queryClient.invalidateQueries({ queryKey: ['siteForeman'] });
    },
  });
}

// Hook to update a site
export function useUpdateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ siteId, updates }: { siteId: string; updates: Partial<Site> }) => {
      const { error } = await supabase.from('sites').update(updates).eq('id', siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminSites'] });
      queryClient.invalidateQueries({ queryKey: ['allSites'] });
      queryClient.invalidateQueries({ queryKey: ['foremanSite'] });
    },
  });
}

// Hook to get a single site by id
export function useSite(siteId: string | null) {
  return useQuery({
    queryKey: ['site', siteId],
    queryFn: async (): Promise<Site | null> => {
      if (!siteId) return null;
      const { data, error } = await supabase.from('sites').select('*').eq('id', siteId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!siteId,
  });
}
