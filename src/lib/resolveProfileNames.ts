import { supabase } from '@/integrations/supabase/client';

export async function resolveProfileNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email_address')
    .in('id', uniqueIds);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const profile of data || []) {
    map.set(profile.id, profile.full_name || profile.email_address || profile.id);
  }
  return map;
}
