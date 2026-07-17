import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type Invite = Database['public']['Tables']['invites']['Row'] & {
  site?: {
    id: string;
    site_name: string;
    location: string | null;
    status: string;
  };
};

export function useCreateInvite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      site_id,
      email,
    }: {
      site_id: string;
      email: string;
      site_name: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      // Email delivery is handled server-side by the invites table's
      // on_invite_insert_notify trigger (n8n + Gmail), not from here - a
      // fire-and-forget client call couldn't survive the tab closing
      // before it landed. See 20260731090300_notify_on_invite_created.sql.
      const { data, error } = await supabase
        .from('invites')
        .insert({ site_id, invited_by: user.id, email })
        .select()
        .single();

      if (error) throw error;

      return data as Invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}

export function useSiteInvites(siteId: string) {
  return useQuery({
    queryKey: ['invites', siteId],
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('site_id', siteId)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useInviteByToken(token: string | null) {
  return useQuery({
    queryKey: ['invite', token],
    queryFn: async (): Promise<Invite | null> => {
      if (!token) return null;
      const { data, error } = await supabase
        .from('invites')
        .select('*, site:sites(id, site_name, location, status)')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      return data as Invite | null;
    },
    enabled: !!token,
  });
}

// Consuming an invite (marking it used, assigning the foreman role,
// creating the site_assignment) is a single atomic SECURITY DEFINER RPC,
// not three separate client-side table writes. Table-level RLS narrow
// enough to let "the invited user, and only this row" write to
// invites/user_roles/site_assignments turned out to also be broad enough
// to let any authenticated user browse or claim any live invite platform-
// wide - confirmed as a real cross-tenant leak during RLS verification.
// The RPC validates the token itself (bypassing RLS internally) so the
// client never needs direct write access to these tables for this flow.
export function useConsumeInvite() {
  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const { data, error } = await supabase.rpc('consume_invite', { p_token: token });
      if (error) throw error;
      return data; // the site_id the caller was assigned to
    },
  });
}
