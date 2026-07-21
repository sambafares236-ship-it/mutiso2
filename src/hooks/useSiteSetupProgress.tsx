import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SetupStep {
  id: 'workers' | 'foreman' | 'schedule' | 'attendance';
  label: string;
  description: string;
  done: boolean;
}

export interface SiteSetupProgress {
  steps: SetupStep[];
  completedCount: number;
  allDone: boolean;
}

/**
 * Drives the first-run checklist on a newly-activated site.
 *
 * A site goes active and lands the contractor on an empty dashboard: every
 * feature is available but nothing is set up, and nothing indicates what to do
 * first. These are the things that have to exist before the app does anything
 * useful - a roster to mark attendance against, a foreman to do the marking,
 * and one real day logged.
 *
 * The schedule step is Pro-only and deliberately conditional. `activity` is
 * gated by owns_pro_site(), so on a field_ops site inserting one is rejected
 * by RLS. Listing it there would hand a new contractor a checklist item they
 * physically cannot complete, which is worse than not mentioning it at all.
 *
 * Counts only (`head: true`), never rows: this runs on the dashboard for the
 * contractor's first site and only needs existence, so there's no reason to
 * pull worker or activity payloads to check `length > 0`.
 */
export function useSiteSetupProgress(siteId: string | undefined, tier?: 'field_ops' | 'pro') {
  return useQuery({
    queryKey: ['siteSetupProgress', siteId, tier],
    queryFn: async (): Promise<SiteSetupProgress> => {
      if (!siteId) {
        return { steps: [], completedCount: 0, allDone: false };
      }
      const isPro = tier === 'pro';

      const countOf = async (
        table: 'workers_master' | 'activity' | 'attendance_log',
      ): Promise<number> => {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId);
        if (error) throw error;
        return count ?? 0;
      };

      const [workers, activities, attendance, foremanRes] = await Promise.all([
        countOf('workers_master'),
        isPro ? countOf('activity') : Promise.resolve(0),
        countOf('attendance_log'),
        supabase
          .from('site_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', siteId)
          .eq('is_active', true),
      ]);

      if (foremanRes.error) throw foremanRes.error;

      const steps: SetupStep[] = [
        {
          id: 'workers',
          label: 'Add your workers',
          description: 'Build the roster attendance and payroll are calculated from.',
          done: workers > 0,
        },
        {
          id: 'foreman',
          label: 'Invite your foreman',
          description: 'They run the site day to day and log everything from their phone.',
          done: (foremanRes.count ?? 0) > 0,
        },
        // Pro only - see the note above: a field_ops site can't insert an
        // activity at all, so this step would be permanently unachievable.
        ...(isPro
          ? [
              {
                id: 'schedule' as const,
                label: 'Upload your schedule of works',
                description:
                  'Import a CSV to track progress and see if you are ahead or behind.',
                done: activities > 0,
              },
            ]
          : []),
        {
          id: 'attendance',
          label: 'Log your first day of attendance',
          description: 'Once a day is marked, the WhatsApp assistant can answer about your site.',
          done: attendance > 0,
        },
      ];

      const completedCount = steps.filter((s) => s.done).length;
      return { steps, completedCount, allDone: completedCount === steps.length };
    },
    enabled: !!siteId,
  });
}
