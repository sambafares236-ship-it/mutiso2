import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Activity } from './useActivities';
import type { ScheduleBaseline, ScheduleBaselineActivity } from './useScheduleBaseline';

export type ScheduleClassification = 'ahead' | 'on_track' | 'behind' | 'unknown';

export interface ScheduleProgressItem {
  activityId: string | null;
  name: string;
  activityCode: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  percentComplete: number | null;
  status: string | null;
  classification: ScheduleClassification;
  delayDays: number | null;
}

export interface ScheduleProgressSummary {
  baseline: ScheduleBaseline | null;
  items: ScheduleProgressItem[];
  ahead: number;
  onTrack: number;
  behind: number;
  unknown: number;
  mostDelayed: ScheduleProgressItem | null;
}

const ON_TRACK_BUFFER_PERCENT = 5;

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / msPerDay);
}

// Classifies one activity against its baseline snapshot. Deliberately not
// a critical-path (CPM) calculation - just compares this single activity's
// baseline dates to its own live progress. See useScheduleProgress's
// module comment for why that's an acceptable v1 simplification.
function classify(baselineItem: ScheduleBaselineActivity, live: Activity | undefined): ScheduleProgressItem {
  const base: Omit<ScheduleProgressItem, 'classification' | 'delayDays'> = {
    activityId: baselineItem.activity_id,
    name: baselineItem.name,
    activityCode: baselineItem.activity_code,
    plannedStart: baselineItem.planned_start,
    plannedEnd: baselineItem.planned_end,
    actualStart: live?.actual_start ?? null,
    actualEnd: live?.actual_end ?? null,
    percentComplete: live?.percent_complete ?? null,
    status: live?.status ?? null,
  };

  if (!live || !baselineItem.planned_start || !baselineItem.planned_end) {
    return { ...base, classification: 'unknown', delayDays: null };
  }

  if (live.actual_end) {
    const delayDays = daysBetween(baselineItem.planned_end, live.actual_end);
    return { ...base, classification: delayDays > 0 ? 'behind' : delayDays < 0 ? 'ahead' : 'on_track', delayDays };
  }

  const totalSpan = daysBetween(baselineItem.planned_start, baselineItem.planned_end);
  if (totalSpan <= 0) {
    return { ...base, classification: 'unknown', delayDays: null };
  }
  const elapsed = daysBetween(baselineItem.planned_start, new Date().toISOString().split('T')[0]);
  const expectedPercent = Math.max(0, Math.min(100, (elapsed / totalSpan) * 100));
  const actualPercent = live.percent_complete ?? 0;
  const percentGap = actualPercent - expectedPercent;
  // Map the percent gap back into an approximate day count so completed
  // and in-progress activities share one comparable "delay" unit.
  const delayDays = Math.round((-percentGap / 100) * totalSpan);

  const classification: ScheduleClassification =
    percentGap >= ON_TRACK_BUFFER_PERCENT ? 'ahead' : percentGap <= -ON_TRACK_BUFFER_PERCENT ? 'behind' : 'on_track';

  return { ...base, classification, delayDays };
}

export function useScheduleProgress(siteId: string | undefined) {
  return useQuery({
    queryKey: ['scheduleProgress', siteId],
    queryFn: async (): Promise<ScheduleProgressSummary> => {
      if (!siteId) {
        return { baseline: null, items: [], ahead: 0, onTrack: 0, behind: 0, unknown: 0, mostDelayed: null };
      }

      const { data: baseline, error: baselineError } = await supabase
        .from('schedule_baseline')
        .select('*')
        .eq('site_id', siteId)
        .order('locked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (baselineError) throw baselineError;

      if (!baseline) {
        return { baseline: null, items: [], ahead: 0, onTrack: 0, behind: 0, unknown: 0, mostDelayed: null };
      }

      const [{ data: baselineActivities, error: baError }, { data: liveActivities, error: liveError }] = await Promise.all([
        supabase.from('schedule_baseline_activity').select('*').eq('baseline_id', baseline.id),
        supabase.from('activity').select('*').eq('site_id', siteId),
      ]);
      if (baError) throw baError;
      if (liveError) throw liveError;

      const liveById = new Map((liveActivities || []).map((a) => [a.id, a]));
      const items = (baselineActivities || []).map((ba) =>
        classify(ba, ba.activity_id ? liveById.get(ba.activity_id) : undefined),
      );

      const ahead = items.filter((i) => i.classification === 'ahead').length;
      const onTrack = items.filter((i) => i.classification === 'on_track').length;
      const behind = items.filter((i) => i.classification === 'behind').length;
      const unknown = items.filter((i) => i.classification === 'unknown').length;

      const mostDelayed = items
        .filter((i) => i.classification === 'behind' && i.delayDays !== null)
        .sort((a, b) => (b.delayDays ?? 0) - (a.delayDays ?? 0))[0] ?? null;

      return { baseline, items, ahead, onTrack, behind, unknown, mostDelayed };
    },
    enabled: !!siteId,
  });
}
