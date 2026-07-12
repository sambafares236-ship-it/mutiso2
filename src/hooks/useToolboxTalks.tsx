import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useOfflineQueue } from './useOfflineQueue';

export type ToolboxTalk = Database['public']['Tables']['toolbox_talk_log']['Row'];

export function useSiteToolboxTalks(siteId: string | undefined) {
  return useQuery({
    queryKey: ['toolboxTalks', siteId],
    queryFn: async (): Promise<ToolboxTalk[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('toolbox_talk_log')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// Talk + attendee list submits as one atomic RPC call (create_toolbox_talk)
// rather than two separate table writes - see the migration comment for
// why (offline-queue-friendly, avoids a half-written talk).
export function useCreateToolboxTalk() {
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    networkMode: 'always',
    mutationFn: async (talk: { site_id: string; topic: string; date: string; worker_ids: string[] }) => {
      return submitOrQueue({
        kind: 'rpc',
        fn: 'create_toolbox_talk',
        payload: {
          p_site_id: talk.site_id,
          p_topic: talk.topic,
          p_date: talk.date,
          p_worker_ids: talk.worker_ids,
        },
        description: `Toolbox talk: ${talk.topic}`,
      });
    },
  });
}
