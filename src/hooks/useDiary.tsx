import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useOfflineQueue } from './useOfflineQueue';

export type DiaryEntry = Database['public']['Tables']['site_diary_log']['Row'];

export function useSiteDiary(siteId: string | undefined) {
  return useQuery({
    queryKey: ['siteDiary', siteId],
    queryFn: async (): Promise<DiaryEntry[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('site_diary_log')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

// Groups every diary entry linked to an activity, in one query - avoids an
// N+1 of per-activity queries when the Activities detail view wants to
// show each row's linked diary feed (a site can easily have 50+ activities
// once a real schedule is uploaded).
export function useDiaryEntriesByActivity(siteId: string | undefined) {
  return useQuery({
    queryKey: ['diaryByActivity', siteId],
    queryFn: async (): Promise<Record<string, DiaryEntry[]>> => {
      if (!siteId) return {};
      const { data, error } = await supabase
        .from('site_diary_log')
        .select('*')
        .eq('site_id', siteId)
        .not('activity_id', 'is', null)
        .order('date', { ascending: false });
      if (error) throw error;
      const grouped: Record<string, DiaryEntry[]> = {};
      for (const entry of data || []) {
        if (!entry.activity_id) continue;
        (grouped[entry.activity_id] ??= []).push(entry);
      }
      return grouped;
    },
    enabled: !!siteId,
  });
}

export function useAddDiaryEntry() {
  const { user } = useAuth();
  const { submitOrQueue } = useOfflineQueue();

  return useMutation({
    // See useMarkPresent for why networkMode: 'always' is required on
    // every offline-queue-backed mutation.
    networkMode: 'always',
    mutationFn: async (entry: {
      site_id: string;
      date: string;
      category: string;
      title: string;
      description?: string;
      activity_id?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      return submitOrQueue({
        kind: 'insert',
        table: 'site_diary_log',
        payload: { ...entry, created_by: user.id },
        description: 'Site diary entry',
      });
    },
  });
}
