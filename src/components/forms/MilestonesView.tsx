import { useState } from 'react';
import { toast } from 'sonner';
import { Flag, X, CheckCircle2, Circle, PlayCircle, Sparkles, Plus, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useSiteMilestones, useUpdateMilestoneStatus, useCreateMilestone, useDeleteMilestone } from '@/hooks/useMilestones';
import { useSiteActivities } from '@/hooks/useActivities';
import { useSitePermits, PERMIT_TYPE_LABELS } from '@/hooks/usePermits';
import { useSiteDefects } from '@/hooks/useDefects';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface MilestonesViewProps {
  siteId: string;
  onClose: () => void;
}

export function MilestonesView({ siteId, onClose }: MilestonesViewProps) {
  const { isContractor } = useAuth();
  const { data: milestones, isLoading } = useSiteMilestones(siteId);
  const { data: activities } = useSiteActivities(siteId);
  const { data: permits } = useSitePermits(siteId);
  const { data: defects } = useSiteDefects(siteId);
  const updateStatus = useUpdateMilestoneStatus();
  const createMilestone = useCreateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [newMilestoneName, setNewMilestoneName] = useState('');

  // "Ready to sign off" is a nudge, not an automatic status change - a
  // milestone completing sets signed_off_at/inspected_by (a real
  // compliance record via enforce_milestone_sequence), so it should only
  // ever happen from someone actually clicking Sign Off. Folds in two
  // rule-based signals from foreman field data (approved permits, open
  // defects) alongside the existing linked-activity progress - all three
  // are advisory only, none of them write anything on their own.
  const activityMilestone = new Map<string, string>(); // activity id -> milestone id
  const readiness = new Map<string, { total: number; done: number }>();
  for (const activity of activities ?? []) {
    if (!activity.milestone_id) continue;
    activityMilestone.set(activity.id, activity.milestone_id);
    const entry = readiness.get(activity.milestone_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (activity.percent_complete >= 100) entry.done += 1;
    readiness.set(activity.milestone_id, entry);
  }

  const approvedPermitsByMilestone = new Map<string, typeof permits>();
  for (const permit of permits ?? []) {
    if (!permit.milestone_id || permit.status !== 'approved') continue;
    const list = approvedPermitsByMilestone.get(permit.milestone_id) ?? [];
    list.push(permit);
    approvedPermitsByMilestone.set(permit.milestone_id, list);
  }

  const openDefectCountByMilestone = new Map<string, number>();
  for (const defect of defects ?? []) {
    if (!defect.activity_id || defect.status === 'resolved') continue;
    const milestoneId = activityMilestone.get(defect.activity_id);
    if (!milestoneId) continue;
    openDefectCountByMilestone.set(milestoneId, (openDefectCountByMilestone.get(milestoneId) ?? 0) + 1);
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

  const handleAddMilestone = async () => {
    const name = newMilestoneName.trim();
    if (!name) return;
    const nextSequence = Math.max(0, ...(milestones ?? []).map((m) => m.sequence)) + 1;
    try {
      await createMilestone.mutateAsync({ site_id: siteId, name, sequence: nextSequence });
      toast.success(`${name} added`);
      setNewMilestoneName('');
    } catch (err) {
      toast.error('Could not add milestone', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDeleteMilestone = async (milestoneId: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteMilestone.mutateAsync({ id: milestoneId, site_id: siteId });
      toast.success(`${name} deleted`);
    } catch (err) {
      toast.error('Could not delete milestone', { description: err instanceof Error ? err.message : undefined });
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
              const approvedPermits = approvedPermitsByMilestone.get(milestone.id) ?? [];
              const openDefectCount = openDefectCountByMilestone.get(milestone.id) ?? 0;
              const activitiesReady = !!r && r.total > 0 && r.done === r.total;
              const readyToSignOff = activitiesReady && openDefectCount === 0 && !isCompleted;
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{milestone.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{milestone.status.replace('_', ' ')}</p>
                    {r && r.total > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {r.done}/{r.total} linked activities complete
                      </p>
                    )}
                    {approvedPermits.map((permit) => (
                      <p key={permit.id} className="flex items-center gap-1 text-xs text-success mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                        {PERMIT_TYPE_LABELS[permit.permit_type] ?? permit.permit_type} permit approved
                      </p>
                    ))}
                    {openDefectCount > 0 && (
                      <p className="flex items-center gap-1 text-xs text-warning mt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        {openDefectCount} open defect{openDefectCount > 1 ? 's' : ''} linked
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
                  {isContractor && milestone.status === 'pending' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteMilestone(milestone.id, milestone.name)}
                      disabled={deleteMilestone.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}

            {isContractor && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="Add a custom milestone stage..."
                  value={newMilestoneName}
                  onChange={(e) => setNewMilestoneName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMilestone();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={handleAddMilestone}
                  disabled={createMilestone.isPending || !newMilestoneName.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
