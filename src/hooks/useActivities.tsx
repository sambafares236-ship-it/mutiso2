import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';

export type Activity = Database['public']['Tables']['activity']['Row'];
export type ActivityDependency = Database['public']['Tables']['activity_dependency']['Row'];

export function useSiteActivities(siteId: string | undefined) {
  return useQuery({
    queryKey: ['activities', siteId],
    queryFn: async (): Promise<Activity[]> => {
      if (!siteId) return [];
      const { data, error } = await supabase
        .from('activity')
        .select('*')
        .eq('site_id', siteId)
        .order('activity_code', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!siteId,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    // RLS only allows the site owner to insert - a foreman attempting this
    // gets a policy-violation error, not a silently-ignored write.
    mutationFn: async (activity: {
      site_id: string;
      created_by: string;
      name: string;
      activity_code?: string;
      description?: string;
      parent_id?: string;
      planned_start?: string;
      planned_end?: string;
      responsible_party?: string;
    }) => {
      const { data, error } = await supabase.from('activity').insert(activity).select().single();
      if (error) throw error;
      return data as Activity;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities', variables.site_id] });
    },
  });
}

// Single generic update - the DB trigger (enforce_activity_structural_lock)
// is what actually decides whether a given field change is allowed for the
// caller, not this hook. A foreman's UI only ever calls this with progress
// fields; a contractor's UI can pass structural fields too - if a foreman
// somehow did send a structural field, RLS/the trigger rejects it.
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: Partial<Activity> & { id: string; site_id: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase.from('activity').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['scheduleProgress', variables.site_id] });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; site_id: string }) => {
      const { error } = await supabase.from('activity').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities', variables.site_id] });
    },
  });
}

// Orders a flat activity list into depth-first tree order (each parent
// immediately followed by its children, recursively) and annotates each
// row with its nesting depth - used to render the WBS as an actual tree
// instead of a flat activity_code sort, once parent_id has been populated
// (by manual "Add activity" nesting or by an uploaded schedule's Outline
// Number hierarchy).
export function buildActivityTree(activities: Activity[]): Array<Activity & { depth: number }> {
  const byParent = new Map<string | null, Activity[]>();
  for (const a of activities) {
    const key = a.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(a);
  }
  const sortSiblings = (list: Activity[]) =>
    [...list].sort((a, b) => (a.activity_code ?? '').localeCompare(b.activity_code ?? '', undefined, { numeric: true }));

  const result: Array<Activity & { depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const child of sortSiblings(byParent.get(parentId) ?? [])) {
      result.push({ ...child, depth });
      visit(child.id, depth + 1);
    }
  };
  visit(null, 0);

  // Defensive fallback only - parent_id cascades on delete, so an activity
  // referencing a missing parent shouldn't normally occur.
  const visited = new Set(result.map((a) => a.id));
  for (const a of activities) {
    if (!visited.has(a.id)) result.push({ ...a, depth: 0 });
  }
  return result;
}

export interface UploadedActivity {
  name: string;
  activity_code?: string;
  planned_start?: string;
  planned_end?: string;
  responsible_party?: string;
}

// Bulk-replaces the site's whole WBS from an uploaded schedule of works -
// see replace_site_activities() in the migration for why this has to be
// one atomic RPC rather than a client-side delete-then-insert.
export function useReplaceActivities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ site_id, activities }: { site_id: string; activities: UploadedActivity[] }) => {
      const { data, error } = await supabase.rpc('replace_site_activities', {
        p_site_id: site_id,
        p_activities: activities as unknown as Json,
      });
      if (error) throw error;
      return data as number; // count inserted
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities', variables.site_id] });
      queryClient.invalidateQueries({ queryKey: ['scheduleProgress', variables.site_id] });
    },
  });
}

export function useActivityDependencies(activityId: string | undefined) {
  return useQuery({
    queryKey: ['activityDependencies', activityId],
    queryFn: async (): Promise<ActivityDependency[]> => {
      if (!activityId) return [];
      const { data, error } = await supabase.from('activity_dependency').select('*').eq('activity_id', activityId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!activityId,
  });
}

export function useAddActivityDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ activity_id, depends_on_id }: { activity_id: string; depends_on_id: string }) => {
      const { error } = await supabase.from('activity_dependency').insert({ activity_id, depends_on_id });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activityDependencies', variables.activity_id] });
    },
  });
}
