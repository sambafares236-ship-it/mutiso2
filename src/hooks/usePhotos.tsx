import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';

export type SitePhoto = Database['public']['Tables']['site_photos']['Row'];

export function useSitePhotos(siteId: string | undefined) {
  return useQuery({
    queryKey: ['sitePhotos', siteId],
    queryFn: async (): Promise<(SitePhoto & { url: string })[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('site_photos')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Bucket is private - each photo needs its own signed URL rather
      // than a public one.
      const withUrls = await Promise.all(
        (data ?? []).map(async (photo) => {
          const { data: signed } = await supabase.storage
            .from('site-photos')
            .createSignedUrl(photo.photo_url, 60 * 60);
          return { ...photo, url: signed?.signedUrl ?? '' };
        }),
      );
      return withUrls;
    },
    enabled: !!siteId,
  });
}

// Photo upload is not offline-queued - unlike the other Stage 2 forms, a
// multi-megabyte file can't reasonably sit in IndexedDB waiting for
// reconnect the same way a small JSON payload can. Foreman is expected to
// retry when back online; the other forms (attendance/materials/diary)
// are the ones designed for spotty-connectivity capture.
export function useUploadPhoto() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      siteId,
      file,
      category,
      caption,
      diaryId,
    }: {
      siteId: string;
      file: File;
      category: string;
      caption?: string;
      /** Links this photo to a site_diary_log entry - the entry's own
       * description doubles as the caption everywhere these grouped
       * photos are shown, so per-photo caption is normally omitted here. */
      diaryId?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${siteId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from('site-photos').upload(path, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('site_photos').insert({
        site_id: siteId,
        photo_url: path,
        category,
        caption: caption || null,
        uploaded_by: user.id,
        diary_id: diaryId || null,
      });
      if (insertError) throw insertError;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sitePhotos', variables.siteId] });
      if (variables.diaryId) {
        queryClient.invalidateQueries({ queryKey: ['siteReport'] });
      }
    },
  });
}
