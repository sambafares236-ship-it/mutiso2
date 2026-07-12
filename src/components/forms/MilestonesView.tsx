import { toast } from 'sonner';
import { Flag, X, CheckCircle2, Circle, PlayCircle, Sparkles } from 'lucide-react';
import { useSiteMilestones, useUpdateMilestoneStatus } from '@/hooks/useMilestones';
import { useSiteActivities } from '@/hooks/useActivities';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface MilestonesViewProps {
  siteId: string;
  onClose: () => void;
}

export function MilestonesView({ siteId, onClose }: MilestonesViewProps) {
  const { data: milestones, isLoading } = useSiteMilestones(siteId);
  const { data: activities } = useSiteActivities(siteId);
  const updateStatus = useUpdateMilestoneStatus();

  // "Ready to sign off" is a nudge, not an automatic status change - a
  // milestone completing sets signed_off_at/inspected_by (a real
  // compliance record via enforce_milestone_sequence), so it should only
  // ever happen from someone actually clicking Sign Off, never silently
  // because every linked activity happened to reach 100%.
  const readiness = new Map<string, { total: number; done: number }>();
  for (const activity of activities ?? []) {
    if (!activity.milestone_id) continue;
    const entry = readiness.get(activity.milestone_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (activity.percent_complete >= 100) entry.done += 1;
    readiness.set(activity.milestone_id, entry);
  }

  const handleUpdate = async (milestoneId: string, status: 'in_progress' | 'completed', name: string) => {
    try {
      await updateStatus.mutateAsync({ milestoneId, status });
      toast.success(status === 'completed' ? `${name} signed off` : `${name} started`);
    } catch (err) {
      // The sequence gate (enforce_milestone_sequence trigger) rejects
      // out-of-order transitions with a Postgres exception, surfaced here.
      toast.error('Cannot update milestone', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-lg mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Flag className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">MILESTONES</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {milestones?.map((milestone) => {
              const isCompleted = milestone.status === 'completed';
              const isInProgress = milestone.status === 'in_progress';
              const r = readiness.get(milestone.id);
              const readyToSignOff = !!r && r.total > 0 && r.done === r.total && !isCompleted;
              return (
                <div
                  key={milestone.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 ${
                    isCompleted ? 'border-success bg-success/10' : isInProgress ? 'border-warning bg-warning/10' : 'border-border bg-card'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0" />
                  ) : isInProgress ? (
                    <PlayCircle className="w-6 h-6 text-warning flex-shrink-0" />
                  ) : (
                    <Circle className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{milestone.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{milestone.status.replace('_', ' ')}</p>
                    {r && r.total > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {r.done}/{r.total} linked activities complete
                      </p>
                    )}
                    {readyToSignOff && (
                      <p className="flex items-center gap-1 text-xs text-primary font-medium mt-0.5">
                        <Sparkles className="w-3.5 h-3.5" /> Ready to sign off
                      </p>
                    )}
                  </div>
                  {milestone.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdate(milestone.id, 'in_progress', milestone.name)}
                      disabled={updateStatus.isPending}
                    >
                      Start
                    </Button>
                  )}
                  {milestone.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="construction"
                      onClick={() => handleUpdate(milestone.id, 'completed', milestone.name)}
                      disabled={updateStatus.isPending}
                    >
                      Sign Off
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
