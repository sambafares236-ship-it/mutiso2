import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { X, ListTree, TrendingUp, TrendingDown, Minus, Plus, Save, ChevronDown, ChevronUp, BookText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSiteActivities, useCreateActivity, useUpdateActivity, buildActivityTree, type Activity } from '@/hooks/useActivities';
import { useScheduleProgress, type ScheduleClassification } from '@/hooks/useScheduleProgress';
import { useSiteMilestones, type Milestone } from '@/hooks/useMilestones';
import { useDiaryEntriesByActivity, type DiaryEntry } from '@/hooks/useDiary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScheduleGanttChart } from '@/components/ScheduleGanttChart';

interface ScheduleDetailViewProps {
  siteId: string;
  onClose: () => void;
}

const NO_MILESTONE = '__none__';

const activitySchema = z.object({
  name: z.string().min(1, 'Activity name is required'),
  activity_code: z.string().optional(),
  planned_start: z.string().optional(),
  planned_end: z.string().optional(),
  responsible_party: z.string().optional(),
});
type ActivityFormValues = z.infer<typeof activitySchema>;

const CLASSIFICATION_STYLE: Record<ScheduleClassification, { label: string; className: string; Icon: typeof TrendingUp }> = {
  ahead: { label: 'Ahead', className: 'text-success bg-success/10 border-success/30', Icon: TrendingUp },
  on_track: { label: 'On track', className: 'text-muted-foreground bg-secondary border-border', Icon: Minus },
  behind: { label: 'Behind', className: 'text-destructive bg-destructive/10 border-destructive/30', Icon: TrendingDown },
  unknown: { label: 'No baseline data', className: 'text-muted-foreground bg-secondary border-border', Icon: Minus },
};

function ActivityRow({
  siteId,
  activity,
  diaryEntries,
  milestones,
}: {
  siteId: string;
  activity: Activity;
  diaryEntries: DiaryEntry[];
  milestones: Milestone[];
}) {
  const { isContractor } = useAuth();
  const updateActivity = useUpdateActivity();
  const [percent, setPercent] = useState(activity.percent_complete);
  const [showDiary, setShowDiary] = useState(false);

  const handleSaveProgress = async () => {
    try {
      await updateActivity.mutateAsync({
        id: activity.id,
        site_id: siteId,
        percent_complete: percent,
        status: percent >= 100 ? 'completed' : percent > 0 ? 'in_progress' : 'not_started',
        actual_start: activity.actual_start ?? (percent > 0 ? new Date().toISOString().split('T')[0] : null),
        actual_end: percent >= 100 ? new Date().toISOString().split('T')[0] : activity.actual_end,
      });
      toast.success(`${activity.name} updated`);
    } catch (err) {
      toast.error('Could not update activity', { description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleMilestoneChange = async (milestoneId: string) => {
    try {
      await updateActivity.mutateAsync({
        id: activity.id,
        site_id: siteId,
        milestone_id: milestoneId === NO_MILESTONE ? null : milestoneId,
      });
    } catch (err) {
      toast.error('Could not assign milestone', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground text-sm">
            {activity.activity_code && <span className="text-muted-foreground mr-1">{activity.activity_code}</span>}
            {activity.name}
          </p>
          {(activity.planned_start || activity.planned_end) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Planned: {activity.planned_start ?? '—'} → {activity.planned_end ?? '—'}
            </p>
          )}
          {activity.responsible_party && <p className="text-xs text-muted-foreground">{activity.responsible_party}</p>}
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground whitespace-nowrap capitalize">
          {activity.status.replace('_', ' ')}
        </span>
      </div>

      {isContractor && (
        <div className="mt-2">
          <Select value={activity.milestone_id ?? NO_MILESTONE} onValueChange={handleMilestoneChange}>
            <SelectTrigger className="h-7 text-xs w-fit gap-1">
              <SelectValue placeholder="Assign to milestone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MILESTONE}>No milestone</SelectItem>
              {milestones.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <Input
          type="number"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => setPercent(Math.max(0, Math.min(100, Number(e.target.value))))}
          className="w-20 h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">% complete</span>
        <Button size="sm" variant="outline" className="ml-auto h-8" onClick={handleSaveProgress} disabled={updateActivity.isPending}>
          <Save className="w-3.5 h-3.5" />
        </Button>
      </div>

      {diaryEntries.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => setShowDiary((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <BookText className="w-3.5 h-3.5" />
            {diaryEntries.length} diary {diaryEntries.length === 1 ? 'entry' : 'entries'}
            {showDiary ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showDiary && (
            <div className="mt-2 space-y-2">
              {diaryEntries.map((entry) => (
                <div key={entry.id} className="text-xs bg-secondary rounded-md p-2">
                  <p className="text-foreground font-medium">
                    {entry.title} <span className="text-muted-foreground font-normal">· {entry.date}</span>
                  </p>
                  {entry.description && <p className="text-muted-foreground mt-0.5">{entry.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ScheduleDetailView({ siteId, onClose }: ScheduleDetailViewProps) {
  const { isContractor, user } = useAuth();
  const { data: activities, isLoading } = useSiteActivities(siteId);
  const { data: progress } = useScheduleProgress(siteId);
  const { data: milestones } = useSiteMilestones(siteId);
  const { data: diaryByActivity } = useDiaryEntriesByActivity(siteId);
  const createActivity = useCreateActivity();
  const [showAddForm, setShowAddForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({ resolver: zodResolver(activitySchema) });

  const onSubmit = async (values: ActivityFormValues) => {
    if (!user) return;
    try {
      await createActivity.mutateAsync({
        site_id: siteId,
        created_by: user.id,
        name: values.name,
        activity_code: values.activity_code || undefined,
        planned_start: values.planned_start || undefined,
        planned_end: values.planned_end || undefined,
        responsible_party: values.responsible_party || undefined,
      });
      toast.success('Activity added');
      reset();
      setShowAddForm(false);
    } catch (err) {
      toast.error('Could not add activity', { description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="container max-w-2xl mx-auto px-4 py-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/20 rounded-xl">
              <ListTree className="w-6 h-6 text-primary" />
            </div>
            <h2 className="font-display text-3xl text-primary">ACTIVITIES</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Timeline</p>
              <ScheduleGanttChart activities={activities ?? []} progressItems={progress?.items ?? []} />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">All activities</p>
              {buildActivityTree(activities ?? []).map((activity) => {
                const item = progress?.items.find((i) => i.activityId === activity.id);
                const style = CLASSIFICATION_STYLE[item?.classification ?? 'unknown'];
                return (
                  <div key={activity.id} className="space-y-1" style={{ marginLeft: `${activity.depth * 16}px` }}>
                    {item && (
                      <div className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${style.className}`}>
                        <style.Icon className="w-3 h-3" />
                        {style.label}
                      </div>
                    )}
                    <ActivityRow
                      siteId={siteId}
                      activity={activity}
                      diaryEntries={diaryByActivity?.[activity.id] ?? []}
                      milestones={milestones ?? []}
                    />
                  </div>
                );
              })}
              {!activities?.length && <p className="text-sm text-muted-foreground">No activities yet.</p>}
            </div>

            {isContractor && (
              <div>
                {showAddForm ? (
                  <form onSubmit={handleSubmit(onSubmit)} className="p-3 border border-dashed border-border rounded-lg space-y-2" noValidate>
                    <Input placeholder="Activity name" {...register('name')} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Code (e.g. 1.1)" {...register('activity_code')} />
                      <Input placeholder="Responsible party" {...register('responsible_party')} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Planned start</Label>
                        <Input type="date" {...register('planned_start')} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Planned end</Label>
                        <Input type="date" {...register('planned_end')} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" variant="construction" disabled={isSubmitting}>
                        Add
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
                    <Plus className="w-4 h-4 mr-1" /> Add activity
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
